const test = require("node:test");
const assert = require("node:assert/strict");

const { DB_VERSION, normalizeDishName, shouldLearnAlias, consolidateDishRecords, buildCookRecords, buildCookUpdateRecords, assembleCooks, assembleOccasions, flattenDishAttempts, isEligibleMapPhoto } = require("../archive-store.js");

test("uses one map-photo eligibility rule", () => {
  const attempts = [{ id: "a1", dishId: "d1", occasionId: "o1" }, { id: "a2", dishId: "d2", occasionId: "o1" }];
  const occasions = [{ id: "o1", mainPhotoId: "main" }];
  assert.equal(isEligibleMapPhoto("d1", { id: "assigned", dishAttemptId: "a1", occasionId: "o1" }, attempts, occasions), true);
  assert.equal(isEligibleMapPhoto("d1", { id: "main", dishAttemptId: "a2", occasionId: "o1" }, attempts, occasions), true);
  assert.equal(isEligibleMapPhoto("d1", { id: "extra", dishAttemptId: null, occasionId: "o1" }, attempts, occasions), false);
});

test("uses the multi-dish IndexedDB schema version", () => {
  assert.equal(DB_VERSION, 5);
});

test("learns only meaningfully distinct local aliases", () => {
  assert.equal(shouldLearnAlias("Oyakodon", [], "OYAKODON"), false);
  assert.equal(shouldLearnAlias("Crème brûlée", [], "Creme-brulee"), false);
  assert.equal(shouldLearnAlias("Oyakodon", [], "Chicken and egg bowl"), true);
  assert.equal(shouldLearnAlias("Oyakodon", ["Chicken and egg bowl"], "chicken-and-egg bowl"), false);
});

test("assembles one occasion with several dish attempts and photographs", async () => {
  const occasions = [{ id: "o1", cookedAt: "2026-09-06", createdAt: "2026-09-06T18:00:00Z", mainPhotoId: "p1" }];
  const dishes = [
    { id: "d1", canonicalName: "Oyakodon", country: "Japan", defaultMapPhotoId: "p2" },
    { id: "d2", canonicalName: "Miso soup", country: "Japan", defaultMapPhotoId: "p1" },
  ];
  const attempts = [
    { id: "a1", occasionId: "o1", dishId: "d1", rating: 8 },
    { id: "a2", occasionId: "o1", dishId: "d2", rating: 7 },
  ];
  const photos = [
    { id: "p1", occasionId: "o1", dishAttemptId: null, role: "main", blob: new Blob(["meal"]), mimeType: "image/jpeg", createdAt: "1" },
    { id: "p2", occasionId: "o1", dishAttemptId: "a1", role: "extra", blob: new Blob(["dish"]), mimeType: "image/jpeg", createdAt: "2" },
  ];
  const result = assembleOccasions(occasions, dishes, attempts, photos);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].dishNames, ["Oyakodon", "Miso soup"]);
  assert.equal(result[0].photos.length, 2);
  const flat = flattenDishAttempts(result, dishes);
  assert.equal(flat.length, 2);
  assert.equal(flat.find((attempt) => attempt.id === "a1").photoId, "p2");
  assert.equal(flat.find((attempt) => attempt.id === "a2").photoId, "p1");
  assert.equal(await flat.find((attempt) => attempt.id === "a1").mapPhotoBlob.text(), "dish");
});

test("builds one internally linked cook for an atomic IndexedDB write", () => {
  const photoBlob = new Blob(["photo"], { type: "image/jpeg" });
  const records = buildCookRecords(
    {
      dishName: " Big Mac ",
      cookedAt: "2026-09-04",
      rating: "7",
      notes: " Pretty good ",
      ingredients: "Beef patties",
      country: "United States",
      transcript: "Big Mac. Pretty good.",
      sourceIdeaId: "idea-1",
      photoBlob,
    },
    "2026-09-04T20:00:00.000Z",
    { occasionId: "occasion-1", dishId: "dish-1", attemptId: "attempt-1", photoId: "photo-1" },
  );

  assert.equal(records.occasion.mainPhotoId, "photo-1");
  assert.equal(records.attempt.occasionId, "occasion-1");
  assert.equal(records.attempt.dishId, "dish-1");
  assert.equal(records.photo.dishAttemptId, "attempt-1");
  assert.equal(records.dish.canonicalName, "Big Mac");
  assert.equal(records.dish.normalizedName, "big mac");
  assert.equal(records.dish.defaultMapPhotoId, "photo-1");
  assert.equal(records.attempt.rating, 7);
  assert.equal(records.attempt.notes, "Pretty good");
  assert.equal(records.attempt.sourceIdeaId, "idea-1");
  assert.equal(records.photo.blob, photoBlob);
});

test("stores a confirmed speech correction as a local dish alias", () => {
  const records = buildCookRecords({
    dishName: "Mul naengmyeon",
    speechAlias: "mool nang myun",
    cookedAt: "2026-09-09",
    country: "South Korea",
    photoBlob: new Blob(["photo"]),
  });
  assert.deepEqual(records.dish.aliases, ["mool nang myun"]);
  assert.equal(records.dish.countryCode, "KOR");
});

