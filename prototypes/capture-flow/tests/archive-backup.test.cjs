const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SCHEMA_VERSION,
  PERSISTENT_STORES,
  ARCHIVE_STORES,
  buildBackupPayload,
  validateBackupPayload,
  deserializeRecord,
  createBackupFileName,
  summarizePayload,
  payloadForRestore,
  inspectBackupBlob,
  getArchiveSummary,
  restoreValidatedBackup,
  clearArchive,
} = require("../archive-backup.js");

test("keeps schema v2 compatible while resetting older geography locations", async () => {
  const source = records();
  source.dishes[0].mapLocation = { x: 50, y: 50, countryKey: "USA", mapDataVersion: 99 };
  const payload = await buildBackupPayload(source);
  assert.doesNotThrow(() => validateBackupPayload(payload));
  assert.equal(summarizePayload(payload).mapLocationsReset, 1);
  assert.equal(payloadForRestore(payload).records.dishes[0].mapLocation, null);
});

function records() {
  return {
    occasions: [{ id: "occasion-1", cookedAt: "2026-09-06", mainPhotoId: "photo-1" }],
    dishes: [{ id: "dish-1", canonicalName: "Soup", defaultMapPhotoId: "photo-1" }],
    attempts: [{ id: "attempt-1", occasionId: "occasion-1", dishId: "dish-1", sourceIdeaId: "idea-1", rating: 8 }],
    photos: [{ id: "photo-1", occasionId: "occasion-1", dishAttemptId: "attempt-1", mimeType: "image/jpeg", byteLength: 10, blob: new Blob(["cook-photo"], { type: "image/jpeg" }) }],
    ideas: [{ id: "idea-1", title: "Soup", sourceKind: "manual", ingredients: ["Stock"], instructions: ["Simmer"], imageId: "idea-image-1" }],
    ideaImages: [{ id: "idea-image-1", ideaId: "idea-1", mimeType: "image/jpeg", byteLength: 7, displayBlob: new Blob(["display"]), thumbnailBlob: new Blob(["thumb"]) }],
    ideaDrafts: [{ id: "active", title: "must not export" }],
  };
}

