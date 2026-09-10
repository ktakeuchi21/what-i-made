const test = require("node:test");
const assert = require("node:assert/strict");
const { createActivityClient } = require("../activity-client.js");

test("queues only allowlisted content-free events", async () => {
  const queued = [];
  const client = createActivityClient({ enabled: true, endpoint: "https://api.example", clientVersion: "51" }, { store: { enqueue: async (event) => queued.push(event), batch: async () => ({ events: [], partial: false }), remove: async () => {} }, randomId: () => "12345678-1234-1234-1234-123456789abc", now: () => "2026-09-10T12:00:00.000Z" });
  client.setAccount("a".repeat(64));
  assert.equal(await client.record("cook_created"), true);
  assert.equal(await client.record("page_view"), false);
  assert.deepEqual(queued, [{ id: "12345678-1234-1234-1234-123456789abc", accountKey: "a".repeat(64), type: "cook_created", occurredAt: "2026-09-10T12:00:00.000Z", clientVersion: "51" }]);
});

test("flushes bounded metadata with authorization and removes acknowledged events", async () => {
  const removed = [];
  const requests = [];
  let reads = 0;
  const event = { id: "12345678-1234-1234-1234-123456789abc", accountKey: "a".repeat(64), type: "idea_created", occurredAt: "2026-09-10T12:00:00.000Z", clientVersion: "51" };
  const client = createActivityClient({ enabled: true, endpoint: "https://api.example", clientVersion: "51" }, { navigator: { onLine: true }, store: { enqueue: async () => {}, batch: async () => reads++ ? ({ events: [], partial: false }) : ({ events: [event], partial: true }), remove: async (...args) => removed.push(args) }, fetch: async (url, options) => { requests.push({ url, options }); return { ok: true }; } });
  client.setAccount("a".repeat(64));
  assert.deepEqual(await client.flush(async () => "token"), { sent: 1 });
  assert.equal(requests[0].options.headers.Authorization, "Bearer token");
  const { accountKey: ignored, ...publicEvent } = event;
  assert.deepEqual(JSON.parse(requests[0].options.body), { events: [publicEvent], partial: true });
  assert.deepEqual(removed, [[[event.id], true, "a".repeat(64)]]);
});

test("does not submit one account's queued events with another account's token", async () => {
  const requests = [];
  const event = { id: "12345678-1234-1234-1234-123456789abc", accountKey: "a".repeat(64), type: "cook_created", occurredAt: "2026-09-10T12:00:00.000Z", clientVersion: "51" };
  const client = createActivityClient({ enabled: true, endpoint: "https://api.example", clientVersion: "51" }, { navigator: { onLine: true }, store: { enqueue: async () => {}, batch: async () => ({ events: [event], partial: false }), remove: async () => assert.fail("stale events must remain queued") }, fetch: async (...args) => { requests.push(args); return { ok: true }; } });
  client.setAccount("a".repeat(64));
  const result = await client.flush(async () => { client.setAccount("b".repeat(64)); return "account-b-token"; });
  assert.deepEqual(result, { sent: 0 });
  assert.equal(requests.length, 0);
});

test("drops events too old for ingestion and labels the next batch partial", async () => {
  const discarded = [];
  const requests = [];
  let reads = 0;
  const stale = { id: "11111111-1111-1111-1111-111111111111", accountKey: "a".repeat(64), type: "cook_created", occurredAt: "2026-07-01T12:00:00.000Z", clientVersion: "51" };
  const current = { id: "22222222-2222-2222-2222-222222222222", accountKey: "a".repeat(64), type: "idea_created", occurredAt: "2026-09-10T11:00:00.000Z", clientVersion: "51" };
  const client = createActivityClient({ enabled: true, endpoint: "https://api.example", clientVersion: "51" }, { navigator: { onLine: true }, now: () => "2026-09-10T12:00:00.000Z", store: { enqueue: async () => {}, batch: async () => reads++ ? ({ events: [], partial: false }) : ({ events: [stale, current], partial: false }), discard: async (...args) => discarded.push(args), remove: async () => {} }, fetch: async (url, options) => { requests.push({ url, options }); return { ok: true }; } });
  client.setAccount("a".repeat(64));
  assert.deepEqual(await client.flush(async () => "token"), { sent: 1 });
  assert.deepEqual(discarded, [[[stale.id], "a".repeat(64)]]);
  const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload.partial, true);
  assert.deepEqual(payload.events.map((event) => event.id), [current.id]);
});
