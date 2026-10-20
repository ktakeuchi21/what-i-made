(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeCaptureDraft = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function hasText(value) {
    return String(value || "").trim().length > 0;
  }

  function hasCaptureDraft(snapshot = {}) {
    return Boolean(
      snapshot.photoReady ||
      snapshot.recordingActive ||
      [
        snapshot.dishName,
        snapshot.country,
        snapshot.transcript,
        snapshot.rating,
        snapshot.notes,
        snapshot.ingredients,
        snapshot.liveTranscript,
      ].some(hasText),
    );
  }

  async function discardActiveVoice(session, message = "Unsaved voice note discarded") {
    const adapter = session.activeAdapter;
    session.activeAdapter = null;
    session.activeTranscript = null;
    if (adapter) await adapter.cancel(message);
  }

  function additionalDishSuggestions(suggestions, existingDishes, previouslySuggestedNames = []) {
    const nameKey = (name) => String(name || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
    const seen = new Set([...previouslySuggestedNames, ...existingDishes.map((dish) => dish.dishName)].map(nameKey));
    return suggestions.filter((dish) => {
      const key = nameKey(dish.dishName);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return { hasCaptureDraft, discardActiveVoice, additionalDishSuggestions };
});