test("builds a versioned portable payload with Ideas and no transient drafts", async () => {
  const payload = await buildBackupPayload(records(), "2026-09-06T12:00:00Z");
  assert.equal(payload.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(Object.keys(payload.records), PERSISTENT_STORES);
  assert.equal(payload.counts.ideas, 1);
  assert.equal(payload.counts.ideaImages, 1);
  assert.equal(payload.records.ideaDrafts, undefined);
  assert.equal(typeof payload.records.ideaImages[0].thumbnailBlobData, "string");
  validateBackupPayload(payload);
  const restored = deserializeRecord("ideaImages", payload.records.ideaImages[0]);
  assert.equal(await restored.thumbnailBlob.text(), "thumb");
  assert.equal(await restored.displayBlob.text(), "display");
});

test("accepts several distinct dish attempts and extra photos in one occasion", async () => {
  const source = records();
  source.dishes.push({ id: "dish-2", canonicalName: "Bread", defaultMapPhotoId: "photo-2" });
  source.attempts.push({ id: "attempt-2", occasionId: "occasion-1", dishId: "dish-2", rating: null });
  source.photos.push({ id: "photo-2", occasionId: "occasion-1", dishAttemptId: "attempt-2", role: "extra", mimeType: "image/jpeg", byteLength: 5, blob: new Blob(["bread"], { type: "image/jpeg" }) });
  source.photos[0].role = "main";
  const payload = await buildBackupPayload(source);
  assert.doesNotThrow(() => validateBackupPayload(payload));
  assert.equal(payload.counts.attempts, 2);
  assert.equal(payload.counts.photos, 2);
});

test("accepts the current occasion main photo as a map photo for every dish in that occasion", async () => {
  const source = records();
  source.dishes.push({ id: "dish-2", canonicalName: "Bread", defaultMapPhotoId: "photo-1" });
  source.attempts.push({ id: "attempt-2", occasionId: "occasion-1", dishId: "dish-2", rating: null });
  const payload = await buildBackupPayload(source);
  assert.doesNotThrow(() => validateBackupPayload(payload));
});

test("rejects a saved map location that conflicts with the dish country", async () => {
  const source = records();
  source.dishes[0].country = "United States";
  source.dishes[0].countryCode = "USA";
  source.dishes[0].mapLocation = { x: 89.2, y: 33.8, countryKey: "JPN", mapDataVersion: 1 };
  const payload = await buildBackupPayload(source);
  assert.throws(() => validateBackupPayload(payload), /confirmed country/i);
});

test("rejects count mismatches, duplicate identities, and orphaned Idea images", async () => {
  const payload = await buildBackupPayload(records());
  assert.throws(() => validateBackupPayload({ ...payload, counts: { ...payload.counts, ideas: 2 } }), /count/i);
  const duplicate = structuredClone(payload);
  duplicate.records.ideas.push({ ...duplicate.records.ideas[0] });
  duplicate.counts.ideas += 1;
  assert.throws(() => validateBackupPayload(duplicate), /identity/i);
  const orphan = structuredClone(payload);
  orphan.records.ideaImages[0].ideaId = "missing";
  assert.throws(() => validateBackupPayload(orphan), /without its Idea/i);
});

test("rejects unsupported and malformed backup envelopes", () => {
  assert.throws(() => validateBackupPayload(null), /supported/i);
  assert.throws(() => validateBackupPayload({ format: "what-i-made-backup", schemaVersion: 99 }), /supported/i);
});

test("rejects malformed encoded images during inspection", async () => {
  const payload = await buildBackupPayload(records());
  payload.records.photos[0].blobData = "truncated";
  await assert.rejects(() => inspectBackupBlob(JSON.stringify(payload)), /invalid image data/i);
});

test("rejects incomplete and internally inconsistent Idea images", async () => {
  const base = await buildBackupPayload(records());
  const cases = [
    ["legacy blob-only image", (value) => {
      const image = value.records.ideaImages[0];
      image.blobData = image.displayBlobData;
      delete image.displayBlobData;
      delete image.thumbnailBlobData;
    }, /unsupported Idea image format/i],
    ["missing display image", (value) => { delete value.records.ideaImages[0].displayBlobData; }, /complete image data/i],
    ["missing thumbnail image", (value) => { delete value.records.ideaImages[0].thumbnailBlobData; }, /complete image data/i],
    ["display byte mismatch", (value) => { value.records.ideaImages[0].byteLength += 1; }, /invalid byte count/i],
  ];
  for (const [name, mutate, pattern] of cases) {
    const payload = structuredClone(base);
    mutate(payload);
    assert.throws(() => validateBackupPayload(payload), pattern, name);
  }
});

test("rejects incomplete cooks and invalid required domain fields", async () => {
  const base = await buildBackupPayload(records());
  const cases = [
    ["occasion without attempt", (value) => { value.records.attempts = []; value.counts.attempts = 0; }, /without its cooking attempt/i],
    ["invalid cooked date", (value) => { value.records.occasions[0].cookedAt = "2026-02-30"; }, /valid cooked date/i],
    ["dish without name", (value) => { value.records.dishes[0].canonicalName = " "; }, /dish without a name/i],
    ["invalid rating", (value) => { value.records.attempts[0].rating = 11; }, /invalid rating/i],
    ["Idea without ingredients", (value) => { value.records.ideas[0].ingredients = []; }, /valid ingredients/i],
    ["photo byte mismatch", (value) => { value.records.photos[0].byteLength += 1; }, /invalid byte count/i],
  ];
  for (const [name, mutate, pattern] of cases) {
    const payload = structuredClone(base);
    mutate(payload);
    assert.throws(() => validateBackupPayload(payload), pattern, name);
  }
});

test("rejects every broken persistent-record relationship", async () => {
  const base = await buildBackupPayload(records());
  const cases = [
    ["occasion main photo", (value) => { value.records.occasions[0].mainPhotoId = "missing"; }, /main photograph/i],
    ["attempt occasion", (value) => { value.records.attempts[0].occasionId = "missing"; }, /without its occasion/i],
    ["attempt dish", (value) => {
      value.records.dishes[0].defaultMapPhotoId = null;
      value.records.attempts[0].dishId = "missing";
    }, /without its dish/i],
    ["photo occasion", (value) => {
      value.records.occasions[0].mainPhotoId = "photo-2";
      value.records.dishes[0].defaultMapPhotoId = null;
      value.records.photos[0].occasionId = "missing";
      value.records.photos.push({ id: "photo-2", occasionId: "occasion-1", dishAttemptId: null, mimeType: "image/jpeg", blobData: "dGh1bWI=" });
      value.counts.photos += 1;
    }, /photograph without its occasion/i],
    ["dish map photo", (value) => { value.records.dishes[0].defaultMapPhotoId = "missing"; }, /map photograph/i],
    ["Idea image", (value) => { value.records.ideas[0].imageId = "missing"; }, /Idea linked to a missing image/i],
    ["Idea image ownership", (value) => { value.records.ideaImages[0].ideaId = "idea-2"; }, /without its Idea/i],
    ["attempt Idea", (value) => { value.records.attempts[0].sourceIdeaId = "missing"; }, /linked to a missing Idea/i],
    ["main photo ownership", (value) => { value.records.photos[0].occasionId = "other"; value.records.occasions.push({ id: "other", mainPhotoId: "photo-1" }); value.counts.occasions += 1; }, /another occasion's photograph/i],
    ["map photo ownership", (value) => { value.records.dishes.push({ id: "dish-2", canonicalName: "Stew", defaultMapPhotoId: "photo-1" }); value.counts.dishes += 1; }, /another dish's map photograph/i],
    ["attempt photo ownership", (value) => {
      value.records.occasions.push({ id: "other", cookedAt: "2026-09-05", mainPhotoId: "photo-2" });
      value.records.attempts.push({ id: "attempt-2", occasionId: "other", dishId: "dish-1", sourceIdeaId: null, rating: null });
      value.records.photos.push({ id: "photo-2", occasionId: "other", dishAttemptId: "attempt-1", mimeType: "image/jpeg", byteLength: 5, blobData: "dGh1bWI=" });
      value.counts.occasions += 1;
      value.counts.attempts += 1;
      value.counts.photos += 1;
    }, /across cooking occasions/i],
  ];
  for (const [name, mutate, pattern] of cases) {
    const payload = structuredClone(base);
    mutate(payload);
    assert.throws(() => validateBackupPayload(payload), pattern, name);
  }
});

test("names and inspects a validated schema-v2 JSON backup", async () => {
  const payload = await buildBackupPayload(records(), "2026-09-06T12:00:00Z");
  const source = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const inspection = await inspectBackupBlob(source);
  assert.equal(createBackupFileName(new Date("2026-09-06T23:59:00Z")), "what-i-made-backup-2026-09-06.json");
  assert.deepEqual(inspection.summary, summarizePayload(payload, source.size));
  assert.equal(inspection.summary.cooks, 1);
  assert.equal(inspection.summary.ideas, 1);
  assert.equal(inspection.summary.cookingPhotos, 1);
});

test("reports deterministic serialization progress", async () => {
  const progress = [];
  await buildBackupPayload(records(), "2026-09-06T12:00:00Z", { onProgress: (value) => progress.push(value) });
  assert.deepEqual(progress[0], { phase: "serialize", completed: 0, total: 6 });
  assert.deepEqual(progress.at(-1), { phase: "serialize", completed: 6, total: 6 });
});

function installFakeArchive(seed = {}) {
  const data = Object.fromEntries(ARCHIVE_STORES.map((name) => [name, [...(seed[name] || [])]]));
  const transactions = [];
  const database = {
    transaction(storeNames, mode) {
      transactions.push({ storeNames: [...storeNames], mode });
      return {
        objectStore(name) {
          return {
            count: () => {
              const request = { result: data[name].length, value: data[name].length, onsuccess: null, onerror: null };
              queueMicrotask(() => request.onsuccess?.());
              return request;
            },
            getAll: () => [...data[name]],
            add: (record) => data[name].push(record),
            clear: () => { data[name].length = 0; },
          };
        },
        abort() {},
      };
    },
  };
  const previous = globalThis.WhatIMadeArchive;
  globalThis.WhatIMadeArchive = {
    openDatabase: async () => database,
    requestResult: async (request) => request?.value ?? request,
    transactionDone: async () => {},
  };
  return { data, transactions, restore: () => { globalThis.WhatIMadeArchive = previous; } };
}

test("summarizes and atomically clears persistent records and drafts", { concurrency: false }, async () => {
  const fake = installFakeArchive(records());
  try {
    const summary = await getArchiveSummary();
    assert.equal(summary.isEmpty, false);
    assert.equal(summary.drafts, 1);
    await clearArchive();
    ARCHIVE_STORES.forEach((name) => assert.equal(fake.data[name].length, 0, name));
  } finally {
    fake.restore();
  }
});

test("restores only into an empty archive and removes transient drafts", { concurrency: false }, async () => {
  const payload = await buildBackupPayload(records());
  const fake = installFakeArchive({ ideaDrafts: [{ id: "active" }] });
  try {
    const counts = await restoreValidatedBackup(payload);
    assert.equal(counts.occasions, 1);
    assert.equal(fake.data.occasions.length, 1);
    assert.equal(fake.data.ideaDrafts.length, 0);
    assert.deepEqual(fake.transactions, [{ storeNames: ARCHIVE_STORES, mode: "readwrite" }]);
    await assert.rejects(() => restoreValidatedBackup(payload), /empty archive/i);
  } finally {
    fake.restore();
  }
});
