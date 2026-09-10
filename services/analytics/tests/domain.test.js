"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateEventBatch, identityFromClaims, summarizeEvents, digestSubject } = require("../domain");

test("accepts only metadata-only client events", () => {
  const value = validateEventBatch({ events: [{ id: "12345678-1234-1234-1234-123456789abc", type: "cook_created", occurredAt: "2026-09-10T12:00:00.000Z", clientVersion: "50" }], partial: false }, Date.parse("2026-09-10T12:01:00Z"));
  assert.equal(value.events[0].type, "cook_created");
  assert.throws(() => validateEventBatch({ events: [{ id: "12345678-1234-1234-1234-123456789abc", type: "cook_created", occurredAt: "2026-09-10T12:00:00.000Z", clientVersion: "50", dishName: "Private" }] }, Date.parse("2026-09-10T12:01:00Z")), /invalid_request/);
  assert.throws(() => validateEventBatch({ events: [{ id: "12345678-1234-1234-1234-123456789abc", type: "sign_in_succeeded", occurredAt: "2026-09-10T12:00:00.000Z", clientVersion: "50" }] }, Date.parse("2026-09-10T12:01:00Z")), /invalid_request/);
});

test("requires the configured client and admin group", () => {
  const env = { COGNITO_CLIENT_ID: "client", ADMIN_GROUP_NAME: "what-i-made-admins" };
  const claims = { sub: "subject", client_id: "client", token_use: "access", "cognito:groups": "[what-i-made-admins]" };
  assert.equal(identityFromClaims(claims, env, { admin: true }).accountId, digestSubject("subject"));
  assert.equal(identityFromClaims({ ...claims, "cognito:groups": "[]" }, env, { admin: true }), null);
  assert.equal(identityFromClaims({ ...claims, client_id: "other" }, env), null);
});

test("summarizes only the selected range without archive content", () => {
  const now = Date.parse("2026-09-10T12:00:00Z");
  const events = [
    { accountId: "a", type: "sign_in_succeeded", occurredAt: "2026-09-10T10:00:00Z" },
    { accountId: "a", type: "cook_created", occurredAt: "2026-09-09T10:00:00Z" },
    { accountId: "b", type: "idea_created", occurredAt: "2026-07-01T10:00:00Z" },
  ];
  assert.deepEqual(summarizeEvents(events, "30d", now), { activeAccounts: 1, accountsSignedIn: 1, signIns: 1, cooks: 1, ideas: 0, partial: false, series: [{ date: "2026-09-09", signIns: 0, cooks: 1, ideas: 0 }, { date: "2026-09-10", signIns: 1, cooks: 0, ideas: 0 }] });
});
