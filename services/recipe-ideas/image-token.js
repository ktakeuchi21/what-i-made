"use strict";

const crypto = require("node:crypto");

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function signImageToken(imageUrl, secret, now = Date.now(), lifetimeSeconds = 300) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("Image signing is not configured.");
  const payload = encode(JSON.stringify({ url: imageUrl, exp: Math.floor(now / 1000) + lifetimeSeconds }));
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyImageToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== "string" || token.length > 4096) throw new Error("invalid_token");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("invalid_token");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { throw new Error("invalid_token"); }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("invalid_token");
  let decoded;
  try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new Error("invalid_token"); }
  if (!decoded?.url || !Number.isInteger(decoded.exp) || decoded.exp < Math.floor(now / 1000)) throw new Error("invalid_token");
  return decoded.url;
}

module.exports = { signImageToken, verifyImageToken };
