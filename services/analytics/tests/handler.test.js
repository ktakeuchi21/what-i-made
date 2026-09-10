"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHandler, createPostAuthenticationHandler } = require("../index");

const environment = { COGNITO_CLIENT_ID: "client", ADMIN_GROUP_NAME: "what-i-made-admins", ANALYTICS_LAUNCH_DATE: "2026-09-10" };
function api(path, method, groups = "[]", body = "") { return { rawPath: path, body, requestContext: { http: { method }, authorizer: { jwt: { claims: { sub: "owner", client_id: "client", token_use: "access", "cognito:groups": groups } } } } }; }

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
