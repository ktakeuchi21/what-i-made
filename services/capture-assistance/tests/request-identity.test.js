"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { requestIdentity } = require("../request-identity");

test("derives a pseudonymous stable account key only from trusted gateway claims", () => {
  const environment = { COGNITO_CLIENT_ID: "client-123" };
  const event = { requestContext: { authorizer: { jwt: { claims: { sub: "user-a", token_use: "access", client_id: "client-123" } } } } };
  const first = requestIdentity(event, environment);
  const second = requestIdentity(event, environment);
  assert.match(first.accountKey, /^[a-f0-9]{64}$/);
  assert.equal(first.accountKey, second.accountKey);
  assert.equal(first.accountKey.includes("user-a"), false);
});

test("rejects absent, ID-token, and wrong-client identities", () => {
  const environment = { COGNITO_CLIENT_ID: "client-123" };
  assert.equal(requestIdentity({}, environment), null);
  assert.equal(requestIdentity({ requestContext: { authorizer: { jwt: { claims: { sub: "user-a", token_use: "id", client_id: "client-123" } } } } }, environment), null);
  assert.equal(requestIdentity({ requestContext: { authorizer: { jwt: { claims: { sub: "user-a", token_use: "access", client_id: "wrong" } } } } }, environment), null);
});

test("does not accept the retired shared-token authorization path", () => {
  const event = { headers: { authorization: "Bearer legacy_owner_token_that_is_long_enough" } };
  const environment = { COGNITO_CLIENT_ID: "client-123", OWNER_TOKEN_SHA256: "a".repeat(64) };
  assert.equal(requestIdentity(event, environment), null);
});
