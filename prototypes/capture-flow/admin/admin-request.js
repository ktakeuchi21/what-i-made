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
  function eraseControl(purgeStatus) {
    const clearing = purgeStatus === "clearing";
    return { disabled: clearing, label: clearing ? "Erase in progress" : "Erase analytics" };
  }
  return { createLatestGate, eraseControl };
});
