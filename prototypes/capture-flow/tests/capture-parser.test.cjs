"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCaptureTranscript, inferCountry, extractCountry } = require("../capture-parser.js");

test("parses a natural Oyakodon note into all applicable fields", () => {
  assert.deepEqual(
    parseCaptureTranscript(
      "I made Oyakodon, eight out of ten. Notes: use less soy next time. Ingredients were chicken, egg, onion, and rice.",
    ),
    {
      dishName: "Oyakodon",
      rating: "8",
      notes: "Use less soy next time",
      ingredients: "Chicken, egg, onion, and rice",
      country: "Japan",
    },
  );
});

test("keeps ingredients and notes separate regardless of their order", () => {
  assert.deepEqual(
    parseCaptureTranscript(
      "I cooked carbonara, rating was 9 out of 10. Ingredients include spaghetti, eggs, pecorino and guanciale. Notes: the sauce was silkier this time.",
    ),
    {
      dishName: "Carbonara",
      rating: "9",
      notes: "The sauce was silkier this time",
      ingredients: "Spaghetti, eggs, pecorino and guanciale",
      country: "Italy",
    },
  );
});

test("returns only information it can identify", () => {
  assert.deepEqual(parseCaptureTranscript("Dinner turned out nicely."), {
    dishName: "",
    rating: "",
    notes: "Dinner turned out nicely",
    ingredients: "",
    country: "",
  });
});

test("country inference is a suggestion and leaves unknown dishes blank", () => {
  assert.equal(inferCountry("Katsu curry"), "Japan");
  assert.equal(inferCountry("My family casserole"), "");
});

test("spoken country names populate the country field", () => {
  const tamales = parseCaptureTranscript("I made tamales. Country is Mexico.");
  assert.equal(tamales.country, "Mexico");
  assert.equal(tamales.notes, "");
  assert.equal(parseCaptureTranscript("Big Mac. United States. Seven out of ten.").country, "United States");
  assert.equal(parseCaptureTranscript("Jollof rice from Ghana. Nine out of ten.").country, "Ghana");
});

test("a spoken country overrides dish-based inference", () => {
  assert.equal(parseCaptureTranscript("I made ramen. Country is South Korea.").country, "South Korea");
});

test("ambiguous food words require country phrasing", () => {
  assert.equal(extractCountry("I made a turkey sandwich."), "");
  assert.equal(extractCountry("I made a sandwich. The country is Turkey."), "Turkey");
});

test("country names inside food and drink names do not create false countries", () => {
  assert.equal(extractCountry("Chile relleno was delicious."), "");
  assert.equal(extractCountry("I roasted Guinea fowl."), "");
  assert.equal(extractCountry("Brazil nut cookies. Eight out of ten."), "");
  assert.equal(extractCountry("I tried an India pale ale."), "");
});

test("punctuated country initials are recognized and removed from notes", () => {
  const unitedStates = parseCaptureTranscript("I made a burger. Country is U.S.");
  assert.equal(unitedStates.country, "United States");
  assert.equal(unitedStates.notes, "");

  const unitedKingdom = parseCaptureTranscript("I made shepherd's pie. Country is U.K.");
  assert.equal(unitedKingdom.country, "United Kingdom");
  assert.equal(unitedKingdom.notes, "");

  assert.equal(
    parseCaptureTranscript("I made a burger. Country is U.S. Notes: remind us to add less salt.").notes,
    "Remind us to add less salt",
  );
  assert.equal(
    parseCaptureTranscript("I made a burger. Country is United States. Notes: this recipe works for us.").notes,
    "This recipe works for us",
  );
});

test("accepts a concise dish-first note", () => {
  const result = parseCaptureTranscript("Katsu curry, nine out of ten. Notes: crispier than last time.");
  assert.equal(result.dishName, "Katsu curry");
  assert.equal(result.rating, "9");
  assert.equal(result.notes, "Crispier than last time");
  assert.equal(result.country, "Japan");
});

test("uses a punctuated opening phrase as the dish name", () => {
  const result = parseCaptureTranscript(
    "Big Mac. Made my own Big Mac. Using Costco beef patties. It's pretty good.",
  );

  assert.equal(result.dishName, "Big Mac");
  assert.equal(result.notes, "Made my own Big Mac. Using Costco beef patties. It's pretty good");
});

test("supports a one-word dish name at the start of a voice note", () => {
  const result = parseCaptureTranscript("Oyakodon. The egg texture was better this time.");

  assert.equal(result.dishName, "Oyakodon");
  assert.equal(result.notes, "The egg texture was better this time");
  assert.equal(result.country, "Japan");
});

test("stops a leading dish phrase before commentary", () => {
  const result = parseCaptureTranscript("Chicken curry was great. Used less salt.");

  assert.equal(result.dishName, "Chicken curry");
  assert.equal(result.notes, "Was great. Used less salt");
});

test("does not mistake short commentary for a dish name", () => {
  assert.equal(parseCaptureTranscript("The sauce was great. Used less salt.").dishName, "");
  assert.equal(parseCaptureTranscript("Made my own Big Mac. Using Costco beef patties.").dishName, "");
  assert.equal(parseCaptureTranscript("It was pretty good. I would make it again.").dishName, "");
  assert.equal(parseCaptureTranscript("Using Costco beef patties. It was pretty good.").dishName, "");
  assert.equal(parseCaptureTranscript("Making my own Big Mac. It was pretty good.").dishName, "");
});
