"use strict";

const crypto = require("node:crypto");

function header(headers, name) {
  return String(Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] || "");
}
function digest(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex"); }
function ownerTokenIdentity(event, environment) {
  if (!/^[a-f0-9]{64}$/i.test(environment.OWNER_TOKEN_SHA256 || "")) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(header(event.headers, "authorization"));
  if (!match) return null;
  const actual = crypto.createHash("sha256").update(match[1]).digest();
  const expected = Buffer.from(environment.OWNER_TOKEN_SHA256, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? { accountKey: "legacy-owner" } : null;
}
function cognitoIdentity(event, environment) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const subject = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const clientId = typeof claims?.client_id === "string" ? claims.client_id : "";
  if (!subject || subject.length > 128 || !/^[\w:@.+-]+$/.test(subject)) return null;
  if (claims.token_use !== "access" || !environment.COGNITO_CLIENT_ID || clientId !== environment.COGNITO_CLIENT_ID) return null;
  return { accountKey: digest(subject) };
}
function requestIdentity(event, environment) {
  return environment.AUTH_MODE === "cognito" ? cognitoIdentity(event, environment) : ownerTokenIdentity(event, environment);
}

module.exports = { requestIdentity, testing: { cognitoIdentity, ownerTokenIdentity, digest } };
