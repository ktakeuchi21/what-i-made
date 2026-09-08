(function (root, factory) {
  const mapGeometry = typeof module === "object" && module.exports
    ? require("./map-geometry.js")
    : root?.WhatIMadeMapGeometry;
  const api = factory(root, mapGeometry);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeArchive = api;
})(typeof window !== "undefined" ? window : globalThis, function (root, mapGeometry) {
  "use strict";

  const DB_NAME = "what-i-made-archive";
  const ACCOUNT_DB_PREFIX = `${DB_NAME}-account-v1`;
  const DB_VERSION = 5;
  const STORES = ["occasions", "dishes", "attempts", "photos"];
  let activeArchiveKey = null;
  let contextVersion = 0;
  let databasePromise = null;

  function normalizeArchiveKey(value) {
    const key = String(value || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("A valid private archive context is required.");
    return key;
  }

  function databaseNameForArchiveKey(value = activeArchiveKey) {
    return value === null ? DB_NAME : `${ACCOUNT_DB_PREFIX}-${normalizeArchiveKey(value)}`;
  }

  function setArchiveContext(value) {
    const nextKey = normalizeArchiveKey(value);
    if (nextKey === activeArchiveKey) return databaseNameForArchiveKey();
    const pendingDatabase = databasePromise;
    contextVersion += 1;
    activeArchiveKey = nextKey;
    databasePromise = null;
    if (pendingDatabase) pendingDatabase.then((database) => database.close()).catch(() => {});
    return databaseNameForArchiveKey();
  }

  async function closeDatabase() {
    const pendingDatabase = databasePromise;
    contextVersion += 1;
    databasePromise = null;
    if (!pendingDatabase) return;
    try {
      const database = await pendingDatabase;
      database.close();
    } catch {}
  }

  function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `wim-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanOptional(value) {
    const cleaned = String(value || "").trim();
    return cleaned || null;
  }

  function resolvedCountryKey(value) {
    return mapGeometry?.resolvedPosition?.(value)?.countryKey || "";
  }

  function isEligibleMapPhoto(dishId, photo, attempts, occasions) {
    if (!dishId || !photo) return false;
    const dishAttempts = attempts.filter((attempt) => attempt.dishId === dishId);
    const attemptIds = new Set(dishAttempts.map((attempt) => attempt.id));
    if (photo.dishAttemptId && attemptIds.has(photo.dishAttemptId)) return true;
    const occasionIds = new Set(dishAttempts.map((attempt) => attempt.occasionId));
    return occasionIds.has(photo.occasionId)
      && occasions.some((occasion) => occasion.id === photo.occasionId && occasion.mainPhotoId === photo.id);
  }

  function isValidCookedDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
  }

  function normalizeRating(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 10 ? number : null;
  }

  function normalizeDishName(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
      .trim()
      .toLowerCase();
  }

  function shouldLearnAlias(canonicalName, aliases, proposedName) {
    const proposed = normalizeDishName(proposedName);
    return Boolean(proposed)
      && proposed !== normalizeDishName(canonicalName)
      && !(aliases || []).some((alias) => normalizeDishName(alias) === proposed);
  }

  function consolidateDishRecords(dishes, attempts, photos = []) {
    const sortedDishes = dishes.map((dish) => ({ ...dish, aliases: [...(dish.aliases || [])] }))
      .sort((left, right) => `${left.createdAt || ""}|${left.id}`.localeCompare(`${right.createdAt || ""}|${right.id}`));
    const attemptsCopy = attempts.map((attempt) => ({ ...attempt }));
    const keepers = new Map();
    const removedDishIds = [];

    sortedDishes.forEach((dish) => {
      const normalizedName = normalizeDishName(dish.canonicalName);
      dish.normalizedName = normalizedName || undefined;
      const keeper = keepers.get(normalizedName);
      if (!keeper || !normalizedName) {
        keepers.set(normalizedName || `dish:${dish.id}`, dish);
        return;
      }

      attemptsCopy.forEach((attempt) => {
        if (attempt.dishId === dish.id) attempt.dishId = keeper.id;
      });
      if (dish.canonicalName !== keeper.canonicalName && !keeper.aliases.includes(dish.canonicalName)) {
        keeper.aliases.push(dish.canonicalName);
      }
      if (!keeper.country && dish.country) keeper.country = dish.country;
      if (!keeper.defaultMapPhotoId && dish.defaultMapPhotoId) keeper.defaultMapPhotoId = dish.defaultMapPhotoId;
      removedDishIds.push(dish.id);
    });

    const photosByAttempt = new Map(photos.filter((photo) => photo.dishAttemptId).map((photo) => [photo.dishAttemptId, photo]));
    const photosByOccasion = new Map(photos.filter((photo) => photo.occasionId).map((photo) => [photo.occasionId, photo]));
    const earliestAttempts = attemptsCopy.slice().sort((left, right) =>
      `${left.createdAt || ""}|${left.id}`.localeCompare(`${right.createdAt || ""}|${right.id}`),
    );
    [...keepers.values()].forEach((dish) => {
      if (dish.defaultMapPhotoId) return;
      const attempt = earliestAttempts.find((candidate) => candidate.dishId === dish.id);
      const photo = attempt && (photosByAttempt.get(attempt.id) || photosByOccasion.get(attempt.occasionId));
      if (photo) dish.defaultMapPhotoId = photo.id;
    });

    return { dishes: [...keepers.values()], attempts: attemptsCopy, removedDishIds };
  }

  function buildCookRecords(input, now = new Date().toISOString(), ids = {}) {
    const dishName = String(input.dishName || "").trim();
    const cookedAt = String(input.cookedAt || "").trim();
    if (!dishName) throw new Error("A dish name is required.");
    if (!isValidCookedDate(cookedAt)) throw new Error("A valid cooked date is required.");
    if (!(input.photoBlob instanceof Blob) || input.photoBlob.size === 0) throw new Error("A main photo is required.");

    const occasionId = ids.occasionId || createId();
    const dishId = ids.dishId || createId();
    const attemptId = ids.attemptId || createId();
    const photoId = ids.photoId || createId();

    return {
      occasion: {
        id: occasionId,
        cookedAt,
        createdAt: now,
        updatedAt: now,
        mainPhotoId: photoId,
      },
      dish: {
        id: dishId,
        canonicalName: dishName,
        normalizedName: normalizeDishName(dishName) || undefined,
        aliases: [],
        country: cleanOptional(input.country),
        countryCode: resolvedCountryKey(input.country) || null,
        mapLocation: null,
        defaultMapPhotoId: photoId,
        createdAt: now,
        updatedAt: now,
      },
      attempt: {
        id: attemptId,
        occasionId,
        dishId,
        rating: normalizeRating(input.rating),
        notes: cleanOptional(input.notes),
        ingredientsText: cleanOptional(input.ingredients),
        transcript: cleanOptional(input.transcript),
        sourceIdeaId: cleanOptional(input.sourceIdeaId),
        createdAt: now,
        updatedAt: now,
      },
      photo: {
        id: photoId,
        occasionId,
        dishAttemptId: attemptId,
        role: "main",
        mimeType: input.photoBlob.type || "image/jpeg",
        byteLength: input.photoBlob.size,
        blob: input.photoBlob,
        createdAt: now,
      },
    };
  }

  function buildCookUpdateRecords(current, input, now = new Date().toISOString()) {
    const dishName = String(input.dishName || "").trim();
    const cookedAt = String(input.cookedAt || "").trim();
    if (!dishName) throw new Error("A dish name is required.");
    if (!isValidCookedDate(cookedAt)) throw new Error("A valid cooked date is required.");
    if (input.rating !== "" && input.rating !== null && input.rating !== undefined && normalizeRating(input.rating) === null) {
      throw new Error("Rating must be a whole number from 1 through 10.");
    }
    if (input.photoBlob !== undefined && (!(input.photoBlob instanceof Blob) || input.photoBlob.size === 0)) {
      throw new Error("Choose a valid replacement photo.");
    }
    if (!current.photo || !(current.photo.blob instanceof Blob) || current.photo.blob.size === 0) {
      throw new Error("This cook's original photo is missing, so it cannot be edited.");
    }

    const occasion = { ...current.occasion, cookedAt, updatedAt: now };
    const attempt = {
      ...current.attempt,
      rating: normalizeRating(input.rating),
      notes: cleanOptional(input.notes),
      ingredientsText: cleanOptional(input.ingredients),
      updatedAt: now,
    };
    const dish = { ...current.dish, aliases: [...(current.dish.aliases || [])] };
    if (dishName !== dish.canonicalName && !dish.aliases.includes(dish.canonicalName)) dish.aliases.push(dish.canonicalName);
    dish.canonicalName = dishName;
    dish.normalizedName = normalizeDishName(dishName) || undefined;
    const priorCountryKey = resolvedCountryKey(dish.country);
    dish.country = cleanOptional(input.country);
    dish.countryCode = resolvedCountryKey(dish.country) || null;
    if (priorCountryKey !== dish.countryCode) dish.mapLocation = null;
    dish.updatedAt = now;

    const photo = { ...current.photo };
    if (input.photoBlob !== undefined) {
      photo.blob = input.photoBlob;
      photo.mimeType = input.photoBlob.type || "image/jpeg";
      photo.byteLength = input.photoBlob.size;
    }
    return { occasion, attempt, dish, photo };
  }

  function assembleCooks(occasions, dishes, attempts, photos) {
    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    const attemptsByOccasion = new Map(attempts.map((attempt) => [attempt.occasionId, attempt]));
    const photosById = new Map(photos.map((photo) => [photo.id, photo]));

    return occasions
      .map((occasion) => {
        const attempt = attemptsByOccasion.get(occasion.id);
        const dish = attempt ? dishesById.get(attempt.dishId) : null;
        const photo = photosById.get(occasion.mainPhotoId);
        const mapPhoto = dish ? photosById.get(dish.defaultMapPhotoId) || photo : photo;
        if (!attempt || !dish || !photo) return null;
        return {
          id: occasion.id,
          cookedAt: occasion.cookedAt,
          createdAt: occasion.createdAt,
          updatedAt: occasion.updatedAt,
          dishId: dish.id,
          dishName: dish.canonicalName,
          country: dish.country,
          countryCode: dish.countryCode || resolvedCountryKey(dish.country) || null,
          mapLocation: dish.mapLocation || null,
          attemptId: attempt.id,
          rating: attempt.rating,
          notes: attempt.notes,
          ingredients: attempt.ingredientsText,
          transcript: attempt.transcript,
          sourceIdeaId: attempt.sourceIdeaId || null,
          photoId: photo.id,
          photoBlob: photo.blob,
          photoMimeType: photo.mimeType,
          mapPhotoId: mapPhoto.id,
          mapPhotoBlob: mapPhoto.blob,
          mapPhotoMimeType: mapPhoto.mimeType,
        };
      })
      .filter(Boolean)
      .sort((a, b) => `${b.cookedAt}|${b.createdAt}`.localeCompare(`${a.cookedAt}|${a.createdAt}`));
  }

  function assembleOccasions(occasions, dishes, attempts, photos) {
    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    const attemptsByOccasion = new Map();
    attempts.forEach((attempt) => {
      if (!attemptsByOccasion.has(attempt.occasionId)) attemptsByOccasion.set(attempt.occasionId, []);
      attemptsByOccasion.get(attempt.occasionId).push(attempt);
    });
    const photosByOccasion = new Map();
    photos.forEach((photo) => {
      if (!photosByOccasion.has(photo.occasionId)) photosByOccasion.set(photo.occasionId, []);
      photosByOccasion.get(photo.occasionId).push(photo);
    });
    return occasions.map((occasion) => {
      const occasionAttempts = (attemptsByOccasion.get(occasion.id) || []).slice().sort((left, right) => (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER) || `${left.createdAt || ""}|${left.id}`.localeCompare(`${right.createdAt || ""}|${right.id}`)).map((attempt) => {
        const dish = dishesById.get(attempt.dishId);
        if (!dish) return null;
        return {
          id: attempt.id,
          occasionId: occasion.id,
          dishId: dish.id,
          dishName: dish.canonicalName,
          aliases: [...(dish.aliases || [])],
          country: dish.country || null,
          rating: attempt.rating ?? null,
          notes: attempt.notes || null,
          ingredients: attempt.ingredientsText || null,
          transcript: attempt.transcript || null,
          sourceIdeaId: attempt.sourceIdeaId || null,
          createdAt: attempt.createdAt,
          updatedAt: attempt.updatedAt,
        };
      }).filter(Boolean);
      const occasionPhotos = (photosByOccasion.get(occasion.id) || []).slice()
        .sort((left, right) => `${left.createdAt || ""}|${left.id}`.localeCompare(`${right.createdAt || ""}|${right.id}`));
      const mainPhoto = occasionPhotos.find((photo) => photo.id === occasion.mainPhotoId);
      if (!occasionAttempts.length || !mainPhoto?.blob) return null;
      return {
        id: occasion.id,
        cookedAt: occasion.cookedAt,
        createdAt: occasion.createdAt,
        updatedAt: occasion.updatedAt,
        mainPhotoId: occasion.mainPhotoId,
        mainPhoto,
        photos: occasionPhotos,
        attempts: occasionAttempts,
        dishNames: occasionAttempts.map((attempt) => attempt.dishName),
      };
    }).filter(Boolean)
      .sort((left, right) => `${right.cookedAt}|${right.createdAt}|${right.id}`.localeCompare(`${left.cookedAt}|${left.createdAt}|${left.id}`));
  }

  function flattenDishAttempts(occasions, dishes = [], allPhotos = occasions.flatMap((occasion) => occasion.photos)) {
    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    const photosById = new Map(allPhotos.map((photo) => [photo.id, photo]));
    return occasions.flatMap((occasion) => occasion.attempts.map((attempt) => {
      const assignedPhotos = occasion.photos.filter((photo) => photo.dishAttemptId === attempt.id);
      const primaryPhoto = assignedPhotos[0] || occasion.mainPhoto;
      const dish = dishesById.get(attempt.dishId);
      const mapPhoto = photosById.get(dish?.defaultMapPhotoId) || primaryPhoto;
      return {
        ...attempt,
        id: attempt.id,
        occasionId: occasion.id,
        cookedAt: occasion.cookedAt,
        occasionCreatedAt: occasion.createdAt,
        photoId: primaryPhoto.id,
        photoBlob: primaryPhoto.blob,
        photoMimeType: primaryPhoto.mimeType,
        mapPhotoId: mapPhoto.id,
        mapPhotoBlob: mapPhoto.blob,
        mapPhotoMimeType: mapPhoto.mimeType,
        countryCode: dish?.countryCode || resolvedCountryKey(dish?.country) || null,
        mapLocation: dish?.mapLocation || null,
        occasionPhotoCount: occasion.photos.length,
        occasionDishNames: occasion.dishNames,
      };
    })).sort((left, right) => `${right.cookedAt}|${right.occasionCreatedAt}|${right.id}`.localeCompare(`${left.cookedAt}|${left.occasionCreatedAt}|${left.id}`));
  }

  function openDatabase() {
    if (!("indexedDB" in root)) return Promise.reject(new Error("Local journal storage is unavailable in this browser."));
    if (databasePromise) return databasePromise;

    const openingContextVersion = contextVersion;
    const databaseName = databaseNameForArchiveKey();
    const openingPromise = new Promise((resolve, reject) => {
      const request = root.indexedDB.open(databaseName, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const database = request.result;
        if (!database.objectStoreNames.contains("occasions")) {
          const store = database.createObjectStore("occasions", { keyPath: "id" });
          store.createIndex("cookedAt", "cookedAt");
        }
        if (!database.objectStoreNames.contains("dishes")) database.createObjectStore("dishes", { keyPath: "id" });
        if (!database.objectStoreNames.contains("attempts")) {
          const store = database.createObjectStore("attempts", { keyPath: "id" });
          store.createIndex("occasionId", "occasionId");
        }
        if (!database.objectStoreNames.contains("photos")) {
          const store = database.createObjectStore("photos", { keyPath: "id" });
          store.createIndex("occasionId", "occasionId");
        }
        if (!database.objectStoreNames.contains("ideas")) {
          const store = database.createObjectStore("ideas", { keyPath: "id" });
          store.createIndex("canonicalSourceUrl", "canonicalSourceUrl", { unique: true });
          store.createIndex("updatedAt", "updatedAt");
        }
        if (!database.objectStoreNames.contains("ideaImages")) {
          database.createObjectStore("ideaImages", { keyPath: "id" }).createIndex("ideaId", "ideaId", { unique: true });
        }
        if (!database.objectStoreNames.contains("ideaDrafts")) database.createObjectStore("ideaDrafts", { keyPath: "id" });
        if (event.oldVersion > 0 && event.oldVersion < 5) {
          const attemptsStore = request.transaction.objectStore("attempts");
          if (attemptsStore.indexNames.contains("occasionId")) attemptsStore.deleteIndex("occasionId");
          attemptsStore.createIndex("occasionId", "occasionId");
        }
        const dishesStore = request.transaction.objectStore("dishes");
        if (event.oldVersion < 3) {
          if (dishesStore.indexNames.contains("normalizedName")) dishesStore.deleteIndex("normalizedName");
          dishesStore.createIndex("normalizedName", "normalizedName");
        }
        if (event.oldVersion === 2) {
          const dishesRequest = dishesStore.getAll();
          dishesRequest.onsuccess = () => {
            dishesRequest.result.forEach((dish) => {
              dish.normalizedName = normalizeDishName(dish.canonicalName) || undefined;
              dishesStore.put(dish);
            });
          };
        }
        if (event.oldVersion < 2) {
          const attemptsStore = request.transaction.objectStore("attempts");
          const photosStore = request.transaction.objectStore("photos");
          const dishesRequest = dishesStore.getAll();
          const attemptsRequest = attemptsStore.getAll();
          const photosRequest = photosStore.getAll();
          let legacyDishes = null;
          let legacyAttempts = null;
          let legacyPhotos = null;
          const consolidate = () => {
            if (!legacyDishes || !legacyAttempts || !legacyPhotos) return;
            const result = consolidateDishRecords(legacyDishes, legacyAttempts, legacyPhotos);
            result.dishes.forEach((dish) => dishesStore.put(dish));
            result.attempts.forEach((attempt) => attemptsStore.put(attempt));
            result.removedDishIds.forEach((id) => dishesStore.delete(id));
          };
          dishesRequest.onsuccess = () => {
            legacyDishes = dishesRequest.result;
            consolidate();
          };
          attemptsRequest.onsuccess = () => {
            legacyAttempts = attemptsRequest.result;
            consolidate();
          };
          photosRequest.onsuccess = () => {
            legacyPhotos = photosRequest.result;
            consolidate();
          };
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (openingContextVersion !== contextVersion || databasePromise !== openingPromise) {
          database.close();
          reject(new Error("The private archive account changed while storage was opening."));
          return;
        }
        database.onversionchange = () => {
          database.close();
          if (databasePromise === openingPromise) databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => {
        if (databasePromise === openingPromise) databasePromise = null;
        reject(request.error || new Error("The local journal could not be opened."));
      };
      request.onblocked = () => {
        if (databasePromise === openingPromise) databasePromise = null;
        reject(new Error("Close other copies of What I Made, then try again."));
      };
    });
    databasePromise = openingPromise;
    return databasePromise;
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("The local journal write failed."));
      transaction.onabort = () => reject(transaction.error || new Error("The local journal write was cancelled."));
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("The local journal read failed."));
    });
  }

  async function saveCook(input) {
    const records = buildCookRecords(input);
    const database = await openDatabase();
    const transaction = database.transaction(STORES, "readwrite");
    const done = transactionDone(transaction);
    const dishesStore = transaction.objectStore("dishes");
    const existingDish = records.dish.normalizedName && !input.forceNewDish
      ? await requestResult(dishesStore.index("normalizedName").get(records.dish.normalizedName))
      : null;
    if (existingDish) {
      records.attempt.dishId = existingDish.id;
      existingDish.aliases = existingDish.aliases || [];
      if (shouldLearnAlias(existingDish.canonicalName, existingDish.aliases, records.dish.canonicalName)) {
        existingDish.aliases.push(records.dish.canonicalName);
      }
      if (records.dish.country) existingDish.country = records.dish.country;
      if (!existingDish.defaultMapPhotoId) existingDish.defaultMapPhotoId = records.photo.id;
      existingDish.updatedAt = records.dish.updatedAt;
      dishesStore.put(existingDish);
    } else {
      dishesStore.add(records.dish);
    }
    transaction.objectStore("occasions").add(records.occasion);
    transaction.objectStore("attempts").add(records.attempt);
    transaction.objectStore("photos").add(records.photo);
    await done;
    return records.occasion.id;
  }

  async function listCooks() {
    return listDishAttempts();
  }

  async function readArchiveRecords() {
    const database = await openDatabase();
    const transaction = database.transaction(STORES, "readonly");
    const [occasions, dishes, attempts, photos] = await Promise.all(
      STORES.map((name) => requestResult(transaction.objectStore(name).getAll())),
    );
    return { occasions, dishes, attempts, photos };
  }

  async function listOccasions() {
    const records = await readArchiveRecords();
    return assembleOccasions(records.occasions, records.dishes, records.attempts, records.photos);
  }

  async function getOccasion(id) {
    const occasions = await listOccasions();
    return occasions.find((occasion) => occasion.id === id) || null;
  }

  async function listDishAttempts() {
    const records = await readArchiveRecords();
    return flattenDishAttempts(assembleOccasions(records.occasions, records.dishes, records.attempts, records.photos), records.dishes, records.photos);
  }

  async function saveOccasion(input) {
    const cookedAt = String(input.cookedAt || "").trim();
    const dishInputs = Array.isArray(input.dishes) ? input.dishes : [];
    const photoInputs = Array.isArray(input.photos) ? input.photos : [];
    if (!isValidCookedDate(cookedAt)) throw new Error("A valid cooked date is required.");
    if (!dishInputs.length || dishInputs.some((dish) => !String(dish.dishName || "").trim())) throw new Error("Every dish needs a name.");
    if (!photoInputs.length || !(photoInputs[0].blob instanceof Blob) || photoInputs[0].blob.size === 0) throw new Error("A main photo is required.");
    const now = new Date().toISOString();
    const occasionId = createId();
    const database = await openDatabase();
    const transaction = database.transaction(STORES, "readwrite");
    const done = transactionDone(transaction);
    try {
      const dishesStore = transaction.objectStore("dishes");
      const attemptsStore = transaction.objectStore("attempts");
      const photosStore = transaction.objectStore("photos");
      const seenDishIds = new Set();
      const attemptRecords = [];
      for (const [dishIndex, dishInput] of dishInputs.entries()) {
        const dishName = String(dishInput.dishName).trim();
        const normalizedName = normalizeDishName(dishName) || undefined;
        let dish = dishInput.matchedDishId ? await requestResult(dishesStore.get(dishInput.matchedDishId)) : null;
        if (dishInput.matchedDishId && !dish) throw new Error("The selected existing dish is no longer available.");
        if (!dish && normalizedName && !dishInput.forceNewDish) dish = await requestResult(dishesStore.index("normalizedName").get(normalizedName));
        if (!dish) {
          dish = { id: createId(), canonicalName: dishName, normalizedName, aliases: [], country: cleanOptional(dishInput.country), countryCode: resolvedCountryKey(dishInput.country) || null, mapLocation: null, defaultMapPhotoId: null, createdAt: now, updatedAt: now };
          dishesStore.add(dish);
        } else {
          if (seenDishIds.has(dish.id)) throw new Error("The same dish can appear only once in a cooking occasion.");
          dish.aliases = [...(dish.aliases || [])];
          if (shouldLearnAlias(dish.canonicalName, dish.aliases, dishName)) dish.aliases.push(dishName);
          if (cleanOptional(dishInput.country)) {
            const previousCountryKey = resolvedCountryKey(dish.country);
            dish.country = cleanOptional(dishInput.country);
            dish.countryCode = resolvedCountryKey(dish.country) || null;
            if (previousCountryKey !== dish.countryCode) dish.mapLocation = null;
          }
          dish.updatedAt = now;
          dishesStore.put(dish);
        }
        seenDishIds.add(dish.id);
        const attempt = { id: createId(), occasionId, dishId: dish.id, position: dishIndex, rating: normalizeRating(dishInput.rating), notes: cleanOptional(dishInput.notes), ingredientsText: cleanOptional(dishInput.ingredients), transcript: cleanOptional(dishInput.transcript), sourceIdeaId: cleanOptional(dishInput.sourceIdeaId), createdAt: now, updatedAt: now };
        attemptsStore.add(attempt);
        attemptRecords.push({ attempt, dish });
      }
      const photoRecords = photoInputs.map((photoInput, index) => {
        if (!(photoInput.blob instanceof Blob) || photoInput.blob.size === 0) throw new Error("Choose valid photographs.");
        const attempt = Number.isInteger(photoInput.dishIndex) ? attemptRecords[photoInput.dishIndex]?.attempt : null;
        return { id: createId(), occasionId, dishAttemptId: attempt?.id || null, role: index === 0 ? "main" : "extra", mimeType: photoInput.blob.type || "image/jpeg", byteLength: photoInput.blob.size, blob: photoInput.blob, thumbnailBlob: photoInput.thumbnailBlob instanceof Blob ? photoInput.thumbnailBlob : null, width: photoInput.width || null, height: photoInput.height || null, createdAt: now };
      });
      photoRecords.forEach((photo) => photosStore.add(photo));
      transaction.objectStore("occasions").add({ id: occasionId, cookedAt, createdAt: now, updatedAt: now, mainPhotoId: photoRecords[0].id });
      attemptRecords.forEach(({ dish, attempt }) => {
        if (dish.defaultMapPhotoId) return;
        const assigned = photoRecords.find((photo) => photo.dishAttemptId === attempt.id);
        dish.defaultMapPhotoId = (assigned || photoRecords[0]).id;
        dishesStore.put(dish);
      });
      await done;
      return occasionId;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function addDishToOccasion(occasionId, input) {
    const database = await openDatabase();
    const transaction = database.transaction(STORES, "readwrite");
    const done = transactionDone(transaction);
    try {
      const occasion = await requestResult(transaction.objectStore("occasions").get(occasionId));
      if (!occasion) throw new Error("That cooking occasion is no longer available.");
      const name = String(input.dishName || "").trim();
      if (!name) throw new Error("A dish name is required.");
      const dishesStore = transaction.objectStore("dishes");
      const attemptsStore = transaction.objectStore("attempts");
      const normalizedName = normalizeDishName(name) || undefined;
      let dish = normalizedName && !input.forceNewDish ? await requestResult(dishesStore.index("normalizedName").get(normalizedName)) : null;
      const existingAttempts = await requestResult(attemptsStore.index("occasionId").getAll(occasionId));
      if (dish && existingAttempts.some((attempt) => attempt.dishId === dish.id)) throw new Error("That dish is already part of this occasion.");
      const now = new Date().toISOString();
      const isNewDish = !dish;
      if (!dish) {
        dish = { id: createId(), canonicalName: name, normalizedName, aliases: [], country: cleanOptional(input.country), countryCode: resolvedCountryKey(input.country) || null, mapLocation: null, defaultMapPhotoId: null, createdAt: now, updatedAt: now };
      } else {
        if (cleanOptional(input.country)) {
          const previousCountryKey = resolvedCountryKey(dish.country);
          dish.country = cleanOptional(input.country);
          dish.countryCode = resolvedCountryKey(dish.country) || null;
          if (previousCountryKey !== dish.countryCode) dish.mapLocation = null;
        }
        dish.updatedAt = now;
      }
      const attempt = { id: createId(), occasionId, dishId: dish.id, position: existingAttempts.reduce((maximum, candidate) => Math.max(maximum, Number.isInteger(candidate.position) ? candidate.position : -1), -1) + 1, rating: normalizeRating(input.rating), notes: cleanOptional(input.notes), ingredientsText: cleanOptional(input.ingredients), transcript: cleanOptional(input.transcript), sourceIdeaId: cleanOptional(input.sourceIdeaId), createdAt: now, updatedAt: now };
      attemptsStore.add(attempt);
      if (input.photo) {
        if (!(input.photo.blob instanceof Blob) || !input.photo.blob.size) throw new Error("Choose a valid photograph.");
        const photo = { id: createId(), occasionId, dishAttemptId: attempt.id, role: "extra", mimeType: input.photo.blob.type || "image/jpeg", byteLength: input.photo.blob.size, blob: input.photo.blob, thumbnailBlob: input.photo.thumbnailBlob instanceof Blob ? input.photo.thumbnailBlob : null, width: input.photo.width || null, height: input.photo.height || null, createdAt: now };
        transaction.objectStore("photos").add(photo);
        if (!dish.defaultMapPhotoId) dish.defaultMapPhotoId = photo.id;
      }
      if (!dish.defaultMapPhotoId) dish.defaultMapPhotoId = occasion.mainPhotoId;
      if (isNewDish) dishesStore.add(dish);
      else dishesStore.put(dish);
      occasion.updatedAt = now;
      transaction.objectStore("occasions").put(occasion);
      await done;
      return attempt.id;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function addPhotosToOccasion(occasionId, inputs) {
    const database = await openDatabase();
    const transaction = database.transaction(["occasions", "attempts", "photos"], "readwrite");
    const done = transactionDone(transaction);
    try {
      const occasion = await requestResult(transaction.objectStore("occasions").get(occasionId));
      if (!occasion) throw new Error("That cooking occasion is no longer available.");
      const attempts = await requestResult(transaction.objectStore("attempts").index("occasionId").getAll(occasionId));
      const attemptIds = new Set(attempts.map((attempt) => attempt.id));
      const now = new Date().toISOString();
      const records = inputs.map((input) => {
        if (!(input.blob instanceof Blob) || !input.blob.size) throw new Error("Choose valid photographs.");
        if (input.dishAttemptId && !attemptIds.has(input.dishAttemptId)) throw new Error("A photograph can only be assigned to a dish in this occasion.");
        return { id: createId(), occasionId, dishAttemptId: input.dishAttemptId || null, role: "extra", mimeType: input.blob.type || "image/jpeg", byteLength: input.blob.size, blob: input.blob, thumbnailBlob: input.thumbnailBlob instanceof Blob ? input.thumbnailBlob : null, width: input.width || null, height: input.height || null, createdAt: now };
      });
      records.forEach((record) => transaction.objectStore("photos").add(record));
      occasion.updatedAt = now;
      transaction.objectStore("occasions").put(occasion);
      await done;
      return records.map((record) => record.id);
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function updatePhoto(occasionId, photoId, changes) {
    const database = await openDatabase();
    const transaction = database.transaction(["occasions", "dishes", "attempts", "photos"], "readwrite");
    const done = transactionDone(transaction);
    try {
      const occasionsStore = transaction.objectStore("occasions");
      const photosStore = transaction.objectStore("photos");
      const occasion = await requestResult(occasionsStore.get(occasionId));
      const photo = await requestResult(photosStore.get(photoId));
      if (!occasion || !photo || photo.occasionId !== occasionId) throw new Error("That photograph is no longer available.");
      const previousAttemptId = photo.dishAttemptId || null;
      let nextAttempt = null;
      if (changes.dishAttemptId !== undefined && changes.dishAttemptId !== null) {
        nextAttempt = await requestResult(transaction.objectStore("attempts").get(changes.dishAttemptId));
        if (!nextAttempt || nextAttempt.occasionId !== occasionId) throw new Error("A photograph can only be assigned to a dish in this occasion.");
      }
      if (changes.dishAttemptId !== undefined) photo.dishAttemptId = changes.dishAttemptId || null;
      if (changes.makeMain && occasion.mainPhotoId !== photo.id) {
        const previous = await requestResult(photosStore.get(occasion.mainPhotoId));
        if (previous) { previous.role = "extra"; photosStore.put(previous); }
        photo.role = "main";
        occasion.mainPhotoId = photo.id;
        if (previous) {
          const dishesStore = transaction.objectStore("dishes");
          const attemptsStore = transaction.objectStore("attempts");
          const [dishes, allAttempts, allPhotos, allOccasions] = await Promise.all([
            requestResult(dishesStore.getAll()),
            requestResult(attemptsStore.getAll()),
            requestResult(photosStore.getAll()),
            requestResult(occasionsStore.getAll()),
          ]);
          const currentOccasions = allOccasions.map((candidate) => candidate.id === occasion.id ? occasion : candidate);
          for (const dish of dishes.filter((candidate) => candidate.defaultMapPhotoId === previous.id)) {
            if (isEligibleMapPhoto(dish.id, previous, allAttempts, currentOccasions)) continue;
            const eligible = allPhotos.filter((candidate) => candidate.id !== previous.id
              && isEligibleMapPhoto(dish.id, candidate, allAttempts, currentOccasions))
              .sort((left, right) => `${left.createdAt || ""}|${left.id}`.localeCompare(`${right.createdAt || ""}|${right.id}`));
            dish.defaultMapPhotoId = eligible.at(-1)?.id || null;
            dishesStore.put(dish);
          }
        }
      }
      if (changes.dishAttemptId !== undefined && previousAttemptId !== photo.dishAttemptId && photo.id !== occasion.mainPhotoId) {
        const dishesStore = transaction.objectStore("dishes");
        const attemptsStore = transaction.objectStore("attempts");
        const previousAttempt = previousAttemptId ? await requestResult(attemptsStore.get(previousAttemptId)) : null;
        const previousDish = previousAttempt ? await requestResult(dishesStore.get(previousAttempt.dishId)) : null;
        if (previousDish?.defaultMapPhotoId === photo.id) {
          const [allAttempts, allPhotos, allOccasions] = await Promise.all([
            requestResult(attemptsStore.getAll()), requestResult(photosStore.getAll()), requestResult(occasionsStore.getAll()),
          ]);
          const eligible = allPhotos.filter((candidate) => candidate.id !== photo.id
            && isEligibleMapPhoto(previousDish.id, candidate, allAttempts, allOccasions))
            .sort((left, right) => `${left.createdAt || ""}|${left.id}`.localeCompare(`${right.createdAt || ""}|${right.id}`));
          previousDish.defaultMapPhotoId = eligible.at(-1)?.id || null;
          dishesStore.put(previousDish);
        }
        if (nextAttempt) {
          const nextDish = await requestResult(dishesStore.get(nextAttempt.dishId));
          if (nextDish && !nextDish.defaultMapPhotoId) { nextDish.defaultMapPhotoId = photo.id; dishesStore.put(nextDish); }
        }
      }
      occasion.updatedAt = new Date().toISOString();
      photosStore.put(photo);
      occasionsStore.put(occasion);
      await done;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function deletePhoto(occasionId, photoId) {
    const database = await openDatabase();
    const transaction = database.transaction(["occasions", "dishes", "attempts", "photos"], "readwrite");
    const done = transactionDone(transaction);
    try {
      const occasion = await requestResult(transaction.objectStore("occasions").get(occasionId));
      const photo = await requestResult(transaction.objectStore("photos").get(photoId));
      if (!occasion || !photo || photo.occasionId !== occasionId) throw new Error("That photograph is no longer available.");
      if (occasion.mainPhotoId === photoId) throw new Error("Make another photograph the main photo before deleting this one.");
      transaction.objectStore("photos").delete(photoId);
      const dishes = await requestResult(transaction.objectStore("dishes").getAll());
      const allAttempts = await requestResult(transaction.objectStore("attempts").getAll());
      const allPhotos = await requestResult(transaction.objectStore("photos").getAll());
      const allOccasions = await requestResult(transaction.objectStore("occasions").getAll());
      for (const dish of dishes.filter((candidate) => candidate.defaultMapPhotoId === photoId)) {
        const remaining = allPhotos.filter((candidate) => candidate.id !== photoId
          && isEligibleMapPhoto(dish.id, candidate, allAttempts, allOccasions))
          .sort((left, right) => `${left.createdAt || ""}|${left.id}`.localeCompare(`${right.createdAt || ""}|${right.id}`));
        dish.defaultMapPhotoId = remaining.at(-1)?.id || null;
        transaction.objectStore("dishes").put(dish);
      }
      await done;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function removeDishAttempt(occasionId, attemptId) {
    const database = await openDatabase();
    const transaction = database.transaction(STORES, "readwrite");
    const done = transactionDone(transaction);
    try {
      const attemptsStore = transaction.objectStore("attempts");
      const attempts = await requestResult(attemptsStore.index("occasionId").getAll(occasionId));
      const attempt = attempts.find((candidate) => candidate.id === attemptId);
      if (!attempt) throw new Error("That dish is no longer part of this occasion.");
      if (attempts.length <= 1) throw new Error("A cooking occasion must keep at least one dish.");
      const occasion = await requestResult(transaction.objectStore("occasions").get(occasionId));
      const photos = await requestResult(transaction.objectStore("photos").index("occasionId").getAll(occasionId));
      photos.filter((photo) => photo.dishAttemptId === attemptId).forEach((photo) => {
        if (photo.id === occasion.mainPhotoId) { photo.dishAttemptId = null; transaction.objectStore("photos").put(photo); }
        else transaction.objectStore("photos").delete(photo.id);
      });
      attemptsStore.delete(attemptId);
      const remainingAttempts = (await requestResult(attemptsStore.getAll())).filter((candidate) => candidate.id !== attemptId && candidate.dishId === attempt.dishId);
      if (!remainingAttempts.length) transaction.objectStore("dishes").delete(attempt.dishId);
      else {
        const dish = await requestResult(transaction.objectStore("dishes").get(attempt.dishId));
        const deletedPhotoIds = new Set(photos.filter((photo) => photo.dishAttemptId === attemptId && photo.id !== occasion.mainPhotoId).map((photo) => photo.id));
        const noLongerEligiblePhotoIds = new Set(photos.filter((photo) => photo.dishAttemptId === attemptId).map((photo) => photo.id));
        if (dish && noLongerEligiblePhotoIds.has(dish.defaultMapPhotoId)) {
          const allPhotos = await requestResult(transaction.objectStore("photos").getAll());
          const allOccasions = await requestResult(transaction.objectStore("occasions").getAll());
          const eligible = allPhotos.filter((photo) => !deletedPhotoIds.has(photo.id)
            && isEligibleMapPhoto(dish.id, photo, remainingAttempts, allOccasions))
            .sort((left, right) => `${left.createdAt || ""}|${left.id}`.localeCompare(`${right.createdAt || ""}|${right.id}`));
          dish.defaultMapPhotoId = eligible.at(-1)?.id || null;
          transaction.objectStore("dishes").put(dish);
        }
      }
      await done;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function getCook(id) {
    const cooks = await listCooks();
    return cooks.find((cook) => cook.id === id || cook.occasionId === id) || null;
  }

  async function getDishMapPreferences(dishId) {
    const database = await openDatabase();
    const transaction = database.transaction(STORES, "readonly");
    const done = transactionDone(transaction);
    const [dish, attempts, photos, occasions] = await Promise.all([
      requestResult(transaction.objectStore("dishes").get(dishId)),
      requestResult(transaction.objectStore("attempts").getAll()),
      requestResult(transaction.objectStore("photos").getAll()),
      requestResult(transaction.objectStore("occasions").getAll()),
    ]);
    await done;
    if (!dish) throw new Error("That dish is no longer available.");
    const eligiblePhotos = photos.filter((photo) => isEligibleMapPhoto(dishId, photo, attempts, occasions))
      .sort((left, right) => `${right.createdAt || ""}|${right.id}`.localeCompare(`${left.createdAt || ""}|${left.id}`));
    return { dish, eligiblePhotos };
  }

  async function updateDishMapPreferences(dishId, input) {
    const database = await openDatabase();
    const transaction = database.transaction(STORES, "readwrite");
    const done = transactionDone(transaction);
    try {
      const dishesStore = transaction.objectStore("dishes");
      const [dish, attempts, photos, occasions] = await Promise.all([
        requestResult(dishesStore.get(dishId)),
        requestResult(transaction.objectStore("attempts").getAll()),
        requestResult(transaction.objectStore("photos").getAll()),
        requestResult(transaction.objectStore("occasions").getAll()),
      ]);
      if (!dish) throw new Error("That dish is no longer available.");
      const eligiblePhotos = photos.filter((photo) => isEligibleMapPhoto(dishId, photo, attempts, occasions));
      if (input.defaultMapPhotoId && !eligiblePhotos.some((photo) => photo.id === input.defaultMapPhotoId)) {
        throw new Error("Choose a photograph from this dish's cooking history.");
      }
      const mapLocation = input.mapLocation === null
        ? null
        : mapGeometry?.validateMapLocation?.(input.mapLocation, { requireCurrentVersion: true });
      const countryKey = resolvedCountryKey(dish.country);
      if (mapLocation && mapLocation.countryKey !== countryKey) throw new Error("Keep the approximate location inside the confirmed country.");
      dish.defaultMapPhotoId = input.defaultMapPhotoId || eligiblePhotos[0]?.id || null;
      dish.mapLocation = mapLocation;
      dish.countryCode = countryKey || null;
      dish.updatedAt = new Date().toISOString();
      dishesStore.put(dish);
      await done;
      return dish;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function updateCook(id, input) {
    const database = await openDatabase();
    const transaction = database.transaction(STORES, "readwrite");
    const done = transactionDone(transaction);
    try {
      const occasionsStore = transaction.objectStore("occasions");
      const attemptsStore = transaction.objectStore("attempts");
      const dishesStore = transaction.objectStore("dishes");
      const photosStore = transaction.objectStore("photos");
      let occasion = await requestResult(occasionsStore.get(id));
      let attempt = occasion ? await requestResult(attemptsStore.index("occasionId").get(id)) : await requestResult(attemptsStore.get(id));
      if (!occasion && attempt) occasion = await requestResult(occasionsStore.get(attempt.occasionId));
      if (!occasion) throw new Error("That cook is no longer available.");
      if (!attempt) throw new Error("That cook is incomplete and could not be edited.");
      const dish = await requestResult(dishesStore.get(attempt.dishId));
      if (!dish) throw new Error("That dish is no longer available.");
      const photo = await requestResult(photosStore.get(occasion.mainPhotoId));
      const updated = buildCookUpdateRecords({ occasion, attempt, dish, photo }, input);
      occasionsStore.put(updated.occasion);
      attemptsStore.put(updated.attempt);
      dishesStore.put(updated.dish);
      if (updated.photo) photosStore.put(updated.photo);

      await done;
      return id;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  return { DB_NAME, ACCOUNT_DB_PREFIX, DB_VERSION, normalizeArchiveKey, databaseNameForArchiveKey, setArchiveContext, closeDatabase, normalizeDishName, shouldLearnAlias, consolidateDishRecords, buildCookRecords, buildCookUpdateRecords, assembleCooks, assembleOccasions, flattenDishAttempts, isEligibleMapPhoto, openDatabase, requestResult, transactionDone, saveCook, saveOccasion, addDishToOccasion, addPhotosToOccasion, updatePhoto, deletePhoto, removeDishAttempt, updateCook, listCooks, listOccasions, listDishAttempts, getCook, getOccasion, getDishMapPreferences, updateDishMapPreferences };
});
