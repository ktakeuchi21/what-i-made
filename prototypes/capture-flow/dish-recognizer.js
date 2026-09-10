(function (root, factory) {
  const matcher = typeof module === "object" && module.exports ? require("./dish-matcher.js") : root?.WhatIMadeDishMatcher;
  const catalog = typeof module === "object" && module.exports ? require("./assets/international-dishes.js") : root?.WhatIMadeInternationalDishes;
  const api = factory(matcher, catalog);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeDishRecognizer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (matcher, catalog) {
  "use strict";

  const MIN_SCORE = 0.86;
  const MIN_MARGIN = 0.08;

  function candidateScore(input, names) {
    const normalized = matcher.normalize(input);
    const exact = names.some((name) => matcher.normalize(name) === normalized);
    const dice = Math.max(...names.map((name) => matcher.dice(input, name)));
    const jaccard = Math.max(...names.map((name) => matcher.tokenJaccard(input, name)));
    return { exact, score: exact ? 1 : Math.max(dice, jaccard) };
  }

  function resolve({ dishName, countryCode = "", cooks = [], resolveCountry, entries = catalog?.dishes || [] } = {}) {
    const input = matcher.normalize(dishName);
    if (!input) return null;
    const candidates = new Map();
    const add = (candidate) => {
      if (countryCode && candidate.countryCode && countryCode !== candidate.countryCode) return;
      const names = [candidate.canonicalName, ...(candidate.aliases || [])];
      const scoring = candidateScore(dishName, names);
      const key = `${matcher.normalize(candidate.canonicalName)}|${candidate.countryCode || ""}`;
      const prior = candidates.get(key);
      const merged = prior ? {
        ...prior,
        aliases: [...new Set([...(prior.aliases || []), ...(candidate.aliases || [])])],
        savedDishId: prior.savedDishId || candidate.savedDishId || "",
        source: prior.savedDishId || candidate.savedDishId ? "archive" : prior.source,
        exact: prior.exact || scoring.exact,
        score: Math.max(prior.score, scoring.score),
      } : { ...candidate, ...scoring };
      candidates.set(key, merged);
    };
    (entries || []).forEach((entry) => add({ ...entry, source: "catalog", savedDishId: "" }));
    matcher.buildDishSummaries(cooks).forEach((dish) => add({
      canonicalName: dish.canonicalName,
      aliases: dish.aliases || [],
      countryCode: dish.country && resolveCountry ? resolveCountry(dish.country)?.key || "" : "",
      savedDishId: dish.dishId,
      source: "archive",
    }));
    const ranked = [...candidates.values()].filter((candidate) => candidate.exact || candidate.score >= MIN_SCORE)
      .sort((left, right) => Number(right.exact) - Number(left.exact) || right.score - left.score
        || Number(Boolean(right.savedDishId)) - Number(Boolean(left.savedDishId))
        || matcher.normalize(left.canonicalName).localeCompare(matcher.normalize(right.canonicalName)));
    const first = ranked[0];
    if (!first) return null;
    const second = ranked[1];
    if (second && !first.exact && first.score - second.score < MIN_MARGIN) return null;
    if (second && first.exact && second.exact && matcher.normalize(first.canonicalName) !== matcher.normalize(second.canonicalName)) return null;
    if (matcher.normalize(first.canonicalName) === input) return null;
    return {
      originalDishName: String(dishName || "").trim(),
      canonicalName: first.canonicalName,
      countryCode: first.countryCode || null,
      savedDishId: first.savedDishId || null,
      source: first.source,
      score: first.score,
    };
  }

  function applyToParsedDish(dish, options = {}) {
    const recognition = resolve({
      dishName: dish?.dishName,
      countryCode: dish?.countryCode || "",
      cooks: options.cooks || [],
      resolveCountry: options.resolveCountry,
      entries: options.entries,
    });
    if (!recognition) return { dish, recognition: null };
    const hasCountry = Boolean(dish.countryCode);
    return {
      dish: {
        ...dish,
        dishName: recognition.canonicalName,
        countryCode: dish.countryCode || recognition.countryCode,
        countrySource: dish.countryCode ? dish.countrySource : recognition.countryCode ? "inferred" : "unknown",
        confidence: {
          ...dish.confidence,
          dishName: Math.max(Number(dish.confidence?.dishName) || 0, recognition.score),
          country: hasCountry ? dish.confidence?.country : recognition.countryCode ? 0.94 : 0,
        },
      },
      recognition,
    };
  }

  return { MIN_SCORE, MIN_MARGIN, candidateScore, resolve, applyToParsedDish };
});
