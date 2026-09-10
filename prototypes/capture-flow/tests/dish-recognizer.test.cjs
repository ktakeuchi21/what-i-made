"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const geography = require("../assets/world-map-data.js");
const regions = require("../assets/culinary-regions.js");
const catalog = require("../assets/international-dishes.js");
const recognizer = require("../dish-recognizer.js");

test("recognizes common Mul naengmyeon transcription variants and supplies South Korea", () => {
  for (const heard of ["mool nang myun", "mul nang myun", "mul name young"]) {
    const result = recognizer.resolve({ dishName: heard, resolveCountry: geography.findCountry });
    assert.equal(result.canonicalName, "Mul naengmyeon");
    assert.equal(result.countryCode, "KOR");
  }
});

test("uses local aliases and rejects known country conflicts", () => {
  const cooks = [{ dishId: "saved", dishName: "Tteokbokki", aliases: ["topokki"], country: "South Korea", cookedAt: "2026-08-01" }];
  assert.equal(recognizer.resolve({ dishName: "topokki", cooks, resolveCountry: geography.findCountry }).savedDishId, "saved");
  assert.equal(recognizer.resolve({ dishName: "topokki", countryCode: "JPN", cooks, resolveCountry: geography.findCountry }), null);
});

test("leaves weak or tied names unchanged", () => {
  assert.equal(recognizer.resolve({ dishName: "cold noodles maybe" }), null);
  const tied = recognizer.resolve({
    dishName: "mool noodle",
    entries: [
      { canonicalName: "Moon noodle", aliases: [], countryCode: "KOR" },
      { canonicalName: "Moor noodle", aliases: [], countryCode: "JPN" },
    ],
  });
  assert.equal(tied, null);
});

test("catalog country codes exist and every culinary region has recognition coverage", () => {
  const known = new Set(geography.countries.map((country) => country.key));
  assert.ok(catalog.dishes.every((dish) => !dish.countryCode || known.has(dish.countryCode)));
  const covered = new Set(catalog.dishes.map((dish) => regions.findRegionByCountryKey(dish.countryCode)?.id).filter(Boolean));
  assert.deepEqual([...covered].sort(), regions.regions.map((region) => region.id).sort());
});

test("applying a catalog correction never overwrites an explicit country", () => {
  const base = {
    dishName: "mool nang myun", countryCode: "KOR", countrySource: "explicit",
    confidence: { dishName: 0.9, rating: 0, notes: 0, ingredientsText: 0, country: 0.99 },
  };
  const result = recognizer.applyToParsedDish(base, { resolveCountry: geography.findCountry });
  assert.equal(result.dish.dishName, "Mul naengmyeon");
  assert.equal(result.dish.countryCode, "KOR");
  assert.equal(result.dish.countrySource, "explicit");
});
