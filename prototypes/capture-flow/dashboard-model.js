(function (root, factory) {
  const geography = typeof module === "object" && module.exports
    ? require("./assets/world-map-data.js")
    : root?.WhatIMadeWorldMap;
  const culinaryRegions = typeof module === "object" && module.exports
    ? require("./assets/culinary-regions.js")
    : root?.WhatIMadeCulinaryRegions;
  const mapGeometry = typeof module === "object" && module.exports
    ? require("./map-geometry.js")
    : root?.WhatIMadeMapGeometry;
  const api = factory(geography, culinaryRegions, mapGeometry);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeDashboard = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (geography, culinaryRegions, mapGeometry) {
  "use strict";

  const COUNTRY_POINTS = Object.freeze(Object.fromEntries(
    (geography?.countries || []).map((country) => [country.name, country.point]),
  ));
  const COUNTRIES_BY_KEY = new Map((geography?.countries || []).map((country) => [country.key, country]));

  function toTimestamp(dateValue) {
    const value = new Date(`${dateValue}T12:00:00Z`).getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function mapPosition(country, siblingIndex = 0, mapLocation = null) {
    const base = mapGeometry?.resolvedPosition?.(country, mapLocation);
    if (!base) return null;
    if (mapLocation && base.x === Number(mapLocation.x) && base.y === Number(mapLocation.y)) return base;
    if (!siblingIndex) return base;
    for (let attempt = siblingIndex; attempt < siblingIndex + 28; attempt += 1) {
      const angle = attempt * 2.399963229728653;
      const radius = 0.08 * Math.sqrt(attempt);
      const candidate = { ...base, x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius };
      if (mapGeometry?.isPointInCountry?.(base.countryKey, candidate.x, candidate.y)) return candidate;
    }
    return base;
  }

  function countryIdentity(country) {
    const value = String(country || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("en");
    if (!value) return "";
    const match = geography?.findCountry?.(country);
    return match ? `mapped:${match.key}` : `unmapped:${value}`;
  }

  function compareCooksChronologically(left, right) {
    const cookedDateDifference = toTimestamp(left.cookedAt) - toTimestamp(right.cookedAt);
    if (cookedDateDifference) return cookedDateDifference;
    const leftCreatedAt = new Date(left.createdAt || 0).getTime() || 0;
    const rightCreatedAt = new Date(right.createdAt || 0).getTime() || 0;
    return leftCreatedAt - rightCreatedAt || String(left.id || "").localeCompare(String(right.id || ""));
  }

  function compareDishesByFrequency(left, right) {
    return right.attemptCount - left.attemptCount
      || compareCooksChronologically(right.latestCook, left.latestCook)
      || left.dishName.localeCompare(right.dishName)
      || String(left.dishId).localeCompare(String(right.dishId));
  }

  function compareCountriesByFrequency(left, right) {
    return right.cookCount - left.cookCount
      || toTimestamp(right.latestCookedAt) - toTimestamp(left.latestCookedAt)
      || left.countryName.localeCompare(right.countryName)
      || left.countryKey.localeCompare(right.countryKey);
  }

  function chooseRegionPhotos(countries, capacity = 3) {
    const rankedCountries = countries.slice().sort(compareCountriesByFrequency);
    const selected = rankedCountries.map((country) => country.dishes[0]).filter(Boolean).slice(0, capacity);
    if (selected.length >= capacity) return selected;

    const selectedIds = new Set(selected.map((dish) => dish.dishId));
    const remaining = rankedCountries.flatMap((country) => country.dishes)
      .filter((dish) => !selectedIds.has(dish.dishId))
      .sort(compareDishesByFrequency);
    return selected.concat(remaining.slice(0, capacity - selected.length));
  }

  function buildMapHierarchy(mappedDishes) {
    const countryGroups = new Map();
    mappedDishes.forEach((dish) => {
      if (!countryGroups.has(dish.countryKey)) countryGroups.set(dish.countryKey, []);
      countryGroups.get(dish.countryKey).push(dish);
    });

    const countries = [...countryGroups.entries()].map(([countryKey, countryDishes]) => {
      const dishes = countryDishes.slice().sort(compareDishesByFrequency);
      const country = COUNTRIES_BY_KEY.get(countryKey);
      return {
        countryKey,
        countryName: country?.name || dishes[0].country,
        regionId: dishes[0].regionId,
        point: country?.point || [dishes[0].position.x, dishes[0].position.y],
        dishes,
        dishCount: dishes.length,
        cookCount: dishes.reduce((total, dish) => total + dish.attemptCount, 0),
        latestCookedAt: dishes.reduce((latest, dish) => toTimestamp(dish.latestCookedAt) > toTimestamp(latest) ? dish.latestCookedAt : latest, ""),
        topDish: dishes[0],
      };
    }).sort(compareCountriesByFrequency);

    const regions = (culinaryRegions?.regions || []).map((region) => {
      const regionCountries = countries.filter((country) => country.regionId === region.id).sort(compareCountriesByFrequency);
      const dishCount = regionCountries.reduce((total, country) => total + country.dishCount, 0);
      return {
        ...region,
        countries: regionCountries,
        countryCount: regionCountries.length,
        dishCount,
        cookCount: regionCountries.reduce((total, country) => total + country.cookCount, 0),
        featuredDishes: chooseRegionPhotos(regionCountries, 3),
        hiddenDishCount: Math.max(0, dishCount - 3),
      };
    });

    return { countries, regions };
  }

  function buildYearDashboard(cooks, options = {}) {
    const now = options.now instanceof Date ? options.now : new Date();
    const year = Number(options.year || now.getFullYear());
    const yearCooks = cooks.filter((cook) => Number(String(cook.cookedAt).slice(0, 4)) === year);
    const allTimeGroups = new Map();
    cooks.slice().sort(compareCooksChronologically).forEach((cook) => {
      const key = cook.dishId || `cook:${cook.id}`;
      if (!allTimeGroups.has(key)) allTimeGroups.set(key, []);
      allTimeGroups.get(key).push(cook);
    });
    const groups = new Map();

    yearCooks.forEach((cook) => {
      const key = cook.dishId || `cook:${cook.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(cook);
    });

    const dishes = [...groups.entries()].map(([dishId, attempts]) => {
      const chronological = attempts.slice().sort(compareCooksChronologically);
      const latestCook = chronological[chronological.length - 1];
      const allTimeAttempts = allTimeGroups.get(dishId) || chronological;
      const meaningfulRepeat = allTimeAttempts.some((cook, index) => {
        if (Number(String(cook.cookedAt).slice(0, 4)) !== year || index === 0) return false;
        const previous = allTimeAttempts[index - 1];
        const rating = cook.rating === null || cook.rating === undefined ? "" : String(cook.rating);
        const previousRating = previous.rating === null || previous.rating === undefined ? "" : String(previous.rating);
        const note = String(cook.notes || "").trim();
        const previousNote = String(previous.notes || "").trim();
        return (rating !== previousRating && Boolean(rating || previousRating))
          || (note !== previousNote && Boolean(note || previousNote));
      });
      return {
        dishId,
        dishName: latestCook.dishName,
        country: latestCook.country || "",
        attemptCount: chronological.length,
        firstCookedAt: allTimeAttempts[0]?.cookedAt || chronological[0].cookedAt,
        latestCookedAt: latestCook.cookedAt,
        latestCook,
        mapLocation: latestCook.mapLocation || null,
        meaningfulRepeat,
      };
    }).sort((left, right) => compareCooksChronologically(right.latestCook, left.latestCook));

    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const countryCounts = new Map();
    const siblingIndices = new Map();
    dishes.slice().sort((left, right) => countryIdentity(left.country).localeCompare(countryIdentity(right.country)) || String(left.dishId).localeCompare(String(right.dishId))).forEach((dish) => {
      const identity = countryIdentity(dish.country);
      const siblingIndex = countryCounts.get(identity) || 0;
      siblingIndices.set(dish.dishId, siblingIndex);
      countryCounts.set(identity, siblingIndex + 1);
    });
    const mappedDishes = [];
    const needsLocation = [];
    dishes.forEach((dish) => {
      const position = mapPosition(dish.country, siblingIndices.get(dish.dishId) || 0, dish.mapLocation);
      const region = position ? culinaryRegions?.findRegionByCountryKey?.(position.countryKey) : null;
      const country = position ? COUNTRIES_BY_KEY.get(position.countryKey) : null;
      if (position && region) {
        mappedDishes.push({
          ...dish,
          position,
          countryKey: position.countryKey,
          countryName: country?.name || dish.country,
          regionId: region.id,
        });
      } else needsLocation.push(dish);
    });
    const hierarchy = buildMapHierarchy(mappedDishes);

    return {
      year,
      cookCount: new Set(yearCooks.map((cook) => cook.occasionId || cook.id)).size,
      dishCount: dishes.length,
      countryCount: new Set(mappedDishes.map((dish) => dish.countryKey)).size,
      latestCook: yearCooks.slice().sort((left, right) => compareCooksChronologically(right, left))[0] || null,
      dishes,
      mappedDishes,
      previewDishes: mappedDishes.slice(0, 12),
      needsLocation,
      newDishes: dishes.filter((dish) => toTimestamp(dish.firstCookedAt) >= thirtyDaysAgo),
      repeatDishes: dishes.filter((dish) => dish.meaningfulRepeat),
      countries: hierarchy.countries,
      regions: hierarchy.regions,
    };
  }

  return { COUNTRY_POINTS, mapPosition, buildMapHierarchy, buildYearDashboard };
});
