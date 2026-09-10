"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler, createPostAuthenticationHandler, testing } = require("../index");
const { digestSubject } = require("../domain");

const environment = { COGNITO_CLIENT_ID: "client", ADMIN_GROUP_NAME: "what-i-made-admins", ANALYTICS_LAUNCH_DATE: "2026-09-10" };
function api(path, method, groups = "[]", body = "", queryStringParameters = {}) { return { rawPath: path, body, queryStringParameters, requestContext: { http: { method }, authorizer: { jwt: { claims: { sub: "owner", client_id: "client", token_use: "access", "cognito:groups": groups } } } } }; }

test("invitees may write bounded activity but cannot read analytics", async () => {
  const recorded = [];
  const repository = { record: async (account, event, options) => { recorded.push({ account, event, options }); return true; }, scanGeneration: async () => ({ items: [] }) };
  const handler = createHandler({ repository, now: () => Date.parse("2026-09-10T12:00:00Z") }, environment);
  const body = JSON.stringify({ events: [{ id: "12345678-1234-1234-1234-123456789abc", type: "idea_created", occurredAt: "2026-09-10T11:00:00Z", clientVersion: "50" }] });
  assert.equal((await handler(api("/v1/activity/events", "POST", "[]", body))).statusCode, 200);
  assert.equal(recorded.length, 1);
  assert.equal((await handler(api("/v1/admin/analytics/summary", "GET"))).statusCode, 403);
});

test("an owner can read summaries and rotate analytics", async () => {
  let invoked = null;
  const repository = { scanGeneration: async () => ({ items: [{ entity: "event", accountId: "x", type: "cook_created", occurredAt: "2026-09-10T11:00:00Z" }] }), rotateGeneration: async () => ({ previous: "old", next: "new" }) };
  const listUsers = async () => [{ Username: "person", Enabled: true, UserStatus: "CONFIRMED", Attributes: [{ Name: "sub", Value: "person" }, { Name: "email", Value: "person@example.com" }] }];
  const handler = createHandler({ repository, listUsers, invokePurge: async (value) => { invoked = value; }, now: () => Date.parse("2026-09-10T12:00:00Z") }, environment);
  const groups = "[what-i-made-admins]";
  const summary = await handler(api("/v1/admin/analytics/summary", "GET", groups));
  assert.equal(summary.statusCode, 200);
  assert.equal(JSON.parse(summary.body).cooks, 1);
  const cleared = await handler(api("/v1/admin/analytics", "DELETE", groups, JSON.stringify({ confirmation: "ERASE ANALYTICS" })));
  assert.equal(cleared.statusCode, 202);
  assert.deepEqual(invoked, { internalPurge: true, generation: "old" });
});

test("post authentication records only a completed configured-client sign in", async () => {
  const calls = [];
  const handler = createPostAuthenticationHandler({ repository: { record: async (...args) => calls.push(args) }, now: () => Date.parse("2026-09-10T12:00:00Z") }, environment);
  const event = { triggerSource: "PostAuthentication_Authentication", callerContext: { clientId: "client" }, request: { userAttributes: { sub: "person" } } };
  assert.equal(await handler(event), event);
  assert.equal(calls[0][1].type, "sign_in_succeeded");
  assert.equal(calls[0][1].appClient, "client");
  await handler({ ...event, triggerSource: "TokenGeneration_RefreshTokens" });
  assert.equal(calls.length, 1);
});

test("user detail applies the selected range and preserves durable partial status", async () => {
  const accountId = digestSubject("person");
  const items = [
    { entity: "summary", accountId, analyticsPartial: true, firstSignInAt: "2026-01-01T12:00:00Z", lastActivityAt: "2026-09-10T11:00:00Z" },
    { entity: "event", accountId, eventId: "new", type: "cook_created", occurredAt: "2026-09-10T11:00:00Z" },
    { entity: "event", accountId, eventId: "old", type: "idea_created", occurredAt: "2026-06-01T11:00:00Z" },
  ];
  const repository = { scanGeneration: async () => ({ items, control: { purgeStatus: "complete" } }) };
  const listUsers = async () => [{ Username: "person", Enabled: true, UserStatus: "CONFIRMED", Attributes: [{ Name: "sub", Value: "person" }, { Name: "email", Value: "person@example.com" }] }];
  const handler = createHandler({ repository, listUsers, now: () => Date.parse("2026-09-10T12:00:00Z") }, environment);
  const result = await handler(api(`/v1/admin/analytics/users/${accountId}`, "GET", "[what-i-made-admins]", "", { range: "7d" }));
  const payload = JSON.parse(result.body);
  assert.deepEqual(payload.events.map((event) => event.type), ["cook_created"]);
  assert.equal(payload.user.partial, true);
});

test("cursor pages are bounded and invalid cursors fail closed", () => {
  const first = testing.page(Array.from({ length: 101 }, (_, index) => index), null, 100);
  assert.equal(first.values.length, 100);
  assert.ok(first.nextCursor);
  assert.deepEqual(testing.page(Array.from({ length: 101 }, (_, index) => index), first.nextCursor, 100), { values: [100], nextCursor: null });
  assert.throws(() => testing.readCursor("not-a-cursor"), /invalid_request/);
});

test("purge performs a consistent empty verification pass before completion", async () => {
  const invocations = [];
  let pass = 0;
  const repository = { purgeGeneration: async () => (++pass === 1 ? { nextKey: null, deletedCount: 2 } : { nextKey: null, deletedCount: 0 }), completePurge: async (generation) => invocations.push({ complete: generation }) };
  const handler = createHandler({ repository, invokePurge: async (payload) => invocations.push(payload) }, environment);
  assert.deepEqual(await handler({ internalPurge: true, generation: "old" }), { complete: false });
  assert.deepEqual(invocations[0], { internalPurge: true, generation: "old", verify: true });
  assert.deepEqual(await handler({ internalPurge: true, generation: "old", verify: true }), { complete: true });
  assert.deepEqual(invocations[1], { complete: "old" });
});
