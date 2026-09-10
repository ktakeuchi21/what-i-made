"use strict";

const crypto = require("node:crypto");
const { identityFromClaims, readRange, summarizeEvents, validateEventBatch, eventLabel, digestSubject } = require("./domain");
const { createRepository } = require("./repository");

function response(statusCode, body) {
  return { statusCode, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, private", "x-content-type-options": "nosniff" }, body: JSON.stringify(body) };
}
function readJson(event) {
  const source = typeof event.body === "string" ? event.body : "";
  if (!source || Buffer.byteLength(source, event.isBase64Encoded ? "base64" : "utf8") > 32768) throw new Error("invalid_request");
  try { return JSON.parse(Buffer.from(source, event.isBase64Encoded ? "base64" : "utf8").toString("utf8")); } catch { throw new Error("invalid_request"); }
}
function query(event) { return event.queryStringParameters || {}; }
function claims(event) { return event.requestContext?.authorizer?.jwt?.claims || {}; }
function timeline(events) { return events.sort((a, b) => `${b.occurredAt}|${b.eventId}`.localeCompare(`${a.occurredAt}|${a.eventId}`)).map((event) => ({ type: event.type, label: eventLabel(event.type), occurredAt: event.occurredAt })); }

function createHandler(dependencies = {}, environment = process.env) {
  const repository = dependencies.repository || createRepository(environment, dependencies.repositoryDependencies);
  const listUsers = dependencies.listUsers || (async () => {
    const { CognitoIdentityProviderClient, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
    const client = new CognitoIdentityProviderClient({});
    const users = [];
    let PaginationToken;
    do {
      const result = await client.send(new ListUsersCommand({ UserPoolId: environment.USER_POOL_ID, PaginationToken, Limit: 60 }));
      users.push(...(result.Users || []));
      PaginationToken = result.PaginationToken;
    } while (PaginationToken);
    return users;
  });
  const invokePurge = dependencies.invokePurge || (async (payload) => {
    const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
    await new LambdaClient({}).send(new InvokeCommand({ FunctionName: environment.AWS_LAMBDA_FUNCTION_NAME, InvocationType: "Event", Payload: Buffer.from(JSON.stringify(payload)) }));
  });
  const now = dependencies.now || Date.now;
  const launchDate = environment.ANALYTICS_LAUNCH_DATE || new Date(now()).toISOString().slice(0, 10);
  return async function handler(event = {}) {
    if (event.internalPurge === true) {
      const nextKey = await repository.purgeGeneration(String(event.generation || ""), event.startKey || undefined);
      if (nextKey) await invokePurge({ internalPurge: true, generation: event.generation, startKey: nextKey });
      else await repository.completePurge(String(event.generation || ""));
      return { complete: !nextKey };
    }
    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path || "";
    const account = identityFromClaims(claims(event), environment, { admin: path.startsWith("/v1/admin/") });
    if (!account) return response(403, { error: "forbidden" });
    try {
      if (method === "POST" && path === "/v1/activity/events") {
        const batch = validateEventBatch(readJson(event), now());
        let accepted = 0;
        for (const item of batch.events) if (await repository.record(account.accountId, item, { partial: batch.partial })) accepted += 1;
        return response(200, { accepted, duplicate: batch.events.length - accepted });
      }
      if (method === "DELETE" && path === "/v1/admin/analytics") {
        const body = readJson(event);
        if (!body || Object.keys(body).length !== 1 || body.confirmation !== "ERASE ANALYTICS") throw new Error("invalid_request");
        const rotated = await repository.rotateGeneration();
        invokePurge({ internalPurge: true, generation: rotated.previous }).catch(() => {});
        return response(202, { status: "clearing", trackedSince: launchDate });
      }
      const range = readRange(query(event).range);
      const snapshot = await repository.scanGeneration();
      const events = snapshot.items.filter((item) => item.entity === "event");
      const summaries = new Map(snapshot.items.filter((item) => item.entity === "summary").map((item) => [item.accountId, item]));
      const users = await listUsers();
      const roster = users.map((user) => {
        const attributes = Object.fromEntries((user.Attributes || []).map((attribute) => [attribute.Name, attribute.Value]));
        const accountId = digestSubject(attributes.sub || user.Username || "");
        const userEvents = events.filter((item) => item.accountId === accountId);
        const summary = summaries.get(accountId) || {};
        const ordered = userEvents.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
        const signIns = ordered.filter((item) => item.type === "sign_in_succeeded");
        return { accountId, email: attributes.email || "Invited user", status: user.UserStatus || "UNKNOWN", enabled: user.Enabled !== false, createdAt: user.UserCreateDate ? new Date(user.UserCreateDate).toISOString() : null, firstSignInAt: summary.firstSignInAt || signIns.at(-1)?.occurredAt || null, lastSignInAt: summary.lastSignInAt || signIns[0]?.occurredAt || null, lastActivityAt: summary.lastActivityAt || ordered[0]?.occurredAt || null, partial: summary.analyticsPartial === true };
      }).sort((a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || "") || a.email.localeCompare(b.email));
      if (method === "GET" && path === "/v1/admin/analytics/summary") {
        if (snapshot.control?.purgeStatus === "clearing" && snapshot.control?.purgingGeneration) invokePurge({ internalPurge: true, generation: snapshot.control.purgingGeneration }).catch(() => {});
        const metrics = summarizeEvents(events, range, now());
        metrics.accountsSignedIn = roster.filter((user) => Boolean(user.firstSignInAt)).length;
        return response(200, { trackedSince: launchDate, purgeStatus: snapshot.control?.purgeStatus || "complete", invitedAccounts: roster.length, ...metrics });
      }
      if (method === "GET" && path === "/v1/admin/analytics/users") {
        const enriched = roster.map((user) => ({ ...user, ...summarizeEvents(events.filter((item) => item.accountId === user.accountId), range, now()), series: undefined }));
        return response(200, { trackedSince: launchDate, users: enriched, nextCursor: null });
      }
      const match = path.match(/^\/v1\/admin\/analytics\/users\/([a-f0-9]{64})$/);
      if (method === "GET" && match) {
        const user = roster.find((item) => item.accountId === match[1]);
        if (!user) return response(404, { error: "not_found" });
        const userEvents = events.filter((item) => item.accountId === user.accountId);
        return response(200, { trackedSince: launchDate, user: { ...user, ...summarizeEvents(userEvents, range, now()), series: undefined }, events: timeline(userEvents).slice(0, 200), nextCursor: null });
      }
      return response(404, { error: "not_found" });
    } catch (error) {
      return response(error?.message === "invalid_request" ? 400 : 503, { error: error?.message === "invalid_request" ? "invalid_request" : "unavailable" });
    }
  };
}

function createPostAuthenticationHandler(dependencies = {}, environment = process.env) {
  const repository = dependencies.repository || createRepository(environment, dependencies.repositoryDependencies);
  const now = dependencies.now || Date.now;
  return async function handler(event = {}) {
    const subject = String(event.request?.userAttributes?.sub || "").trim();
    if (!subject || event.triggerSource !== "PostAuthentication_Authentication" || (environment.COGNITO_CLIENT_ID && event.callerContext?.clientId !== environment.COGNITO_CLIENT_ID)) return event;
    const occurredAt = new Date(now()).toISOString();
    try { await repository.record(digestSubject(subject), { id: crypto.randomUUID(), type: "sign_in_succeeded", occurredAt, clientVersion: "cognito", appClient: String(event.callerContext?.clientId || "").slice(0, 128) }); } catch {}
    return event;
  };
}

module.exports = { createHandler, createPostAuthenticationHandler, testing: { readJson, timeline } };
