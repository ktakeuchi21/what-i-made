"use strict";

const crypto = require("node:crypto");

function digest(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex"); }
function cognitoIdentity(event, environment) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const subject = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const clientId = typeof claims?.client_id === "string" ? claims.client_id : "";
  if (!subject || subject.length > 128 || !/^[\w:@.+-]+$/.test(subject)) return null;
  if (claims.token_use !== "access" || !environment.COGNITO_CLIENT_ID || clientId !== environment.COGNITO_CLIENT_ID) return null;
  return { accountKey: digest(subject) };
}
function requestIdentity(event, environment) {
  return cognitoIdentity(event, environment);
}

module.exports = { requestIdentity, testing: { cognitoIdentity, digest } };
