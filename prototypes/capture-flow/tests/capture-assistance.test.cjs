const test = require("node:test");
const assert = require("node:assert/strict");

const assistance = require("../capture-assistance.js");

const confidence = { dishName: 0.97, rating: 0.99, notes: 0.9, ingredientsText: 0.91, country: 0.94 };

test("accepts a bounded multi-dish response and known country codes", () => {
  const result = assistance.validateResponse({
    cleanedVoiceText: "I made adobo and rice.",
    dishes: [
      { dishName: "Adobo", rating: 8, notes: null, ingredientsText: "Chicken", countryCode: "PHL", countrySource: "inferred", confidence },
      { dishName: "Rice", rating: null, notes: null, ingredientsText: null, countryCode: null, countrySource: "unknown", confidence: { ...confidence, country: 0 } },
    ],
    warnings: [],
  }, ["PHL"]);
  assert.equal(result.dishes.length, 2);
  assert.equal(result.dishes[0].countryCode, "PHL");
});

test("rejects extra fields, invalid ratings, and unknown countries", () => {
  const base = { cleanedVoiceText: "Adobo", dishes: [], warnings: [] };
  assert.throws(() => assistance.validateResponse({ ...base, raw: "secret" }, ["PHL"]), /not valid/i);
  assert.throws(() => assistance.validateResponse({ ...base, dishes: [{ dishName: "Adobo", rating: 11, notes: null, ingredientsText: null, countryCode: "PHL", countrySource: "inferred", confidence }] }, ["PHL"]), /not valid/i);
  assert.throws(() => assistance.validateResponse({ ...base, dishes: [{ dishName: "Adobo", rating: 8, notes: null, ingredientsText: null, countryCode: "XXX", countrySource: "inferred", confidence }] }, ["PHL"]), /not valid/i);
});

test("client validation removes filler from every structured text field", () => {
  const result = assistance.validateResponse({
    cleanedVoiceText: "Oh, uh, I made ramen.",
    dishes: [{ dishName: "Uh ramen", rating: 7, notes: "It was, um, too salty", ingredientsText: "Noodles, uh, broth", countryCode: "JPN", countrySource: "inferred", confidence }],
    warnings: [],
  }, ["JPN"]);
  assert.equal(result.cleanedVoiceText, "I made ramen.");
  assert.equal(result.dishes[0].dishName, "ramen");
  assert.equal(result.dishes[0].notes, "It was too salty");
  assert.equal(result.dishes[0].ingredientsText, "Noodles, broth");
});

test("fake assistance removes filler but preserves meaningful like", async () => {
  const result = await assistance.fakeParseCook({
    transcript: "Uh, I like basil. I made pasta.", voiceSegment: "Uh, I like basil. I made pasta.",
    parseFallback: () => ({ dishName: "Pasta", notes: "I like basil" }), countryLookup: () => null,
  });
  assert.equal(result.cleanedVoiceText, "I like basil. I made pasta.");
  assert.match(result.dishes[0].notes, /like basil/);
});

test("fake assistance can parse a cleaned voice segment before a transcript is committed", async () => {
  let parsedText = "";
  const result = await assistance.fakeParseCook({
    transcript: "", voiceSegment: "Oh, uh, I made ramen.",
    parseFallback: (value) => { parsedText = value; return { dishName: "Ramen" }; },
    countryLookup: () => null,
  });
  assert.equal(parsedText, "I made ramen.");
  assert.equal(result.cleanedVoiceText, "I made ramen.");
  assert.equal(result.dishes[0].dishName, "Ramen");
});

test("applies the same confidence thresholds to every proposed dish", () => {
  assert.deepEqual(assistance.acceptedDishFields({
    dishName: "Adobo", rating: 8, notes: "Less vinegar", ingredientsText: "Chicken",
    confidence: { dishName: 0.79, rating: 0.89, notes: 0.69, ingredientsText: 0.7, country: 0.9 },
  }), { dishName: null, rating: null, notes: null, ingredientsText: "Chicken" });
});

test("client request sends only the documented text contract", async () => {
  let request;
  const fetchImpl = async (_url, options) => {
    request = options;
    return { ok: true, json: async () => ({ cleanedVoiceText: "Adobo", dishes: [], warnings: [] }) };
  };
  await assistance.parseCook({ endpoint: "https://example.test", token: "a".repeat(32), transcript: "Adobo", voiceSegment: "Adobo", countryCodes: [], fetchImpl });
  assert.deepEqual(Object.keys(JSON.parse(request.body)).sort(), ["locale", "transcript", "voiceSegment"]);
  assert.equal(request.cache, "no-store");
});

test("rejects cleaned text that could duplicate typed text or earlier recordings", async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ cleanedVoiceText: "Earlier typed text and adobo", dishes: [], warnings: [] }) });
  await assert.rejects(() => assistance.parseCook({
    endpoint: "https://example.test", token: "a".repeat(32), transcript: "Earlier typed text and adobo",
    voiceSegment: "adobo", countryCodes: [], fetchImpl,
  }), /not valid/i);
  await assert.rejects(() => assistance.parseCook({
    endpoint: "https://example.test", token: "a".repeat(32), transcript: "Typed adobo",
    voiceSegment: "", countryCodes: [], fetchImpl,
  }), /not valid/i);
  assert.equal(assistance.cleanedTokensComeFromSegment(
    "I made a very large bowl of chicken adobo tonight",
    "Earlier note I made a very large bowl of chicken adobo tonight",
  ), false);
  assert.equal(assistance.cleanedTokensComeFromSegment("Uh, I made adobo, adobo.", "I made adobo."), true);
});
