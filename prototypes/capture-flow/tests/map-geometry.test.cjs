"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const worldMap = require("../assets/world-map-data.js");
const geometry = require("../map-geometry.js");

test("derives a valid interior anchor for every mapped country", () => {
  const invalid = worldMap.countries.filter((country) => {
    const anchor = geometry.countryGeometry(country.key).anchor;
    return !geometry.isPointInCountry(country.key, anchor.x, anchor.y);
  });
  assert.deepEqual(invalid.map((country) => country.key), []);
});

test("validates current map locations and rejects cross-border points", () => {
  const japan = geometry.countryGeometry("JPN").anchor;
  assert.deepEqual(geometry.validateMapLocation({ ...japan, countryKey: "JPN", mapDataVersion: 1 }), { ...japan, countryKey: "JPN", mapDataVersion: 1 });
  assert.throws(() => geometry.validateMapLocation({ ...japan, countryKey: "USA", mapDataVersion: 1 }), /inside the confirmed country/i);
});

test("uses custom positions only for their current country and geography version", () => {
  const japan = geometry.countryGeometry("JPN").anchor;
  const offset = [0.01, -0.01, 0.02, -0.02].map((delta) => ({ x: japan.x + delta, y: japan.y }))
    .find((point) => geometry.isPointInCountry("JPN", point.x, point.y));
  const custom = { ...offset, countryKey: "JPN", mapDataVersion: 1 };
  assert.deepEqual(geometry.resolvedPosition("Japan", custom), custom);
  assert.notDeepEqual(geometry.resolvedPosition("France", custom), custom);
  assert.notDeepEqual(geometry.resolvedPosition("Japan", { ...custom, mapDataVersion: 99 }), custom);
});

test("maps country cook counts into the five density bands", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 7, 8, 100].map(geometry.densityBand), [1, 2, 3, 3, 4, 4, 5, 5]);
});

test("builds deterministic country activity with monotonic capped peaks", () => {
  const countries = [
    { countryKey: "KOR", countryName: "South Korea", cookCount: 2 },
    { countryKey: "USA", countryName: "United States", cookCount: 8 },
    { countryKey: "JPN", countryName: "Japan", cookCount: 8 },
    { countryKey: "FRA", countryName: "France", cookCount: 0 },
  ];
  const activity = geometry.countryActivityModel(countries);
  assert.deepEqual(activity.map(({ country, cookCount, band }) => [country.countryKey, cookCount, band]), [
    ["JPN", 8, 5],
    ["USA", 8, 5],
    ["KOR", 2, 2],
  ]);
  assert.ok(activity[0].peakHeight > activity[2].peakHeight);
  assert.equal(geometry.peakHeight(0), 0);
  assert.equal(geometry.peakHeight(10_000), 62);
});
