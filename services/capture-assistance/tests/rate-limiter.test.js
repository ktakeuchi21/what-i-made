"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDurableRateLimiter } = require("../rate-limiter");

test("fails closed for Cognito mode without the durable counter table", async () => {
  const allow = createDurableRateLimiter({ AUTH_MODE: "cognito" });
  assert.equal(await allow("a".repeat(64), "/route", 0, 10), false);
});

test("uses an atomic expiring counter without exposing the raw subject", async () => {
  let input;
  const allow = createDurableRateLimiter({ AUTH_MODE: "cognito", RATE_LIMIT_TABLE: "limits" }, {
    client: { async send(command) { input = command; } },
    commandFactory: (value) => value,
  });
  assert.equal(await allow("a".repeat(64), "/v1/parse-cook", 120001, 10), true);
  assert.equal(input.TableName, "limits");
  assert.equal(input.Key.accountWindow.S, `${"a".repeat(64)}:/v1/parse-cook:120000`);
  assert.match(input.UpdateExpression, /ADD requestCount/);
  assert.match(input.ConditionExpression, /requestCount < :limit/);
  assert.equal(input.ExpressionAttributeValues[":expiresAt"].N, "420");
});

test("turns a failed conditional write into a rate-limit decision", async () => {
  const allow = createDurableRateLimiter({ AUTH_MODE: "cognito", RATE_LIMIT_TABLE: "limits" }, {
    client: { async send() { throw { name: "ConditionalCheckFailedException" }; } },
    commandFactory: (value) => value,
  });
  assert.equal(await allow("a".repeat(64), "/route", 0, 1), false);
});
