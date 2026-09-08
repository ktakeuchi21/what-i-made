(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeAccountContext = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

  function normalizeSubject(value) {
    const subject = String(value || "").trim();
    if (!subject || subject.length > 256 || /[\u0000-\u001f\u007f]/.test(subject)) {
      throw new Error("The signed-in account identity is invalid.");
    }
    return subject;
  }

  function bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function archiveKeyForSubject(value, cryptoApi = root.crypto) {
    const subject = normalizeSubject(value);
    if (!cryptoApi?.subtle?.digest) throw new Error("Secure account storage is unavailable in this browser.");
    const bytes = new TextEncoder().encode(`what-i-made-archive:${subject}`);
    return bytesToHex(await cryptoApi.subtle.digest("SHA-256", bytes));
  }

  function offlineAccessState(lastAuthorizedAt, now = Date.now(), graceMs = OFFLINE_GRACE_MS) {
    const authorizedAt = Number(lastAuthorizedAt);
    const currentTime = Number(now);
    if (!Number.isFinite(authorizedAt) || !Number.isFinite(currentTime) || authorizedAt <= 0 || currentTime < authorizedAt) {
      return { allowed: false, expiresAt: null, remainingMs: 0 };
    }
    const expiresAt = authorizedAt + graceMs;
    return { allowed: currentTime <= expiresAt, expiresAt, remainingMs: Math.max(0, expiresAt - currentTime) };
  }

  return { OFFLINE_GRACE_MS, normalizeSubject, archiveKeyForSubject, offlineAccessState };
});
