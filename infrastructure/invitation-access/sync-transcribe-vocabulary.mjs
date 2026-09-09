#!/usr/bin/env node

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const catalog = require("../../prototypes/capture-flow/assets/international-dishes.js");

function cleanPhrase(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9.-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function buildVocabularyPhrases(entries = catalog.dishes) {
  const phrases = [];
  const seen = new Set();
  for (const dish of entries || []) {
    for (const value of [dish.canonicalName, ...(dish.aliases || [])]) {
      const phrase = cleanPhrase(value);
      const key = phrase.toLowerCase();
      if (!phrase || phrase.length > 256 || seen.has(key)) continue;
      seen.add(key);
      phrases.push(phrase);
    }
  }
  if (!phrases.length || phrases.length > 256) throw new Error("The culinary vocabulary must contain 1–256 distinct phrases.");
  return phrases;
}

function parseArguments(values) {
  const result = { region: "us-east-2", name: `what-i-made-culinary-terms-v${catalog.version}` };
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]?.replace(/^--/, "");
    const value = values[index + 1];
    if (!key || value === undefined) throw new Error(`Missing value for ${values[index] || "argument"}.`);
    result[key] = value;
  }
  if (!/^[a-z]{2}-[a-z]+-\d$/.test(result.region)) throw new Error("AWS region is invalid.");
  if (!/^[0-9A-Za-z._-]{1,200}$/.test(result.name)) throw new Error("Vocabulary name is invalid.");
  return result;
}

function runAws(args, options = {}) {
  const result = spawnSync("aws", args, { encoding: "utf8", stdio: options.capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  return result;
}

function pause(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function syncVocabulary({ name, region, run = runAws, wait = pause } = {}) {
  const phrases = buildVocabularyPhrases();
  const common = ["--vocabulary-name", name, "--language-code", "en-US", "--phrases", JSON.stringify(phrases), "--region", region, "--no-cli-pager"];
  const existing = run(["transcribe", "get-vocabulary", "--vocabulary-name", name, "--region", region, "--no-cli-pager"], { capture: true });
  const action = existing.status === 0 ? "update-vocabulary" : "create-vocabulary";
  const submitted = run(["transcribe", action, ...common]);
  if (submitted.status !== 0) throw new Error(`AWS could not ${action === "create-vocabulary" ? "create" : "update"} the vocabulary.`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const statusResult = run(["transcribe", "get-vocabulary", "--vocabulary-name", name, "--region", region, "--output", "json", "--no-cli-pager"], { capture: true });
    if (statusResult.status !== 0) throw new Error("AWS could not read vocabulary status.");
    const status = JSON.parse(statusResult.stdout || "{}").VocabularyState;
    if (status === "READY") return { name, region, phraseCount: phrases.length, state: status };
    if (status === "FAILED") throw new Error("Amazon Transcribe rejected the culinary vocabulary.");
    wait(2000);
  }
  throw new Error("The culinary vocabulary did not become ready within 60 seconds.");
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const options = parseArguments(process.argv.slice(2));
  const result = syncVocabulary(options);
  console.log(`Vocabulary ${result.name} is READY with ${result.phraseCount} public culinary terms.`);
}

export const testing = { cleanPhrase, parseArguments };
