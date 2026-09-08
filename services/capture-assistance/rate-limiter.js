"use strict";

function createDurableRateLimiter(environment = process.env, dependencies = {}) {
  let client = dependencies.client || null;
  let commandFactory = dependencies.commandFactory || null;
  const tableName = environment.RATE_LIMIT_TABLE || "";
  const localWindows = new Map();
  return async function allow(accountKey, route, now, limit) {
    if (!tableName) {
      if (environment.AUTH_MODE === "cognito") return false;
      const key = `${accountKey}:${route}`;
      const current = localWindows.get(key);
      const window = !current || now - current.startedAt >= 60000 ? { startedAt: now, count: 0 } : current;
      window.count += 1;
      localWindows.set(key, window);
      return window.count <= limit;
    }
    if (!client) {
      const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
      client = new DynamoDBClient({});
    }
    if (!commandFactory) {
      const { UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
      commandFactory = (input) => new UpdateItemCommand(input);
    }
    const windowStart = Math.floor(now / 60000) * 60000;
    try {
      await client.send(commandFactory({
        TableName: tableName,
        Key: { accountWindow: { S: `${accountKey}:${route}:${windowStart}` } },
        UpdateExpression: "SET expiresAt = if_not_exists(expiresAt, :expiresAt) ADD requestCount :one",
        ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :limit",
        ExpressionAttributeValues: {
          ":expiresAt": { N: String(Math.floor(windowStart / 1000) + 300) },
          ":one": { N: "1" },
          ":limit": { N: String(limit) },
        },
      }));
      return true;
    } catch (error) {
      if (error?.name === "ConditionalCheckFailedException") return false;
      throw error;
    }
  };
}

module.exports = { createDurableRateLimiter };
