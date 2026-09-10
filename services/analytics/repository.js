"use strict";

const crypto = require("node:crypto");
const { EVENT_TTL_SECONDS } = require("./domain");

function value(item) {
  if (!item) return null;
  return Object.fromEntries(Object.entries(item).map(([key, attribute]) => [key, attribute.S ?? (attribute.N === undefined ? attribute.BOOL : Number(attribute.N))]));
}

function createRepository(environment = process.env, dependencies = {}) {
  const tableName = environment.ANALYTICS_TABLE || "";
  let client = dependencies.client || null;
  let commands = dependencies.commands || null;
  const now = dependencies.now || Date.now;
  function ready() {
    if (!tableName) throw new Error("unavailable");
    if (!client) {
      const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
      client = new DynamoDBClient({});
    }
    if (!commands) commands = require("@aws-sdk/client-dynamodb");
  }
  async function send(name, input) { ready(); return client.send(new commands[name](input)); }
  async function control() {
    const result = await send("GetItemCommand", { TableName: tableName, Key: { pk: { S: "CONTROL" }, sk: { S: "ACTIVE" } }, ConsistentRead: true });
    if (result.Item?.generation?.S) return value(result.Item);
    const created = crypto.randomUUID();
    try {
      await send("PutItemCommand", { TableName: tableName, Item: { pk: { S: "CONTROL" }, sk: { S: "ACTIVE" }, generation: { S: created }, startedAt: { S: new Date(now()).toISOString() } }, ConditionExpression: "attribute_not_exists(pk)" });
      return { generation: created, startedAt: new Date(now()).toISOString(), purgeStatus: "complete" };
    } catch (error) {
      if (error?.name !== "ConditionalCheckFailedException") throw error;
      return control();
    }
  }
  async function generation() { return (await control()).generation; }
  async function record(accountId, event, options = {}) {
    const active = options.generation || await generation();
    const receivedAt = new Date(now()).toISOString();
    const expiresAt = Math.floor(new Date(event.occurredAt).getTime() / 1000) + EVENT_TTL_SECONDS;
    const pk = `GEN#${active}#USER#${accountId}`;
    const eventItem = {
      pk: { S: pk }, sk: { S: `EVENT#${event.occurredAt}#${event.id}` }, entity: { S: "event" }, accountId: { S: accountId }, eventId: { S: event.id }, type: { S: event.type }, occurredAt: { S: event.occurredAt }, receivedAt: { S: receivedAt }, day: { S: event.occurredAt.slice(0, 10) }, month: { S: event.occurredAt.slice(0, 7) }, expiresAt: { N: String(expiresAt) }, partial: { BOOL: options.partial === true },
    };
    if (event.clientVersion) eventItem.clientVersion = { S: event.clientVersion };
    if (event.appClient) eventItem.appClient = { S: String(event.appClient).slice(0, 128) };
    const setParts = ["accountId = :accountId", "entity = :summary", "firstActivityAt = if_not_exists(firstActivityAt, :occurredAt)", "lastActivityAt = if_not_exists(lastActivityAt, :occurredAt)"];
    const summaryValues = { ":accountId": { S: accountId }, ":summary": { S: "summary" }, ":occurredAt": { S: event.occurredAt }, ":one": { N: "1" } };
    if (options.partial) {
      setParts.push("analyticsPartial = :partial");
      summaryValues[":partial"] = { BOOL: true };
    }
    if (event.type === "sign_in_succeeded") {
      setParts.push("firstSignInAt = if_not_exists(firstSignInAt, :occurredAt)", "lastSignInAt = if_not_exists(lastSignInAt, :occurredAt)");
    }
    let duplicate = false;
    try {
      await send("TransactWriteItemsCommand", { TransactItems: [
        { Put: { TableName: tableName, Item: eventItem, ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)" } },
        { ConditionCheck: { TableName: tableName, Key: { pk: { S: "CONTROL" }, sk: { S: "ACTIVE" } }, ConditionExpression: "generation = :generation", ExpressionAttributeValues: { ":generation": { S: active } } } },
        { Update: { TableName: tableName, Key: { pk: { S: pk }, sk: { S: "SUMMARY" } }, UpdateExpression: `SET ${setParts.join(", ")} ADD totalEvents :one, #counter :one`, ExpressionAttributeNames: { "#counter": `count_${event.type}` }, ExpressionAttributeValues: summaryValues } },
      ] });
    } catch (error) {
      if (error?.name !== "TransactionCanceledException") throw error;
      const existing = await send("GetItemCommand", { TableName: tableName, Key: { pk: { S: pk }, sk: { S: `EVENT#${event.occurredAt}#${event.id}` } }, ConsistentRead: true });
      duplicate = Boolean(existing.Item);
      if (!duplicate && !options.generation && await generation() !== active) return record(accountId, event, options);
      if (!duplicate) throw error;
    }
    const boundary = async (field, comparison) => {
      try {
        await send("UpdateItemCommand", { TableName: tableName, Key: { pk: { S: pk }, sk: { S: "SUMMARY" } }, UpdateExpression: `SET #field = :occurredAt`, ConditionExpression: `#field ${comparison} :occurredAt`, ExpressionAttributeNames: { "#field": field }, ExpressionAttributeValues: { ":occurredAt": { S: event.occurredAt } } });
      } catch (error) {
        if (error?.name !== "ConditionalCheckFailedException") throw error;
      }
    };
    await boundary("firstActivityAt", ">");
    await boundary("lastActivityAt", "<");
    if (event.type === "sign_in_succeeded") {
      await boundary("firstSignInAt", ">");
      await boundary("lastSignInAt", "<");
    }
    return !duplicate;
  }
  async function scanGeneration(active = null) {
    const selected = active || await generation();
    const items = [];
    let key;
    do {
      const result = await send("ScanCommand", { TableName: tableName, ExclusiveStartKey: key, FilterExpression: "begins_with(pk, :prefix)", ExpressionAttributeValues: { ":prefix": { S: `GEN#${selected}#` } } });
      items.push(...(result.Items || []).map(value));
      if (items.length > 10000) throw new Error("analytics_limit_exceeded");
      key = result.LastEvaluatedKey;
    } while (key);
    const latestControl = await control();
    if (latestControl.generation !== selected) return scanGeneration(latestControl.generation);
    return { generation: selected, items, control: latestControl };
  }
  async function rotateGeneration() {
    const current = await control();
    if (current.purgeStatus === "clearing" && current.purgingGeneration) return { previous: current.purgingGeneration, next: current.generation, alreadyClearing: true };
    const previous = current.generation;
    const next = crypto.randomUUID();
    try {
      await send("UpdateItemCommand", { TableName: tableName, Key: { pk: { S: "CONTROL" }, sk: { S: "ACTIVE" } }, UpdateExpression: "SET generation = :next, startedAt = :startedAt, purgeStatus = :clearing, purgingGeneration = :previous", ConditionExpression: "generation = :previous", ExpressionAttributeValues: { ":next": { S: next }, ":startedAt": { S: new Date(now()).toISOString() }, ":clearing": { S: "clearing" }, ":previous": { S: previous } } });
      return { previous, next };
    } catch (error) {
      if (error?.name !== "ConditionalCheckFailedException") throw error;
      return rotateGeneration();
    }
  }
  async function purgeGeneration(selected, startKey) {
    const result = await send("ScanCommand", { TableName: tableName, ExclusiveStartKey: startKey, Limit: 100, ConsistentRead: true, FilterExpression: "begins_with(pk, :prefix)", ExpressionAttributeValues: { ":prefix": { S: `GEN#${selected}#` } }, ProjectionExpression: "pk, sk" });
    const keys = result.Items || [];
    for (let index = 0; index < keys.length; index += 25) {
      let pending = keys.slice(index, index + 25).map((Key) => ({ DeleteRequest: { Key } }));
      do {
        const deletion = await send("BatchWriteItemCommand", { RequestItems: { [tableName]: pending } });
        pending = deletion.UnprocessedItems?.[tableName] || [];
      } while (pending.length);
    }
    return { nextKey: result.LastEvaluatedKey || null, deletedCount: keys.length };
  }
  async function completePurge(selected) {
    try {
      await send("UpdateItemCommand", { TableName: tableName, Key: { pk: { S: "CONTROL" }, sk: { S: "ACTIVE" } }, UpdateExpression: "SET purgeStatus = :complete REMOVE purgingGeneration", ConditionExpression: "purgingGeneration = :selected", ExpressionAttributeValues: { ":complete": { S: "complete" }, ":selected": { S: selected } } });
    } catch (error) {
      if (error?.name !== "ConditionalCheckFailedException") throw error;
    }
  }
  return { control, generation, record, scanGeneration, rotateGeneration, purgeGeneration, completePurge };
}

module.exports = { createRepository, testing: { value } };
