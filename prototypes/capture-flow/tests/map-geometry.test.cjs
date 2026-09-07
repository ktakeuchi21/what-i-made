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

test("builds deterministic dish, country, and nearby collision groups", () => {
  const base = { position: { x: 50, y: 50 } };
  const groups = geometry.collisionGroups([
    { ...base, dishId: "a", countryKey: "JPN" },
    { ...base, dishId: "b", countryKey: "JPN", position: { x: 50.1, y: 50 } },
    { ...base, dishId: "c", countryKey: "KOR", position: { x: 80, y: 50 } },
  ], { width: 390, height: 252, scale: 2 });
  assert.equal(groups[0].kind, "country");
  assert.equal(groups[1].kind, "dish");
  const nearby = geometry.collisionGroups([
    { ...base, dishId: "a", countryKey: "JPN" },
    { ...base, dishId: "b", countryKey: "KOR", position: { x: 50.1, y: 50 } },
  ], { width: 390, height: 252, scale: 2 });
  assert.equal(nearby[0].kind, "nearby");
});

test("detects vertical overlap using the letterboxed map layer height", () => {
  const groups = geometry.collisionGroups([
    { dishId: "a", countryKey: "JPN", position: { x: 50, y: 48.8 } },
    { dishId: "b", countryKey: "JPN", position: { x: 50, y: 51.2 } },
  ], { width: 390, height: 195, scale: 9 });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "country");
});

test("maps repeat counts into the five calm visual bands", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 7, 8, 100].map(geometry.repeatBand), [1, 2, 3, 3, 4, 4, 5, 5]);
});
