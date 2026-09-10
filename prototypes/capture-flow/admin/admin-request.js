(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeAdminRequests = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function createLatestGate(readKey) {
    let version = 0;
    return {
      begin() {
        const requestVersion = ++version;
        const key = readKey();
        return { key, isCurrent: () => requestVersion === version && key === readKey() };
      },
      invalidate() { version += 1; },
    };
  }
  return { createLatestGate };
});
