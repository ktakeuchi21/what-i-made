const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto").webcrypto;

const {
  OAUTH_TRANSACTION_MAX_AGE_MS,
  OAUTH_TRANSACTION_KEY,
  normalizeAuthConfig,
  createAuthorizationRequest,
  parseCallback,
  withoutOAuthParameters,
  validateTokenResponse,
  createAuthClient,
  createIndexedDbSessionStore,
} = require("../auth-session.js");

const config = {
  enabled: true,
  domain: "https://what-i-made.auth.us-east-2.amazoncognito.com",
  clientId: "client123456789",
  redirectUri: "https://app.example.test/index.html",
};

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.signature`;
}

function memoryStorage(initial = null) {
  let record = initial;
  return {
    read: async () => record,
    write: async (value) => { record = { ...value }; },
    clear: async () => { record = null; },
    current: () => record,
  };
}

function transactionStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function keyValueStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("accepts only a public Cognito HTTPS client configuration", () => {
  assert.equal(normalizeAuthConfig({}).enabled, false);
  assert.equal(normalizeAuthConfig(config).domain, "https://what-i-made.auth.us-east-2.amazoncognito.com");
  assert.throws(() => normalizeAuthConfig({ ...config, domain: "http://example.test" }), /HTTPS Cognito domain/i);
  assert.throws(() => normalizeAuthConfig({ ...config, clientId: "bad client" }), /public app client/i);
  assert.throws(() => normalizeAuthConfig({ ...config, redirectUri: "http://example.test" }), /secure return address/i);
});

test("creates a state-bound authorization-code request with PKCE", async () => {
  const request = await createAuthorizationRequest(config, { crypto, now: 1000 });
  const url = new URL(request.authorizeUrl);
  assert.equal(url.pathname, "/oauth2/authorize");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("prompt"), "login");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.match(url.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(url.searchParams.get("state"), request.transaction.state);
  assert.equal(url.searchParams.get("nonce"), request.transaction.nonce);
  assert.match(request.transaction.verifier, /^[A-Za-z0-9_-]{64}$/);
  assert.equal(url.searchParams.get("scope"), "openid email");
});

test("rejects missing, mismatched, and expired callback state", () => {
  const transaction = { state: "expected", nonce: "nonce", verifier: "verifier", createdAt: 1000 };
  assert.equal(parseCallback("https://app.example.test/", null, 1000), null);
  assert.throws(() => parseCallback("https://app.example.test/?code=one&state=wrong", transaction, 1000), /could not be verified/i);
  assert.throws(() => parseCallback(`https://app.example.test/?code=one&state=expected`, transaction, 1000 + OAUTH_TRANSACTION_MAX_AGE_MS + 1), /expired/i);
  assert.deepEqual(parseCallback("https://app.example.test/?code=one&state=expected", transaction, 1001), { code: "one", verifier: "verifier", nonce: "nonce" });
});

test("removes OAuth response data without deleting unrelated app parameters", () => {
  assert.equal(
    withoutOAuthParameters("https://app.example.test/index.html?voice=fake&code=secret&state=state#capture"),
    "/index.html?voice=fake#capture",
  );
});

test("removes callback parameters and the PKCE transaction even when callback verification fails", async () => {
  const callbackLocation = { href: "https://app.example.test/index.html?view=year&code=secret&state=wrong#capture" };
  const transaction = transactionStorage();
  transaction.setItem(OAUTH_TRANSACTION_KEY, JSON.stringify({ state: "expected", nonce: "nonce", verifier: "verifier", createdAt: 1000 }));
  const replacements = [];
  const client = createAuthClient(config, {
    storage: memoryStorage(),
    transactionStorage: transaction,
    location: callbackLocation,
    history: { state: null, replaceState: (_state, _title, url) => replacements.push(url) },
    navigator: { onLine: true },
    now: () => 1001,
  });
  await assert.rejects(() => client.restore(), /could not be verified/i);
  assert.deepEqual(replacements, ["/index.html?view=year#capture"]);
  assert.equal(transaction.getItem(OAUTH_TRANSACTION_KEY), null);
});

