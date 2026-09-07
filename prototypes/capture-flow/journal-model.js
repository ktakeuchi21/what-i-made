(function (root, factory) {
  const geography = typeof module === "object" && module.exports
    ? require("./assets/world-map-data.js")
    : root?.WhatIMadeWorldMap;
  const api = factory(geography);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeJournal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (geography) {
  "use strict";

  const MISSING_COUNTRY = "missing";

  function normalizeSearch(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLocaleLowerCase("en");
  }

  function countryKey(value) {
    if (!String(value || "").trim()) return MISSING_COUNTRY;
    const match = geography?.findCountry?.(value);
    return match?.key || `unmapped:${normalizeSearch(value)}`;
  }

  function compareCooks(left, right) {
    return `${right.cookedAt || ""}|${right.createdAt || ""}|${right.id || ""}`
      .localeCompare(`${left.cookedAt || ""}|${left.createdAt || ""}|${left.id || ""}`);
  }

  function deriveFilterOptions(cooks, currentYear = new Date().getFullYear()) {
    cooks = cooks.flatMap((item) => Array.isArray(item.attempts) ? item.attempts.map((attempt) => ({ ...attempt, cookedAt: item.cookedAt })) : [item]);
    const countries = new Map();
    const years = new Set([Number(currentYear)]);
    let hasMissingCountry = false;
    cooks.forEach((cook) => {
      const key = countryKey(cook.country);
      if (key === MISSING_COUNTRY) hasMissingCountry = true;
      else if (!countries.has(key)) {
        const match = geography?.findCountry?.(cook.country);
        countries.set(key, match?.name || String(cook.country).trim());
      }
      const year = Number(String(cook.cookedAt || "").slice(0, 4));
      if (Number.isInteger(year) && year > 0) years.add(year);
    });
    return {
      countries: [...countries.entries()]
        .map(([key, label]) => ({ key, label }))
        .sort((left, right) => left.label.localeCompare(right.label) || left.key.localeCompare(right.key)),
      hasMissingCountry,
      years: [...years].sort((left, right) => right - left),
    };
  }

  function filterCooks(cooks, filters = {}) {
    const query = normalizeSearch(filters.query);
    const country = String(filters.country || "all");
    const year = String(filters.year || "");
    const month = year ? String(filters.month || "") : "";
    const rating = String(filters.rating || "any");
    const minimum = rating.startsWith("min:") ? Number(rating.slice(4)) : null;
    return cooks.filter((cook) => {
      if (query && !normalizeSearch(cook.dishName).includes(query)) return false;
      if (country !== "all" && countryKey(cook.country) !== country) return false;
      const cookedAt = String(cook.cookedAt || "");
      if (year && cookedAt.slice(0, 4) !== year) return false;
      if (month && cookedAt.slice(5, 7) !== month.padStart(2, "0")) return false;
      const hasRating = Number.isInteger(cook.rating);
      if (rating === "unrated" && hasRating) return false;
      if (Number.isInteger(minimum) && (!hasRating || cook.rating < minimum)) return false;
      return true;
    }).sort(compareCooks);
  }

  function buildJournalView(cooks, filters = {}, currentYear) {
    const source = Array.isArray(cooks) ? cooks : [];
    return {
      cooks: filterCooks(source, filters),
      totalCount: source.length,
      options: deriveFilterOptions(source, currentYear),
    };
  }

  function buildYearRecap(cooks, year) {
    const selectedYear = Number(year);
    const filtered = (Array.isArray(cooks) ? cooks : [])
      .filter((cook) => Number(String(cook.cookedAt || "").slice(0, 4)) === selectedYear)
      .sort(compareCooks);
    const months = new Map();
    filtered.forEach((cook) => {
      const month = Number(String(cook.cookedAt).slice(5, 7));
      if (!Number.isInteger(month) || month < 1 || month > 12) return;
      if (!months.has(month)) months.set(month, []);
      months.get(month).push(cook);
    });
    return {
      year: selectedYear,
      cookCount: filtered.length,
      groups: [...months.entries()]
        .sort(([left], [right]) => right - left)
        .map(([month, monthCooks]) => ({ month, cooks: monthCooks })),
    };
  }

  function filterOccasions(occasions, filters = {}) {
    const query = normalizeSearch(filters.query);
    const selectedCountry = filters.country || "all";
    const selectedYear = Number(filters.year) || null;
    const selectedMonth = selectedYear ? Number(filters.month) || null : null;
    return occasions.filter((occasion) => {
      const date = String(occasion.cookedAt || "");
      if (selectedYear && Number(date.slice(0, 4)) !== selectedYear) return false;
      if (selectedMonth && Number(date.slice(5, 7)) !== selectedMonth) return false;
      return occasion.attempts.some((attempt) => {
        if (query && !normalizeSearch(attempt.dishName).includes(query)) return false;
        const attemptCountry = countryKey(attempt.country);
        if (selectedCountry === MISSING_COUNTRY ? attemptCountry !== MISSING_COUNTRY : selectedCountry !== "all" && attemptCountry !== selectedCountry) return false;
        if (filters.rating === "unrated") return !Number.isInteger(attempt.rating);
        if (String(filters.rating || "").startsWith("min:")) return Number.isInteger(attempt.rating) && attempt.rating >= Number(String(filters.rating).slice(4));
        return true;
      });
    }).slice().sort((left, right) => `${right.cookedAt || ""}|${right.createdAt || ""}|${right.id}`.localeCompare(`${left.cookedAt || ""}|${left.createdAt || ""}|${left.id}`));
  }

  function buildOccasionJournalView(occasions, filters = {}, currentYear = new Date().getFullYear()) {
    return { occasions: filterOccasions(occasions, filters), totalCount: occasions.length, options: deriveFilterOptions(occasions, currentYear) };
  }

  function buildPhotoRecap(occasions, year) {
    const selectedYear = Number(year);
    const items = occasions.filter((occasion) => Number(String(occasion.cookedAt || "").slice(0, 4)) === selectedYear)
      .flatMap((occasion) => occasion.photos.map((photo) => {
        const attempt = occasion.attempts.find((candidate) => candidate.id === photo.dishAttemptId) || null;
        const occasionName = occasion.dishNames.join(" and ");
        const displayName = attempt?.dishName || (occasion.dishNames.length > 1 ? `${occasion.dishNames.length} dishes` : occasionName);
        return { id: photo.id, photo, occasionId: occasion.id, cookedAt: occasion.cookedAt, dishName: attempt?.dishName || occasionName, displayName, rating: attempt?.rating ?? null };
      }))
      .sort((left, right) => `${right.cookedAt}|${right.photo.createdAt || ""}|${right.id}`.localeCompare(`${left.cookedAt}|${left.photo.createdAt || ""}|${left.id}`));
    const months = new Map();
    items.forEach((item) => {
      const month = Number(item.cookedAt.slice(5, 7));
      if (!months.has(month)) months.set(month, []);
      months.get(month).push(item);
    });
    return { year: selectedYear, photoCount: items.length, groups: [...months.entries()].sort(([left], [right]) => right - left).map(([month, photos]) => ({ month, photos })) };
  }

  function createLatestRequestGate() {
    let latest = 0;
    return {
      begin() {
        latest += 1;
        return latest;
      },
      invalidate() {
        latest += 1;
      },
      isCurrent(requestId) {
        return requestId === latest;
      },
    };
  }

  return { MISSING_COUNTRY, normalizeSearch, countryKey, deriveFilterOptions, filterCooks, buildJournalView, buildYearRecap, filterOccasions, buildOccasionJournalView, buildPhotoRecap, createLatestRequestGate };
});