test("normalizes equivalent dish names without using the name as identity", () => {
  assert.equal(normalizeDishName("  Crème   Brûlée "), "creme brulee");
  assert.equal(normalizeDishName("BIG-MAC"), "big mac");
  assert.equal(normalizeDishName("親子丼"), "親子丼");
  assert.notEqual(normalizeDishName("親子丼"), normalizeDishName("ラーメン"));
  assert.notEqual(normalizeDishName("カレー"), normalizeDishName("ガレー"));
  assert.notEqual(normalizeDishName("か"), normalizeDishName("が"));
  assert.notEqual(normalizeDishName("क"), normalizeDishName("क़"));
  assert.equal(normalizeDishName("🍜"), "");
});

test("consolidates exact normalized duplicates and preserves every attempt", () => {
  const result = consolidateDishRecords([
    { id: "dish-1", canonicalName: "Big Mac", aliases: [], country: "United States", createdAt: "2026-01-01" },
    { id: "dish-2", canonicalName: " big-mac ", aliases: [], country: null, createdAt: "2026-02-01" },
    { id: "dish-3", canonicalName: "Mac and cheese", aliases: [], country: "United States", createdAt: "2026-03-01" },
  ], [
    { id: "attempt-1", dishId: "dish-1" },
    { id: "attempt-2", dishId: "dish-2" },
    { id: "attempt-3", dishId: "dish-3" },
  ]);

  assert.equal(result.dishes.length, 2);
  assert.deepEqual(result.removedDishIds, ["dish-2"]);
  assert.equal(result.attempts.find((attempt) => attempt.id === "attempt-2").dishId, "dish-1");
  assert.equal(result.attempts.find((attempt) => attempt.id === "attempt-3").dishId, "dish-3");
  assert.ok(result.dishes.find((dish) => dish.id === "dish-1").aliases.includes(" big-mac "));
});

test("keeps distinct non-Latin dishes and assigns stable legacy map photos", () => {
  const result = consolidateDishRecords([
    { id: "dish-1", canonicalName: "親子丼", aliases: [], createdAt: "2026-01-01" },
    { id: "dish-2", canonicalName: "ラーメン", aliases: [], createdAt: "2026-02-01" },
  ], [
    { id: "attempt-1", occasionId: "occasion-1", dishId: "dish-1", createdAt: "2026-01-01" },
    { id: "attempt-2", occasionId: "occasion-2", dishId: "dish-2", createdAt: "2026-02-01" },
  ], [
    { id: "photo-1", occasionId: "occasion-1", dishAttemptId: "attempt-1" },
    { id: "photo-2", occasionId: "occasion-2", dishAttemptId: "attempt-2" },
  ]);

  assert.equal(result.dishes.length, 2);
  assert.equal(result.dishes.find((dish) => dish.id === "dish-1").defaultMapPhotoId, "photo-1");
  assert.equal(result.dishes.find((dish) => dish.id === "dish-2").defaultMapPhotoId, "photo-2");
});

test("rejects a cook unless photo, name, and date are all present", () => {
  const valid = { dishName: "Oyakodon", cookedAt: "2026-09-04", photoBlob: new Blob(["photo"]) };
  assert.throws(() => buildCookRecords({ ...valid, dishName: "" }), /dish name/i);
  assert.throws(() => buildCookRecords({ ...valid, cookedAt: "today" }), /date/i);
  assert.throws(() => buildCookRecords({ ...valid, cookedAt: "2026-02-31" }), /date/i);
  assert.throws(() => buildCookRecords({ ...valid, cookedAt: "2026-99-01" }), /date/i);
  assert.throws(() => buildCookRecords({ ...valid, photoBlob: null }), /photo/i);
});

test("updates attempt fields, shared dish fields, and a replacement photo together", async () => {
  const replacement = new Blob(["replacement"], { type: "image/jpeg" });
  const updated = buildCookUpdateRecords({
    occasion: { id: "occasion-1", cookedAt: "2026-09-01", updatedAt: "old", mainPhotoId: "photo-1" },
    attempt: { id: "attempt-1", occasionId: "occasion-1", dishId: "dish-1", rating: 7, notes: "Old", ingredientsText: "Old" },
    dish: { id: "dish-1", canonicalName: "Stew", normalizedName: "stew", aliases: [], country: "Ireland" },
    photo: { id: "photo-1", blob: new Blob(["old"]), byteLength: 3, mimeType: "image/jpeg" },
  }, {
    dishName: "Irish stew",
    cookedAt: "2026-09-05",
    rating: "9",
    notes: "More thyme",
    ingredients: "Beef, potato",
    country: "Ireland",
    photoBlob: replacement,
  }, "2026-09-05T20:00:00Z");

  assert.equal(updated.occasion.cookedAt, "2026-09-05");
  assert.equal(updated.attempt.rating, 9);
  assert.equal(updated.attempt.notes, "More thyme");
  assert.equal(updated.dish.canonicalName, "Irish stew");
  assert.equal(updated.dish.normalizedName, "irish stew");
  assert.deepEqual(updated.dish.aliases, ["Stew"]);
  assert.equal(updated.photo.byteLength, replacement.size);
  assert.equal(await updated.photo.blob.text(), "replacement");
});

