"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createDeploymentHandler } = require("../lambda");

const ownerToken = "owner_token_for_deployment_tests_123456";
const environment = {
  RECIPE_IDEAS_ENABLED: "true", AWS_REGION: "us-east-2", BEDROCK_MODEL_ID: "openai.gpt-5.6-terra",
  OWNER_TOKEN_SHA256: crypto.createHash("sha256").update(ownerToken).digest("hex"),
  IMAGE_TOKEN_SECRET: "image-token-secret-that-is-at-least-32-bytes",
};
function event(path, body) {
  return { rawPath: path, requestContext: { requestId: "deploy-test", http: { method: "POST" } }, headers: { authorization: `Bearer ${ownerToken}` }, body: JSON.stringify(body) };
}
function response(payload) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return { ok: true, headers: { get: (name) => name === "content-type" ? "application/json" : null }, arrayBuffer: async () => bytes };
}

test("deployment entrypoint lazily wires concrete search and generation providers", async () => {
  let clientCalls = 0;
  const bedrockFetchImpl = async (_url, options) => {
    clientCalls += 1;
    const request = JSON.parse(options.body);
    const text = request.tools
      ? JSON.stringify({ candidates: [{ title: "Soup", description: "Good", url: "https://example.com/soup", sourceName: "Example", author: "Cook" }] })
      : JSON.stringify({ title: "Soup", description: "Good", servings: "2", prepTime: "5 minutes", cookTime: "10 minutes", totalTime: "15 minutes", ingredientSections: [{ name: "", items: ["Water"] }], instructionSections: [{ name: "", steps: ["Cook."] }] });
    const annotations = request.tools ? [{ type: "url_citation", title: "Soup", url: "https://example.com/soup" }] : [];
    return response({ output: [{ type: "message", content: [{ type: "output_text", text, annotations }] }] });
  };
  const handler = createDeploymentHandler({
    environment, bedrockFetchImpl,
    credentialsProvider: async () => ({ accessKeyId: "AKIATEST", secretAccessKey: "secret", sessionToken: "session" }),
    logger: { info() {} },
  });
  const search = await handler(event("/v1/recipes/search", { description: "soup" }));
  assert.equal(search.statusCode, 200);
  assert.equal(JSON.parse(search.body).candidates[0].citation.url, "https://example.com/soup");
  const generated = await handler(event("/v1/recipes/generate", { description: "soup" }));
  assert.equal(generated.statusCode, 200);
  assert.equal(JSON.parse(generated.body).recipe.sourceKind, "generated");
  assert.equal(clientCalls, 2);
});
