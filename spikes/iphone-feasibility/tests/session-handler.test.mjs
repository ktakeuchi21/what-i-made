import test from "node:test";
import assert from "node:assert/strict";
import { createSessionHandler, createPresignedTranscribeUrl, testing } from "../backend/session/index.mjs";

const originalEnvironment = { ...process.env };
const handler = createSessionHandler({ allowRequest: async () => true });

function configure(overrides = {}) {
  Object.assign(process.env, {
    VOICE_ENABLED: "true",
    COGNITO_CLIENT_ID: "client-123",
    RATE_LIMIT_TABLE: "limits",
    AWS_REGION: "us-east-2",
    AWS_ACCESS_KEY_ID: "ASIATESTACCESSKEY",
    AWS_SECRET_ACCESS_KEY: "test-secret-key-not-a-real-credential",
    AWS_SESSION_TOKEN: "test-session-token-not-a-real-credential",
    PRESIGN_EXPIRES_SECONDS: "15",
  }, overrides);
}

function event(body = { languageCode: "en-US", sampleRateHertz: 16000 }) {
  return {
    requestContext: {
      requestId: "request-test",
      http: { method: "POST" },
      authorizer: { jwt: { claims: { sub: "account-a", token_use: "access", client_id: "client-123" } } },
    },
    body: JSON.stringify(body),
  };
}

test.afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in originalEnvironment)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

test("AC-21: missing and invalid Cognito claims are rejected", async () => {
  configure();
  const missing = event();
  delete missing.requestContext.authorizer;
  assert.equal((await handler(missing)).statusCode, 401);
  const wrongClient = event();
  wrongClient.requestContext.authorizer.jwt.claims.client_id = "wrong";
  assert.equal((await handler(wrongClient)).statusCode, 401);
});

test("does not accept the retired shared-token authorization path", async () => {
  configure({ OWNER_TOKEN_SHA256: "a".repeat(64) });
  const request = event();
  delete request.requestContext.authorizer;
  request.headers = { authorization: "Bearer legacy_owner_token_that_is_long_enough" };
  assert.equal((await handler(request)).statusCode, 401);
});

test("accepts only API Gateway-validated Cognito access-token claims", async () => {
  configure();
  const request = event();
  request.requestContext.authorizer = { jwt: { claims: { sub: "account-a", token_use: "access", client_id: "client-123" } } };
  assert.match(testing.requestIdentity(request).accountKey, /^[a-f0-9]{64}$/);
  request.requestContext.authorizer.jwt.claims.client_id = "wrong";
  assert.equal(testing.requestIdentity(request), null);
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
