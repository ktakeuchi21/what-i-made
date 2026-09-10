(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeCountryCombobox = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalize(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function searchCountries(countries, query, limit = 8) {
    const needle = normalize(query);
    if (!needle) return [];
    return (countries || []).flatMap((country) => {
      const name = normalize(country.name);
      const aliases = [...new Set([country.name, ...(country.aliases || [])].map(normalize).filter(Boolean))];
      let rank = Number.POSITIVE_INFINITY;
      if (name === needle) rank = 0;
      else if (aliases.includes(needle)) rank = 1;
      else if (name.startsWith(needle)) rank = 2;
      else if (aliases.some((alias) => alias.startsWith(needle))) rank = 3;
      else if (aliases.some((alias) => alias.split(" ").some((word) => word.startsWith(needle)))) rank = 4;
      else if (aliases.some((alias) => alias.includes(needle))) rank = 5;
      return Number.isFinite(rank) ? [{ country, rank }] : [];
    }).sort((left, right) => left.rank - right.rank || left.country.name.localeCompare(right.country.name))
      .slice(0, Math.max(0, limit)).map(({ country }) => country);
  }

  function selectionStatus(geography, { value, selectedKey = "", userEdited = false, allowPristineUnresolved = false } = {}) {
    const text = String(value || "").trim();
    if (!text) return { valid: true, country: null, preserved: false };
    const selected = selectedKey ? geography?.countries?.find((country) => country.key === selectedKey) : null;
    if (selected && normalize(text) === normalize(selected.name)) return { valid: true, country: selected, preserved: false };
    if (allowPristineUnresolved && !userEdited) return { valid: true, country: null, preserved: true };
    return { valid: false, country: null, preserved: false };
  }

  function create(input, geography, options = {}) {
    if (!input || !geography?.countries || !geography?.findCountry) throw new Error("Country autocomplete requires an input and geography catalog.");
    if (input._countryCombobox) return input._countryCombobox;

    const document = input.ownerDocument;
    const wrapper = document.createElement("div");
    const list = document.createElement("ul");
    const error = document.createElement("p");
    const listId = `${input.id || "country"}-country-options`;
    const errorId = `${input.id || "country"}-country-error`;
    let matches = [];
    let activeIndex = -1;
    let selectedKey = "";
    let userEdited = false;

    wrapper.className = "country-combobox";
    list.className = "country-combobox-list";
    list.id = listId;
    list.role = "listbox";
    list.hidden = true;
    error.className = "field-error country-combobox-error";
    error.id = errorId;
    error.setAttribute("role", "alert");
    error.textContent = options.errorMessage || "Choose a country from the suggestions, or leave this blank.";
    error.hidden = true;
    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(input, list, error);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocomplete", "off");
    const describedBy = new Set(String(input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    describedBy.add(errorId);
    input.setAttribute("aria-describedby", [...describedBy].join(" "));

    function close() {
      matches = [];
      activeIndex = -1;
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function setActive(index) {
      if (!matches.length) return;
      activeIndex = (index + matches.length) % matches.length;
      [...list.children].forEach((item, itemIndex) => {
        const active = itemIndex === activeIndex;
        item.setAttribute("aria-selected", String(active));
        item.classList.toggle("is-active", active);
        if (active) {
          input.setAttribute("aria-activedescendant", item.id);
          item.scrollIntoView?.({ block: "nearest" });
        }
      });
    }

    function commit(country, notify = true) {
      input.value = country?.name || "";
      selectedKey = country?.key || "";
      if (selectedKey) input.dataset.countryKey = selectedKey;
      else delete input.dataset.countryKey;
      input.removeAttribute("aria-invalid");
      error.hidden = true;
      close();
      if (notify) {
        userEdited = true;
        input.dispatchEvent(new CustomEvent("countrycommit", { bubbles: true, detail: { country: country || null } }));
      }
    }

    function render() {
      matches = searchCountries(geography.countries, input.value, options.limit || 8);
      activeIndex = -1;
      list.replaceChildren();
      matches.forEach((country, index) => {
        const item = document.createElement("li");
        item.id = `${listId}-${index}`;
        item.role = "option";
        item.setAttribute("aria-selected", "false");
        item.textContent = country.name;
        item.addEventListener("pointerdown", (event) => event.preventDefault());
        item.addEventListener("click", () => {
          commit(country);
          input.focus();
        });
        list.append(item);
      });
      list.hidden = !matches.length;
      input.setAttribute("aria-expanded", String(Boolean(matches.length)));
    }

    function validate() {
      const result = selectionStatus(geography, { value: input.value, selectedKey, userEdited, allowPristineUnresolved: Boolean(options.allowPristineUnresolved) });
      if (result.valid) {
        if (!result.preserved) commit(result.country, false);
        input.removeAttribute("aria-invalid");
        error.hidden = true;
        return true;
      }
      selectedKey = "";
      delete input.dataset.countryKey;
      input.setAttribute("aria-invalid", "true");
      error.hidden = false;
      return false;
    }

    function setValue(value) {
      const country = geography.findCountry(value);
      if (country) {
        commit(country, false);
        userEdited = false;
      }
      else {
        input.value = String(value || "");
        selectedKey = "";
        userEdited = false;
        delete input.dataset.countryKey;
        input.removeAttribute("aria-invalid");
        error.hidden = true;
        close();
      }
    }

    input.addEventListener("input", () => {
      selectedKey = "";
      userEdited = true;
      delete input.dataset.countryKey;
      input.removeAttribute("aria-invalid");
      error.hidden = true;
      render();
    });
    input.addEventListener("focus", render);
    input.addEventListener("blur", () => {
      window.setTimeout(() => {
        validate();
        close();
      }, 0);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (list.hidden) render();
        if (matches.length) {
          event.preventDefault();
          setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
        }
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        commit(matches[activeIndex]);
      } else if (event.key === "Escape" && !list.hidden) {
        event.preventDefault();
        close();
      }
    });

    const controller = {
      close, setValue, validate,
      get country() { return selectedKey ? geography.countries.find((country) => country.key === selectedKey) || null : null; },
      get isDirty() { return userEdited; },
    };
    input._countryCombobox = controller;
    setValue(input.value);
    return controller;
  }

  return { normalize, searchCountries, selectionStatus, create };
});
