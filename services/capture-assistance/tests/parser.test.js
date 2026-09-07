const test = require("node:test");
const assert = require("node:assert/strict");

const { cleanVoiceText, responseSchema, validateProviderResult } = require("../parser");
const { COUNTRY_CODES } = require("../country-catalog");
const worldMap = require("../../../prototypes/capture-flow/assets/world-map-data.js");

const confidence = { dishName: 0.9, rating: 0.9, notes: 0.9, ingredientsText: 0.9, country: 0.9 };

test("cleans vocal and conversational filler without changing meaning", () => {
  assert.equal(cleanVoiceText("Uh, I, I made adobo, you know, and it was, like, salty."), "I made adobo, and it was salty.");
  assert.equal(cleanVoiceText("I like basil, but I do not like five-spice."), "I like basil, but I do not like five-spice.");
  assert.match(cleanVoiceText("Use 1 1/2 cups, not 2 cups."), /1 1\/2 cups, not 2 cups/);
});

test("validates multiple dishes and rejects inconsistent countries", () => {
  const value = { cleanedVoiceText: "Adobo and rice", warnings: [], dishes: [
    { dishName: "Adobo", rating: 8, notes: null, ingredientsText: null, countryCode: "PHL", countrySource: "inferred", confidence },
    { dishName: "Rice", rating: null, notes: null, ingredientsText: null, countryCode: null, countrySource: "unknown", confidence },
  ] };
  assert.equal(validateProviderResult(value).dishes.length, 2);
  assert.throws(() => validateProviderResult({ ...value, dishes: [{ ...value.dishes[0], countryCode: null }] }), /invalid_provider_response/);
});

test("server country codes stay in parity with bundled client geography", () => {
  assert.deepEqual([...COUNTRY_CODES].sort(), worldMap.countries.map((country) => country.key).sort());
});

test("wire schema avoids unsupported Bedrock structured-output keywords", () => {
  const forbidden = new Set(["minLength", "maxLength", "maxItems"]);
  const inspect = (value) => {
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, child]) => { assert.equal(forbidden.has(key), false, `unsupported schema keyword: ${key}`); inspect(child); });
  };
  inspect(responseSchema);
});
