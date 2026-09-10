"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createLatestGate, eraseControl } = require("../admin/admin-request.js");

test("only the latest matching analytics range may render", () => {
  let range = "30d";
  const gate = createLatestGate(() => range);
  const slow = gate.begin();
  range = "7d";
  const current = gate.begin();
  assert.equal(slow.isCurrent(), false);
  assert.equal(current.isCurrent(), true);
  gate.invalidate();
  assert.equal(current.isCurrent(), false);
});

test("erase controls recover after physical clearing completes", () => {
  assert.deepEqual(eraseControl("clearing"), { disabled: true, label: "Erase in progress" });
  assert.deepEqual(eraseControl("complete"), { disabled: false, label: "Erase analytics" });
});