test("sanitizes callback before archive storage and survives transaction-storage failure", async () => {
  const events = [];
  const client = createAuthClient(config, {
    storage: {
      read: async () => { events.push("archive-read"); return null; },
      write: async () => {},
      clear: async () => {},
    },
    transactionStorage: {
      getItem: () => { events.push("transaction-read"); throw new Error("storage blocked"); },
      removeItem: () => { events.push("transaction-remove"); throw new Error("storage blocked"); },
    },
    location: { href: "https://app.example.test/index.html?code=secret&state=wrong#capture" },
    history: { state: null, replaceState: (_state, _title, url) => events.push(`url:${url}`) },
    navigator: { onLine: true },
    now: () => 1001,
  });

  await assert.rejects(() => client.restore(), /could not be verified/i);
  assert.equal(events[0], "url:/index.html#capture");
  assert.deepEqual(events.slice(1), ["transaction-read", "transaction-remove", "archive-read"]);
});

test("sanitizes callback even when archive storage cannot be read", async () => {
  const replacements = [];
  const transaction = transactionStorage();
  transaction.setItem(OAUTH_TRANSACTION_KEY, JSON.stringify({ state: "expected", nonce: "nonce", verifier: "verifier", createdAt: 1000 }));
  const client = createAuthClient(config, {
    storage: {
      read: async () => { throw new Error("archive unavailable"); },
      write: async () => {},
      clear: async () => {},
    },
    transactionStorage: transaction,
    location: { href: "https://app.example.test/index.html?code=secret&state=expected" },
    history: { state: null, replaceState: (_state, _title, url) => replacements.push(url) },
    navigator: { onLine: true },
    now: () => 1001,
  });

  await assert.rejects(() => client.restore(), /archive unavailable/i);
  assert.deepEqual(replacements, ["/index.html"]);
  assert.equal(transaction.getItem(OAUTH_TRANSACTION_KEY), null);
});

test("pending sign-out cleanup discards a sanitized callback without exchanging it", async () => {
  const events = [];
  const transaction = transactionStorage();
  transaction.setItem(OAUTH_TRANSACTION_KEY, JSON.stringify({ state: "expected", nonce: "nonce", verifier: "verifier", createdAt: 1000 }));
  const client = createAuthClient(config, {
    storage: {
      read: async () => { events.push("archive-read"); return null; },
      write: async () => { events.push("archive-write"); },
      clear: async () => { events.push("archive-clear"); },
    },
    transactionStorage: transaction,
    guardStorage: {
      getItem: () => "1",
      removeItem: () => events.push("guard-clear"),
    },
    location: { href: "https://app.example.test/index.html?code=secret&state=expected" },
    history: { state: null, replaceState: (_state, _title, url) => events.push(`url:${url}`) },
    navigator: { onLine: true },
    fetch: async () => { events.push("fetch"); throw new Error("must not fetch"); },
    now: () => 1001,
  });

  assert.deepEqual(await client.restore(), { kind: "signedOut", reason: "cleanupComplete" });
  assert.deepEqual(events, ["url:/index.html", "archive-clear", "guard-clear"]);
  assert.equal(transaction.getItem(OAUTH_TRANSACTION_KEY), null);
});

test("requires the returned identity token to match the request nonce", () => {
  const valid = validateTokenResponse({ access_token: "access", id_token: jwt({ nonce: "same" }), expires_in: 900 }, "same", 1000);
  assert.equal(valid.expiresAt, 901000);
  assert.throws(() => validateTokenResponse({ access_token: "access", id_token: jwt({ nonce: "wrong" }), expires_in: 900 }, "same", 1000), /identity could not be verified/i);
});

test("restores a valid retained session without a network request", async () => {
  const storage = memoryStorage({ subject: "sub-1", email: "one@example.test", accessToken: "access", refreshToken: "refresh", expiresAt: 100000, lastAuthorizedAt: 1000 });
  const client = createAuthClient(config, {
    storage,
    transactionStorage: transactionStorage(),
    location: { href: config.redirectUri },
    navigator: { onLine: true },
    now: () => 2000,
    fetch: async () => { throw new Error("network should not be called"); },
  });
  assert.deepEqual(await client.restore(), {
    kind: "signedIn", subject: "sub-1", email: "one@example.test", accessToken: "access", accessTokenExpiresAt: 100000, lastAuthorizedAt: 1000,
  });
});

