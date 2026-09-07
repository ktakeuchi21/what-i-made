"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildYearDashboard, mapPosition } = require("../dashboard-model.js");
const worldMap = require("../assets/world-map-data.js");
const culinaryRegions = require("../assets/culinary-regions.js");

function cook(id, dishId, dishName, cookedAt, country, rating, notes = "") {
  return { id, dishId, dishName, cookedAt, country, rating, notes, createdAt: `${cookedAt}T12:00:00Z`, photoBlob: new Blob([id]), photoId: `p-${id}` };
}

test("derives current-year counts, latest photo, countries, and recent dishes", () => {
  const result = buildYearDashboard([
    cook("1", "d1", "Oyakodon", "2026-08-20", "Japan", 8),
    cook("2", "d2", "Tacos", "2026-09-03", "Mexico", 9),
    cook("old", "d3", "Paella", "2025-12-20", "Spain", 7),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.equal(result.cookCount, 2);
  assert.equal(result.dishCount, 2);
  assert.equal(result.countryCount, 2);
  assert.equal(result.latestCook.id, "2");
  assert.deepEqual(result.newDishes.map((dish) => dish.dishName), ["Tacos", "Oyakodon"]);
});

test("counts a multi-dish meal as one occasion while keeping both dish attempts", () => {
  const shared = [
    { ...cook("a1", "d1", "Oyakodon", "2026-09-06", "Japan", 8), occasionId: "occasion-1" },
    { ...cook("a2", "d2", "Miso soup", "2026-09-06", "Japan", 7), occasionId: "occasion-1" },
  ];
  const model = buildYearDashboard(shared, { year: 2026, now: new Date("2026-09-10T12:00:00Z") });
  assert.equal(model.cookCount, 1);
  assert.equal(model.dishCount, 2);
  assert.equal(model.regions.find((region) => region.id === "east-asia").cookCount, 2);
});

test("groups attempts by canonical dish and identifies meaningful repeats", () => {
  const result = buildYearDashboard([
    cook("1", "d1", "Oyakodon", "2026-03-01", "Japan", 7, "Less soy"),
    cook("2", "d1", "Oyakodon", "2026-09-03", "Japan", 8, "Better egg texture"),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.equal(result.dishCount, 1);
  assert.equal(result.dishes[0].attemptCount, 2);
  assert.equal(result.repeatDishes[0].dishName, "Oyakodon");
  assert.equal(result.mappedDishes.length, 1);
});

test("keeps distinct dishes in one country independently positioned", () => {
  const result = buildYearDashboard([
    cook("1", "d1", "Oyakodon", "2026-09-01", "Japan", 8),
    cook("2", "d2", "Ramen", "2026-09-02", "Japan", 9),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.equal(result.mappedDishes.length, 2);
  assert.notDeepEqual(result.mappedDishes[0].position, result.mappedDishes[1].position);
});

test("groups aliases as one country and offsets their dishes", () => {
  const result = buildYearDashboard([
    cook("1", "d1", "Burger", "2026-09-01", "United States", 8),
    cook("2", "d2", "Chili", "2026-09-02", "USA", 9),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.equal(result.countryCount, 1);
  assert.equal(result.mappedDishes.length, 2);
  assert.notDeepEqual(result.mappedDishes[0].position, result.mappedDishes[1].position);
  assert.ok(result.mappedDishes.every((dish) => dish.position.countryKey === "USA"));
});

test("keeps more than seven dishes in one country independently positioned", () => {
  const positions = Array.from({ length: 10 }, (_, index) => mapPosition("Japan", index));
  assert.equal(new Set(positions.map((position) => `${position.x},${position.y}`)).size, 10);
});

test("does not invent map positions for missing or unsupported countries", () => {
  const result = buildYearDashboard([
    cook("1", "d1", "Family casserole", "2026-09-01", "", 8),
    cook("2", "d2", "Island stew", "2026-09-02", "Atlantis", 9),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.equal(result.mappedDishes.length, 0);
  assert.equal(result.needsLocation.length, 2);
  assert.equal(mapPosition("Atlantis"), null);
});

test("keeps a year with no matching cooks empty instead of borrowing another year", () => {
  const result = buildYearDashboard([
    cook("old", "d1", "Paella", "2025-12-20", "Spain", 7),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.equal(result.cookCount, 0);
  assert.equal(result.latestCook, null);
  assert.deepEqual(result.dishes, []);
});

test("does not call an earlier-year dish new when it is repeated this month", () => {
  const result = buildYearDashboard([
    cook("old", "d1", "Paella", "2025-12-20", "Spain", 7),
    cook("repeat", "d1", "Paella", "2026-09-03", "Spain", 8),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.deepEqual(result.newDishes, []);
});

test("treats adding the first note on a repeat as meaningful", () => {
  const result = buildYearDashboard([
    cook("first", "d1", "Stew", "2026-08-20", "Ireland", 8),
    cook("second", "d1", "Stew", "2026-09-03", "Ireland", 8, "Added thyme"),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.equal(result.repeatDishes.length, 1);
});

test("treats a changed first cook this year as a meaningful cross-year repeat", () => {
  const result = buildYearDashboard([
    cook("prior", "d1", "Paella", "2025-12-20", "Spain", 7),
    cook("current", "d1", "Paella", "2026-01-03", "Spain", 8),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.equal(result.repeatDishes.length, 1);
});

test("keeps another dish's map position stable when its sibling is repeated", () => {
  const before = buildYearDashboard([
    cook("one", "d1", "Oyakodon", "2026-09-01", "Japan", 7),
    cook("two", "d2", "Ramen", "2026-09-02", "Japan", 8),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });
  const after = buildYearDashboard([
    cook("one", "d1", "Oyakodon", "2026-09-01", "Japan", 7),
    cook("two", "d2", "Ramen", "2026-09-02", "Japan", 8),
    cook("repeat", "d1", "Oyakodon", "2026-09-03", "Japan", 8),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  assert.deepEqual(
    before.mappedDishes.find((dish) => dish.dishId === "d2").position,
    after.mappedDishes.find((dish) => dish.dishId === "d2").position,
  );
});

test("uses creation time to choose the latest photo when cooks share a date", () => {
  const earlier = cook("earlier", "d1", "Oyakodon", "2026-09-05", "Japan", 7);
  const later = cook("later", "d1", "Oyakodon", "2026-09-05", "Japan", 8);
  earlier.createdAt = "2026-09-05T08:00:00Z";
  later.createdAt = "2026-09-05T18:00:00Z";

  const result = buildYearDashboard([later, earlier], { year: 2026, now: new Date("2026-09-05T20:00:00Z") });

  assert.equal(result.latestCook.id, "later");
  assert.equal(result.dishes[0].latestCook.id, "later");
});

test("assigns every bundled geography to exactly one culinary region", () => {
  const memberships = new Map();
  culinaryRegions.regions.forEach((region) => region.countryKeys.forEach((countryKey) => {
    memberships.set(countryKey, (memberships.get(countryKey) || 0) + 1);
  }));

  assert.deepEqual(
    worldMap.countries.filter((country) => memberships.get(country.key) !== 1).map((country) => country.key),
    [],
  );
  assert.equal(culinaryRegions.findRegionByCountryKey("MEX").id, "central-america-caribbean");
  assert.equal(culinaryRegions.findRegionByCountryKey("TUR").id, "north-africa-middle-east");
  assert.equal(culinaryRegions.findRegionByCountryKey("RUS").id, "eastern-europe");
});

test("builds region and country summaries with year-scoped counts", () => {
  const result = buildYearDashboard([
    cook("burger-1", "burger", "Burger", "2026-03-01", "United States", 8),
    cook("burger-2", "burger", "Burger", "2026-09-01", "United States", 9),
    cook("chili-1", "chili", "Chili", "2026-08-01", "United States", 8),
    cook("poutine-1", "poutine", "Poutine", "2026-09-02", "Canada", 9),
    cook("old", "burger", "Burger", "2025-01-01", "United States", 7),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  const region = result.regions.find((candidate) => candidate.id === "north-america");
  const usa = result.countries.find((candidate) => candidate.countryKey === "USA");
  assert.equal(region.countryCount, 2);
  assert.equal(region.dishCount, 3);
  assert.equal(region.cookCount, 4);
  assert.equal(usa.cookCount, 3);
  assert.equal(usa.dishes[0].dishName, "Burger");
});

test("region photos favor different countries before filling by frequency", () => {
  const result = buildYearDashboard([
    cook("burger-1", "burger", "Burger", "2026-03-01", "United States", 8),
    cook("burger-2", "burger", "Burger", "2026-09-01", "United States", 9),
    cook("chili-1", "chili", "Chili", "2026-08-01", "United States", 8),
    cook("chili-2", "chili", "Chili", "2026-08-10", "United States", 9),
    cook("poutine-1", "poutine", "Poutine", "2026-09-02", "Canada", 9),
  ], { year: 2026, now: new Date("2026-09-05T12:00:00Z") });

  const featured = result.regions.find((candidate) => candidate.id === "north-america").featuredDishes;
  assert.deepEqual(featured.slice(0, 2).map((dish) => dish.countryKey), ["USA", "CAN"]);
  assert.deepEqual(featured.map((dish) => dish.dishName), ["Burger", "Poutine", "Chili"]);
});
