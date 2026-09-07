const test = require("node:test");
const assert = require("node:assert/strict");

const { canonicalizeSourceUrl, normalizeIdea, deriveIdeas, matchesIdea } = require("../idea-store.js");

const complete = {
  title: " Oyakodon ",
  sourceUrl: "https://WWW.Example.com/recipes/oyakodon/?utm_source=newsletter&b=2&a=1#method",
  sourceName: "Example Kitchen",
  sourceKind: "url",
  ingredients: ["Chicken", "Eggs"],
  instructions: ["Simmer chicken.", "Add eggs."],
};

test("canonicalizes public recipe URLs for deterministic duplicate detection", () => {
  assert.equal(
    canonicalizeSourceUrl(complete.sourceUrl),
    "https://www.example.com/recipes/oyakodon?a=1&b=2",
  );
  assert.throws(() => canonicalizeSourceUrl("http://example.com/recipe"), /HTTPS/i);
  assert.throws(() => canonicalizeSourceUrl("https://user:secret@example.com/recipe"), /credentials/i);
  assert.throws(() => canonicalizeSourceUrl("not a url"), /complete/i);
});

test("normalizes an editable recipe snapshot without inventing missing values", () => {
  const idea = normalizeIdea(complete, "2026-09-06T12:00:00Z", { ideaId: "idea-1" });
  assert.equal(idea.id, "idea-1");
  assert.equal(idea.title, "Oyakodon");
  assert.equal(idea.canonicalSourceUrl, "https://www.example.com/recipes/oyakodon?a=1&b=2");
  assert.equal(idea.description, null);
  assert.deepEqual(idea.ingredients, ["Chicken", "Eggs"]);
  assert.throws(() => normalizeIdea({ ...complete, title: "" }), /title/i);
  assert.throws(() => normalizeIdea({ ...complete, ingredients: [] }), /ingredient/i);
  assert.throws(() => normalizeIdea({ ...complete, instructions: [] }), /instruction/i);
});

test("searches title, source, author, and ingredients", () => {
  const idea = normalizeIdea({ ...complete, sourceAuthor: "Namiko", ingredients: ["Chicken thigh", "Egg"] });
  assert.equal(matchesIdea(idea, "oyako"), true);
  assert.equal(matchesIdea(idea, "namiko"), true);
  assert.equal(matchesIdea(idea, "chicken"), true);
  assert.equal(matchesIdea(idea, "unrelated"), false);
});

test("derives made state from linked attempts and filters newest first", () => {
  const records = [
    { ...normalizeIdea(complete, "2026-09-01T12:00:00Z", { ideaId: "older" }), createdAt: "2026-09-01" },
    { ...normalizeIdea({ ...complete, title: "Ramen", sourceUrl: "https://example.com/ramen" }, "2026-09-05T12:00:00Z", { ideaId: "newer" }), createdAt: "2026-09-05" },
  ];
  const images = [{ id: "image-1", ideaId: "older", blob: new Blob(["image"]) }];
  const attempts = [{ id: "attempt-1", sourceIdeaId: "older" }];
  assert.deepEqual(deriveIdeas(records, images, attempts).map((idea) => idea.id), ["newer", "older"]);
  assert.deepEqual(deriveIdeas(records, images, attempts, { filter: "made" }).map((idea) => idea.id), ["older"]);
  assert.deepEqual(deriveIdeas(records, images, attempts, { filter: "unmade" }).map((idea) => idea.id), ["newer"]);
  assert.equal(deriveIdeas(records, images, attempts).find((idea) => idea.id === "older").image.id, "image-1");
});
