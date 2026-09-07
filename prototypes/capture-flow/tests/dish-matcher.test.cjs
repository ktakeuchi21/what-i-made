const test = require("node:test");
const assert = require("node:assert/strict");

const matcher = require("../dish-matcher.js");

const countries = new Map([["japan", { key: "JPN" }], ["italy", { key: "ITA" }]]);
const resolveCountry = (value) => countries.get(String(value || "").toLowerCase()) || null;
const cooks = [
  { dishId: "d1", dishName: "Crème brûlée", aliases: ["Creme brulee"], country: "Italy", cookedAt: "2026-01-01" },
  { dishId: "d2", dishName: "Oyakodon", aliases: ["Chicken and egg bowl"], country: "Japan", cookedAt: "2026-03-01" },
  { dishId: "d2", dishName: "Oyakodon", aliases: ["Chicken and egg bowl"], country: "Japan", cookedAt: "2026-04-01" },
  { dishId: "d3", dishName: "Chicken biryani", aliases: [], country: "", cookedAt: "2026-02-01" },
];

test("preselects one exact canonical or alias match", () => {
  assert.equal(matcher.findMatches({ dishName: "creme-brulee", cooks, resolveCountry }).exact.dishId, "d1");
  assert.equal(matcher.findMatches({ dishName: "Chicken and egg bowl", country: "Japan", cooks, resolveCountry }).exact.dishId, "d2");
});

test("surfaces fuzzy containment without preselecting it", () => {
  const result = matcher.findMatches({ dishName: "Biryani", cooks, resolveCountry });
  assert.equal(result.exact, null);
  assert.equal(result.candidates[0].dishId, "d3");
});

test("excludes a match when both resolved countries conflict", () => {
  const result = matcher.findMatches({ dishName: "Oyakodon", country: "Italy", cooks, resolveCountry });
  assert.equal(result.exact, null);
  assert.deepEqual(result.candidates, []);
});

test("orders equal candidates deterministically by usage and identity", () => {
  const result = matcher.findMatches({ dishName: "Chicken egg bowl", cooks, resolveCountry });
  assert.equal(result.candidates[0].dishId, "d2");
  assert.equal(matcher.normalize(" Crème—Brûlée "), "creme brulee");
});

test("orders fuzzy candidates by similarity before country agreement", () => {
  const candidates = [
    { dishId: "strong", dishName: "Chicken and egg bowl", aliases: [], country: "", cookedAt: "2026-01-01" },
    { dishId: "country", dishName: "Chicken bowl", aliases: [], country: "Japan", cookedAt: "2026-01-01" },
  ];
  const result = matcher.findMatches({ dishName: "Chicken egg bowl", country: "Japan", cooks: candidates, resolveCountry });
  assert.equal(result.candidates[0].dishId, "strong");
  assert.equal(result.candidates[1].dishId, "country");
});
