import test from "node:test";
import assert from "node:assert/strict";
import { buildVocabularyPhrases, syncVocabulary, testing } from "./sync-transcribe-vocabulary.mjs";

test("builds a bounded public culinary vocabulary with Mul naengmyeon variants", () => {
  const phrases = buildVocabularyPhrases();
  assert.ok(phrases.includes("Mul naengmyeon"));
  assert.ok(phrases.includes("mool nang myun"));
  assert.ok(phrases.length <= 256);
  assert.equal(new Set(phrases.map((phrase) => phrase.toLowerCase())).size, phrases.length);
});

test("normalizes vocabulary characters without changing the catalog", () => {
  assert.equal(testing.cleanPhrase("Phở"), "Pho");
  assert.equal(testing.cleanPhrase("  mul—naengmyeon  "), "mul naengmyeon");
});

test("updates an existing vocabulary and waits until it is ready", () => {
  const calls = [];
  let reads = 0;
  const result = syncVocabulary({
    name: "terms-v1",
    region: "us-east-2",
    wait: () => {},
    run(args) {
      calls.push(args);
      if (args[1] === "get-vocabulary") {
        reads += 1;
        return reads === 1 ? { status: 0, stdout: "{}" } : { status: 0, stdout: JSON.stringify({ VocabularyState: "READY" }) };
      }
      return { status: 0, stdout: "" };
    },
  });
  assert.equal(calls[1][1], "update-vocabulary");
  assert.equal(result.state, "READY");
});
