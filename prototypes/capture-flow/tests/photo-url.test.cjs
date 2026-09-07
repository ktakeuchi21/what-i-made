"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { replaceOwnedObjectUrl } = require("../photo-url.js");

test("keeps a newly selected photo URL alive for image loading", () => {
  const revoked = [];
  const selectedUrl = "blob:new-photo";

  const activeUrl = replaceOwnedObjectUrl(selectedUrl, selectedUrl, (url) => revoked.push(url));

  assert.equal(activeUrl, selectedUrl);
  assert.deepEqual(revoked, []);
});

test("revokes the previous selected photo when it is replaced", () => {
  const revoked = [];

  const activeUrl = replaceOwnedObjectUrl("blob:first-photo", "blob:second-photo", (url) => revoked.push(url));

  assert.equal(activeUrl, "blob:second-photo");
  assert.deepEqual(revoked, ["blob:first-photo"]);
});

test("revokes a selected photo when switching to a bundled sample", () => {
  const revoked = [];

  const activeUrl = replaceOwnedObjectUrl("blob:selected-photo", "", (url) => revoked.push(url));

  assert.equal(activeUrl, "");
  assert.deepEqual(revoked, ["blob:selected-photo"]);
});
