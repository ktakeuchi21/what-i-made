import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { handler, createPresignedTranscribeUrl } from "../backend/session/index.mjs";

const token = "owner_token_for_tests_1234567890abcd";
const originalEnvironment = { ...process.env };

function configure(overrides = {}) {
  Object.assign(process.env, {
    VOICE_ENABLED: "true",
    OWNER_TOKEN_SHA256: crypto.createHash("sha256").update(token).digest("hex"),
    AWS_REGION: "us-east-2",
    AWS_ACCESS_KEY_ID: "ASIATESTACCESSKEY",
    AWS_SECRET_ACCESS_KEY: "test-secret-key-not-a-real-credential",
    AWS_SESSION_TOKEN: "test-session-token-not-a-real-credential",
    PRESIGN_EXPIRES_SECONDS: "15",
  }, overrides);
}

function event(body = { languageCode: "en-US", sampleRateHertz: 16000 }, authorization = `Bearer ${token}`) {
  return {
    requestContext: { requestId: "request-test", http: { method: "POST" } },
    headers: { authorization },
    body: JSON.stringify(body),
  };
}

test.afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

test("AC-21: missing and wrong owner tokens are rejected", async () => {
  configure();
  assert.equal((await handler(event(undefined, ""))).statusCode, 401);
  assert.equal((await handler(event(undefined, "Bearer wrong_token_that_is_long_enough_123"))).statusCode, 401);
});

test("AC-21: disabled, malformed, unknown, and oversized requests fail safely", async () => {
  configure({ VOICE_ENABLED: "false" });
  assert.equal((await handler(event())).statusCode, 503);
  configure();
  assert.equal((await handler(event({ languageCode: "en-US", sampleRateHertz: 16000, extra: true }))).statusCode, 400);
  assert.equal((await handler({ ...event(), body: "{" })).statusCode, 400);
  assert.equal((await handler({ ...event(), body: "x".repeat(1025) })).statusCode, 413);
  assert.equal((await handler({ ...event(), requestContext: { http: { method: "GET" } } })).statusCode, 405);
});

test("INV-15 and AC-21: valid request returns only a short-lived constrained URL", async () => {
  configure();
  const result = await handler(event());
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["cache-control"], "no-store");
  assert.equal(result.headers["access-control-allow-origin"], undefined);
  const body = JSON.parse(result.body);
  const url = new URL(body.websocketUrl);
  assert.equal(url.protocol, "wss:");
  assert.equal(url.host, "transcribestreaming.us-east-2.amazonaws.com:8443");
  assert.equal(url.searchParams.get("language-code"), "en-US");
  assert.equal(url.searchParams.get("media-encoding"), "pcm");
  assert.equal(url.searchParams.get("sample-rate"), "16000");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "15");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
  assert.equal(body.maxCaptureSeconds, 45);
  assert.ok(!result.body.includes(process.env.AWS_SECRET_ACCESS_KEY));
});

test("INV-15: signer output is deterministic for a fixed session and contains no secret", () => {
  const options = {
    region: "us-east-2",
    accessKeyId: "ASIATESTACCESSKEY",
    secretAccessKey: "test-secret-key-not-a-real-credential",
    sessionToken: "test/session+token==",
    now: new Date("2026-09-02T12:34:56.000Z"),
    expiresSeconds: 15,
    sessionId: "00000000-0000-4000-8000-000000000000",
  };
  const first = createPresignedTranscribeUrl(options);
  const second = createPresignedTranscribeUrl(options);
  assert.equal(first, second);
  assert.ok(!first.includes(options.secretAccessKey));
  assert.match(first, /\?X-Amz-Algorithm=.*&X-Amz-SignedHeaders=host&language-code=en-US/);
  assert.match(first, /X-Amz-Security-Token=test%2Fsession%2Btoken%3D%3D/);
  assert.equal(new URL(first).searchParams.get("X-Amz-Security-Token"), options.sessionToken);
  assert.equal(new URL(first).searchParams.get("X-Amz-Signature"), "ef4c90f223c8e950d5dcfb8705988d00b175bd23b12afd55f915d478399285ac");
  assert.match(new URL(first).searchParams.get("X-Amz-Signature"), /^[a-f0-9]{64}$/);
});
