const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { cleanVoiceText, responseSchema, validateProviderResult } = require("../parser");
const { COUNTRY_CODES } = require("../country-catalog");
const worldMap = require("../../../prototypes/capture-flow/assets/world-map-data.js");
const voiceFixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../prototypes/capture-flow/tests/fixtures/voice-mapping-v1.json"), "utf8"));

const confidence = { dishName: 0.9, rating: 0.9, notes: 0.9, ingredientsText: 0.9, country: 0.9 };

test("cleans vocal and conversational filler without changing meaning", () => {
  assert.equal(cleanVoiceText("Uh, I, I made adobo, you know, and it was, like, salty."), "I made adobo, and it was salty.");
  assert.equal(cleanVoiceText("I like basil, but I do not like five-spice."), "I like basil, but I do not like five-spice.");
  assert.match(cleanVoiceText("Use 1 1/2 cups, not 2 cups."), /1 1\/2 cups, not 2 cups/);
});

test("server cleanup stays in parity with the versioned client fixtures", () => {
  voiceFixtures.cleanup.forEach((fixture) => {
    assert.equal(cleanVoiceText(fixture.input), fixture.expected, fixture.name);
  });
});

test("structured text fields receive the same deterministic cleanup", () => {
  const value = { cleanedVoiceText: "Uh, I made ramen.", warnings: [], dishes: [{
    dishName: "Uh ramen", rating: 7, notes: "It was, um, too salty", ingredientsText: "Noodles, uh, broth",
    countryCode: "JPN", countrySource: "inferred", confidence,
  }] };
  const result = validateProviderResult(value);
  assert.equal(result.cleanedVoiceText, "I made ramen.");
  assert.equal(result.dishes[0].dishName, "ramen");
  assert.equal(result.dishes[0].notes, "It was too salty");
  assert.equal(result.dishes[0].ingredientsText, "Noodles, broth");
});

test("versioned service fixtures validate multi-dish ownership and abstention", () => {
  voiceFixtures.serviceResponses.forEach((fixture) => {
    const result = validateProviderResult(fixture.response);
    assert.equal(result.dishes.length, fixture.response.dishes.length, fixture.name);
    assert.deepEqual(result.warnings, fixture.response.warnings, fixture.name);
  });
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
