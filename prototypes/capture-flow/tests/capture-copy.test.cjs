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

test("service worker caches OAuth navigations only under the canonical shell URL", () => {
  const worker = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const navigationBranch = worker.slice(worker.indexOf('if (event.request.mode === "navigate")'), worker.indexOf("event.respondWith(\n    fetch(event.request)", worker.indexOf('if (event.request.mode === "navigate")') + 1));
  assert.match(navigationBranch, /new Response\(await response\.clone\(\)\.arrayBuffer\(\)/);
  assert.match(navigationBranch, /cache\.put\("\.\/index\.html", canonicalResponse\)/);
  assert.doesNotMatch(navigationBranch, /cache\.put\(event\.request/);
  assert.doesNotMatch(navigationBranch, /cache\.put\("\.\/index\.html", (?:copy|response\.clone\(\))\)/);
});
