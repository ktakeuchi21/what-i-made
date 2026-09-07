(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadePhotoUrls = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function replaceOwnedObjectUrl(currentUrl, nextUrl, revoke) {
    if (currentUrl && currentUrl !== nextUrl) revoke(currentUrl);
    return nextUrl;
  }

  return Object.freeze({ replaceOwnedObjectUrl });
});