test("refreshes an expired session and re-verifies its Cognito identity", async () => {
  const storage = memoryStorage({ subject: "sub-1", email: "old@example.test", accessToken: "old", refreshToken: "refresh", expiresAt: 1000, lastAuthorizedAt: 500 });
  const calls = [];
  const client = createAuthClient(config, {
    storage,
    transactionStorage: transactionStorage(),
    location: { href: config.redirectUri },
    navigator: { onLine: true },
    now: () => 2000,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/oauth2/token")) return { ok: true, json: async () => ({ access_token: "new-access", expires_in: 900 }) };
      return { ok: true, json: async () => ({ sub: "sub-1", email: "new@example.test" }) };
    },
  });
  const session = await client.restore();
  assert.equal(session.kind, "signedIn");
  assert.equal(session.accessToken, "new-access");
  assert.equal(session.email, "new@example.test");
  assert.equal(storage.current().refreshToken, "refresh");
  assert.equal(calls.length, 2);
  assert.doesNotMatch(String(calls[0].url), /refresh/);
});

test("allows only a previously verified account inside offline grace", async () => {
  const now = Date.UTC(2026, 8, 8);
  const recent = memoryStorage({ subject: "sub-1", email: "one@example.test", accessToken: "still-unexpired", refreshToken: "refresh", expiresAt: now + 60000, lastAuthorizedAt: now - 1000 });
  const client = createAuthClient(config, { storage: recent, transactionStorage: transactionStorage(), location: { href: config.redirectUri }, navigator: { onLine: false }, now: () => now });
  const session = await client.restore();
  assert.equal(session.kind, "offlineGrace");
  assert.equal(session.accessToken, "");

  const expired = memoryStorage({ ...recent.current(), lastAuthorizedAt: now - (8 * 24 * 60 * 60 * 1000) });
  const expiredClient = createAuthClient(config, { storage: expired, transactionStorage: transactionStorage(), location: { href: config.redirectUri }, navigator: { onLine: false }, now: () => now });
  assert.deepEqual(await expiredClient.restore(), { kind: "signedOut", reason: "offlineExpired" });
  assert.equal(expired.current(), null);
});

test("refreshes once for concurrent network actions and preserves the verified subject", async () => {
  const storage = memoryStorage({ subject: "sub-1", email: "one@example.test", accessToken: "old", refreshToken: "refresh", expiresAt: 1, lastAuthorizedAt: 500 });
  let tokenCalls = 0;
  let identityCalls = 0;
  const client = createAuthClient(config, {
    storage,
    transactionStorage: transactionStorage(),
    location: { href: config.redirectUri },
    navigator: { onLine: true },
    now: () => 2000,
    fetch: async (url) => {
      if (url.endsWith("/oauth2/token")) {
        tokenCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ok: true, json: async () => ({ access_token: "fresh", expires_in: 900 }) };
      }
      identityCalls += 1;
      return { ok: true, json: async () => ({ sub: "sub-1", email: "one@example.test" }) };
    },
  });
  const [first, second] = await Promise.all([client.getSessionForNetwork(), client.getSessionForNetwork()]);
  assert.equal(first.accessToken, "fresh");
  assert.equal(second.accessToken, "fresh");
  assert.equal(tokenCalls, 1);
  assert.equal(identityCalls, 1);
});

test("rejects a refreshed identity that differs from the active archive", async () => {
  const storage = memoryStorage({ subject: "sub-1", email: "one@example.test", accessToken: "old", refreshToken: "refresh", expiresAt: 1, lastAuthorizedAt: 500 });
  const client = createAuthClient(config, {
    storage,
    transactionStorage: transactionStorage(),
    location: { href: config.redirectUri },
    navigator: { onLine: true },
    now: () => 2000,
    fetch: async (url) => url.endsWith("/oauth2/token")
      ? { ok: true, json: async () => ({ access_token: "fresh", expires_in: 900 }) }
      : { ok: true, json: async () => ({ sub: "sub-2", email: "two@example.test" }) },
  });
  await assert.rejects(client.getSessionForNetwork(), /identity changed/i);
  assert.equal(storage.current(), null);
});

