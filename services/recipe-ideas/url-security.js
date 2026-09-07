"use strict";

const dns = require("node:dns/promises");
const https = require("node:https");
const net = require("node:net");

const TRACKING_PARAMETERS = new Set([
  "fbclid", "gclid", "dclid", "mc_cid", "mc_eid", "ref", "referrer",
  "source", "igshid", "mkt_tok", "vero_conv", "vero_id",
]);

class FetchSafetyError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "FetchSafetyError";
    this.code = code;
  }
}

function parseHttpsUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new FetchSafetyError("invalid_url");
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new FetchSafetyError("invalid_url");
  }
  if (!url.hostname || url.hostname.length > 253) throw new FetchSafetyError("invalid_url");
  return url;
}

function canonicalizeUrl(value) {
  const url = parseHttpsUrl(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith("utm_") && !TRACKING_PARAMETERS.has(key.toLowerCase()))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  url.search = "";
  for (const [key, valuePart] of kept) url.searchParams.append(key, valuePart);
  return url.toString();
}

function ipv4Number(address) {
  return address.split(".").reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function inV4Range(address, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

function ipv6Number(address) {
  if (typeof address !== "string" || address.includes(".")) return null;
  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) return null;
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function inV6Range(addressValue, base, bits) {
  const baseValue = ipv6Number(base);
  return baseValue !== null && (addressValue >> BigInt(128 - bits)) === (baseValue >> BigInt(128 - bits));
}

function isPublicIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const blocked = [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4],
    ];
    return !blocked.some(([base, bits]) => inV4Range(address, base, bits));
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
    if (mapped) return isPublicIp(mapped[1]);
    const value = ipv6Number(normalized);
    if (value === null) return false;
    // Only globally routable unicast is eligible, with IANA special-purpose
    // protocol, transition, and documentation allocations denied conservatively.
    if (!inV6Range(value, "2000::", 3)) return false;
    return ![
      ["2001::", 23],
      ["2001:db8::", 32],
      ["2002::", 16],
      ["3fff::", 20],
    ].some(([base, bits]) => inV6Range(value, base, bits));
  }
  return false;
}

async function resolvePublicUrl(url, lookup = dns.lookup) {
  const parsed = url instanceof URL ? url : parseHttpsUrl(url);
  if (net.isIP(parsed.hostname)) {
    if (!isPublicIp(parsed.hostname)) throw new FetchSafetyError("unsafe_address");
    return { url: parsed, addresses: [{ address: parsed.hostname, family: net.isIP(parsed.hostname) }] };
  }
  let addresses;
  try {
    addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new FetchSafetyError("unreachable_host");
  }
  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new FetchSafetyError("unsafe_address");
  }
  return { url: parsed, addresses };
}

async function assertPublicUrl(url, lookup = dns.lookup) {
  return (await resolvePublicUrl(url, lookup)).url;
}

function pinnedHttpsFetch(url, options = {}) {
  const approved = options.approvedAddresses || [];
  const maximumBytes = options.maximumBytes || 1024 * 1024;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const request = https.request(url, {
      method: "GET",
      headers: options.headers,
      lookup(_hostname, lookupOptions, callback) {
        const requestedFamily = typeof lookupOptions === "object" ? lookupOptions.family : 0;
        const match = approved.find((entry) => !requestedFamily || entry.family === requestedFamily) || approved[0];
        if (!match) return callback(new FetchSafetyError("unsafe_address"));
        callback(null, match.address, match.family);
      },
    }, (incoming) => {
      const chunks = [];
      let length = 0;
      incoming.on("data", (chunk) => {
        length += chunk.length;
        if (length > maximumBytes) {
          incoming.destroy(new FetchSafetyError("response_too_large"));
          return;
        }
        chunks.push(chunk);
      });
      incoming.on("error", finishReject);
      incoming.on("end", () => {
        if (settled) return;
        settled = true;
        const bytes = Buffer.concat(chunks);
        resolve({
          status: incoming.statusCode || 0,
          ok: (incoming.statusCode || 0) >= 200 && (incoming.statusCode || 0) < 300,
          headers: { get: (name) => incoming.headers[String(name).toLowerCase()] || null },
          arrayBuffer: async () => bytes,
        });
      });
    });
    request.on("error", finishReject);
    const abort = () => request.destroy(Object.assign(new Error("aborted"), { name: "AbortError" }));
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    request.end();
  });
}

async function readLimitedBody(response, maximumBytes) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) throw new FetchSafetyError("response_too_large");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw new FetchSafetyError("response_too_large");
  return bytes;
}

async function safeFetch(value, options = {}) {
  const fetchImpl = options.fetchImpl || pinnedHttpsFetch;
  const lookup = options.lookup || dns.lookup;
  const maximumBytes = options.maximumBytes || 1024 * 1024;
  const allowedMimeTypes = options.allowedMimeTypes || ["text/html", "application/xhtml+xml"];
  const maximumRedirects = options.maximumRedirects ?? 3;
  const timeoutMs = options.timeoutMs || 8000;
  if (typeof fetchImpl !== "function") throw new FetchSafetyError("fetch_unavailable");

  let current = parseHttpsUrl(value);
  for (let redirects = 0; redirects <= maximumRedirects; redirects += 1) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new FetchSafetyError("timeout"));
      }, timeoutMs);
    });
    let response;
    try {
      const { addresses } = await Promise.race([resolvePublicUrl(current, lookup), timeout]);
      response = await Promise.race([fetchImpl(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        approvedAddresses: addresses,
        maximumBytes,
        headers: { accept: allowedMimeTypes.join(", "), "user-agent": "WhatIMadeRecipeImporter/1.0" },
      }), timeout]);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects === maximumRedirects) throw new FetchSafetyError("too_many_redirects");
        const location = response.headers?.get?.("location");
        if (!location) throw new FetchSafetyError("invalid_redirect");
        current = parseHttpsUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) throw new FetchSafetyError("upstream_error");
      const mimeType = String(response.headers?.get?.("content-type") || "").split(";", 1)[0].trim().toLowerCase();
      if (!allowedMimeTypes.includes(mimeType)) throw new FetchSafetyError("unsupported_content_type");
      const bytes = await Promise.race([readLimitedBody(response, maximumBytes), timeout]);
      return { bytes, mimeType, finalUrl: current.toString(), status: response.status };
    } catch (error) {
      if (error instanceof FetchSafetyError) throw error;
      throw new FetchSafetyError(error?.name === "AbortError" ? "timeout" : "fetch_failed");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FetchSafetyError("too_many_redirects");
}

module.exports = {
  FetchSafetyError,
  assertPublicUrl,
  canonicalizeUrl,
  isPublicIp,
  parseHttpsUrl,
  pinnedHttpsFetch,
  readLimitedBody,
  resolvePublicUrl,
  safeFetch,
};
