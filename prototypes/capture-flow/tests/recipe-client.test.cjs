const test = require("node:test");
const assert = require("node:assert/strict");

const { readableDuration, normalizeRecipePayload, fakeCandidates } = require("../recipe-client.js");

test("turns common Schema.org ISO durations into readable compact labels", () => {
  assert.equal(readableDuration("PT1H30M"), "1 hr 30 min");
  assert.equal(readableDuration("PT20M"), "20 min");
  assert.equal(readableDuration("about 20 minutes"), "about 20 minutes");
});

test("adapts structured service sections to the editable Ideas form", () => {
  const recipe = normalizeRecipePayload({
    title: "Soup",
    sourceKind: "imported",
    author: "A. Cook",
    ingredientSections: [{ name: "Broth", items: ["2 cups stock"] }, { name: "Finish", items: ["Salt"] }],
    instructionSections: [{ name: "Base", steps: ["Simmer."] }],
  }, "url");
  assert.equal(recipe.sourceKind, "url");
  assert.equal(recipe.sourceAuthor, "A. Cook");
  assert.deepEqual(recipe.ingredients, ["Broth", "2 cups stock", "Finish", "Salt"]);
  assert.deepEqual(recipe.instructions, ["Base", "Simmer."]);
});

test("local search fixture is deterministic, capped, and can exercise no-result recovery", () => {
  assert.equal(fakeCandidates("mushroom noodles").length, 3);
  assert.deepEqual(fakeCandidates("no results mushroom noodles"), []);
  assert.equal(fakeCandidates("oyakodon")[0].title, "Oyakodon");
});
