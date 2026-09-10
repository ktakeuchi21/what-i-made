const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto").webcrypto;

const { OFFLINE_GRACE_MS, normalizeSubject, archiveKeyForSubject, offlineAccessState } = require("../account-context.js");
const archive = require("../archive-store.js");
const { DB_NAME, ACCOUNT_DB_PREFIX, normalizeArchiveKey, databaseNameForArchiveKey, setArchiveContext, closeDatabase } = archive;

test("derives deterministic opaque archive keys from stable account subjects", async () => {
  const first = await archiveKeyForSubject("cognito-subject-1", crypto);
  const same = await archiveKeyForSubject("cognito-subject-1", crypto);
  const other = await archiveKeyForSubject("cognito-subject-2", crypto);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, same);
  assert.notEqual(first, other);
  assert.ok(!first.includes("cognito-subject"));
});

test("rejects absent or malformed account and archive identities", async () => {
  assert.throws(() => normalizeSubject(""), /identity is invalid/i);
  await assert.rejects(archiveKeyForSubject("account", {}), /secure account storage/i);
  assert.throws(() => normalizeArchiveKey("account@example.com"), /archive context/i);
});

test("uses legacy storage only when no account context has been selected", async () => {
  const key = await archiveKeyForSubject("cognito-subject-1", crypto);
  assert.equal(databaseNameForArchiveKey(null), DB_NAME);
  assert.equal(databaseNameForArchiveKey(key), `${ACCOUNT_DB_PREFIX}-${key}`);
});

test("switches archive namespaces without exposing the subject", async () => {
  const first = await archiveKeyForSubject("cognito-subject-1", crypto);
  const second = await archiveKeyForSubject("cognito-subject-2", crypto);
  assert.equal(setArchiveContext(first), `${ACCOUNT_DB_PREFIX}-${first}`);
  assert.equal(databaseNameForArchiveKey(), `${ACCOUNT_DB_PREFIX}-${first}`);
  assert.equal(setArchiveContext(second), `${ACCOUNT_DB_PREFIX}-${second}`);
  assert.equal(databaseNameForArchiveKey(), `${ACCOUNT_DB_PREFIX}-${second}`);
  assert.ok(!databaseNameForArchiveKey().includes("cognito-subject"));
  await closeDatabase();
});

test("an old account open failure cannot clear the new account database", async () => {
  const requests = [];
  const originalIndexedDb = globalThis.indexedDB;
  globalThis.indexedDB = {
    open(name) {
      const request = { result: null, error: null, name };
      requests.push(request);
      return request;
    },
  };
  const first = await archiveKeyForSubject("switch-race-1", crypto);
  const second = await archiveKeyForSubject("switch-race-2", crypto);

  try {
    setArchiveContext(first);
    const firstOpen = archive.openDatabase();
    setArchiveContext(second);
    const secondOpen = archive.openDatabase();

    requests[0].error = new Error("old account failed");
    requests[0].onerror();
    assert.equal(archive.openDatabase(), secondOpen);

    const secondDatabase = { close() {}, onversionchange: null };
    requests[1].result = secondDatabase;
    requests[1].onsuccess();
    await assert.rejects(firstOpen, /old account failed/);
    assert.equal(await secondOpen, secondDatabase);
  } finally {
    await closeDatabase();
    if (originalIndexedDb === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = originalIndexedDb;
  }
});

test("bounds offline archive access to seven days", () => {
  const authorizedAt = Date.UTC(2026, 8, 1);
  assert.equal(OFFLINE_GRACE_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(offlineAccessState(authorizedAt, authorizedAt + OFFLINE_GRACE_MS).allowed, true);
  assert.equal(offlineAccessState(authorizedAt, authorizedAt + OFFLINE_GRACE_MS + 1).allowed, false);
  assert.equal(offlineAccessState(null, authorizedAt).allowed, false);
  assert.equal(offlineAccessState(authorizedAt + 1, authorizedAt).allowed, false);
});
