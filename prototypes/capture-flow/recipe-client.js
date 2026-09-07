(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeRecipeClient = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const SAMPLE_RECIPE = Object.freeze({
    title: "Oyakodon",
    description: "Chicken and softly set egg simmered with onion over rice.",
    servings: "2 servings",
    prepTime: "10 minutes",
    cookTime: "20 minutes",
    ingredients: ["2 bowls cooked rice", "250 g boneless chicken thighs", "1/2 onion, sliced", "3 eggs", "180 ml dashi", "2 tbsp soy sauce", "2 tbsp mirin"],
    instructions: ["Combine dashi, soy sauce, and mirin in a skillet and bring to a gentle simmer.", "Add onion and chicken; simmer until the chicken is cooked through.", "Pour over lightly beaten eggs, cover, and cook until softly set.", "Spoon over hot rice and serve immediately."],
    sourceKind: "url",
    sourceName: "Just One Cookbook",
    sourceAuthor: "Namiko Chen",
    sourceUrl: "https://www.justonecookbook.com/oyakodon/",
    imageUrl: "./assets/sample-oyakodon.jpg",
  });

  function config() {
    return root.WIM_RECIPE_CONFIG || { enabled: false, endpoint: "", fake: false };
  }

  function readableDuration(value) {
    const source = String(value || "").trim();
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/i.exec(source);
    if (!match) return source;
    const parts = [];
    if (match[1]) parts.push(`${Number(match[1])} hr`);
    if (match[2]) parts.push(`${Number(match[2])} min`);
    return parts.join(" ");
  }

  function normalizeRecipePayload(recipe, sourceKind) {
    const ingredientSections = Array.isArray(recipe?.ingredientSections) ? recipe.ingredientSections : [];
    const instructionSections = Array.isArray(recipe?.instructionSections) ? recipe.instructionSections : [];
    return {
      ...recipe,
      sourceKind: recipe?.sourceKind === "imported" ? "url" : (recipe?.sourceKind || sourceKind),
      sourceAuthor: recipe?.sourceAuthor || recipe?.author || null,
      prepTime: readableDuration(recipe?.prepTime),
      cookTime: readableDuration(recipe?.cookTime),
      ingredients: Array.isArray(recipe?.ingredients)
        ? recipe.ingredients
        : ingredientSections.flatMap((section) => [section.name, ...(section.items || [])].filter(Boolean)),
      instructions: Array.isArray(recipe?.instructions)
        ? recipe.instructions
        : instructionSections.flatMap((section) => [section.name, ...(section.steps || [])].filter(Boolean)),
    };
  }

  async function request(path, body, token) {
    const settings = config();
    if (!settings.enabled || !settings.endpoint) throw new Error("Online recipe search is not configured. You can still add a recipe manually.");
    const response = await fetch(`${settings.endpoint.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "The recipe service could not complete this request.");
    return payload;
  }

  function fakeCandidates(query) {
    const title = String(query || "").trim() || "Recipe idea";
    if (/no results/i.test(title)) return [];
    if (/oyakodon/i.test(title)) return [{ ...SAMPLE_RECIPE, id: "sample-oyakodon", sourceKind: "search" }];
    return [
      { id: "sample-1", title: `${title} — classic`, description: "A traditional version with clear, approachable instructions.", sourceName: "Sample Kitchen", sourceAuthor: "Test fixture", sourceUrl: `https://example.com/recipes/${encodeURIComponent(title.toLowerCase().replace(/\s+/g, "-"))}`, sourceKind: "search", imageUrl: null },
      { id: "sample-2", title: `${title} — weeknight`, description: "A streamlined version designed for a home kitchen.", sourceName: "Weeknight Table", sourceAuthor: "Test fixture", sourceUrl: `https://example.org/recipes/${encodeURIComponent(title.toLowerCase().replace(/\s+/g, "-"))}`, sourceKind: "search", imageUrl: null },
      { id: "sample-3", title: `${title} — project`, description: "A slower version with traditional technique.", sourceName: "Slow Kitchen", sourceAuthor: "Test fixture", sourceUrl: `https://recipes.example.net/${encodeURIComponent(title.toLowerCase().replace(/\s+/g, "-"))}`, sourceKind: "search", imageUrl: null },
    ];
  }

  async function search(description, token) {
    if (config().fake) return { candidates: fakeCandidates(description) };
    return request("/v1/recipes/search", { description }, token);
  }

  async function importRecipe(url, token) {
    if (config().fake) {
      if (/justonecookbook\.com\/oyakodon/i.test(url)) return { recipe: { ...SAMPLE_RECIPE } };
      const name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "Recipe").replace(/[-_]/g, " ");
      return { recipe: { ...SAMPLE_RECIPE, title: name.replace(/\b\w/g, (letter) => letter.toUpperCase()), sourceUrl: url, sourceName: new URL(url).hostname.replace(/^www\./, ""), sourceAuthor: null, imageUrl: null } };
    }
    const payload = await request("/v1/recipes/import", { url }, token);
    return { ...payload, recipe: normalizeRecipePayload(payload.recipe, "url") };
  }

  async function generate(description, token) {
    if (config().fake) return { recipe: {
      title: description.trim() || "Generated recipe",
      description: "A clearly labeled development fixture for reviewing the AI fallback flow.",
      servings: "2 servings",
      prepTime: "10 minutes",
      cookTime: "20 minutes",
      ingredients: ["200 g noodles", "750 ml vegetable broth", "2 cups sliced mushrooms", "Chili paste, to taste"],
      instructions: ["Prepare the noodles according to their package directions.", "Simmer the broth with mushrooms until tender.", "Season with chili paste, add the noodles, and taste before serving."],
      sourceKind: "generated",
      sourceName: "AI-generated draft",
      sourceAuthor: null,
      sourceUrl: null,
      imageUrl: null,
    } };
    const payload = await request("/v1/recipes/generate", { description }, token);
    return { ...payload, recipe: normalizeRecipePayload(payload.recipe, "generated") };
  }

  async function fetchImage(imageReference, token) {
    if (!imageReference) return null;
    if (config().fake && imageReference.startsWith("./")) {
      const response = await fetch(imageReference);
      return response.ok ? response.blob() : null;
    }
    const settings = config();
    const response = await fetch(`${settings.endpoint.replace(/\/$/, "")}/v1/recipes/image?token=${encodeURIComponent(imageReference)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined,
    });
    if (!response.ok) return null;
    return response.blob();
  }

  return { SAMPLE_RECIPE, readableDuration, normalizeRecipePayload, search, importRecipe, generate, fetchImage, fakeCandidates };
});
