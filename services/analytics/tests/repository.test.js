"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const commands = require("@aws-sdk/client-dynamodb");
const { createRepository } = require("../repository");

function mockRepository(respond, now = () => Date.parse("2026-09-10T12:00:00Z")) {
  const calls = [];
  const client = {
    async send(command) {
      calls.push(command);
      return respond(command, calls) || {};
    },
  };
  return { calls, repository: createRepository({ ANALYTICS_TABLE: "analytics" }, { client, commands, now }) };
}

test("records an idempotent event with a twelve-month TTL and lifetime counter", async () => {
  const { calls, repository } = mockRepository((command) => {
    if (command instanceof commands.GetItemCommand) return { Item: { generation: { S: "current" } } };
    return {};
  });
  const saved = await repository.record("account", { id: "event-id", type: "cook_created", occurredAt: "2026-09-10T11:00:00.000Z", clientVersion: "51" }, { partial: true });
  assert.equal(saved, true);
  const transaction = calls.find((call) => call instanceof commands.TransactWriteItemsCommand).input.TransactItems;
  assert.equal(transaction[0].Put.Item.pk.S, "GEN#current#USER#account");
  assert.equal(transaction[0].Put.Item.expiresAt.N, String(Math.floor(Date.parse("2027-09-11T11:00:00.000Z") / 1000)));
  assert.equal(transaction[0].Put.ConditionExpression, "attribute_not_exists(pk) AND attribute_not_exists(sk)");
  assert.equal(transaction[1].ConditionCheck.ExpressionAttributeValues[":generation"].S, "current");
  assert.match(transaction[2].Update.UpdateExpression, /ADD totalEvents :one, #counter :one/);
  assert.equal(transaction[2].Update.ExpressionAttributeNames["#counter"], "count_cook_created");
  assert.equal(transaction[2].Update.ExpressionAttributeValues[":partial"].BOOL, true);
});

test("treats a cancelled event transaction as an idempotent duplicate", async () => {
  const { repository } = mockRepository((command) => {
    if (command instanceof commands.GetItemCommand && command.input.Key.pk.S === "CONTROL") return { Item: { generation: { S: "current" } } };
    if (command instanceof commands.GetItemCommand) return { Item: { eventId: { S: "event-id" } } };
    if (command instanceof commands.TransactWriteItemsCommand) throw Object.assign(new Error("duplicate"), { name: "TransactionCanceledException", CancellationReasons: [{ Code: "ConditionalCheckFailed" }, { Code: "None" }] });
    return {};
  });
  assert.equal(await repository.record("account", { id: "event-id", type: "idea_created", occurredAt: "2026-09-10T11:00:00.000Z", clientVersion: "51" }), false);
});

test("rotates analytics immediately and purges the retired generation", async () => {
  let scan = 0;
  const { calls, repository } = mockRepository((command) => {
    if (command instanceof commands.GetItemCommand) return { Item: { generation: { S: "old" } } };
    if (command instanceof commands.ScanCommand) {
      scan += 1;
      return scan === 1 ? { Items: [{ pk: { S: "GEN#old#USER#a" }, sk: { S: "EVENT#1" } }], LastEvaluatedKey: { pk: { S: "cursor" }, sk: { S: "cursor" } } } : { Items: [] };
    }
    return {};
  });
  const rotated = await repository.rotateGeneration();
  assert.equal(rotated.previous, "old");
  assert.notEqual(rotated.next, "old");
  const controlUpdate = calls.find((call) => call instanceof commands.UpdateItemCommand).input;
  assert.equal(controlUpdate.ExpressionAttributeValues[":clearing"].S, "clearing");
  assert.equal(controlUpdate.ExpressionAttributeValues[":previous"].S, "old");
  const purge = await repository.purgeGeneration("old");
  assert.deepEqual(purge.nextKey, { pk: { S: "cursor" }, sk: { S: "cursor" } });
  assert.equal(purge.deletedCount, 1);
  assert.equal(calls.find((call) => call instanceof commands.ScanCommand).input.ConsistentRead, true);
  assert.equal(calls.some((call) => call instanceof commands.BatchWriteItemCommand), true);
  await repository.completePurge("old");
  assert.match(calls.find((call) => call instanceof commands.UpdateItemCommand).input.UpdateExpression, /purgeStatus/);
});

test("a retired purge cannot mark a newer erase operation complete", async () => {
  const { repository } = mockRepository((command) => {
    if (command instanceof commands.UpdateItemCommand) throw Object.assign(new Error("newer purge"), { name: "ConditionalCheckFailedException" });
    return {};
  });
  await assert.doesNotReject(() => repository.completePurge("retired"));
});

test("an event racing with erase retries only in the active generation", async () => {
  let controlReads = 0;
  let transactions = 0;
  const { calls, repository } = mockRepository((command) => {
    if (command instanceof commands.GetItemCommand && command.input.Key.pk.S === "CONTROL") {
      controlReads += 1;
      return { Item: { generation: { S: controlReads === 1 ? "old" : "new" } } };
    }
    if (command instanceof commands.GetItemCommand) return {};
    if (command instanceof commands.TransactWriteItemsCommand && transactions++ === 0) throw Object.assign(new Error("generation changed"), { name: "TransactionCanceledException" });
    return {};
  });
  assert.equal(await repository.record("account", { id: "event-id", type: "cook_created", occurredAt: "2026-09-10T11:00:00.000Z", clientVersion: "51" }), true);
  const writes = calls.filter((call) => call instanceof commands.TransactWriteItemsCommand);
  assert.equal(writes[0].input.TransactItems[0].Put.Item.pk.S, "GEN#old#USER#account");
  assert.equal(writes[1].input.TransactItems[0].Put.Item.pk.S, "GEN#new#USER#account");
});

test("a repeated erase is rejected until the tracked purge completes", async () => {
  const { calls, repository } = mockRepository((command) => {
    if (command instanceof commands.GetItemCommand) return { Item: { generation: { S: "new" }, purgeStatus: { S: "clearing" }, purgingGeneration: { S: "old" } } };
    return {};
  });
  await assert.rejects(() => repository.rotateGeneration(), /erase_in_progress/);
  assert.equal(calls.some((call) => call instanceof commands.UpdateItemCommand), false);
});