test("clears a custom location only when the resolved country changes", () => {
  const current = {
    occasion: { id: "o1" }, attempt: { id: "a1" },
    dish: { canonicalName: "Stew", country: "USA", aliases: [], mapLocation: { x: 20, y: 30, countryKey: "USA", mapDataVersion: 1 } },
    photo: { blob: new Blob(["photo"]) },
  };
  const same = buildCookUpdateRecords(current, { dishName: "Stew", cookedAt: "2026-09-07", country: "United States" });
  assert.ok(same.dish.mapLocation);
  const changed = buildCookUpdateRecords(current, { dishName: "Stew", cookedAt: "2026-09-07", country: "France" });
  assert.equal(changed.dish.mapLocation, null);
});

test("rejects invalid saved-cook edits before producing update records", () => {
  const current = {
    occasion: {}, attempt: {}, dish: { canonicalName: "Stew" }, photo: { blob: new Blob(["photo"]) },
  };
  assert.throws(() => buildCookUpdateRecords(current, { dishName: "", cookedAt: "2026-09-05" }), /dish name/i);
  assert.throws(() => buildCookUpdateRecords(current, { dishName: "Stew", cookedAt: "today" }), /date/i);
  assert.throws(() => buildCookUpdateRecords(current, { dishName: "Stew", cookedAt: "2026-99-05" }), /date/i);
  assert.throws(() => buildCookUpdateRecords(current, { dishName: "Stew", cookedAt: "2026-02-31" }), /date/i);
  assert.throws(() => buildCookUpdateRecords(current, { dishName: "Stew", cookedAt: "2026-09-05", rating: "11" }), /rating/i);
  assert.throws(() => buildCookUpdateRecords(current, { dishName: "Stew", cookedAt: "2026-09-05", photoBlob: new Blob([]) }), /replacement photo/i);
  assert.throws(() => buildCookUpdateRecords({ ...current, photo: null }, { dishName: "Stew", cookedAt: "2026-09-05" }), /original photo/i);
});

test("assembles complete cooks newest first and ignores incomplete records", () => {
  const occasions = [
    { id: "older", cookedAt: "2026-08-01", createdAt: "2026-08-01T10:00:00Z", mainPhotoId: "p1" },
    { id: "newer", cookedAt: "2026-09-04", createdAt: "2026-09-04T10:00:00Z", mainPhotoId: "p2" },
    { id: "broken", cookedAt: "2026-09-05", createdAt: "2026-09-05T10:00:00Z", mainPhotoId: "missing" },
  ];
  const dishes = [
    { id: "d1", canonicalName: "Oyakodon", country: "Japan", defaultMapPhotoId: "p1" },
    { id: "d2", canonicalName: "Big Mac", country: "United States" },
  ];
  const attempts = [
    { id: "a1", occasionId: "older", dishId: "d1", rating: 8 },
    { id: "a2", occasionId: "newer", dishId: "d2", rating: 7 },
    { id: "a3", occasionId: "broken", dishId: "d2", rating: 9 },
  ];
  const photos = [
    { id: "p1", blob: new Blob(["one"]), mimeType: "image/jpeg" },
    { id: "p2", blob: new Blob(["two"]), mimeType: "image/jpeg" },
  ];

  const cooks = assembleCooks(occasions, dishes, attempts, photos);
  assert.deepEqual(cooks.map((cook) => cook.dishName), ["Big Mac", "Oyakodon"]);
  assert.equal(cooks[0].photoId, "p2");
  assert.equal(cooks[1].mapPhotoId, "p1");
});

test("keeps a canonical dish's first map photo after a later cook", async () => {
  const cooks = assembleCooks([
    { id: "first", cookedAt: "2026-08-01", createdAt: "2026-08-01T10:00:00Z", mainPhotoId: "p1" },
    { id: "repeat", cookedAt: "2026-09-04", createdAt: "2026-09-04T10:00:00Z", mainPhotoId: "p2" },
  ], [
    { id: "d1", canonicalName: "Oyakodon", country: "Japan", defaultMapPhotoId: "p1" },
  ], [
    { id: "a1", occasionId: "first", dishId: "d1", rating: 7 },
    { id: "a2", occasionId: "repeat", dishId: "d1", rating: 8 },
  ], [
    { id: "p1", blob: new Blob(["first"]), mimeType: "image/jpeg" },
    { id: "p2", blob: new Blob(["repeat"]), mimeType: "image/jpeg" },
  ]);

  assert.equal(cooks[0].photoId, "p2");
  assert.equal(cooks[0].mapPhotoId, "p1");
  assert.equal(await cooks[0].mapPhotoBlob.text(), "first");
});
