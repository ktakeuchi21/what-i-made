const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("omits the removed capture audio disclosure paragraphs", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  assert.doesNotMatch(html, /While recording, audio streams to Amazon Transcribe/i);
  assert.doesNotMatch(html, /Cooks and photographs are saved only on this device\. Voice audio streams only while recording\./i);
  assert.doesNotMatch(html, /class="voice-privacy"/);
  assert.doesNotMatch(html, /class="prototype-disclaimer"/);
  assert.doesNotMatch(css, /\.voice-privacy|\.prototype-disclaimer/);
});
