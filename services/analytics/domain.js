"use strict";

const crypto = require("node:crypto");

const EVENT_TYPES = Object.freeze([
  "cook_created",
  "cook_updated",
  "cook_deleted",
  "idea_created",
  "idea_updated",
  "idea_deleted",
  "idea_completed",
  "sign_in_succeeded",
]);
const CLIENT_EVENT_TYPES = new Set(EVENT_TYPES.filter((value) => value !== "sign_in_succeeded"));
const RANGE_DAYS = Object.freeze({ "7d": 7, "30d": 30, "90d": 90, "12m": 366 });
const EVENT_TTL_SECONDS = 366 * 24 * 60 * 60;

function digestSubject(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function safeIsoDate(value, now = Date.now()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const delta = date.getTime() - Number(now);
  if (delta > 5 * 60 * 1000 || delta < -30 * 24 * 60 * 60 * 1000) return null;
  return date.toISOString();
}

function validateEventBatch(value, now = Date.now()) {
  if (!value || Array.isArray(value) || Object.keys(value).some((key) => !["events", "partial"].includes(key))) throw new Error("invalid_request");
  if (!Array.isArray(value.events) || value.events.length < 1 || value.events.length > 50 || (value.partial !== undefined && typeof value.partial !== "boolean")) throw new Error("invalid_request");
  const ids = new Set();
  const events = value.events.map((event) => {
    if (!event || Array.isArray(event) || Object.keys(event).some((key) => !["id", "type", "occurredAt", "clientVersion"].includes(key))) throw new Error("invalid_request");
    const id = String(event.id || "");
    const type = String(event.type || "");
    const occurredAt = safeIsoDate(event.occurredAt, now);
    const clientVersion = String(event.clientVersion || "");
    if (!/^[0-9a-f-]{16,64}$/i.test(id) || ids.has(id) || !CLIENT_EVENT_TYPES.has(type) || !occurredAt || !/^[A-Za-z0-9._-]{1,32}$/.test(clientVersion)) throw new Error("invalid_request");
    ids.add(id);
    return { id, type, occurredAt, clientVersion };
  });
  return { events, partial: value.partial === true };
}

function parseGroups(value) {
  if (Array.isArray(value)) return value.map(String);
  const source = String(value || "").trim();
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return source.replace(/^\[|\]$/g, "").split(",").map((item) => item.trim()).filter(Boolean);
}

function identityFromClaims(claims, environment, options = {}) {
  const subject = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const clientId = typeof claims?.client_id === "string" ? claims.client_id : "";
  if (!subject || subject.length > 256 || claims?.token_use !== "access" || !environment.COGNITO_CLIENT_ID || clientId !== environment.COGNITO_CLIENT_ID) return null;
  const groups = parseGroups(claims["cognito:groups"]);
  if (options.admin && !groups.includes(environment.ADMIN_GROUP_NAME || "what-i-made-admins")) return null;
  return { accountId: digestSubject(subject), subject, groups };
}

function readRange(value) {
  const range = String(value || "30d");
  if (!Object.hasOwn(RANGE_DAYS, range)) throw new Error("invalid_request");
  return range;
}

function eventLabel(type) {
  return ({
    cook_created: "Recorded a cook",
    cook_updated: "Updated a cook",
    cook_deleted: "Deleted a cook",
    idea_created: "Saved an Idea",
    idea_updated: "Updated an Idea",
    idea_deleted: "Deleted an Idea",
    idea_completed: "Cooked an Idea",
    sign_in_succeeded: "Signed in",
  })[type] || "Used the archive";
}

function summarizeEvents(events, range, now = Date.now()) {
  const days = RANGE_DAYS[readRange(range)];
  const cutoff = Number(now) - days * 24 * 60 * 60 * 1000;
  const current = events.filter((event) => new Date(event.occurredAt).getTime() >= cutoff);
  const accounts = new Set(current.map((event) => event.accountId));
  const signedInAccounts = new Set(events.filter((event) => event.type === "sign_in_succeeded").map((event) => event.accountId));
  const count = (type) => current.filter((event) => event.type === type).length;
  const byDate = new Map();
  current.forEach((event) => {
    const day = event.occurredAt.slice(0, 10);
    const record = byDate.get(day) || { date: day, signIns: 0, cooks: 0, ideas: 0 };
    if (event.type === "sign_in_succeeded") record.signIns += 1;
    if (event.type === "cook_created") record.cooks += 1;
    if (event.type === "idea_created") record.ideas += 1;
    byDate.set(day, record);
  });
  return {
    activeAccounts: accounts.size,
    accountsSignedIn: signedInAccounts.size,
    signIns: count("sign_in_succeeded"),
    cooks: count("cook_created"),
    ideas: count("idea_created"),
    partial: current.some((event) => event.partial === true),
    series: [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date)),
  };
}

module.exports = { EVENT_TYPES, CLIENT_EVENT_TYPES, RANGE_DAYS, EVENT_TTL_SECONDS, digestSubject, safeIsoDate, validateEventBatch, parseGroups, identityFromClaims, readRange, eventLabel, summarizeEvents };