test("blocks network token access whenever the browser is offline", async () => {
  const storage = memoryStorage({ subject: "sub-1", accessToken: "valid", refreshToken: "refresh", expiresAt: Date.now() + 60000, lastAuthorizedAt: Date.now() });
  const client = createAuthClient(config, { storage, transactionStorage: transactionStorage(), location: { href: config.redirectUri }, navigator: { onLine: false } });
  await assert.rejects(client.getSessionForNetwork(), /connect to the internet/i);
});

test("a temporary refresh outage preserves the verified session for local use", async () => {
  const now = Date.UTC(2026, 8, 8);
  const record = { subject: "sub-1", email: "one@example.test", accessToken: "expired", refreshToken: "refresh", expiresAt: 1, lastAuthorizedAt: now - 1000 };
  const storage = memoryStorage(record);
  const client = createAuthClient(config, {
    storage,
    transactionStorage: transactionStorage(),
    location: { href: config.redirectUri },
    navigator: { onLine: true },
    now: () => now,
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: "server_error" }) }),
  });
  assert.equal((await client.restore()).kind, "offlineGrace");
  assert.equal(storage.current().subject, "sub-1");
  await assert.rejects(client.getSessionForNetwork(), (error) => error.code === "temporarily_unavailable");
  assert.equal(storage.current().subject, "sub-1");
});

test("a definitive invalid grant clears the session and requires sign-in", async () => {
  const storage = memoryStorage({ subject: "sub-1", accessToken: "expired", refreshToken: "revoked", expiresAt: 1, lastAuthorizedAt: 1000 });
  const client = createAuthClient(config, {
    storage,
    transactionStorage: transactionStorage(),
    location: { href: config.redirectUri },
    navigator: { onLine: true },
    now: () => 2000,
    fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }),
  });
  assert.deepEqual(await client.restore(), { kind: "signedOut", reason: "expired" });
  assert.equal(storage.current(), null);
});

test("sign-out prevents an older in-flight refresh from restoring the session", async () => {
  const storage = memoryStorage({ subject: "sub-1", accessToken: "expired", refreshToken: "refresh", expiresAt: 1, lastAuthorizedAt: 1000 });
  let resolveToken;
  const tokenResponse = new Promise((resolve) => { resolveToken = resolve; });
  const client = createAuthClient(config, {
    storage,
    transactionStorage: transactionStorage(),
    location: { href: config.redirectUri },
    navigator: { onLine: true },
    now: () => 2000,
    fetch: async (url) => {
      if (url.endsWith("/oauth2/token")) return tokenResponse;
      return { ok: true, status: 200, json: async () => ({ sub: "sub-1" }) };
    },
  });
  const refreshing = client.getSessionForNetwork();
  await client.signOut();
  resolveToken({ ok: true, status: 200, json: async () => ({ access_token: "late-token", expires_in: 900 }) });
  await assert.rejects(refreshing, (error) => error.code === "cancelled");
  assert.equal(storage.current(), null);
});

test("explicit sign-out removes the retained session before returning a hosted logout URL", async () => {
  const storage = memoryStorage({ subject: "sub-1", accessToken: "secret" });
  const client = createAuthClient(config, { storage, transactionStorage: transactionStorage(), location: { href: config.redirectUri } });
  const logoutUrl = new URL(await client.signOut());
  assert.equal(storage.current(), null);
  assert.equal(logoutUrl.pathname, "/logout");
  assert.equal(logoutUrl.searchParams.get("client_id"), config.clientId);
  assert.equal(logoutUrl.searchParams.get("logout_uri"), config.redirectUri);
  assert.doesNotMatch(logoutUrl.toString(), /secret/);
});

test("the local invitation harness stays signed out until sign-in is explicitly started", async () => {
  const storage = memoryStorage();
  const guardStorage = keyValueStorage();
  const client = createAuthClient({ enabled: true, fake: true, fakeSubject: "alice", fakeEmail: "alice@example.test" }, {
    storage,
    guardStorage,
    transactionStorage: transactionStorage(),
    location: { href: "http://localhost/app" },
    now: () => 2000,
  });

  assert.equal((await client.restore()).kind, "signedIn");
  assert.equal(await client.signOut(), null);
  assert.equal(storage.current(), null);
  assert.deepEqual(await client.restore(), { kind: "signedOut" });
  assert.equal((await client.startSignIn()).kind, "signedIn");
});

