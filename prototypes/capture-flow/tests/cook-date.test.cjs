const test = require("node:test");
const assert = require("node:assert/strict");

const { MIN_COOK_DATE, isCalendarDate, localDateValue, dateBounds, validateCookDate } = require("../cook-date.js");

test("uses January 1, 2026 as the earliest cooking date", () => {
  const now = new Date("2026-09-10T18:00:00Z");
  assert.equal(MIN_COOK_DATE, "2026-01-01");
  assert.deepEqual(dateBounds(now), { min: "2026-01-01", max: localDateValue(now) });
});

test("accepts real calendar dates at both capture boundaries", () => {
  const bounds = { min: "2026-01-01", max: "2026-09-10" };
  assert.equal(validateCookDate("2026-01-01", { bounds }).valid, true);
  assert.equal(validateCookDate("2026-09-10", { bounds }).valid, true);
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2028-02-29"), true);
});

test("rejects dates before the archive boundary and after today", () => {
  const bounds = { min: "2026-01-01", max: "2026-09-10" };
  assert.match(validateCookDate("2025-12-31", { bounds }).message, /January 1, 2026/);
  assert.match(validateCookDate("2026-09-11", { bounds }).message, /future/);
  assert.match(validateCookDate("", { bounds }).message, /valid cooking date/);
  assert.match(validateCookDate("2026-02-30", { bounds }).message, /valid cooking date/);
});
