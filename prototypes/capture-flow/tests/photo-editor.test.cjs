const test = require("node:test");
const assert = require("node:assert/strict");
const { createDraft } = require("../photo-editor.js");
const { buildPhotoEditRecords } = require("../archive-store.js");
const photo = (name) => ({ blob: new Blob([name], { type: "image/jpeg" }), thumbnailBlob: new Blob([`${name}-thumb`], { type: "image/jpeg" }), width: 400, height: 300 });
function setup(options = {}) {
  let sequence = 0;
  const released = [];
  const model = createDraft({ processPhoto: async (blob) => ({ blob, thumbnailBlob: blob }), createUrl: () => `blob:${++sequence}`, revokeUrl: (url) => released.push(url), ...options });
  return { model, released };
}

test("several library selections append, with a selectable main and removable draft photos", async () => {
  const { model, released } = setup();
  await model.add([photo("one").blob, photo("two").blob]);
  await model.add([photo("three").blob]);
  assert.equal(model.items.length, 3);
  model.makeMain(model.items[2].key);
  assert.equal(await model.values()[0].blob.text(), "three");
  model.remove(model.items[1].key);
  assert.deepEqual(await Promise.all(model.values().map((item) => item.blob.text())), ["three", "two"]);
  assert.equal(released.length, 1);
  model.reset();
  assert.equal(released.length, 3);
  assert.equal(model.changed, false);
});

test("replacement keeps saved identity and assignment and replaces the thumbnail", async () => {
  const { model, released } = setup();
  model.reset([{ ...photo("old"), id: "p1", dishAttemptId: "a1" }]);
  await model.add([photo("new").blob], model.items[0].key);
  assert.equal(model.values()[0].id, "p1");
  assert.equal(model.values()[0].dishAttemptId, "a1");
  assert.equal(await model.values()[0].thumbnailBlob.text(), "new");
  assert.equal(model.values()[0].edited, true);
  assert.equal(released.length, 1);
});

test("an invalid or undecodable batch preserves the previous gallery", async () => {
  const { model } = setup({ processPhoto: async (blob) => {
    if (await blob.text() === "broken") throw new Error("Unreadable image.");
    return { blob };
  } });
  model.reset([photo("saved")]);
  assert.equal(await model.add([photo("good").blob, photo("broken").blob]), false);
  assert.equal(model.values().length, 1);
  assert.equal(model.error, true);
  assert.match(model.message, /previous photos are unchanged/);
  assert.equal(await model.add([new Blob(["text"], { type: "text/plain" })]), false);
  assert.equal(model.values().length, 1);
});

test("cancel invalidates processing and late results cannot enter a new draft", async () => {
  let finish;
  const { model, released } = setup({ processPhoto: () => new Promise((resolve) => { finish = resolve; }) });
  model.reset([photo("original")]);
  const pending = model.add([photo("pending").blob]);
  assert.equal(model.busy, true);
  model.reset([photo("another account")]);
  finish(photo("pending"));
  assert.equal(await pending, false);
  assert.equal(model.busy, false);
  assert.equal(await model.values()[0].blob.text(), "another account");
  assert.equal(released.length, 1);
});

test("editing keeps one photo and excludes concurrent mutations during processing", async () => {
  let finish;
  const { model } = setup({ minimum: 1, processPhoto: () => new Promise((resolve) => { finish = resolve; }) });
  model.reset([photo("original")]);
  model.remove(model.items[0].key);
  assert.equal(model.items.length, 1);
  const pending = model.add([photo("second").blob]);
  assert.equal(await model.add([photo("third").blob]), false);
  model.remove(model.items[0].key);
  finish(photo("second"));
  await pending;
  assert.equal(model.items.length, 2);
  model.remove(model.items[0].key);
  assert.equal(model.items.length, 1);
});

const occasion = { id: "o1", mainPhotoId: "p1", updatedAt: "original" };
const existing = [
  { ...photo("one"), id: "p1", occasionId: "o1", dishAttemptId: "a1", role: "main", createdAt: "before" },
  { ...photo("two"), id: "p2", occasionId: "o1", dishAttemptId: "a2", role: "extra", createdAt: "before" },
];
const edits = (photos) => ({ updatedAt: "original", photoIds: ["p1", "p2"], photos });

test("gallery save adds, replaces, removes, and promotes in one validated change set", async () => {
  const result = buildPhotoEditRecords(occasion, existing, edits([
    { id: "p2", ...photo("replacement"), edited: true, dishAttemptId: "wrong" },
    photo("added"),
  ]), "a1", "now");
  assert.equal(result.mainPhotoId, "p2");
  assert.deepEqual(result.deletedPhotoIds, ["p1"]);
  assert.equal(result.photos[0].dishAttemptId, "a2");
  assert.equal(result.photos[0].createdAt, "before");
  assert.equal(await result.photos[0].thumbnailBlob.text(), "replacement-thumb");
  assert.equal(result.photos[1].dishAttemptId, "a1");
  assert.equal(result.photos[1].occasionId, "o1");
  assert.equal(result.photos[1].createdAt, "now");
  assert.equal(result.photos[1].role, "extra");
  assert.equal(await existing[1].blob.text(), "two");
});

test("untouched saved photos retain all metadata and blobs", () => {
  const result = buildPhotoEditRecords(occasion, existing, edits([{ id: "p1" }, { id: "p2" }]), "a1");
  assert.deepEqual(result.photos, existing);
  assert.deepEqual(result.deletedPhotoIds, []);
});

test("stale edits, cross-occasion ids, duplicate ids, invalid photos, and empty galleries are rejected", () => {
  assert.throws(() => buildPhotoEditRecords({ ...occasion, updatedAt: "changed" }, existing, edits([{ id: "p1" }]), "a1"), /changed while/);
  assert.throws(() => buildPhotoEditRecords(occasion, [...existing, { id: "new" }], edits([{ id: "p1" }]), "a1"), /changed while/);
  assert.throws(() => buildPhotoEditRecords(occasion, existing, edits([{ id: "elsewhere" }]), "a1"), /occasion/);
  assert.throws(() => buildPhotoEditRecords(occasion, existing, edits([{ id: "p1" }, { id: "p1" }]), "a1"), /once/);
  assert.throws(() => buildPhotoEditRecords(occasion, existing, edits([{ id: "p1", edited: true, blob: new Blob([]) }]), "a1"), /valid/);
  assert.throws(() => buildPhotoEditRecords(occasion, existing, edits([]), "a1"), /at least one/);
});
