const test = require("node:test");
const assert = require("node:assert/strict");

const { createProvider, finalJsonText, signRequest } = require("../bedrock-provider");

const result = { cleanedVoiceText: "I made adobo.", dishes: [], warnings: [] };
function http(payload, headers = {}) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return { ok: true, headers: { get: (name) => headers[name] || (name === "content-type" ? "application/json" : null) }, arrayBuffer: async () => bytes };
}

test("signs Mantle requests without exposing the secret", () => {
  const headers = signRequest({ url: "https://bedrock-mantle.us-east-2.api.aws/openai/v1/responses", body: "{}", region: "us-east-2", now: new Date("2026-09-07T12:00:00Z"), credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret", sessionToken: "session" } });
  assert.match(headers.authorization, /AKIATEST/);
  assert.equal(JSON.stringify(headers).includes("secret"), false);
});

test("isolates validated JSON after GPT OSS reasoning without trusting the prose", () => {
  assert.equal(finalJsonText(`<reasoning>Untrusted working text.</reasoning>\n\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\``), JSON.stringify(result));
});

test("requests strict non-stored structured output and validates it", async () => {
  let request;
  const provider = createProvider({ environment: { AWS_REGION: "us-east-2", AWS_ACCESS_KEY_ID: "A", AWS_SECRET_ACCESS_KEY: "B" }, fetchImpl: async (_url, options) => { request = JSON.parse(options.body); return http({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }], usage: { input_tokens: 20, output_tokens: 8, total_tokens: 28 } }); } });
  const parsed = await provider.parseCook({ transcript: "Adobo", voiceSegment: "Adobo", locale: "en-US" });
  assert.deepEqual(parsed, result);
  assert.deepEqual(parsed.usage, { inputTokens: 20, outputTokens: 8, totalTokens: 28 });
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.equal(request.tools, undefined);
  assert.match(request.instructions, /only a cleaned version of voiceSegment/);
});

test("uses Bedrock InvokeModel for account-available GPT OSS models", async () => {
  let target;
  let request;
  const provider = createProvider({
    environment: { AWS_REGION: "us-east-2", AWS_ACCESS_KEY_ID: "A", AWS_SECRET_ACCESS_KEY: "B", BEDROCK_MODEL_ID: "openai.gpt-oss-20b" },
    fetchImpl: async (url, options) => {
      target = url;
      request = JSON.parse(options.body);
      return http({ choices: [{ message: { content: `<reasoning>working</reasoning>\n\`\`\`json\n${JSON.stringify(result)}\n\`\`\`` } }], usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 } });
    },
  });
  const parsed = await provider.parseCook({ transcript: "Adobo", voiceSegment: "Adobo", locale: "en-US" });
  assert.deepEqual(parsed, result);
  assert.deepEqual(parsed.usage, { inputTokens: 20, outputTokens: 8, totalTokens: 28 });
  assert.equal(target, "https://bedrock-runtime.us-east-2.amazonaws.com/model/openai.gpt-oss-20b-1:0/invoke");
  assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(request.model, "openai.gpt-oss-20b-1:0");
  assert.match(request.messages[0].content, /only a cleaned version of voiceSegment/);
});

test("rejects unsupported or stalled provider responses", async () => {
  const environment = { AWS_REGION: "us-east-2", AWS_ACCESS_KEY_ID: "A", AWS_SECRET_ACCESS_KEY: "B" };
  await assert.rejects(() => createProvider({ environment, fetchImpl: async () => ({ ok: true, headers: { get: () => "text/html" }, arrayBuffer: async () => new ArrayBuffer(0) }) }).parseCook({ transcript: "x", voiceSegment: "", locale: "en-US" }), /provider_unavailable/);
  await assert.rejects(() => createProvider({ environment, timeoutMs: 5, fetchImpl: async () => new Promise(() => {}) }).parseCook({ transcript: "x", voiceSegment: "", locale: "en-US" }), /timeout/);
});
