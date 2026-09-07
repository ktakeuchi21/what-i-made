(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeDishMatcher = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalize(value) {
    return String(value || "").normalize("NFKD").replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ").trim().toLowerCase();
  }

  function tokenJaccard(left, right) {
    const a = new Set(normalize(left).split(" ").filter(Boolean));
    const b = new Set(normalize(right).split(" ").filter(Boolean));
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter((token) => b.has(token)).length;
    return intersection / (a.size + b.size - intersection);
  }

  function bigrams(value) {
    const text = normalize(value).replace(/\s+/g, " ");
    if (text.length < 2) return text ? [text] : [];
    return Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2));
  }

  function dice(left, right) {
    const a = bigrams(left);
    const b = bigrams(right);
    if (!a.length || !b.length) return 0;
    const remaining = b.slice();
    let matches = 0;
    a.forEach((pair) => {
      const index = remaining.indexOf(pair);
      if (index >= 0) { matches += 1; remaining.splice(index, 1); }
    });
    return (2 * matches) / (a.length + b.length);
  }

  function tokenContains(left, right) {
    const a = normalize(left).split(" ").filter(Boolean);
    const b = normalize(right).split(" ").filter(Boolean);
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    return shorter.join(" ").length >= 6 && shorter.every((token) => longer.includes(token));
  }

  function resolvedCountry(value, resolver) {
    return value && typeof resolver === "function" ? resolver(value)?.key || "" : "";
  }

  function buildDishSummaries(cooks) {
    const summaries = new Map();
    (cooks || []).forEach((cook) => {
      if (!cook?.dishId || !cook.dishName) return;
      let item = summaries.get(cook.dishId);
      if (!item) {
        item = { dishId: cook.dishId, canonicalName: cook.dishName, aliases: [...new Set(cook.aliases || [])], country: cook.country || "", cookCount: 0, lastCookedAt: "" };
        summaries.set(cook.dishId, item);
      }
      item.cookCount += 1;
      if (`${cook.cookedAt || ""}|${cook.createdAt || ""}` > item.lastCookedAt) item.lastCookedAt = `${cook.cookedAt || ""}|${cook.createdAt || ""}`;
    });
    return [...summaries.values()];
  }

  function findMatches({ dishName, country, cooks, resolveCountry, limit = 3 }) {
    const input = normalize(dishName);
    if (!input) return { exact: null, candidates: [] };
    const inputCountry = resolvedCountry(country, resolveCountry);
    const scored = buildDishSummaries(cooks).flatMap((dish) => {
      const names = [dish.canonicalName, ...(dish.aliases || [])];
      const isExact = names.some((name) => normalize(name) === input);
      const dishCountry = resolvedCountry(dish.country, resolveCountry);
      const conflict = Boolean(inputCountry && dishCountry && inputCountry !== dishCountry);
      if (conflict) return [];
      const jaccard = Math.max(...names.map((name) => tokenJaccard(input, name)));
      const diceScore = Math.max(...names.map((name) => dice(input, name)));
      const contained = names.some((name) => tokenContains(input, name));
      if (!isExact && jaccard < 0.67 && diceScore < 0.82 && !contained) return [];
      return [{ ...dish, exact: isExact, countryAgreement: Boolean(inputCountry && dishCountry === inputCountry), score: Math.max(jaccard, diceScore, contained ? 0.81 : 0) }];
    }).sort((left, right) => Number(right.exact) - Number(left.exact)
      || right.score - left.score
      || Number(right.countryAgreement) - Number(left.countryAgreement)
      || right.cookCount - left.cookCount
      || right.lastCookedAt.localeCompare(left.lastCookedAt)
      || normalize(left.canonicalName).localeCompare(normalize(right.canonicalName))
      || left.dishId.localeCompare(right.dishId));
    const exactMatches = scored.filter((candidate) => candidate.exact);
    return { exact: exactMatches.length === 1 ? exactMatches[0] : null, candidates: scored.slice(0, Math.max(0, limit)) };
  }

  return { normalize, tokenJaccard, dice, tokenContains, buildDishSummaries, findMatches };
});