test("a failed sign-out deletion leaves a persistent tombstone that blocks reload", async () => {
  let record = { subject: "sub-1", accessToken: "secret" };
  let failClear = true;
  const storage = {
    read: async () => record,
    write: async (value) => { record = value; },
    markSignOutPending: async () => { record = { signOutPending: true }; },
    clear: async () => {
      if (failClear) { failClear = false; throw new Error("disk unavailable"); }
      record = null;
    },
  };
  const first = createAuthClient(config, { storage, transactionStorage: transactionStorage(), location: { href: config.redirectUri } });
  await assert.rejects(first.signOut(), /disk unavailable/);
  assert.deepEqual(record, { signOutPending: true });
  const relaunched = createAuthClient(config, { storage, transactionStorage: transactionStorage(), location: { href: config.redirectUri } });
  assert.deepEqual(await relaunched.restore(), { kind: "signedOut", reason: "cleanupComplete" });
  assert.equal(record, null);
});

for (const failure of ["invalid_grant", "userinfo_unauthorized"]) {
  test(`${failure} plus a failed delete cannot reopen the archive offline`, async () => {
    let record = { subject: "sub-1", accessToken: "expired", refreshToken: "refresh", expiresAt: 1, lastAuthorizedAt: 1000 };
    let clearAttempts = 0;
    const storage = {
      read: async () => record,
      write: async (value) => { record = value; },
      markSignOutPending: async () => { record = { signOutPending: true }; },
      clear: async () => {
        clearAttempts += 1;
        if (clearAttempts === 1) throw new Error("disk unavailable");
        record = null;
      },
    };
    const guardStorage = keyValueStorage();
    const fetch = async (url) => {
      if (url.endsWith("/oauth2/token")) {
        return failure === "invalid_grant"
          ? { ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }
          : { ok: true, status: 200, json: async () => ({ access_token: "new-access", expires_in: 900 }) };
      }
      return { ok: false, status: 401, json: async () => ({}) };
    };
    const first = createAuthClient(config, { storage, guardStorage, transactionStorage: transactionStorage(), location: { href: config.redirectUri }, navigator: { onLine: true }, now: () => 2000, fetch });
    assert.deepEqual(await first.restore(), { kind: "signedOut", reason: "cleanup" });
    assert.deepEqual(record, { signOutPending: true });
    const relaunchedOffline = createAuthClient(config, { storage, guardStorage, transactionStorage: transactionStorage(), location: { href: config.redirectUri }, navigator: { onLine: false }, now: () => 3000, fetch });
    assert.deepEqual(await relaunchedOffline.restore(), { kind: "signedOut", reason: "cleanupComplete" });
    assert.equal(record, null);
  });
}

test("IndexedDB session writes wait for commit and reject a late transaction abort", async () => {
  const indexedDB = {
    open() {
      const openRequest = {};
      const database = {
        objectStoreNames: { contains: () => true },
        close() {},
        transaction() {
          const transaction = {
            error: new Error("late abort"),
            objectStore: () => ({ put: () => {
              const request = { result: "ok" };
              setTimeout(() => {
                request.onsuccess?.();
                transaction.onabort?.();
              }, 0);
              return request;
            } }),
          };
          return transaction;
        },
      };
      openRequest.result = database;
      setTimeout(() => openRequest.onsuccess?.(), 0);
      return openRequest;
    },
  };
  const storage = createIndexedDbSessionStore(indexedDB);
  await assert.rejects(storage.write({ subject: "sub-1" }), /late abort/);
});

test("a loaded archive becomes ineligible immediately after seven days", async () => {
  const authorizedAt = Date.UTC(2026, 8, 1);
  const storage = memoryStorage({ subject: "sub-1", accessToken: "access", expiresAt: authorizedAt + 1000, lastAuthorizedAt: authorizedAt });
  const client = createAuthClient(config, { storage, transactionStorage: transactionStorage(), location: { href: config.redirectUri }, now: () => authorizedAt });
  assert.equal(client.localAccessState({ lastAuthorizedAt: authorizedAt }, authorizedAt + (7 * 24 * 60 * 60 * 1000)).allowed, true);
  assert.equal(client.localAccessState({ lastAuthorizedAt: authorizedAt }, authorizedAt + (7 * 24 * 60 * 60 * 1000) + 1).allowed, false);
});
