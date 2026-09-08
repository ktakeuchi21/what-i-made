"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { STORES, eligibleOwner, migrationCounts } = require("../legacy-migration.js");

test("only the configured owner archive may inspect the legacy database", () => {
  const owner = "a".repeat(64);
  assert.equal(eligibleOwner(owner, owner), true);
  assert.equal(eligibleOwner("b".repeat(64), owner), false);
  assert.equal(eligibleOwner("owner@example.com", "owner@example.com"), false);
});

test("migration counts include every persistent store and unfinished Idea drafts", () => {
  const records = Object.fromEntries(STORES.map((name, index) => [name, Array.from({ length: index }, (_, id) => ({ id: `${name}-${id}` }))]));
  assert.deepEqual(migrationCounts(records), Object.fromEntries(STORES.map((name, index) => [name, index])));
});
