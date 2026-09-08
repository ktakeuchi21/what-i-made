"use strict";

const { requestIdentity } = require("./request-identity");
const { createDurableRateLimiter } = require("./rate-limiter");
const { canonicalizeUrl, FetchSafetyError, parseHttpsUrl, safeFetch } = require("./url-security");
const { parseRecipeHtml, plainText } = require("./recipe-parser");
const { signImageToken, verifyImageToken } = require("./image-token");

const MAX_BODY_BYTES = 4096;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    body: JSON.stringify(body),
  };
}

function decodeBody(event) {
  const source = typeof event.body === "string" ? event.body : "";
  if (source.length > MAX_BODY_BYTES * 2) throw Object.assign(new Error("too_large"), { statusCode: 413 });
  return Buffer.from(source, event.isBase64Encoded ? "base64" : "utf8");
}

function parseJsonBody(event, allowedKeys) {
  const raw = decodeBody(event);
  if (raw.byteLength > MAX_BODY_BYTES) throw Object.assign(new Error("too_large"), { statusCode: 413 });
  let body;
  try { body = JSON.parse(raw.toString("utf8")); } catch { throw Object.assign(new Error("invalid"), { statusCode: 400 }); }
  if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw Object.assign(new Error("invalid"), { statusCode: 400 });
  }
  return body;
}

function sourceName(sourceUrl) {
  return new URL(sourceUrl).hostname.replace(/^www\./, "").slice(0, 200);
}

function normalizeCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  let url;
  try { url = canonicalizeUrl(candidate.url || candidate.sourceUrl); } catch { return null; }
  const title = plainText(candidate.title || candidate.name, 200);
  if (!title) return null;
  let imageUrl = "";
  if (candidate.imageUrl) {
    try { imageUrl = parseHttpsUrl(new URL(candidate.imageUrl, url).toString()).toString(); } catch { imageUrl = ""; }
  }
  let citation = null;
  try {
    const citationUrl = canonicalizeUrl(candidate.citation?.url);
    if (citationUrl === url) citation = { title: plainText(candidate.citation?.title, 300), url: citationUrl };
  } catch { citation = null; }
  return {
    title,
    description: plainText(candidate.description, 500),
    sourceUrl: url,
    sourceName: plainText(candidate.sourceName, 200) || sourceName(url),
    author: plainText(candidate.author, 200),
    imageUrl,
    citation,
  };
}

function sanitizeSections(sections, childKey) {
  if (!Array.isArray(sections)) return [];
  return sections.slice(0, childKey === "items" ? 30 : 50).map((section) => ({
    name: plainText(section?.name, 120),
    [childKey]: (Array.isArray(section?.[childKey]) ? section[childKey] : [])
      .slice(0, childKey === "items" ? 200 : 100).map((value) => plainText(value, 1000)).filter(Boolean),
  })).filter((section) => section[childKey].length > 0);
}

function sanitizeGeneratedRecipe(value) {
  if (!value || typeof value !== "object") return null;
  const recipe = {
    title: plainText(value.title || value.name, 200),
    description: plainText(value.description, 1000),
    servings: plainText(value.servings, 100),
    prepTime: plainText(value.prepTime, 40),
    cookTime: plainText(value.cookTime, 40),
    totalTime: plainText(value.totalTime, 40),
    ingredientSections: sanitizeSections(value.ingredientSections, "items"),
    instructionSections: sanitizeSections(value.instructionSections, "steps"),
    author: "",
    imageUrl: "",
  };
  return recipe.title && recipe.ingredientSections.length && recipe.instructionSections.length ? recipe : null;
}

function parsePath(event) {
  return event.rawPath || event.path || "/";
}

function queryParameter(event, key) {
  if (event.queryStringParameters?.[key]) return event.queryStringParameters[key];
  return new URLSearchParams(event.rawQueryString || "").get(key) || "";
}

