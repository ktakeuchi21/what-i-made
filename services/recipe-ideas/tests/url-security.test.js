"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { canonicalizeUrl, isPublicIp, safeFetch } = require("../url-security");

const publicLookup = async () => [{ address: "8.8.8.8", family: 4 }];
function response(body, options = {}) {
  const headers = new Map(Object.entries({ "content-type": "text/html", ...(options.headers || {}) }));
  return { status: options.status || 200, ok: (options.status || 200) < 400, headers: { get: (key) => headers.get(key) || null }, arrayBuffer: async () => Buffer.from(body) };
}

test("canonicalizes HTTPS URLs deterministically and removes tracking", () => {
  assert.equal(
    canonicalizeUrl("https://EXAMPLE.com//recipes/soup/?utm_source=x&b=2&a=1#steps"),
    "https://example.com/recipes/soup?a=1&b=2",
  );
  assert.throws(() => canonicalizeUrl("http://example.com/"), /invalid_url/);
  assert.throws(() => canonicalizeUrl("https://user:pass@example.com/"), /invalid_url/);
  assert.throws(() => canonicalizeUrl("https://example.com:8443/"), /invalid_url/);
});

test("classifies private, reserved, mapped, and public addresses", () => {
  for (const address of [
    "127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.1.1", "::1", "::127.0.0.1",
    "fd00::1", "fec0::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "2001:2::1",
    "2001:db8::1", "2002:7f00:1::", "3fff::1",
  ]) {
    assert.equal(isPublicIp(address), false, address);
  }
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("2606:4700:4700::1111"), true);
});

test("rejects any private DNS answer before fetch", async () => {
  let calls = 0;
  await assert.rejects(safeFetch("https://example.com/", {
    lookup: async () => [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }],
    fetchImpl: async () => { calls += 1; return response("ok"); },
  }), /unsafe_address/);
  assert.equal(calls, 0);
});

test("pins the transport to the complete approved DNS answer set", async () => {
  let approved;
  await safeFetch("https://example.com/", {
    lookup: async () => [{ address: "8.8.8.8", family: 4 }, { address: "2606:4700:4700::1111", family: 6 }],
    fetchImpl: async (_url, options) => { approved = options.approvedAddresses; return response("ok"); },
  });
  assert.deepEqual(approved, [
    { address: "8.8.8.8", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 },
  ]);
});

test("revalidates every redirect and blocks a redirect to metadata", async () => {
  let fetchCalls = 0;
  await assert.rejects(safeFetch("https://public.example/start", {
    lookup: async (host) => [{ address: host === "metadata.example" ? "169.254.169.254" : "8.8.8.8", family: 4 }],
    fetchImpl: async () => {
      fetchCalls += 1;
      return response("", { status: 302, headers: { location: "https://metadata.example/latest" } });
    },
  }), /unsafe_address/);
  assert.equal(fetchCalls, 1);
});

test("enforces redirect count, MIME type, declared and actual size", async () => {
  await assert.rejects(safeFetch("https://example.com", { lookup: publicLookup, maximumRedirects: 0, fetchImpl: async () => response("", { status: 302, headers: { location: "/again" } }) }), /too_many_redirects/);
  await assert.rejects(safeFetch("https://example.com", { lookup: publicLookup, fetchImpl: async () => response("x", { headers: { "content-type": "application/pdf" } }) }), /unsupported_content_type/);
  await assert.rejects(safeFetch("https://example.com", { lookup: publicLookup, maximumBytes: 2, fetchImpl: async () => response("x", { headers: { "content-length": "10" } }) }), /response_too_large/);
  await assert.rejects(safeFetch("https://example.com", { lookup: publicLookup, maximumBytes: 2, fetchImpl: async () => response("long") }), /response_too_large/);
});

test("converts an aborted request into a timeout without real network", async () => {
  await assert.rejects(safeFetch("https://example.com", {
    lookup: publicLookup, timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))),
  }), /timeout/);
});

test("timeout also covers a response body that stalls", async () => {
  await assert.rejects(safeFetch("https://example.com", {
    lookup: publicLookup, timeoutMs: 5,
    fetchImpl: async () => ({
      status: 200, ok: true, headers: { get: (key) => key === "content-type" ? "text/html" : null },
      arrayBuffer: async () => new Promise(() => {}),
    }),
  }), /timeout/);
});

test("timeout covers DNS resolution that stalls", async () => {
  await assert.rejects(safeFetch("https://example.com", {
    lookup: async () => new Promise(() => {}), timeoutMs: 5,
    fetchImpl: async () => response("should not fetch"),
  }), /timeout/);
});
