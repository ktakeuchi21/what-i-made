"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { requestIdentity } = require("../request-identity");

test("derives a pseudonymous stable account key only from trusted gateway claims", () => {
  const environment = { AUTH_MODE: "cognito", COGNITO_CLIENT_ID: "client-123" };
  const event = { requestContext: { authorizer: { jwt: { claims: { sub: "user-a", token_use: "access", client_id: "client-123" } } } } };
  const first = requestIdentity(event, environment);
  const second = requestIdentity(event, environment);
  assert.match(first.accountKey, /^[a-f0-9]{64}$/);
  assert.equal(first.accountKey, second.accountKey);
  assert.equal(first.accountKey.includes("user-a"), false);
});

test("rejects absent, ID-token, and wrong-client identities", () => {
  const environment = { AUTH_MODE: "cognito", COGNITO_CLIENT_ID: "client-123" };
  assert.equal(requestIdentity({}, environment), null);
  assert.equal(requestIdentity({ requestContext: { authorizer: { jwt: { claims: { sub: "user-a", token_use: "id", client_id: "client-123" } } } } }, environment), null);
  assert.equal(requestIdentity({ requestContext: { authorizer: { jwt: { claims: { sub: "user-a", token_use: "access", client_id: "wrong" } } } } }, environment), null);
});
