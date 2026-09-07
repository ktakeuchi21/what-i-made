const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeSearch, countryKey, deriveFilterOptions, filterCooks, buildJournalView, buildYearRecap, filterOccasions, buildPhotoRecap, createLatestRequestGate } = require("../journal-model.js");

test("filters one occasion only when the same dish satisfies every dish criterion", () => {
  const occasions = [{ id: "o1", cookedAt: "2026-09-06", createdAt: "now", dishNames: ["Oyakodon", "Ratatouille"], attempts: [
    { id: "a1", dishName: "Oyakodon", country: "Japan", rating: 8 },
    { id: "a2", dishName: "Ratatouille", country: "France", rating: 10 },
  ], photos: [] }];
  assert.equal(filterOccasions(occasions, { query: "oyakodon", country: countryKey("Japan"), rating: "min:8" }).length, 1);
  assert.equal(filterOccasions(occasions, { query: "oyakodon", country: countryKey("France"), rating: "min:8" }).length, 0);
});

test("photo recap includes every main, occasion, and dish photograph", () => {
  const occasions = [{ id: "o1", cookedAt: "2026-09-06", dishNames: ["Oyakodon", "Soup"], attempts: [{ id: "a1", dishName: "Oyakodon", rating: 8 }], photos: [
    { id: "p1", dishAttemptId: null, createdAt: "1" }, { id: "p2", dishAttemptId: "a1", createdAt: "2" }, { id: "p3", dishAttemptId: null, createdAt: "3" },
  ] }];
  const recap = buildPhotoRecap(occasions, 2026);
  assert.equal(recap.photoCount, 3);
  assert.deepEqual(recap.groups[0].photos.map((photo) => photo.dishName), ["Oyakodon and Soup", "Oyakodon", "Oyakodon and Soup"]);
  assert.deepEqual(recap.groups[0].photos.map((photo) => photo.displayName), ["2 dishes", "Oyakodon", "2 dishes"]);
});

const cooks = [
  { id: "1", dishName: "Crème brûlée", country: "France", cookedAt: "2026-09-06", createdAt: "2026-09-06T18:00:00Z", rating: 9 },
  { id: "2", dishName: "Oyakodon", country: "Japan", cookedAt: "2026-09-02", createdAt: "2026-09-02T18:00:00Z", rating: 8 },
  { id: "3", dishName: "Mac & Cheese", country: "USA", cookedAt: "2026-08-12", createdAt: "2026-08-12T18:00:00Z", rating: null },
  { id: "4", dishName: "Chili", country: "United States of America", cookedAt: "2025-01-10", createdAt: "2025-01-10T18:00:00Z", rating: 7 },
  { id: "5", dishName: "Soup", country: "", cookedAt: "2026-08-01", createdAt: "2026-08-01T18:00:00Z", rating: null },
];

test("normalizes dish search and country aliases", () => {
  assert.equal(normalizeSearch(" Crème—Brûlée! "), "creme brulee");
  assert.equal(countryKey("USA"), countryKey("United States of America"));
  assert.deepEqual(filterCooks(cooks, { query: "creme brulee" }).map((cook) => cook.id), ["1"]);
  assert.deepEqual(filterCooks(cooks, { query: "mac cheese" }).map((cook) => cook.id), ["3"]);
});

test("derives deterministic country and year options", () => {
  const options = deriveFilterOptions(cooks, 2027);
  assert.deepEqual(options.years, [2027, 2026, 2025]);
  assert.equal(options.hasMissingCountry, true);
  assert.deepEqual(options.countries.map((country) => country.label), ["France", "Japan", "United States of America"]);
});

test("combines country, year, month, and minimum rating filters", () => {
  const usa = countryKey("USA");
  assert.deepEqual(filterCooks(cooks, { country: usa }).map((cook) => cook.id), ["3", "4"]);
  assert.deepEqual(filterCooks(cooks, { year: "2026", month: "09", rating: "min:9" }).map((cook) => cook.id), ["1"]);
  assert.deepEqual(filterCooks(cooks, { year: "2026", month: "08", rating: "unrated" }).map((cook) => cook.id), ["3", "5"]);
  assert.deepEqual(filterCooks(cooks, { year: "", month: "08" }).map((cook) => cook.id), ["1", "2", "3", "5", "4"]);
});

test("returns individual attempts in stable reverse chronology", () => {
  const repeated = [...cooks, { ...cooks[1], id: "6", cookedAt: "2026-09-07", createdAt: "2026-09-07T18:00:00Z" }];
  const view = buildJournalView(repeated, { query: "oyakodon" }, 2026);
  assert.deepEqual(view.cooks.map((cook) => cook.id), ["6", "2"]);
  assert.equal(view.totalCount, 6);
});

test("groups every cook in the selected year by newest calendar month", () => {
  const recap = buildYearRecap(cooks, 2026);
  assert.equal(recap.cookCount, 4);
  assert.deepEqual(recap.groups.map((group) => group.month), [9, 8]);
  assert.deepEqual(recap.groups[0].cooks.map((cook) => cook.id), ["1", "2"]);
  assert.deepEqual(recap.groups[1].cooks.map((cook) => cook.id), ["3", "5"]);
  assert.equal(buildYearRecap(cooks, 2024).cookCount, 0);
});

test("allows only the latest asynchronous recap read to commit", async () => {
  const gate = createLatestRequestGate();
  const commits = [];
  let releaseFirst;
  let releaseSecond;
  const firstRead = new Promise((resolve) => { releaseFirst = resolve; });
  const secondRead = new Promise((resolve) => { releaseSecond = resolve; });
  async function render(read, value) {
    const requestId = gate.begin();
    await read;
    if (gate.isCurrent(requestId)) commits.push(value);
  }
  const first = render(firstRead, "first");
  const second = render(secondRead, "second");
  releaseSecond();
  await second;
  releaseFirst();
  await first;
  assert.deepEqual(commits, ["second"]);
});

test("invalidates an asynchronous recap read when navigation leaves recap", async () => {
  const gate = createLatestRequestGate();
  let releaseRead;
  let mutated = false;
  const read = new Promise((resolve) => { releaseRead = resolve; });
  async function render() {
    const requestId = gate.begin();
    await read;
    if (gate.isCurrent(requestId)) mutated = true;
  }
  const pendingRender = render();
  gate.invalidate();
  releaseRead();
  await pendingRender;
  assert.equal(mutated, false);
});
