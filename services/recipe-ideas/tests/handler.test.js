"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createHandler } = require("../index");
const { signImageToken } = require("../image-token");

const token = "owner_token_for_recipe_tests_123456789";
const secret = "image-token-secret-that-is-at-least-32-bytes";
const environment = {
  RECIPE_IDEAS_ENABLED: "true",
  OWNER_TOKEN_SHA256: crypto.createHash("sha256").update(token).digest("hex"),
  IMAGE_TOKEN_SECRET: secret,
};
const lookup = async () => [{ address: "8.8.8.8", family: 4 }];
const logger = { info() {} };

function event(method, path, body, authorization = `Bearer ${token}`) {
  return { rawPath: path, requestContext: { requestId: "test", http: { method } }, headers: { authorization }, body: body === undefined ? "" : JSON.stringify(body) };
}
function response(body, contentType = "text/html") {
  return { status: 200, ok: true, headers: { get: (key) => key === "content-type" ? contentType : null }, arrayBuffer: async () => Buffer.from(body) };
}
function bodyOf(result) { return JSON.parse(result.body); }

test("all routes require a valid owner token and honor the kill switch", async () => {
  const handler = createHandler({ logger }, environment);
  assert.equal((await handler(event("POST", "/v1/recipes/search", { description: "soup" }, ""))).statusCode, 401);
  assert.equal((await createHandler({ logger }, { ...environment, RECIPE_IDEAS_ENABLED: "false" })(event("POST", "/v1/recipes/search", { description: "soup" }))).statusCode, 503);
});

test("accepts only the API Gateway-validated Cognito access-token identity", async () => {
  const cognitoEnvironment = { ...environment, AUTH_MODE: "cognito", COGNITO_CLIENT_ID: "client-123" };
  const handler = createHandler({ logger, allowRequest: async () => true }, cognitoEnvironment);
  const request = event("POST", "/v1/recipes/search", { description: "soup" }, "Bearer ignored-by-lambda");
  request.requestContext.authorizer = { jwt: { claims: { sub: "account-a", token_use: "access", client_id: "client-123" } } };
  assert.equal((await handler(request)).statusCode, 503);
  request.requestContext.authorizer.jwt.claims.token_use = "id";
  assert.equal((await handler(request)).statusCode, 401);
});

test("import safely fetches and normalizes a recipe with a signed image token", async () => {
  const document = `<script type="application/ld+json">${JSON.stringify({
    "@type": "Recipe", name: "Rice Bowl", image: "https://cdn.example/rice.jpg",
    recipeIngredient: ["Rice", "Beans"], recipeInstructions: [{ "@type": "HowToStep", text: "Cook." }],
  })}</script>`;
  const handler = createHandler({ fetchImpl: async () => response(document), lookup, logger, now: () => 1_000_000 }, environment);
  const result = await handler(event("POST", "/v1/recipes/import", { url: "https://recipes.example/rice?utm_source=x" }));
  assert.equal(result.statusCode, 200);
  const payload = bodyOf(result);
  assert.equal(payload.recipe.title, "Rice Bowl");
  assert.equal(payload.recipe.sourceUrl, "https://recipes.example/rice");
  assert.equal(payload.recipe.sourceKind, "imported");
  assert.ok(payload.imageToken);
  assert.equal(payload.recipe.imageUrl, undefined);
});

test("import rejects pages without a complete recipe", async () => {
  const handler = createHandler({ fetchImpl: async () => response("<html>No recipe</html>"), lookup, logger }, environment);
  const result = await handler(event("POST", "/v1/recipes/import", { url: "https://example.com/story" }));
  assert.equal(result.statusCode, 422);
});

test("search is unavailable without a provider and sanitizes three sourced candidates", async () => {
  assert.equal((await createHandler({ logger }, environment)(event("POST", "/v1/recipes/search", { description: "soup" }))).statusCode, 503);
  const searchProvider = { searchRecipes: async () => [
    { title: "<b>A</b>", url: "https://one.example/a?utm_source=x" },
    { title: "B", sourceUrl: "https://two.example/b" }, { title: "C", url: "https://three.example/c" },
    { title: "D", url: "https://four.example/d" }, { title: "Unsafe", url: "http://unsafe.example" },
  ] };
  const result = await createHandler({ searchProvider, logger }, environment)(event("POST", "/v1/recipes/search", { description: " noodle soup " }));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(bodyOf(result).candidates.map((item) => item.title), ["A", "B", "C"]);
  assert.equal(bodyOf(result).candidates[0].sourceUrl, "https://one.example/a");
  assert.equal(bodyOf(result).candidates[0].imageUrl, undefined);
});

test("generate is unavailable without a provider and labels a valid draft", async () => {
  assert.equal((await createHandler({ logger }, environment)(event("POST", "/v1/recipes/generate", { description: "soup" }))).statusCode, 503);
  const generateProvider = { generateRecipe: async () => ({
    title: "Soup", description: "Simple", ingredientSections: [{ name: "Main", items: ["Water"] }],
    instructionSections: [{ name: "", steps: ["Simmer."] }], imageUrl: "https://should-not-survive.example/a.jpg",
  }) };
  const result = await createHandler({ generateProvider, logger }, environment)(event("POST", "/v1/recipes/generate", { description: "soup" }));
  assert.equal(result.statusCode, 200);
  assert.equal(bodyOf(result).recipe.sourceKind, "generated");
  assert.equal(bodyOf(result).recipe.imageUrl, "");
});

test("image proxy requires auth and a valid signature, then returns bounded image bytes", async () => {
  const now = () => 1_000_000;
  const imageToken = signImageToken("https://cdn.example/dish.jpg", secret, now(), 300);
  const handler = createHandler({ fetchImpl: async () => response("image-bytes", "image/jpeg"), lookup, logger, now }, environment);
  const request = event("GET", "/v1/recipes/image");
  request.queryStringParameters = { token: imageToken };
  const result = await handler(request);
  assert.equal(result.statusCode, 200);
  assert.equal(result.isBase64Encoded, true);
  assert.equal(Buffer.from(result.body, "base64").toString(), "image-bytes");
  request.queryStringParameters.token += "x";
  assert.equal((await handler(request)).statusCode, 400);
});

test("rejects unknown fields, oversized bodies, unsafe URLs, and unknown routes", async () => {
  const handler = createHandler({ fetchImpl: async () => response(""), lookup: async () => [{ address: "127.0.0.1", family: 4 }], logger }, environment);
  assert.equal((await handler(event("POST", "/v1/recipes/import", { url: "https://example.com", extra: true }))).statusCode, 400);
  assert.equal((await handler(event("POST", "/v1/recipes/search", { description: { dish: "soup" } }))).statusCode, 400);
  const oversized = event("POST", "/v1/recipes/search", {}); oversized.body = "x".repeat(4097);
  assert.equal((await handler(oversized)).statusCode, 413);
  assert.equal((await handler(event("POST", "/v1/recipes/import", { url: "https://example.com" }))).statusCode, 400);
  assert.equal((await handler(event("POST", "/nope", {}))).statusCode, 405);
});