function createHandler(dependencies = {}, environment = process.env) {
  const network = {
    fetchImpl: dependencies.fetchImpl,
    lookup: dependencies.lookup,
    timeoutMs: dependencies.timeoutMs || 8000,
  };
  const now = dependencies.now || Date.now;
  const logger = dependencies.logger || console;
  const allowRequest = dependencies.allowRequest || createDurableRateLimiter(environment, { client: dependencies.rateLimitClient });

  return async function recipeIdeasHandler(event = {}) {
    const method = event.requestContext?.http?.method || event.httpMethod || "";
    const path = parsePath(event);
    const routeLabel = new Set(["/v1/recipes/import", "/v1/recipes/search", "/v1/recipes/generate", "/v1/recipes/image"]).has(path)
      ? path : "unknown";
    const requestId = event.requestContext?.requestId || "unknown";
    const startedAt = now();
    const finish = (statusCode, body) => {
      logger.info?.(JSON.stringify({ requestId, route: routeLabel, statusCode, latencyMs: Math.max(0, now() - startedAt) }));
      return jsonResponse(statusCode, body);
    };

    if (environment.RECIPE_IDEAS_ENABLED !== "true") return finish(503, { error: "disabled" });
    const identity = requestIdentity(event, environment);
    if (!identity) return finish(401, { error: "unauthorized" });
    const routeLimits = { "/v1/recipes/import": 15, "/v1/recipes/search": 10, "/v1/recipes/generate": 5, "/v1/recipes/image": 60 };
    try {
      if (routeLimits[routeLabel] && !await allowRequest(identity.accountKey, routeLabel, startedAt, routeLimits[routeLabel])) return finish(429, { error: "rate_limited" });
    } catch { return finish(503, { error: "unavailable" }); }

    try {
      if (method === "POST" && path === "/v1/recipes/import") {
        const body = parseJsonBody(event, new Set(["url"]));
        if (typeof body.url !== "string" || body.url.length > 2048) return finish(400, { error: "invalid_request" });
        const requestedUrl = canonicalizeUrl(body.url);
        const fetched = await safeFetch(requestedUrl, {
          ...network, maximumBytes: 1024 * 1024,
          allowedMimeTypes: ["text/html", "application/xhtml+xml"], maximumRedirects: 3,
        });
        const finalUrl = canonicalizeUrl(fetched.finalUrl);
        const recipe = parseRecipeHtml(fetched.bytes.toString("utf8"), finalUrl);
        if (!recipe) return finish(422, { error: "recipe_not_found" });
        const imageToken = recipe.imageUrl
          ? signImageToken(recipe.imageUrl, environment.IMAGE_TOKEN_SECRET, now(), 300)
          : null;
        return finish(200, {
          recipe: {
            ...recipe,
            sourceUrl: finalUrl,
            sourceName: sourceName(finalUrl),
            sourceKind: "imported",
            imageUrl: undefined,
          },
          imageToken,
          imageTokenExpiresIn: imageToken ? 300 : null,
        });
      }

      if (method === "POST" && path === "/v1/recipes/search") {
        const body = parseJsonBody(event, new Set(["description"]));
        if (typeof body.description !== "string") return finish(400, { error: "invalid_request" });
        const description = plainText(body.description, 240);
        if (!description || typeof dependencies.searchProvider?.searchRecipes !== "function") {
          return finish(description ? 503 : 400, { error: description ? "unavailable" : "invalid_request" });
        }
        const raw = await dependencies.searchProvider.searchRecipes({ description, limit: 3 });
        const candidates = (Array.isArray(raw) ? raw : []).map(normalizeCandidate).filter(Boolean).slice(0, 3).map((candidate) => {
          const imageToken = candidate.imageUrl
            ? signImageToken(candidate.imageUrl, environment.IMAGE_TOKEN_SECRET, now(), 300)
            : null;
          return { ...candidate, imageUrl: undefined, imageToken, imageTokenExpiresIn: imageToken ? 300 : null };
        });
        return finish(200, { candidates });
      }

      if (method === "POST" && path === "/v1/recipes/generate") {
        const body = parseJsonBody(event, new Set(["description"]));
        if (typeof body.description !== "string") return finish(400, { error: "invalid_request" });
        const description = plainText(body.description, 240);
        if (!description || typeof dependencies.generateProvider?.generateRecipe !== "function") {
          return finish(description ? 503 : 400, { error: description ? "unavailable" : "invalid_request" });
        }
        const recipe = sanitizeGeneratedRecipe(await dependencies.generateProvider.generateRecipe({ description }));
        if (!recipe) return finish(502, { error: "invalid_provider_response" });
        return finish(200, { recipe: { ...recipe, sourceKind: "generated" } });
      }

      if (method === "GET" && path === "/v1/recipes/image") {
        let imageUrl;
        try { imageUrl = verifyImageToken(queryParameter(event, "token"), environment.IMAGE_TOKEN_SECRET, now()); }
        catch { return finish(400, { error: "invalid_request" }); }
        const fetched = await safeFetch(imageUrl, {
          ...network, maximumBytes: 5 * 1024 * 1024,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"], maximumRedirects: 2,
        });
        return {
          statusCode: 200,
          isBase64Encoded: true,
          headers: {
            "content-type": fetched.mimeType,
            "content-length": String(fetched.bytes.byteLength),
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
          },
          body: fetched.bytes.toString("base64"),
        };
      }

      return finish(405, { error: "invalid_request" });
    } catch (error) {
      if (error?.statusCode) return finish(error.statusCode, { error: "invalid_request" });
      if (error instanceof FetchSafetyError) {
        const clientErrors = new Set(["invalid_url", "unsafe_address", "unsupported_content_type", "response_too_large"]);
        return finish(clientErrors.has(error.code) ? 400 : 502, { error: "source_unavailable" });
      }
      return finish(503, { error: "unavailable" });
    }
  };
}

const handler = createHandler();

module.exports = {
  createHandler,
  handler,
  testing: { requestIdentity, decodeBody, normalizeCandidate, sanitizeGeneratedRecipe, sourceName },
};
