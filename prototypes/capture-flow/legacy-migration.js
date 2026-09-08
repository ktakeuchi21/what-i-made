(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeLegacyMigration = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const LEGACY_DB_NAME = "what-i-made-archive";
  const STORES = ["occasions", "dishes", "attempts", "photos", "ideas", "ideaImages", "ideaDrafts"];
  const PERSISTENT_STORES = STORES.filter((name) => name !== "ideaDrafts");

  function eligibleOwner(activeArchiveKey, configuredOwnerArchiveKey) {
    return /^[a-f0-9]{64}$/.test(String(activeArchiveKey || "")) && activeArchiveKey === configuredOwnerArchiveKey;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("The archive migration could not read local data."));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("The archive migration failed."));
      transaction.onabort = () => reject(transaction.error || new Error("The archive migration was cancelled."));
    });
  }

  function openExistingDatabase(indexedDBApi, name) {
    return new Promise((resolve, reject) => {
      let absent = false;
      const request = indexedDBApi.open(name);
      request.onupgradeneeded = (event) => {
        if (event.oldVersion === 0) {
          absent = true;
          request.transaction.abort();
        }
      };
      request.onsuccess = () => resolve(absent ? null : request.result);
      request.onerror = () => {
        if (absent && request.error?.name === "AbortError") resolve(null);
        else reject(request.error || new Error("The previous archive could not be opened."));
      };
      request.onblocked = () => reject(new Error("Close other copies of What I Made, then try again."));
    });
  }

  async function readRecords(database) {
    const available = STORES.filter((name) => database.objectStoreNames.contains(name));
    const records = Object.fromEntries(STORES.map((name) => [name, []]));
    if (!available.length) return records;
    const transaction = database.transaction(available, "readonly");
    const done = transactionDone(transaction);
    await Promise.all(available.map(async (name) => { records[name] = await requestResult(transaction.objectStore(name).getAll()); }));
    await done;
    return records;
  }

  function validateDrafts(drafts) {
    const identities = new Set();
    drafts.forEach((draft) => {
      if (!draft || typeof draft.id !== "string" || !draft.id.trim() || identities.has(draft.id)) {
        throw new Error("The previous archive contains invalid unfinished Ideas.");
      }
      identities.add(draft.id);
    });
  }

  function migrationCounts(records) {
    return Object.fromEntries(STORES.map((name) => [name, records[name]?.length || 0]));
  }

  async function inspect(options = {}) {
    if (!eligibleOwner(options.activeArchiveKey, options.ownerArchiveKey)) return { available: false, reason: "not_owner" };
    const indexedDBApi = options.indexedDB || root.indexedDB;
    const backup = options.backup || root.WhatIMadeBackup;
    if (!indexedDBApi || !backup?.buildBackupPayload || !backup?.validateBackupPayload) throw new Error("Archive migration is unavailable.");
    const source = await openExistingDatabase(indexedDBApi, options.legacyDatabaseName || LEGACY_DB_NAME);
    if (!source) return { available: false, reason: "missing" };
    try {
      const records = await readRecords(source);
      const persistent = Object.fromEntries(PERSISTENT_STORES.map((name) => [name, records[name]]));
      const payload = await backup.buildBackupPayload(persistent);
      backup.validateBackupPayload(payload);
      validateDrafts(records.ideaDrafts);
      const counts = migrationCounts(records);
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      return { available: total > 0, reason: total > 0 ? "ready" : "empty", records, payload, counts };
    } finally {
      source.close();
    }
  }

  async function migrate(inspection, destinationDatabase) {
    if (!inspection?.available || !inspection.records || !destinationDatabase) throw new Error("Inspect the previous archive before moving it.");
    const beforeTransaction = destinationDatabase.transaction(STORES, "readonly");
    const beforeDone = transactionDone(beforeTransaction);
    const before = {};
    await Promise.all(STORES.map(async (name) => { before[name] = await requestResult(beforeTransaction.objectStore(name).count()); }));
    await beforeDone;
    if (Object.values(before).some((count) => count !== 0)) throw new Error("The signed-in archive must be empty before moving the previous archive.");
    const transaction = destinationDatabase.transaction(STORES, "readwrite");
    const done = transactionDone(transaction);
    try {
      STORES.forEach((name) => inspection.records[name].forEach((record) => transaction.objectStore(name).add(record)));
      const observed = {};
      await Promise.all(STORES.map(async (name) => { observed[name] = await requestResult(transaction.objectStore(name).count()); }));
      const expected = migrationCounts(inspection.records);
      if (STORES.some((name) => observed[name] !== expected[name])) {
        transaction.abort();
        throw new Error("The moved archive could not be verified. The previous archive is still untouched.");
      }
      await done;
      return observed;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await done.catch(() => {});
      throw error;
    }
  }

  return { LEGACY_DB_NAME, STORES, PERSISTENT_STORES, eligibleOwner, migrationCounts, inspect, migrate };
});
