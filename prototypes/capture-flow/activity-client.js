(function (root, factory) {
  const authApi = typeof module === "object" && module.exports ? require("./auth-session.js") : root.WhatIMadeAuth;
  const api = factory(root, authApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeActivity = api;
})(typeof window !== "undefined" ? window : globalThis, function (root, authApi) {
  "use strict";

  const OUTBOX_STORE = "activityOutbox";
  const META_STORE = "activityMeta";
  const MAX_QUEUED_EVENTS = 500;
  const MAX_BATCH = 50;
  const EVENT_TYPES = new Set(["cook_created", "cook_updated", "cook_deleted", "idea_created", "idea_updated", "idea_deleted", "idea_completed"]);

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Activity storage is unavailable."));
    });
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Activity storage could not be updated."));
      transaction.onabort = () => reject(transaction.error || new Error("Activity storage was cancelled."));
    });
  }
  function createStore(indexedDb = root.indexedDB) {
    function open() {
      return new Promise((resolve, reject) => {
        const request = indexedDb.open(authApi.AUTH_DB_NAME, authApi.AUTH_DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(authApi.AUTH_STORE_NAME)) request.result.createObjectStore(authApi.AUTH_STORE_NAME, { keyPath: "id" });
          if (!request.result.objectStoreNames.contains(OUTBOX_STORE)) request.result.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
          if (!request.result.objectStoreNames.contains(META_STORE)) request.result.createObjectStore(META_STORE, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Activity storage is unavailable."));
      });
    }
    async function enqueue(event) {
      const database = await open();
      try {
        const transaction = database.transaction([OUTBOX_STORE, META_STORE], "readwrite");
        const done = transactionDone(transaction);
        const outbox = transaction.objectStore(OUTBOX_STORE);
        const existing = await requestResult(outbox.getAll());
        const overflow = Math.max(0, existing.length - MAX_QUEUED_EVENTS + 1);
        existing.sort((a, b) => `${a.occurredAt}|${a.id}`.localeCompare(`${b.occurredAt}|${b.id}`)).slice(0, overflow).forEach((item) => {
          outbox.delete(item.id);
          transaction.objectStore(META_STORE).put({ id: `overflow:${item.accountKey}`, value: true });
        });
        outbox.put(event);
        await done;
      } finally { database.close(); }
    }
    async function batch(accountKey) {
      const database = await open();
      try {
        const transaction = database.transaction([OUTBOX_STORE, META_STORE], "readonly");
        const [events, overflow] = await Promise.all([requestResult(transaction.objectStore(OUTBOX_STORE).getAll()), requestResult(transaction.objectStore(META_STORE).get(`overflow:${accountKey}`))]);
        return { events: events.filter((event) => event.accountKey === accountKey).sort((a, b) => `${a.occurredAt}|${a.id}`.localeCompare(`${b.occurredAt}|${b.id}`)).slice(0, MAX_BATCH), partial: overflow?.value === true };
      } finally { database.close(); }
    }
    async function remove(ids, clearOverflow = false, accountKey = "") {
      const database = await open();
      try {
        const transaction = database.transaction([OUTBOX_STORE, META_STORE], "readwrite");
        const done = transactionDone(transaction);
        ids.forEach((id) => transaction.objectStore(OUTBOX_STORE).delete(id));
        if (clearOverflow) transaction.objectStore(META_STORE).delete(`overflow:${accountKey}`);
        await done;
      } finally { database.close(); }
    }
    async function discard(ids, accountKey) {
      const database = await open();
      try {
        const transaction = database.transaction([OUTBOX_STORE, META_STORE], "readwrite");
        const done = transactionDone(transaction);
        ids.forEach((id) => transaction.objectStore(OUTBOX_STORE).delete(id));
        transaction.objectStore(META_STORE).put({ id: `overflow:${accountKey}`, value: true });
        await done;
      } finally { database.close(); }
    }
    return { enqueue, batch, remove, discard };
  }

  function createActivityClient(config = {}, dependencies = {}) {
    const store = dependencies.store || createStore(dependencies.indexedDB || root.indexedDB);
    const fetchImpl = dependencies.fetch || root.fetch;
    const navigator = dependencies.navigator || root.navigator;
    const now = dependencies.now || (() => new Date().toISOString());
    const randomId = dependencies.randomId || (() => root.crypto.randomUUID());
    let flushing = null;
    let accountKey = "";
    function setAccount(value) {
      accountKey = /^[a-f0-9]{64}$/.test(String(value || "")) ? String(value) : "";
    }
    async function record(type) {
      if (!config.enabled || !accountKey || !EVENT_TYPES.has(type)) return false;
      await store.enqueue({ id: randomId(), accountKey, type, occurredAt: now(), clientVersion: String(config.clientVersion || "unknown") });
      return true;
    }
    async function flush(tokenProvider) {
      if (!config.enabled || !accountKey || navigator?.onLine === false) return { sent: 0 };
      if (flushing) return flushing;
      const flushingAccountKey = accountKey;
      flushing = (async () => {
        let sent = 0;
        for (let page = 0; page < 10; page += 1) {
          if (accountKey !== flushingAccountKey) break;
          let batch = await store.batch(flushingAccountKey);
          if (!batch.events.length) break;
          const cutoff = Date.parse(now()) - 30 * 24 * 60 * 60 * 1000;
          const stale = batch.events.filter((event) => Date.parse(event.occurredAt) < cutoff);
          if (stale.length) {
            await store.discard(stale.map((event) => event.id), flushingAccountKey);
            batch = { events: batch.events.filter((event) => !stale.includes(event)), partial: true };
            if (!batch.events.length) continue;
          }
          const token = await tokenProvider();
          if (accountKey !== flushingAccountKey) break;
          const publicEvents = batch.events.map(({ accountKey: ignored, ...event }) => event);
          const response = await fetchImpl(`${config.endpoint}/v1/activity/events`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ events: publicEvents, partial: batch.partial }), cache: "no-store", credentials: "omit" });
          if (!response.ok) throw new Error("Activity could not be synchronized.");
          if (accountKey !== flushingAccountKey) break;
          await store.remove(batch.events.map((event) => event.id), batch.partial, flushingAccountKey);
          sent += batch.events.length;
          if (batch.events.length < MAX_BATCH) break;
        }
        return { sent };
      })();
      try { return await flushing; } finally { flushing = null; }
    }
    return { setAccount, record, flush };
  }

  return { OUTBOX_STORE, META_STORE, MAX_QUEUED_EVENTS, MAX_BATCH, EVENT_TYPES, createStore, createActivityClient };
});
