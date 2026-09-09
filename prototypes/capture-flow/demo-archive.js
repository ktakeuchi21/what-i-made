(function (root, factory) {
  const geography = typeof module === "object" && module.exports
    ? require("./assets/world-map-data.js")
    : root?.WhatIMadeWorldMap;
  const regions = typeof module === "object" && module.exports
    ? require("./assets/culinary-regions.js")
    : root?.WhatIMadeCulinaryRegions;
  const api = factory(geography, regions);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeDemoArchive = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (geography, culinaryRegions) {
  "use strict";

  const MANIFEST_URL = "./assets/demo/demo-content.json?v=3";
  const DEMO_PREFIX = "demo-";
  const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
  const LICENSE_PATHS = Object.freeze({
    "CC BY 2.0": "/licenses/by/2.0",
    "CC BY 3.0": "/licenses/by/3.0",
    "CC BY 4.0": "/licenses/by/4.0",
    "CC BY-SA 2.0": "/licenses/by-sa/2.0",
    "CC BY-SA 3.0": "/licenses/by-sa/3.0",
    "CC BY-SA 4.0": "/licenses/by-sa/4.0",
    "CC0": "/publicdomain/zero/1.0/deed.en",
    "Public domain": "/publicdomain/mark/1.0",
  });

  function invariant(value, message) {
    if (!value) throw new Error(`Sample archive is invalid: ${message}`);
  }

  function clone(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function validateAssetPath(value, kind) {
    const pattern = kind === "thumbnail"
      ? /^\.\/assets\/demo\/thumb\/[a-z0-9-]+\.webp$/
      : /^\.\/assets\/demo\/display\/[a-z0-9-]+\.webp$/;
    invariant(pattern.test(String(value || "")), `${kind} path must stay inside assets/demo.`);
  }

  function validateManifest(manifest) {
    invariant(manifest && typeof manifest === "object" && !Array.isArray(manifest), "manifest must be an object.");
    invariant(manifest.schemaVersion === 2, "unsupported schema version.");
    invariant(manifest.fictional === true, "content must be explicitly fictional.");
    invariant(manifest.media && typeof manifest.media === "object", "media catalog is missing.");
    const mediaKeys = new Set(Object.keys(manifest.media));
    invariant(mediaKeys.size > 0, "media catalog is empty.");
    Object.values(manifest.media).forEach((media) => {
      validateAssetPath(media.thumbnail, "thumbnail");
      validateAssetPath(media.display, "display");
      invariant(media.sourceType === "licensed-photograph", "media must identify a licensed photograph source.");
      invariant(typeof media.sourceTitle === "string" && media.sourceTitle.trim(), "media source title is missing.");
      invariant(typeof media.creator === "string" && media.creator.trim(), "media creator is missing.");
      invariant(Object.hasOwn(LICENSE_PATHS, media.license), "media license is unsupported.");
      let sourcePage;
      let licenseUrl;
      try {
        sourcePage = new URL(media.sourcePage);
        licenseUrl = new URL(media.licenseUrl);
      } catch {
        invariant(false, "media source and license URLs must be valid.");
      }
      invariant(sourcePage.protocol === "https:" && !sourcePage.username && !sourcePage.password && sourcePage.hostname === "commons.wikimedia.org" && sourcePage.pathname.startsWith("/wiki/File:") && !sourcePage.search && !sourcePage.hash, "media source must be a Wikimedia Commons File page.");
      const sourceTitle = decodeURIComponent(sourcePage.pathname.slice("/wiki/File:".length)).replaceAll("_", " ").normalize("NFC");
      invariant(sourceTitle === media.sourceTitle.normalize("NFC"), "media source title must match its Commons File page.");
      const licensePath = licenseUrl.pathname.replace(/\/$/, "");
      invariant(licenseUrl.protocol === "https:" && !licenseUrl.username && !licenseUrl.password && licenseUrl.hostname === "creativecommons.org" && !licenseUrl.search && !licenseUrl.hash && licensePath === LICENSE_PATHS[media.license], "media license does not match its Creative Commons URL.");
      invariant(typeof media.modifications === "string" && media.modifications.trim(), "media modifications are missing.");
    });

    invariant(Array.isArray(manifest.dishes) && manifest.dishes.length === 28, "28 canonical dishes are required.");
    const dishKeys = new Set();
    const countryKeys = new Set();
    const representedRegions = new Set();
    manifest.dishes.forEach((dish) => {
      invariant(/^[a-z0-9-]+$/.test(dish.key || "") && !dishKeys.has(dish.key), "dish keys must be unique slugs.");
      dishKeys.add(dish.key);
      invariant(typeof dish.name === "string" && dish.name.trim(), `dish ${dish.key} needs a name.`);
      invariant(mediaKeys.has(dish.media), `dish ${dish.key} references missing media.`);
      if (dish.countryCode) {
        const country = geography?.countries?.find((candidate) => candidate.key === dish.countryCode);
        invariant(country, `dish ${dish.key} has an unknown country code.`);
        invariant(geography.findCountry(dish.country)?.key === dish.countryCode, `dish ${dish.key} country does not match its code.`);
        const region = culinaryRegions?.findRegionByCountryKey?.(dish.countryCode);
        invariant(region, `dish ${dish.key} is outside the culinary regions.`);
        countryKeys.add(dish.countryCode);
        representedRegions.add(region.id);
      } else {
        invariant(dish.country === null, `dish ${dish.key} has an unresolved country mismatch.`);
      }
    });
    invariant(countryKeys.size >= 20 && countryKeys.size <= 22, "20–22 countries are required.");
    invariant(representedRegions.size === 13, "all 13 culinary regions must be represented.");

    invariant(Array.isArray(manifest.occasions) && manifest.occasions.length === 36, "36 occasions are required.");
    const occasionIds = new Set();
    let attemptCount = 0;
    manifest.occasions.forEach((occasion) => {
      invariant(/^demo-occasion-\d{3}$/.test(occasion.id || "") && !occasionIds.has(occasion.id), "occasion IDs must be deterministic and unique.");
      occasionIds.add(occasion.id);
      invariant(Number.isInteger(occasion.month) && occasion.month >= 1 && occasion.month <= 12, `${occasion.id} has an invalid month.`);
      invariant(Number.isInteger(occasion.day) && occasion.day >= 1 && occasion.day <= 31, `${occasion.id} has an invalid day.`);
      const calendarDate = new Date(2024, occasion.month - 1, occasion.day, 12, 0, 0);
      invariant(calendarDate.getMonth() === occasion.month - 1 && calendarDate.getDate() === occasion.day, `${occasion.id} has an invalid calendar date.`);
      invariant(Array.isArray(occasion.dishes) && occasion.dishes.length >= 1 && occasion.dishes.length <= 6, `${occasion.id} needs one to six dishes.`);
      invariant(occasion.dishes.every((key) => dishKeys.has(key)), `${occasion.id} references a missing dish.`);
      invariant(Array.isArray(occasion.ratings) && occasion.ratings.length === occasion.dishes.length, `${occasion.id} ratings do not match dishes.`);
      invariant(occasion.ratings.every((rating) => rating === null || (Number.isInteger(rating) && rating >= 1 && rating <= 10)), `${occasion.id} has an invalid rating.`);
      attemptCount += occasion.dishes.length;
    });
    invariant(attemptCount === 40, "40 dish attempts are required.");

    invariant(Array.isArray(manifest.ideas) && manifest.ideas.length >= 6 && manifest.ideas.length <= 8, "6–8 Ideas are required.");
    const ideaIds = new Set();
    manifest.ideas.forEach((idea) => {
      invariant(/^demo-idea-\d{3}$/.test(idea.id || "") && !ideaIds.has(idea.id), "Idea IDs must be deterministic and unique.");
      ideaIds.add(idea.id);
      invariant(typeof idea.title === "string" && idea.title.trim(), `${idea.id} needs a title.`);
      invariant(mediaKeys.has(idea.media), `${idea.id} references missing media.`);
      invariant(!idea.madeDish || dishKeys.has(idea.madeDish), `${idea.id} references a missing made dish.`);
      invariant(Array.isArray(idea.ingredients) && idea.ingredients.length > 0, `${idea.id} needs ingredients.`);
      invariant(Array.isArray(idea.instructions) && idea.instructions.length > 0, `${idea.id} needs instructions.`);
    });
    return manifest;
  }

  function previousCalendarYear(now = new Date()) {
    return now.getFullYear() - 1;
  }

  function repositoryForMode(mode, demoRepository, privateRepository) {
    if (mode !== "demo") return privateRepository;
    if (!demoRepository) throw new Error("The sample archive is unavailable.");
    return demoRepository;
  }

  function localDate(year, month, day) {
    const date = new Date(year, month - 1, day, 12, 0, 0);
    invariant(date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day, "an occasion date is not valid.");
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function createRepository(source, options = {}) {
    const manifest = validateManifest(clone(source));
    const year = Number(options.year) || previousCalendarYear(options.now || new Date());
    const dishes = new Map(manifest.dishes.map((dish, index) => [dish.key, {
      ...dish,
      id: `${DEMO_PREFIX}dish-${String(index + 1).padStart(3, "0")}`,
    }]));
    const madeIdeaByDish = new Map(manifest.ideas.filter((idea) => idea.madeDish).map((idea) => [idea.madeDish, idea.id]));

    const occasions = manifest.occasions.map((record, occasionIndex) => {
      const cookedAt = localDate(year, record.month, record.day);
      const timestamp = `${cookedAt}T18:30:00.000Z`;
      const attempts = record.dishes.map((dishKey, attemptIndex) => {
        const dish = dishes.get(dishKey);
        return {
          id: `${record.id}-attempt-${String(attemptIndex + 1).padStart(2, "0")}`,
          occasionId: record.id,
          dishId: dish.id,
          dishName: dish.name,
          aliases: [],
          country: dish.country,
          countryCode: dish.countryCode,
          rating: record.ratings[attemptIndex],
          notes: record.note,
          ingredients: `${dish.name}, aromatics, seasonal produce, and pantry staples`,
          transcript: null,
          sourceIdeaId: madeIdeaByDish.get(dishKey) || null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      });
      const primaryDish = dishes.get(record.dishes[0]);
      const photoCount = (occasionIndex + 1) % 9 === 0 ? 2 : 1;
      const photos = Array.from({ length: photoCount }, (_, photoIndex) => {
        const attemptIndex = Math.min(photoIndex, attempts.length - 1);
        const photographedDish = dishes.get(record.dishes[attemptIndex]) || primaryDish;
        const photographedMedia = manifest.media[photographedDish.media];
        return {
          id: `${record.id}-photo-${String(photoIndex + 1).padStart(2, "0")}`,
          occasionId: record.id,
          dishAttemptId: attempts[attemptIndex].id,
          blob: photographedMedia.display,
          thumbnailBlob: photographedMedia.thumbnail,
          mimeType: "image/webp",
          byteLength: 0,
          alt: `${photographedDish.name}, sample photograph`,
          attribution: {
            sourceTitle: photographedMedia.sourceTitle,
            sourcePage: photographedMedia.sourcePage,
            creator: photographedMedia.creator,
            license: photographedMedia.license,
            licenseUrl: photographedMedia.licenseUrl,
            modifications: photographedMedia.modifications,
          },
          createdAt: `${cookedAt}T18:${String(30 + photoIndex).padStart(2, "0")}:00.000Z`,
        };
      });
      return {
        id: record.id,
        cookedAt,
        createdAt: timestamp,
        updatedAt: timestamp,
        mainPhotoId: photos[0].id,
        mainPhoto: photos[0],
        photos,
        attempts,
        dishNames: attempts.map((attempt) => attempt.dishName),
      };
    }).sort((left, right) => `${right.cookedAt}|${right.id}`.localeCompare(`${left.cookedAt}|${left.id}`));

    const attempts = occasions.flatMap((occasion) => occasion.attempts.map((attempt) => {
      const dish = [...dishes.values()].find((candidate) => candidate.id === attempt.dishId);
      const assignedPhoto = occasion.photos.find((photo) => photo.dishAttemptId === attempt.id) || occasion.mainPhoto;
      return {
        ...attempt,
        occasionId: occasion.id,
        cookedAt: occasion.cookedAt,
        occasionCreatedAt: occasion.createdAt,
        photoId: assignedPhoto.id,
        photoBlob: assignedPhoto.blob,
        photoMimeType: assignedPhoto.mimeType,
        mapPhotoId: assignedPhoto.id,
        mapPhotoBlob: manifest.media[dish.media].thumbnail,
        mapPhotoMimeType: "image/webp",
        countryCode: dish.countryCode,
        mapLocation: null,
        occasionPhotoCount: occasion.photos.length,
        occasionDishNames: occasion.dishNames,
      };
    })).sort((left, right) => `${right.cookedAt}|${right.id}`.localeCompare(`${left.cookedAt}|${left.id}`));

    const madeIdeaIds = new Set(attempts.map((attempt) => attempt.sourceIdeaId).filter(Boolean));
    const ideas = manifest.ideas.map((idea, index) => {
      const media = manifest.media[idea.media];
      return {
        ...idea,
        description: idea.description,
        sourceKind: "manual",
        sourceUrl: null,
        sourceAuthor: "Fictional sample",
        servings: "4",
        prepTime: "20 minutes",
        cookTime: "35 minutes",
        personalNotes: index % 2 ? "Saved for a relaxed weekend." : "Try this when friends come over.",
        image: {
          id: `${idea.id}-image`,
          displayBlob: media.display,
          thumbnailBlob: media.thumbnail,
          alt: `${idea.title}, sample photograph`,
          attribution: {
            sourceTitle: media.sourceTitle,
            sourcePage: media.sourcePage,
            creator: media.creator,
            license: media.license,
            licenseUrl: media.licenseUrl,
            modifications: media.modifications,
          },
        },
        made: madeIdeaIds.has(idea.id),
        createdAt: `${year}-12-${String(24 - index).padStart(2, "0")}T12:00:00.000Z`,
        updatedAt: `${year}-12-${String(24 - index).padStart(2, "0")}T12:00:00.000Z`,
      };
    });

    function filterIdeas(options = {}) {
      const query = String(options.query || "").trim().toLocaleLowerCase("en");
      const filter = options.filter || "all";
      return ideas.filter((idea) => {
        if (filter === "made" && !idea.made) return false;
        if (filter === "unmade" && idea.made) return false;
        if (!query) return true;
        return [idea.title, idea.description, idea.sourceName, ...idea.ingredients].join(" ").toLocaleLowerCase("en").includes(query);
      }).sort((left, right) => `${right.createdAt}|${right.id}`.localeCompare(`${left.createdAt}|${left.id}`));
    }

    return Object.freeze({
      mode: "demo",
      year,
      manifest,
      async listDishAttempts() { return clone(attempts); },
      async listOccasions() { return clone(occasions); },
      async getCook(id) { return clone(attempts.find((attempt) => attempt.id === id || attempt.occasionId === id) || null); },
      async getOccasion(id) { return clone(occasions.find((occasion) => occasion.id === id) || null); },
      async listIdeas(options) { return clone(filterIdeas(options)); },
      async getIdea(id) { return clone(ideas.find((idea) => idea.id === id) || null); },
    });
  }

  async function load(options = {}) {
    const response = await (options.fetch || fetch)(options.url || MANIFEST_URL, {
      credentials: "same-origin",
      cache: "default",
      signal: options.signal,
    });
    if (!response.ok) throw new Error("The sample archive could not be loaded.");
    return createRepository(await response.json(), options);
  }

  return { MANIFEST_URL, MAX_MEDIA_BYTES, validateManifest, previousCalendarYear, repositoryForMode, createRepository, load };
});
