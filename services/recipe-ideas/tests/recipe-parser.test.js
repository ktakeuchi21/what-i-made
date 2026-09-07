"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRecipeHtml, plainText } = require("../recipe-parser");

test("normalizes Recipe JSON-LD in @graph with sections and sanitized text", () => {
  const html = `<!doctype html><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@graph": [{ "@type": "BreadcrumbList" }, {
      "@type": ["Thing", "Recipe"], name: "  Tomato &amp; Bean Soup <b>Best</b>",
      description: "<p>Warming.</p>", author: { name: "A Cook" }, recipeYield: ["4 bowls"],
      prepTime: "PT10M", cookTime: "PT30M", image: [{ url: "/soup.jpg" }],
      recipeIngredient: ["2 tomatoes", "1 can beans"],
      recipeInstructions: [{ "@type": "HowToSection", name: "Soup", itemListElement: [
        { "@type": "HowToStep", text: "<b>Simmer</b> everything." },
        { "@type": "HowToStep", text: "Serve." },
      ] }],
    }],
  })}</script>`;
  const recipe = parseRecipeHtml(html, "https://recipes.example/dinner");
  assert.equal(recipe.title, "Tomato & Bean Soup Best");
  assert.equal(recipe.description, "Warming.");
  assert.equal(recipe.imageUrl, "https://recipes.example/soup.jpg");
  assert.deepEqual(recipe.ingredientSections[0].items, ["2 tomatoes", "1 can beans"]);
  assert.deepEqual(recipe.instructionSections, [{ name: "Soup", steps: ["Simmer everything.", "Serve."] }]);
});

test("handles top-level arrays and string instructions, rejecting incomplete recipes", () => {
  const good = `<script TYPE='application/ld+json'>${JSON.stringify([
    { "@type": "WebPage" }, { "@type": "Recipe", name: "Toast", recipeIngredient: ["Bread"], recipeInstructions: "Toast it." },
  ])}</script>`;
  assert.equal(parseRecipeHtml(good, "https://example.com/").title, "Toast");
  const incomplete = `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "Mystery" })}</script>`;
  assert.equal(parseRecipeHtml(incomplete, "https://example.com/"), null);
});

test("never executes scripts and strips markup and controls", () => {
  globalThis.recipeParserExecuted = false;
  const html = `<script>globalThis.recipeParserExecuted=true</script><script type="application/ld+json">{"@type":"Recipe","name":"X","recipeIngredient":["A"],"recipeInstructions":[{"@type":"HowToStep","text":"B"}]}</script>`;
  assert.equal(parseRecipeHtml(html, "https://example.com").title, "X");
  assert.equal(globalThis.recipeParserExecuted, false);
  assert.equal(plainText("<img src=x onerror=bad> A\u0000  B"), "A B");
  assert.equal(plainText("&lt;img src=x onerror=alert(1)&gt;Soup"), "Soup");
  assert.equal(plainText("Dish &#999999999999; name"), "Dish name");
  delete globalThis.recipeParserExecuted;
});
