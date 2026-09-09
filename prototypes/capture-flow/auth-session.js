(function (root, factory) {
  const accountContext = typeof module === "object" && module.exports
    ? require("./account-context.js")
    : root?.WhatIMadeAccountContext;
  const api = factory(root, accountContext);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeAuth = api;
})(typeof window !== "undefined" ? window : globalThis, function (root, accountContext) {
  "use strict";

  const AUTH_DB_NAME = "what-i-made-auth-v1";
  const AUTH_DB_VERSION = 1;
  const AUTH_STORE_NAME = "session";
  const SESSION_ID = "current";
  const OAUTH_TRANSACTION_KEY = "what-i-made-oauth-transaction";
  const OAUTH_TRANSACTION_MAX_AGE_MS = 10 * 60 * 1000;
  const TOKEN_EXPIRY_SKEW_MS = 30 * 1000;
  const SIGN_OUT_PENDING_KEY = "what-i-made-sign-out-pending";

  function authError(code, message, cause) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function normalizeAuthConfig(input = {}, location = root.location) {
    const fake = input.fake === true;
    const enabled = input.enabled === true || fake;
    if (!enabled) return Object.freeze({ enabled: false, fake: false });

    if (fake) {
      return Object.freeze({
        enabled: true,
        fake: true,
        fakeSubject: String(input.fakeSubject || "local-owner"),
        fakeEmail: String(input.fakeEmail || "owner@example.test"),
      });
    }

    let domain;
    let redirectUri;
    try {
      domain = new URL(String(input.domain || ""));
      redirectUri = new URL(String(input.redirectUri || ""), location?.href);
    } catch {
      throw new Error("Invitation sign-in is not configured correctly.");
    }
    if (domain.protocol !== "https:" || domain.username || domain.password || domain.search || domain.hash || !domain.hostname || !["", "/"].includes(domain.pathname)) {
      throw new Error("Invitation sign-in requires a valid HTTPS Cognito domain.");
    }
    if (redirectUri.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(redirectUri.hostname)) {
      throw new Error("Invitation sign-in requires a secure return address.");
    }
    const clientId = String(input.clientId || "").trim();
    if (!/^[A-Za-z0-9]+$/.test(clientId) || clientId.length > 128) {
      throw new Error("Invitation sign-in requires a valid public app client.");
    }
    const scopes = Array.from(new Set(["openid", "email", ...(Array.isArray(input.scopes) ? input.scopes : [])]))
      .map((value) => String(value).trim()).filter((value) => /^[A-Za-z0-9_./:-]+$/.test(value));
    return Object.freeze({
      enabled: true,
      fake: false,
      domain: domain.origin,
      clientId,
      redirectUri: redirectUri.toString(),
      scopes,
    });
  }

  function randomBase64Url(cryptoApi = root.crypto, byteLength = 32) {
    if (!cryptoApi?.getRandomValues) throw new Error("Secure sign-in is unavailable in this browser.");
    const bytes = cryptoApi.getRandomValues(new Uint8Array(byteLength));
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const encoded = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function bytesToBase64Url(bytes) {
    let binary = "";
    new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
    const encoded = typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function pkceChallenge(verifier, cryptoApi = root.crypto) {
    if (!cryptoApi?.subtle?.digest) throw new Error("Secure sign-in is unavailable in this browser.");
    return bytesToBase64Url(await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  }

  async function createAuthorizationRequest(configInput, options = {}) {
    const config = normalizeAuthConfig(configInput, options.location || root.location);
    if (!config.enabled || config.fake) throw new Error("Hosted invitation sign-in is not configured.");
    const cryptoApi = options.crypto || root.crypto;
    const state = randomBase64Url(cryptoApi, 24);
    const nonce = randomBase64Url(cryptoApi, 24);
    const verifier = randomBase64Url(cryptoApi, 48);
    const createdAt = Number(options.now ?? Date.now());
    const authorizeUrl = new URL("/oauth2/authorize", config.domain);
    authorizeUrl.search = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "),
      state,
      nonce,
      code_challenge_method: "S256",
      code_challenge: await pkceChallenge(verifier, cryptoApi),
    }).toString();
    return { authorizeUrl: authorizeUrl.toString(), transaction: { state, nonce, verifier, createdAt } };
  }

  function parseCallback(url, transaction, now = Date.now()) {
    const current = new URL(String(url));
    const error = current.searchParams.get("error");
    if (error) throw new Error("Invitation sign-in was not completed. Try again.");
    const code = current.searchParams.get("code");
    const returnedState = current.searchParams.get("state");
    if (!code && !returnedState) return null;
    if (!transaction || returnedState !== transaction.state || !transaction.verifier || !transaction.nonce) {
      throw new Error("The sign-in return could not be verified. Start again.");
    }
    const age = Number(now) - Number(transaction.createdAt);
    if (!Number.isFinite(age) || age < 0 || age > OAUTH_TRANSACTION_MAX_AGE_MS) {
      throw new Error("The sign-in return expired. Start again.");
    }
    if (!code) throw new Error("The sign-in return did not contain an authorization code.");
    return { code, verifier: transaction.verifier, nonce: transaction.nonce };
  }

  function withoutOAuthParameters(url) {
    const cleaned = new URL(String(url));
    ["code", "state", "error", "error_description"].forEach((name) => cleaned.searchParams.delete(name));
    return `${cleaned.pathname}${cleaned.search}${cleaned.hash}`;
  }

  function decodeJwtPayload(value) {
    const parts = String(value || "").split(".");
    if (parts.length !== 3) throw new Error("The sign-in service returned an invalid identity token.");
    let encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    encoded += "=".repeat((4 - (encoded.length % 4)) % 4);
    try {
      const binary = typeof atob === "function" ? atob(encoded) : Buffer.from(encoded, "base64").toString("binary");
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("The sign-in service returned an invalid identity token.");
    }
  }

  function validateTokenResponse(payload, nonce, now = Date.now()) {
    if (!payload || typeof payload.access_token !== "string" || !payload.access_token || !Number.isFinite(Number(payload.expires_in))) {
      throw new Error("The sign-in service returned an invalid session.");
    }
    if (nonce) {
      const identity = decodeJwtPayload(payload.id_token);
      if (identity.nonce !== nonce) throw new Error("The sign-in identity could not be verified. Start again.");
    }
    return {
      accessToken: payload.access_token,
      refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : "",
      expiresAt: Number(now) + Math.max(1, Number(payload.expires_in)) * 1000,
    };
  }

  async function requestTokens(config, body, fetchImpl = root.fetch, nonce = "", now = Date.now(), signal) {
    let response;
    try {
      response = await fetchImpl(`${config.domain}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
        cache: "no-store",
        credentials: "omit",
        signal,
      });
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw authError("cancelled", "Sign-in was cancelled.", error);
      throw authError("temporarily_unavailable", "The sign-in service is temporarily unavailable. Try again when connected.", error);
    }
    if (!response.ok) {
      let providerError = "";
      try { providerError = String((await response.json())?.error || ""); } catch {}
      if ([401, 403].includes(response.status) || (response.status === 400 && providerError === "invalid_grant")) {
        throw authError("reauth_required", "Your session ended. Sign in again.");
      }
      throw authError("temporarily_unavailable", "The sign-in service is temporarily unavailable. Try again when connected.");
    }
    return validateTokenResponse(await response.json(), nonce, now);
  }

  async function verifiedIdentity(config, accessToken, fetchImpl = root.fetch, signal) {
    let response;
    try {
      response = await fetchImpl(`${config.domain}/oauth2/userInfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        credentials: "omit",
        signal,
      });
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw authError("cancelled", "Sign-in was cancelled.", error);
      throw authError("temporarily_unavailable", "The signed-in account could not be verified because the service is unavailable.", error);
    }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw authError("reauth_required", "Your session ended. Sign in again.");
      throw authError("temporarily_unavailable", "The signed-in account could not be verified because the service is unavailable.");
    }
    const payload = await response.json();
    const subject = accountContext.normalizeSubject(payload.sub);
    const email = typeof payload.email === "string" ? payload.email.trim().slice(0, 320) : "";
    return { subject, email };
  }

  function createIndexedDbSessionStore(indexedDb = root.indexedDB) {
    function open() {
      if (!indexedDb) return Promise.reject(new Error("Private sign-in storage is unavailable."));
      return new Promise((resolve, reject) => {
        const request = indexedDb.open(AUTH_DB_NAME, AUTH_DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(AUTH_STORE_NAME)) request.result.createObjectStore(AUTH_STORE_NAME, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Private sign-in storage could not be opened."));
      });
    }
    async function operate(mode, action) {
      const database = await open();
      try {
        return await new Promise((resolve, reject) => {
          const transaction = database.transaction(AUTH_STORE_NAME, mode);
          const request = action(transaction.objectStore(AUTH_STORE_NAME));
          let result = null;
          let settled = false;
          request.onsuccess = () => { result = request.result || null; };
          request.onerror = () => reject(request.error || new Error("Private sign-in storage could not be updated."));
          transaction.oncomplete = () => { if (!settled) { settled = true; resolve(result); } };
          transaction.onerror = () => { if (!settled) { settled = true; reject(transaction.error || new Error("Private sign-in storage could not be updated.")); } };
          transaction.onabort = () => { if (!settled) { settled = true; reject(transaction.error || new Error("Private sign-in storage was cancelled.")); } };
        });
      } finally {
        database.close();
      }
    }
    return {
      read: () => operate("readonly", (store) => store.get(SESSION_ID)),
      write: (record) => operate("readwrite", (store) => store.put({ ...record, id: SESSION_ID })),
      markSignOutPending: () => operate("readwrite", (store) => store.put({ id: SESSION_ID, signOutPending: true })),
      clear: () => operate("readwrite", (store) => store.delete(SESSION_ID)),
    };
  }

  function publicSession(record, kind = "signedIn") {
    return {
      kind,
      subject: record.subject,
      email: record.email || "",
      accessToken: kind === "signedIn" ? record.accessToken : "",
      accessTokenExpiresAt: kind === "signedIn" ? record.expiresAt : null,
      lastAuthorizedAt: record.lastAuthorizedAt,
    };
  }

  function createAuthClient(configInput, dependencies = {}) {
    const location = dependencies.location || root.location;
    const config = normalizeAuthConfig(configInput, location);
    const cryptoApi = dependencies.crypto || root.crypto;
    const fetchImpl = dependencies.fetch || root.fetch;
    const storage = dependencies.storage || createIndexedDbSessionStore(dependencies.indexedDB || root.indexedDB);
    const transactionStorage = dependencies.transactionStorage || root.sessionStorage;
    const guardStorage = dependencies.guardStorage || root.localStorage;
    const history = dependencies.history || root.history;
    const navigator = dependencies.navigator || root.navigator;
    const now = dependencies.now || (() => Date.now());
    let refreshPromise = null;
    let refreshController = null;
    let authGeneration = 0;

    async function saveVerifiedSession(tokens, previousRefreshToken = "", expectedSubject = "", generation = authGeneration, signal) {
      if (generation !== authGeneration) throw authError("cancelled", "Sign-in was cancelled.");
      const identity = await verifiedIdentity(config, tokens.accessToken, fetchImpl, signal);
      if (generation !== authGeneration) throw authError("cancelled", "Sign-in was cancelled.");
      if (expectedSubject && identity.subject !== expectedSubject) {
        await clearSession().catch(() => {});
        throw authError("reauth_required", "The refreshed account identity changed. Sign in again.");
      }
      const record = {
        subject: identity.subject,
        email: identity.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || previousRefreshToken,
        expiresAt: tokens.expiresAt,
        lastAuthorizedAt: now(),
      };
      if (generation !== authGeneration) throw authError("cancelled", "Sign-in was cancelled.");
      await storage.write(record);
      if (generation !== authGeneration) {
        await clearSession().catch(() => {});
        throw authError("cancelled", "Sign-in was cancelled.");
      }
      return publicSession(record);
    }

    async function refreshStoredSession(record, generation = authGeneration) {
      if (generation !== authGeneration) throw authError("cancelled", "Sign-in was cancelled.");
      if (refreshPromise) return refreshPromise;
      refreshController = new AbortController();
      refreshPromise = (async () => {
        if (!record?.refreshToken) {
          await clearSession().catch(() => {});
          throw authError("reauth_required", "Your session ended. Sign in again.");
        }
        const tokens = await requestTokens(config, {
          grant_type: "refresh_token",
          client_id: config.clientId,
          refresh_token: record.refreshToken,
        }, fetchImpl, "", now(), refreshController.signal);
        return saveVerifiedSession(tokens, record.refreshToken, record.subject, generation, refreshController.signal);
      })();
      try { return await refreshPromise; }
      finally { refreshPromise = null; refreshController = null; }
    }

    function takeCallback() {
      if (!config.enabled || config.fake) return null;
      const callbackUrl = location.href;
      const callbackParameters = new URL(callbackUrl).searchParams;
      const hasOAuthResponse = ["code", "state", "error", "error_description"].some((name) => callbackParameters.has(name));
      if (!hasOAuthResponse) return null;
      // Remove one-time OAuth values before touching either browser storage or the
      // network. Cleanup failures are deliberately independent: broken storage
      // must never prevent address-bar sanitization.
      try { history?.replaceState?.(history.state, "", withoutOAuthParameters(callbackUrl)); } catch {}
      let transaction = null;
      try { transaction = JSON.parse(transactionStorage?.getItem(OAUTH_TRANSACTION_KEY) || "null"); } catch {}
      try { transactionStorage?.removeItem(OAUTH_TRANSACTION_KEY); } catch {}
      return { callbackUrl, transaction };
    }

    async function completeCallback(context) {
      if (!context) return null;
      const callback = parseCallback(context.callbackUrl, context.transaction, now());
      if (!callback) return null;
      const tokens = await requestTokens(config, {
        grant_type: "authorization_code",
        client_id: config.clientId,
        code: callback.code,
        redirect_uri: config.redirectUri,
        code_verifier: callback.verifier,
      }, fetchImpl, callback.nonce, now());
      return saveVerifiedSession(tokens);
    }

    async function restore() {
      if (!config.enabled) return { kind: "disabled" };
      const callbackContext = takeCallback();
      let cleanupPending = false;
      try { cleanupPending = guardStorage?.getItem(SIGN_OUT_PENDING_KEY) === "1"; } catch {}
      if (cleanupPending) {
        try {
          await storage.clear();
          try { guardStorage?.removeItem(SIGN_OUT_PENDING_KEY); } catch {}
          return { kind: "signedOut", reason: "cleanupComplete" };
        } catch {
          return { kind: "signedOut", reason: "cleanup" };
        }
      }
      const record = await storage.read();
      if (record?.signOutPending) {
        try { await storage.clear(); } catch { return { kind: "signedOut", reason: "cleanup" }; }
        return { kind: "signedOut", reason: "cleanupComplete" };
      }
      if (config.fake) {
        const record = {
          subject: accountContext.normalizeSubject(config.fakeSubject),
          email: config.fakeEmail,
          accessToken: "local-fake-access-token",
          refreshToken: "",
          expiresAt: now() + 60 * 60 * 1000,
          lastAuthorizedAt: now(),
        };
        await storage.write(record);
        return publicSession(record);
      }
      const callbackSession = await completeCallback(callbackContext);
      if (callbackSession) return callbackSession;
      if (!record?.subject) return { kind: "signedOut" };
      if (navigator?.onLine === false) {
        const offline = accountContext.offlineAccessState(record.lastAuthorizedAt, now());
        if (offline.allowed) return publicSession(record, "offlineGrace");
        try { await clearSession(); return { kind: "signedOut", reason: "offlineExpired" }; }
        catch { return { kind: "signedOut", reason: "cleanup" }; }
      }
      if (Number(record.expiresAt) > now() + TOKEN_EXPIRY_SKEW_MS && record.accessToken) return publicSession(record);

      if (record.refreshToken) {
        try {
          return await refreshStoredSession(record);
        } catch (error) {
          if (error?.code === "reauth_required") {
            try { await clearSession(); return { kind: "signedOut", reason: "expired" }; }
            catch { return { kind: "signedOut", reason: "cleanup" }; }
          }
          if (error?.code === "temporarily_unavailable") {
            const offline = accountContext.offlineAccessState(record.lastAuthorizedAt, now());
            return offline.allowed ? publicSession(record, "offlineGrace") : { kind: "signedOut", reason: "serviceUnavailable" };
          }
          return { kind: "signedOut", reason: "cancelled" };
        }
      }
      try { await clearSession(); return { kind: "signedOut", reason: "expired" }; }
      catch { return { kind: "signedOut", reason: "cleanup" }; }
    }

    async function getSessionForNetwork() {
      if (!config.enabled) return { kind: "disabled" };
      if (navigator?.onLine === false) throw new Error("Connect to the internet to use this feature.");
      const generation = authGeneration;
      const record = await storage.read();
      if (generation !== authGeneration) throw authError("cancelled", "Sign-in was cancelled.");
      if (!record?.subject) throw new Error("Sign in again to use this feature.");
      if (Number(record.expiresAt) > now() + TOKEN_EXPIRY_SKEW_MS && record.accessToken) return publicSession(record);
      try {
        return await refreshStoredSession(record, generation);
      } catch (error) {
        if (error?.code === "reauth_required") await clearSession().catch(() => {});
        throw error;
      }
    }

    async function startSignIn() {
      if (!config.enabled) throw new Error("Invitation sign-in is not configured.");
      if (config.fake) return restore();
      const request = await createAuthorizationRequest(config, { crypto: cryptoApi, now: now(), location });
      transactionStorage?.setItem(OAUTH_TRANSACTION_KEY, JSON.stringify(request.transaction));
      return request.authorizeUrl;
    }

    function localAccessState(session, at = now()) {
      return accountContext.offlineAccessState(session?.lastAuthorizedAt, at);
    }

    async function clearSession() {
      authGeneration += 1;
      refreshController?.abort();
      let guarded = false;
      try { guardStorage?.setItem(SIGN_OUT_PENDING_KEY, "1"); guarded = true; } catch {}
      try {
        if (storage.markSignOutPending) await storage.markSignOutPending();
        else if (!guarded) await storage.clear();
      } catch (error) {
        if (!guarded) throw error;
      }
      await storage.clear();
      try { guardStorage?.removeItem(SIGN_OUT_PENDING_KEY); } catch {}
      transactionStorage?.removeItem(OAUTH_TRANSACTION_KEY);
    }

    async function signOut() {
      await clearSession();
      if (!config.enabled || config.fake) return null;
      const logout = new URL("/logout", config.domain);
      logout.search = new URLSearchParams({ client_id: config.clientId, logout_uri: config.redirectUri }).toString();
      return logout.toString();
    }

    return { config, restore, getSessionForNetwork, localAccessState, clearSession, startSignIn, signOut };
  }

  return {
    AUTH_DB_NAME,
    AUTH_DB_VERSION,
    AUTH_STORE_NAME,
    OAUTH_TRANSACTION_KEY,
    OAUTH_TRANSACTION_MAX_AGE_MS,
    TOKEN_EXPIRY_SKEW_MS,
    SIGN_OUT_PENDING_KEY,
    normalizeAuthConfig,
    randomBase64Url,
    pkceChallenge,
    createAuthorizationRequest,
    parseCallback,
    withoutOAuthParameters,
    decodeJwtPayload,
    validateTokenResponse,
    requestTokens,
    verifiedIdentity,
    createIndexedDbSessionStore,
    createAuthClient,
  };
});
