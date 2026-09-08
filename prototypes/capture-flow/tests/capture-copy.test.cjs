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

test("ships no owner-token setup or legacy service endpoint fallback", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const config = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
  assert.doesNotMatch(html, /owner-token|private service token|voice-setup|wim-(?:recipe|capture-assistance|transcribe-session)-endpoint/i);
  assert.doesNotMatch(app, /ownerToken|restoreOwnerToken|tokenRecord/i);
  assert.doesNotMatch(config, /wim-(?:recipe|capture-assistance|transcribe-session)-endpoint/i);
  assert.match(app, /Invitation sign-in is not configured\. The private archive remains locked\./);
});
