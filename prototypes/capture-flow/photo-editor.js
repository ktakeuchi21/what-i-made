(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadePhotoEditor = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function createDraft({ processPhoto, onChange = () => {}, createUrl = (blob) => URL.createObjectURL(blob), revokeUrl = (url) => URL.revokeObjectURL(url), minimum = 0 } = {}) {
    let items = [];
    let version = 0;
    let sequence = 0;
    let busy = false;
    let changed = false;
    let message = "";
    let error = false;
    const notify = () => onChange(api);
    const release = (item) => { if (item.url) revokeUrl(item.url); };
    const prepare = (photo) => ({ ...photo, key: `photo-${++sequence}`, url: createUrl(photo.thumbnailBlob || photo.blob) });
    const api = {
      get items() { return items.slice(); },
      get busy() { return busy; },
      get changed() { return changed; },
      get message() { return message; },
      get error() { return error; },
      values() { return items.map(({ key, url, ...photo }) => ({ ...photo })); },
      reset(photos = []) {
        version += 1;
        items.forEach(release);
        items = photos.map(prepare);
        busy = false; changed = false; message = ""; error = false;
        notify();
      },
      remove(key) {
        if (busy || items.length <= minimum) return;
        const item = items.find((candidate) => candidate.key === key);
        if (!item) return;
        release(item);
        items = items.filter((candidate) => candidate !== item);
        changed = true; message = "Photo removed from this draft."; error = false;
        notify();
      },
      makeMain(key) {
        if (busy) return;
        const index = items.findIndex((item) => item.key === key);
        if (index <= 0) return;
        items.unshift(items.splice(index, 1)[0]);
        changed = true; message = "Main photo updated in this draft."; error = false;
        notify();
      },
      async add(files, replaceKey = null) {
        if (busy || !files?.length) return false;
        const request = ++version;
        busy = true; error = false;
        const prepared = [];
        try {
          for (const [index, file] of Array.from(files).entries()) {
            message = `Preparing photo ${index + 1} of ${files.length} on this device…`;
            notify();
            if (!(file instanceof Blob) || !file.size || (file.type && !file.type.startsWith("image/"))) throw new Error("Choose image files from your camera or photo library.");
            prepared.push(await processPhoto(file));
            if (request !== version) return false;
          }
          if (replaceKey) {
            const index = items.findIndex((item) => item.key === replaceKey);
            if (index < 0) return false;
            const previous = items[index];
            const replacement = prepare({ ...previous, ...prepared[0], edited: true });
            replacement.key = previous.key;
            release(previous);
            items[index] = replacement;
          } else {
            items.push(...prepared.map((photo) => prepare({ ...photo, edited: true })));
          }
          changed = true;
          message = replaceKey ? "Replacement ready. Save to keep this change." : `${prepared.length} ${prepared.length === 1 ? "photo" : "photos"} added to this draft.`;
          return true;
        } catch (failure) {
          if (request !== version) return false;
          error = true;
          message = `${failure.message || "These photos could not be prepared."} Your previous photos are unchanged.`;
          return false;
        } finally {
          if (request === version) { busy = false; notify(); }
        }
      },
    };
    return api;
  }

  function mount(container, options = {}) {
    let disabled = false;
    let replacementKey = null;
    let pendingFocus = null;
    const controls = document.createElement("div");
    controls.className = "photo-editor-inputs";
    const inputs = [];
    const addInput = (labelText, suffix, camera = false) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      label.className = "button button-secondary file-button";
      label.append(labelText);
      input.type = "file"; input.accept = "image/*";
      input.id = `${options.idPrefix}-${suffix}`;
      input.setAttribute("aria-label", `${labelText} for ${options.label || "this cook"}`);
      if (camera) input.setAttribute("capture", "environment");
      else input.multiple = true;
      input.addEventListener("change", () => {
        const files = Array.from(input.files || []);
        input.value = "";
        if (!disabled) void draft.add(files);
      });
      label.append(input); controls.append(label); inputs.push(input);
      return input;
    };
    const cameraInput = addInput("Camera", "camera-input", true);
    const libraryInput = addInput("Add photos", "library-input");
    const hint = document.createElement("p");
    hint.className = "field-helper";
    hint.textContent = options.main === false
      ? "Choose several photos at once, or add more later. Photos are optional."
      : "Choose several photos at once. The main photo represents this cook.";
    const grid = document.createElement("div");
    grid.className = "photo-editor-grid";
    const status = document.createElement("p");
    status.className = "photo-editor-status field-helper";
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    const replacementInput = document.createElement("input");
    replacementInput.type = "file"; replacementInput.accept = "image/*"; replacementInput.hidden = true;
    replacementInput.id = `${options.idPrefix}-replace-input`;
    replacementInput.addEventListener("change", () => {
      const files = Array.from(replacementInput.files || []).slice(0, 1);
      replacementInput.value = "";
      if (!disabled) void draft.add(files, replacementKey);
    });
    container.classList.add("photo-editor");
    container.append(controls, hint, grid, status, replacementInput);
    const render = (model) => {
      const focused = grid.contains(document.activeElement) ? document.activeElement : null;
      if (focused) pendingFocus = { key: focused.dataset.key, action: focused.dataset.action };
      const focusKey = pendingFocus?.key;
      const focusAction = pendingFocus?.action;
      const focusIndex = model.items.findIndex((item) => item.key === focusKey);
      const locked = disabled || model.busy;
      inputs.forEach((input) => { input.disabled = locked; input.parentElement.setAttribute("aria-disabled", String(locked)); });
      replacementInput.disabled = locked;
      container.setAttribute("aria-busy", String(model.busy));
      grid.replaceChildren();
      model.items.forEach((item, index) => {
        const card = document.createElement("div");
        const image = document.createElement("img");
        const caption = document.createElement("p");
        const actions = document.createElement("div");
        card.className = "photo-editor-card";
        image.src = item.url; image.alt = `${options.label || "Cook"}, photo ${index + 1}`;
        image.width = 320; image.height = 240;
        caption.textContent = `Photo ${index + 1}${options.main !== false && index === 0 ? " · Main" : ""}`;
        const button = (text, action, handler, unavailable = false) => {
          const element = document.createElement("button");
          element.type = "button"; element.className = "text-button";
          element.textContent = text; element.dataset.key = item.key; element.dataset.action = action;
          element.setAttribute("aria-label", text === "Main photo" ? `Main photo ${index + 1}` : `${text} photo ${index + 1}`);
          element.disabled = locked || unavailable;
          element.addEventListener("click", handler);
          actions.append(element);
          return element;
        };
        if (options.main !== false) button(index === 0 ? "Main photo" : "Make main", "main", () => draft.makeMain(item.key), index === 0);
        button("Replace", "replace", () => { replacementKey = item.key; replacementInput.click(); });
        const remove = button("Remove", "remove", () => draft.remove(item.key), model.items.length <= (options.minimum || 0));
        remove.classList.add("danger-text");
        card.append(image, caption, actions); grid.append(card);
      });
      status.textContent = model.message || (options.minimum && model.items.length === 1 ? "Keep at least one photo. Add another before removing this one." : "");
      status.classList.toggle("is-error", model.error);
      if (pendingFocus && !locked) {
        const buttons = Array.from(grid.querySelectorAll("button"));
        const next = buttons.find((button) => button.dataset.key === focusKey && button.dataset.action === focusAction && !button.disabled)
          || buttons.find((button) => button.dataset.key === model.items[Math.max(0, focusIndex)]?.key && !button.disabled);
        (next || libraryInput).focus({ preventScroll: true });
        pendingFocus = null;
      }
    };
    const draft = createDraft({
      processPhoto: options.processPhoto || ((file) => window.WhatIMadePhotoProcessor.processPhoto(file)),
      minimum: options.minimum || 0,
      onChange(model) { render(model); options.onChange?.(model); },
    });
    render(draft);
    return {
      draft, cameraInput, libraryInput,
      setDisabled(value) { disabled = Boolean(value); render(draft); },
      destroy() { draft.reset(); container.replaceChildren(); },
    };
  }

  return { createDraft, mount };
});
