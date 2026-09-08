import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createDurableRateLimiter } = require("./rate-limiter.cjs");

const ALLOWED_KEYS = new Set(["languageCode", "sampleRateHertz"]);
const REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d$/;

export async function handler(event = {}) {
  const startedAt = Date.now();
  const requestId = event.requestContext?.requestId || "unknown";
  const method = event.requestContext?.http?.method || event.httpMethod || "";

  if (method !== "POST") return response(405, { error: "invalid_request" });
  if (process.env.VOICE_ENABLED !== "true") return response(503, { error: "disabled" });

  const rawBody = decodeBody(event);
  if (rawBody.byteLength > 1024) return response(413, { error: "invalid_request" });
  const identity = requestIdentity(event);
  if (!identity) return response(401, { error: "unauthorized" });
  try {
    const allowRequest = createDurableRateLimiter(process.env);
    if (!await allowRequest(identity.accountKey, "/v1/transcribe-session", startedAt, 10)) return response(429, { error: "rate_limited" });
  } catch {
    return response(503, { error: "unavailable" });
  }

  let input;
  try {
    input = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return response(400, { error: "invalid_request" });
  }
  if (!validInput(input)) return response(400, { error: "invalid_request" });

  try {
    const now = new Date();
    const region = validRegion(process.env.AWS_REGION) ? process.env.AWS_REGION : "us-east-2";
    const expiresSeconds = clampInteger(process.env.PRESIGN_EXPIRES_SECONDS, 5, 30, 15);
    const websocketUrl = createPresignedTranscribeUrl({
      region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
      now,
      expiresSeconds,
      sessionId: crypto.randomUUID(),
    });
    logOutcome(requestId, "issued", Date.now() - startedAt);
    return response(200, {
      websocketUrl,
      expiresAt: new Date(now.getTime() + expiresSeconds * 1000).toISOString(),
      maxCaptureSeconds: 45,
      region,
    });
  } catch {
    logOutcome(requestId, "unavailable", Date.now() - startedAt);
    return response(503, { error: "unavailable" });
  }
}

function response(statusCode, body) {
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
  return Buffer.from(source, event.isBase64Encoded ? "base64" : "utf8");
}

function requestIdentity(event) {
  if (process.env.AUTH_MODE === "cognito") {
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const valid = typeof claims?.sub === "string" && claims.sub.length > 0 && claims.sub.length <= 128 &&
      claims.token_use === "access" && Boolean(process.env.COGNITO_CLIENT_ID) && claims.client_id === process.env.COGNITO_CLIENT_ID;
    return valid ? { accountKey: crypto.createHash("sha256").update(claims.sub).digest("hex") } : null;
  }
  const expectedHex = process.env.OWNER_TOKEN_SHA256 || "";
  if (!/^[a-f0-9]{64}$/i.test(expectedHex)) return null;
  const normalized = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(normalized.authorization || "");
  if (!match) return null;
  const actual = crypto.createHash("sha256").update(match[1], "utf8").digest();
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? { accountKey: "legacy-owner" } : null;
}

function validInput(input) {
  if (!input || Array.isArray(input) || typeof input !== "object") return false;
  const keys = Object.keys(input);
  return keys.length === 2 && keys.every((key) => ALLOWED_KEYS.has(key)) &&
    input.languageCode === "en-US" && input.sampleRateHertz === 16000;
}

function validRegion(region) {
  return typeof region === "string" && REGION_PATTERN.test(region);
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sha256(value, encoding = "hex") {
  return crypto.createHash("sha256").update(value).digest(encoding);
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest(encoding);
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

export function createPresignedTranscribeUrl(options) {
  const { region, accessKeyId, secretAccessKey, sessionToken, now, expiresSeconds, sessionId } = options;
  if (!accessKeyId || !secretAccessKey || !sessionToken) throw new Error("Temporary Lambda credentials are unavailable.");
  const service = "transcribe";
  const host = `transcribestreaming.${region}.amazonaws.com:8443`;
  const path = "/stream-transcription-websocket";
  const timestamp = formatTimestamp(now);
  const date = timestamp.slice(0, 8);
  const scope = `${date}/${region}/${service}/aws4_request`;
  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-Security-Token": sessionToken,
    "X-Amz-SignedHeaders": "host",
    "language-code": "en-US",
    "media-encoding": "pcm",
    "sample-rate": "16000",
    "session-id": sessionId,
  };
  const requestQuery = Object.entries(query)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join("&");
  const canonicalQuery = Object.entries(query)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join("&");
  const canonicalRequest = ["GET", path, canonicalQuery, `host:${host}\n`, "host", sha256("")].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  return `wss://${host}${path}?${requestQuery}&X-Amz-Signature=${signature}`;
}

function logOutcome(requestId, outcome, latencyMs) {
  console.log(JSON.stringify({ requestId, outcome, latencyMs }));
}

export const testing = { requestIdentity, validInput, decodeBody, formatTimestamp };
