(function (root, factory) {
  const mapGeometry = typeof module === "object" && module.exports
    ? require("./map-geometry.js")
    : root?.WhatIMadeMapGeometry;
  const api = factory(root, mapGeometry);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeBackup = api;
})(typeof window !== "undefined" ? window : globalThis, function (root, mapGeometry) {
  "use strict";

  const FORMAT = "what-i-made-backup";
  const SCHEMA_VERSION = 2;
  const PERSISTENT_STORES = ["occasions", "dishes", "attempts", "photos", "ideas", "ideaImages"];
  const TRANSIENT_STORES = ["ideaDrafts"];
  const ARCHIVE_STORES = [...PERSISTENT_STORES, ...TRANSIENT_STORES];
  const BLOB_FIELDS = Object.freeze({ photos: ["blob", "thumbnailBlob"], ideaImages: ["displayBlob", "thumbnailBlob"] });

  function reportProgress(options, phase, completed, total) {
    if (typeof options?.onProgress === "function") options.onProgress({ phase, completed, total });
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let binary = "";
    const view = new Uint8Array(bytes);
    for (let offset = 0; offset < view.length; offset += 0x8000) {
      binary += String.fromCharCode(...view.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const validBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    if (typeof value !== "string" || !validBase64.test(value)) throw new Error("The backup contains invalid image data.");
    if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(value, "base64"));
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  }

  async function serializeRecord(storeName, record) {
    const output = { ...record };
    for (const field of BLOB_FIELDS[storeName] || []) {
      const blob = output[field];
      delete output[field];
      if (blob instanceof Blob) {
        output[`${field}Data`] = bytesToBase64(await blob.arrayBuffer());
        output[`${field}Type`] = blob.type || output.mimeType || "application/octet-stream";
      }
    }
    return output;
  }

  function deserializeRecord(storeName, record) {
    const output = { ...record };
    for (const field of BLOB_FIELDS[storeName] || []) {
      const dataKey = `${field}Data`;
      const typeKey = `${field}Type`;
      if (output[dataKey] !== undefined) {
        const bytes = base64ToBytes(output[dataKey]);
        output[field] = new Blob([bytes], { type: String(output[typeKey] || output.mimeType || "application/octet-stream") });
        delete output[dataKey];
        delete output[typeKey];
      }
    }
    return output;
  }

  async function buildBackupPayload(recordsByStore, now = new Date().toISOString(), options = {}) {
    const records = {};
    const total = PERSISTENT_STORES.reduce((sum, storeName) => sum + (recordsByStore[storeName]?.length || 0), 0);
    let completed = 0;
    reportProgress(options, "serialize", completed, total);
    for (const storeName of PERSISTENT_STORES) {
      const source = Array.isArray(recordsByStore[storeName]) ? recordsByStore[storeName] : [];
      records[storeName] = [];
      for (const record of source) {
        records[storeName].push(await serializeRecord(storeName, record));
        completed += 1;
        reportProgress(options, "serialize", completed, total);
      }
    }
    const counts = Object.fromEntries(PERSISTENT_STORES.map((name) => [name, records[name].length]));
    return { format: FORMAT, schemaVersion: SCHEMA_VERSION, createdAt: now, counts, records };
  }

  function isValidCookedDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return day <= [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }

  function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function validateBackupPayload(payload) {
    if (!payload || payload.format !== FORMAT || payload.schemaVersion !== SCHEMA_VERSION || !payload.records || !payload.counts) {
      throw new Error("Choose a supported What I Made backup.");
    }
    for (const storeName of PERSISTENT_STORES) {
      const records = payload.records[storeName];
      if (!Array.isArray(records) || !Number.isInteger(payload.counts[storeName]) || payload.counts[storeName] !== records.length) {
        throw new Error(`The backup count for ${storeName} does not match its records.`);
      }
      const ids = new Set();
      records.forEach((record) => {
        if (!record || typeof record.id !== "string" || !record.id || ids.has(record.id)) throw new Error(`The backup contains an invalid ${storeName} identity.`);
        ids.add(record.id);
      });
    }
    const occasionIds = new Set(payload.records.occasions.map((occasion) => occasion.id));
    const dishIds = new Set(payload.records.dishes.map((dish) => dish.id));
    const attemptIds = new Set(payload.records.attempts.map((attempt) => attempt.id));
    const photoIds = new Set(payload.records.photos.map((photo) => photo.id));
    const ideaIds = new Set(payload.records.ideas.map((idea) => idea.id));
    const ideaImageIds = new Set(payload.records.ideaImages.map((image) => image.id));
    const photosById = new Map(payload.records.photos.map((photo) => [photo.id, photo]));
    const attemptsById = new Map(payload.records.attempts.map((attempt) => [attempt.id, attempt]));
    const attemptsByOccasion = new Map();
    payload.records.attempts.forEach((attempt) => {
      if (!attemptsByOccasion.has(attempt.occasionId)) attemptsByOccasion.set(attempt.occasionId, []);
      attemptsByOccasion.get(attempt.occasionId).push(attempt);
    });
    const occasionDishPairs = new Set();
    const attemptedDishIds = new Set();
    payload.records.attempts.forEach((attempt) => {
      if (!occasionIds.has(attempt.occasionId)) throw new Error("The backup contains a cooking attempt without its occasion.");
      if (!dishIds.has(attempt.dishId)) throw new Error("The backup contains a cooking attempt without its dish.");
      const pair = `${attempt.occasionId}\u0000${attempt.dishId}`;
      if (occasionDishPairs.has(pair)) throw new Error("The backup contains the same dish more than once in a cooking occasion.");
      occasionDishPairs.add(pair);
      attemptedDishIds.add(attempt.dishId);
      if (attempt.rating !== null && attempt.rating !== undefined && (!Number.isInteger(attempt.rating) || attempt.rating < 1 || attempt.rating > 10)) throw new Error("The backup contains a cooking attempt with an invalid rating.");
      if (attempt.sourceIdeaId && !ideaIds.has(attempt.sourceIdeaId)) throw new Error("The backup contains a cooking attempt linked to a missing Idea.");
    });
    payload.records.occasions.forEach((occasion) => {
      if (!isValidCookedDate(occasion.cookedAt)) throw new Error("The backup contains a cooking occasion without a valid cooked date.");
      if (!(attemptsByOccasion.get(occasion.id) || []).length) throw new Error("The backup contains a cooking occasion without its cooking attempt.");
      if (!photoIds.has(occasion.mainPhotoId)) throw new Error("The backup contains a cooking occasion without its main photograph.");
      if (photosById.get(occasion.mainPhotoId).occasionId !== occasion.id) throw new Error("The backup contains a cooking occasion linked to another occasion's photograph.");
      if (photosById.get(occasion.mainPhotoId).role && photosById.get(occasion.mainPhotoId).role !== "main") throw new Error("The backup contains a cooking occasion whose main photograph has the wrong role.");
    });
    payload.records.dishes.forEach((dish) => {
      if (!hasText(dish.canonicalName)) throw new Error("The backup contains a dish without a name.");
      if (dish.mapLocation !== null && dish.mapLocation !== undefined) {
        const mapLocation = mapGeometry?.validateMapLocation?.(dish.mapLocation);
        const countryKey = dish.countryCode || mapGeometry?.resolvedPosition?.(dish.country)?.countryKey || "";
        if (mapLocation?.mapDataVersion === mapGeometry?.MAP_DATA_VERSION
          && (!countryKey || mapLocation.countryKey !== countryKey)) {
          throw new Error("The backup contains a dish map location outside its confirmed country.");
        }
      }
      if (dish.defaultMapPhotoId && !photoIds.has(dish.defaultMapPhotoId)) throw new Error("The backup contains a dish linked to a missing map photograph.");
      if (dish.defaultMapPhotoId) {
        const photo = photosById.get(dish.defaultMapPhotoId);
        const dishAttempts = payload.records.attempts.filter((attempt) => attempt.dishId === dish.id);
        const directlyAssigned = photo.dishAttemptId
          && dishAttempts.some((attempt) => attempt.id === photo.dishAttemptId);
        const currentOccasionMain = payload.records.occasions.some((occasion) => occasion.id === photo.occasionId
          && occasion.mainPhotoId === photo.id
          && dishAttempts.some((attempt) => attempt.occasionId === occasion.id));
        const eligible = directlyAssigned || currentOccasionMain;
        if (!eligible) throw new Error("The backup contains a dish linked to another dish's map photograph.");
      }
    });
    payload.records.ideaImages.forEach((image) => {
      if (!hasText(image.mimeType) || !image.mimeType.startsWith("image/")) throw new Error("The backup contains an Idea image with an invalid type.");
      if (!ideaIds.has(image.ideaId)) throw new Error("The backup contains an image without its Idea.");
      if (image.blobData !== undefined) throw new Error("The backup contains an unsupported Idea image format.");
      if (!hasText(image.displayBlobData) || !hasText(image.thumbnailBlobData)) throw new Error("The backup contains an Idea image without complete image data.");
      const displayBytes = base64ToBytes(image.displayBlobData);
      const thumbnailBytes = base64ToBytes(image.thumbnailBlobData);
      if (!displayBytes.length || !thumbnailBytes.length) throw new Error("The backup contains an Idea image without complete image data.");
      if (!Number.isInteger(image.byteLength) || image.byteLength !== displayBytes.length) throw new Error("The backup contains an Idea image with an invalid byte count.");
    });
    payload.records.ideas.forEach((idea) => {
      if (!hasText(idea.title)) throw new Error("The backup contains an Idea without a title.");
      if (!Array.isArray(idea.ingredients) || !idea.ingredients.length || idea.ingredients.some((item) => !hasText(item))) throw new Error("The backup contains an Idea without valid ingredients.");
      if (!Array.isArray(idea.instructions) || !idea.instructions.length || idea.instructions.some((item) => !hasText(item))) throw new Error("The backup contains an Idea without valid instructions.");
      if (!["url", "search", "generated", "manual"].includes(idea.sourceKind)) throw new Error("The backup contains an Idea with an invalid source type.");
      if (idea.imageId && !ideaImageIds.has(idea.imageId)) throw new Error("The backup contains an Idea linked to a missing image.");
      if (idea.imageId) {
        const image = payload.records.ideaImages.find((candidate) => candidate.id === idea.imageId);
        if (image.ideaId !== idea.id) throw new Error("The backup contains an Idea linked to another Idea's image.");
      }
    });
    payload.records.dishes.forEach((dish) => {
      if (!attemptedDishIds.has(dish.id)) throw new Error("The backup contains a dish without a cooking attempt.");
    });
    payload.records.photos.forEach((photo) => {
      if (photo.role !== undefined && !["main", "extra"].includes(photo.role)) throw new Error("The backup contains a photograph with an invalid role.");
      if (!hasText(photo.mimeType) || !photo.mimeType.startsWith("image/")) throw new Error("The backup contains a photograph with an invalid type.");
      if (!occasionIds.has(photo.occasionId)) throw new Error("The backup contains a photograph without its occasion.");
      if (photo.dishAttemptId && !attemptIds.has(photo.dishAttemptId)) throw new Error("The backup contains a photograph without its cooking attempt.");
      if (photo.dishAttemptId && attemptsById.get(photo.dishAttemptId).occasionId !== photo.occasionId) throw new Error("The backup contains a photograph linked across cooking occasions.");
      if (typeof photo.blobData !== "string" || !photo.blobData.length) throw new Error("The backup contains a photograph without image data.");
      const bytes = base64ToBytes(photo.blobData);
      if (!bytes.length || !Number.isInteger(photo.byteLength) || photo.byteLength !== bytes.length) throw new Error("The backup contains a photograph with an invalid byte count.");
    });
    return payload;
  }

  function archiveApi() {
    const archive = root.WhatIMadeArchive;
    if (!archive?.openDatabase) throw new Error("Local archive storage is unavailable.");
    return archive;
  }

  function createBackupFileName(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    const day = Number.isNaN(value.getTime()) ? new Date().toISOString().slice(0, 10) : value.toISOString().slice(0, 10);
    return `what-i-made-backup-${day}.json`;
  }

  function summarizePayload(payload, byteLength = null) {
    const mapLocationsReset = payload.records.dishes.filter((dish) => dish.mapLocation
      && dish.mapLocation.mapDataVersion !== mapGeometry?.MAP_DATA_VERSION).length;
    return {
      createdAt: payload.createdAt,
      schemaVersion: payload.schemaVersion,
      byteLength: Number.isFinite(byteLength) ? byteLength : null,
      counts: { ...payload.counts },
      cooks: payload.counts.occasions,
      dishes: payload.counts.dishes,
      ideas: payload.counts.ideas,
      cookingPhotos: payload.counts.photos,
      ideaImages: payload.counts.ideaImages,
      mapLocationsReset,
    };
  }

  function payloadForRestore(payload) {
    return {
      ...payload,
      records: {
        ...payload.records,
        dishes: payload.records.dishes.map((dish) => dish.mapLocation
          && dish.mapLocation.mapDataVersion !== mapGeometry?.MAP_DATA_VERSION
          ? { ...dish, mapLocation: null }
          : dish),
      },
    };
  }

  async function getArchiveSummary() {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const transaction = database.transaction(ARCHIVE_STORES, "readonly");
    const counts = {};
    await Promise.all(ARCHIVE_STORES.map(async (storeName) => {
      counts[storeName] = await archive.requestResult(transaction.objectStore(storeName).count());
    }));
    return {
      counts,
      cooks: counts.occasions,
      dishes: counts.dishes,
      ideas: counts.ideas,
      cookingPhotos: counts.photos,
      ideaImages: counts.ideaImages,
      drafts: counts.ideaDrafts,
      isEmpty: PERSISTENT_STORES.every((name) => counts[name] === 0),
    };
  }

  async function createBackupBlob(options = {}) {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const transaction = database.transaction(PERSISTENT_STORES, "readonly");
    const records = {};
    reportProgress(options, "read", 0, PERSISTENT_STORES.length);
    let completedStores = 0;
    await Promise.all(PERSISTENT_STORES.map(async (storeName) => {
      records[storeName] = await archive.requestResult(transaction.objectStore(storeName).getAll());
      completedStores += 1;
      reportProgress(options, "read", completedStores, PERSISTENT_STORES.length);
    }));
    const payload = await buildBackupPayload(records, new Date().toISOString(), options);
    reportProgress(options, "finalize", 0, 1);
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    reportProgress(options, "finalize", 1, 1);
    return blob;
  }

  async function inspectBackupBlob(source) {
    const text = typeof source === "string" ? source : await source.text();
    let payload;
    try { payload = JSON.parse(text); } catch { throw new Error("The selected file is not a valid What I Made backup."); }
    validateBackupPayload(payload);
    const byteLength = typeof source === "string" ? new Blob([source]).size : Number(source?.size);
    return { payload, summary: summarizePayload(payload, byteLength) };
  }

  function queueRestoreAfterEmptyCheck(transaction, payload, total, options) {
    return new Promise((resolve, reject) => {
      const counts = new Array(PERSISTENT_STORES.length);
      let remaining = PERSISTENT_STORES.length;
      const abortWith = (error) => {
        try { transaction.abort(); } catch {}
        reject(error);
      };
      const enqueueRestore = () => {
        if (counts.some(Boolean)) {
          abortWith(new Error("Restore requires an empty archive so existing memories cannot be overwritten."));
          return;
        }
        try {
          transaction.objectStore("ideaDrafts").clear();
          let completed = 0;
          for (const storeName of PERSISTENT_STORES) {
            for (const encoded of payload.records[storeName]) {
              transaction.objectStore(storeName).add(deserializeRecord(storeName, encoded));
              completed += 1;
              reportProgress(options, "restore", completed, total);
            }
          }
          resolve();
        } catch (error) {
          abortWith(error);
        }
      };
      PERSISTENT_STORES.forEach((storeName, index) => {
        const request = transaction.objectStore(storeName).count();
        request.onsuccess = () => {
          counts[index] = request.result;
          remaining -= 1;
          if (remaining === 0) enqueueRestore();
        };
        request.onerror = () => abortWith(request.error || new Error("The local archive could not be checked before restore."));
      });
    });
  }

  async function restoreValidatedBackup(payload, options = {}) {
    validateBackupPayload(payload);
    const restorablePayload = payloadForRestore(payload);
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const total = PERSISTENT_STORES.reduce((sum, name) => sum + payload.records[name].length, 0);
    const transaction = database.transaction(ARCHIVE_STORES, "readwrite");
    const done = archive.transactionDone(transaction);
    reportProgress(options, "restore", 0, total);
    try {
      await queueRestoreAfterEmptyCheck(transaction, restorablePayload, total, options);
      await done;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
    return { ...payload.counts };
  }

  async function clearArchive() {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const transaction = database.transaction(ARCHIVE_STORES, "readwrite");
    const done = archive.transactionDone(transaction);
    try {
      ARCHIVE_STORES.forEach((storeName) => transaction.objectStore(storeName).clear());
      await done;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  async function restoreBackupBlob(source, options = {}) {
    const inspection = await inspectBackupBlob(source);
    return restoreValidatedBackup(inspection.payload, options);
  }

  return {
    FORMAT,
    SCHEMA_VERSION,
    PERSISTENT_STORES,
    TRANSIENT_STORES,
    ARCHIVE_STORES,
    serializeRecord,
    deserializeRecord,
    buildBackupPayload,
    validateBackupPayload,
    createBackupFileName,
    summarizePayload,
    payloadForRestore,
    getArchiveSummary,
    createBackupBlob,
    inspectBackupBlob,
    restoreValidatedBackup,
    restoreBackupBlob,
    clearArchive,
  };
});
