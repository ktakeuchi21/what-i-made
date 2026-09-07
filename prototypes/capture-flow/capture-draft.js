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

  return { hasCaptureDraft, discardActiveVoice };
});
