"use strict";

const { validateProviderResult } = require("./parser");
const { requestIdentity } = require("./request-identity");
const { createDurableRateLimiter } = require("./rate-limiter");

const MAX_BODY_BYTES = 8192;
const REQUESTS_PER_MINUTE = 10;

function response(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }, body: JSON.stringify(body) };
}
function metricUsage(value) {
  return ["inputTokens", "outputTokens", "totalTokens"].reduce((result, key) => {
    if (Number.isInteger(value?.[key]) && value[key] >= 0) result[key] = value[key];
    return result;
  }, {});
}
function cleanedTokensComeFromSegment(voiceSegment, cleanedVoiceText) {
  const tokens = (value) => String(value || "").normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const source = tokens(voiceSegment);
  const cleaned = tokens(cleanedVoiceText);
  let sourceIndex = 0;
  return cleaned.every((token) => {
    while (sourceIndex < source.length && source[sourceIndex] !== token) sourceIndex += 1;
    if (sourceIndex >= source.length) return false;
    sourceIndex += 1;
    return true;
  });
}
function readBody(event) {
  const source = typeof event.body === "string" ? event.body : "";
  if (source.length > MAX_BODY_BYTES * 2) throw new Error("invalid_request");
  const raw = Buffer.from(source, event.isBase64Encoded ? "base64" : "utf8");
  if (raw.byteLength > MAX_BODY_BYTES) throw new Error("invalid_request");
  let body;
  try { body = JSON.parse(raw.toString("utf8")); } catch { throw new Error("invalid_request"); }
  const keys = ["transcript", "voiceSegment", "locale"];
  if (!body || Array.isArray(body) || Object.keys(body).some((key) => !keys.includes(key)) || typeof body.transcript !== "string" || typeof body.voiceSegment !== "string" || body.locale !== "en-US") throw new Error("invalid_request");
  if (!body.transcript.trim() || body.transcript.length > 5000 || body.voiceSegment.length > 2000) throw new Error("invalid_request");
  return body;
}

function createHandler(dependencies = {}, environment = process.env) {
  const logger = dependencies.logger || console;
  const now = dependencies.now || Date.now;
  const allowRequest = dependencies.allowRequest || createDurableRateLimiter(environment, { client: dependencies.rateLimitClient });
  return async function handler(event = {}) {
    const requestId = event.requestContext?.requestId || "unknown";
    const startedAt = now();
    const finish = (statusCode, body, tokenCounts) => {
      logger.info?.(JSON.stringify({ requestId, route: "/v1/parse-cook", statusCode, latencyMs: Math.max(0, now() - startedAt), ...(tokenCounts || {}) }));
      return response(statusCode, body);
    };
    if (environment.CAPTURE_ASSISTANCE_ENABLED !== "true") return finish(503, { error: "disabled" });
    const identity = requestIdentity(event, environment);
    if (!identity) return finish(401, { error: "unauthorized" });
    try {
      if (!await allowRequest(identity.accountKey, "/v1/parse-cook", startedAt, REQUESTS_PER_MINUTE)) return finish(429, { error: "rate_limited" });
    } catch { return finish(503, { error: "unavailable" }); }
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path;
    if (method !== "POST" || path !== "/v1/parse-cook") return finish(405, { error: "invalid_request" });
    try {
      const input = readBody(event);
      if (typeof dependencies.provider?.parseCook !== "function") return finish(503, { error: "unavailable" });
      const providerResult = await dependencies.provider.parseCook(input);
      const result = validateProviderResult(providerResult);
      if ((!input.voiceSegment && result.cleanedVoiceText)
        || result.cleanedVoiceText.length > input.voiceSegment.length + 16
        || !cleanedTokensComeFromSegment(input.voiceSegment, result.cleanedVoiceText)) {
        throw new Error("invalid_provider_response");
      }
      return finish(200, result, metricUsage(providerResult?.usage));
    } catch (error) {
      return finish(error?.message === "invalid_request" ? 400 : error?.message === "invalid_provider_response" ? 502 : 503, { error: error?.message === "invalid_request" ? "invalid_request" : "unavailable" });
    }
  };
}

module.exports = { REQUESTS_PER_MINUTE, createHandler, testing: { cleanedTokensComeFromSegment, metricUsage, readBody } };
