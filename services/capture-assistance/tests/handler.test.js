const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { createHandler } = require("../index");

const token = "owner_token_abcdefghijklmnopqrstuvwxyz123456";
const environment = { CAPTURE_ASSISTANCE_ENABLED: "true", OWNER_TOKEN_SHA256: crypto.createHash("sha256").update(token).digest("hex") };
const valid = { cleanedVoiceText: "I made adobo.", dishes: [], warnings: [] };
const event = (body, authorization = `Bearer ${token}`) => ({ rawPath: "/v1/parse-cook", requestContext: { http: { method: "POST" }, requestId: "request-1" }, headers: { authorization }, body: JSON.stringify(body) });

test("requires the owner token and exact bounded request contract", async () => {
  const handler = createHandler({ provider: { parseCook: async () => valid }, logger: { info() {} } }, environment);
  assert.equal((await handler(event({ transcript: "Adobo", voiceSegment: "Adobo", locale: "en-US" }, "Bearer wrong"))).statusCode, 401);
  assert.equal((await handler(event({ transcript: "Adobo", voiceSegment: "", locale: "en-US", archive: [] }))).statusCode, 400);
  assert.equal((await handler(event({ transcript: "x".repeat(5001), voiceSegment: "", locale: "en-US" }))).statusCode, 400);
});

test("returns validated provider output without logging private text", async () => {
  const logs = [];
  const providerValue = { ...valid };
  Object.defineProperty(providerValue, "usage", { enumerable: false, value: { inputTokens: 12, outputTokens: 4, totalTokens: 16, transcript: "must not log" } });
  const handler = createHandler({ provider: { parseCook: async () => providerValue }, logger: { info(value) { logs.push(value); } }, now: (() => { let value = 0; return () => value += 5; })() }, environment);
  const result = await handler(event({ transcript: "I made a private adobo note", voiceSegment: "I made a private adobo note", locale: "en-US" }));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), valid);
  assert.equal(logs.some((line) => /private|adobo/i.test(line)), false);
  assert.deepEqual(JSON.parse(logs[0]), { requestId: "request-1", route: "/v1/parse-cook", statusCode: 200, latencyMs: 5, inputTokens: 12, outputTokens: 4, totalTokens: 16 });
});

test("rejects cleaned output that is not limited to the new voice segment", async () => {
  const handler = createHandler({ provider: { parseCook: async () => valid }, logger: { info() {} } }, environment);
  assert.equal((await handler(event({ transcript: "Typed note", voiceSegment: "", locale: "en-US" }))).statusCode, 502);
  const voiceSegment = "I made a very large bowl of chicken adobo tonight";
  const duplicated = createHandler({ provider: { parseCook: async () => ({ ...valid, cleanedVoiceText: `Earlier note ${voiceSegment}` }) }, logger: { info() {} } }, environment);
  assert.equal((await duplicated(event({ transcript: `Earlier note\n${voiceSegment}`, voiceSegment, locale: "en-US" }))).statusCode, 502);
});

test("kill switch and invalid provider output fail safely", async () => {
  const disabled = createHandler({ logger: { info() {} } }, { ...environment, CAPTURE_ASSISTANCE_ENABLED: "false" });
  assert.equal((await disabled(event({ transcript: "Adobo", voiceSegment: "", locale: "en-US" }))).statusCode, 503);
  const invalid = createHandler({ provider: { parseCook: async () => ({ ...valid, secret: "x" }) }, logger: { info() {} } }, environment);
  assert.equal((await invalid(event({ transcript: "Adobo", voiceSegment: "", locale: "en-US" }))).statusCode, 502);
});

test("limits authenticated requests without retaining their text", async () => {
  let calls = 0;
  const output = { cleanedVoiceText: "", dishes: [], warnings: [] };
  const handler = createHandler({ provider: { parseCook: async () => { calls += 1; return output; } }, logger: { info() {} }, now: () => 100 }, environment);
  const request = event({ transcript: "Adobo", voiceSegment: "", locale: "en-US" });
  for (let index = 0; index < 10; index += 1) assert.equal((await handler(request)).statusCode, 200);
  assert.equal((await handler(request)).statusCode, 429);
  assert.equal(calls, 10);
});
