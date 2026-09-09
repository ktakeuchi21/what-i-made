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
  assert.match(app, /Invitation sign-in is not configured here\. The public sample is still available\./);
});

test("service worker caches OAuth navigations only under the canonical shell URL", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const worker = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const navigationBranch = worker.slice(worker.indexOf('if (event.request.mode === "navigate")'), worker.indexOf("event.respondWith(\n    fetch(event.request)", worker.indexOf('if (event.request.mode === "navigate")') + 1));
  assert.match(navigationBranch, /new Response\(await response\.clone\(\)\.arrayBuffer\(\)/);
  assert.match(navigationBranch, /cache\.put\("\.\/index\.html", canonicalResponse\)/);
  assert.doesNotMatch(navigationBranch, /cache\.put\(event\.request/);
  assert.doesNotMatch(navigationBranch, /cache\.put\("\.\/index\.html", (?:copy|response\.clone\(\))\)/);
  assert.match(worker, /what-i-made-capture-v47/);
  assert.match(worker, /\.\/app\.js\?v=47/);
  assert.match(worker, /\.\/styles\.css\?v=47/);
  assert.match(html, /\.\/app\.js\?v=47/);
  assert.match(html, /\.\/styles\.css\?v=47/);
  assert.match(app, /\.\/sw\.js\?v=47/);
  assert.match(html, /id="entry-photo-credit"/);
  assert.match(html, /id="idea-photo-credit"/);
  assert.match(html, /id="photo-dialog-credit"/);
  assert.match(app, /source\.textContent = attribution\.sourceTitle/);
  assert.match(app, /renderPhotoCredit\(\$\("#photo-dialog-credit"\), photo\.attribution\)/);
  assert.match(app, /licenseGroup\.append\(license, " · cropped"\)/);
});

test("ships country-level Cook Density and Culinary Peaks map views", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  assert.match(html, />Cook Density</);
  assert.match(html, />Culinary Peaks</);
  assert.match(app, /`Cooks in \$\{state\.dashboardModel\?\.year/);
  assert.match(html, /3–4/);
  assert.doesNotMatch(html, />Photo Density|>Needle Field/);
  assert.match(app, /countryActivityModel/);
  assert.match(app, /Warmer, stronger country color shows where you cooked more/);
  assert.match(app, /Peak height and warmer color show where you cooked more/);
  assert.match(app, /clearMapShelfObjectUrls\(\);[\s\S]*countryShelf\.replaceChildren\(\)/);
  assert.match(css, /data-level="world"\]\[data-map-mode="peaks"\][\s\S]*--map-peak-shift: 12%/);
});

test("signed-out discovery and demo safety copy ship together", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const worker = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  assert.match(html, />Explore a sample archive</);
  assert.match(html, /Ready to start your own archive\?/);
  assert.match(html, /Sample content will never enter your private archive/);
  assert.match(app, /state\.mode === "demo"/);
  assert.match(app, /activeArchiveRepository\(\)/);
  assert.match(app, /url\.searchParams\.set\("demo", "1"\)/);
  assert.match(app, /url\.searchParams\.delete\("demo"\)/);
  assert.doesNotMatch(worker, /assets\/demo\/(?:demo-content|display|thumb)/);
  assert.doesNotMatch(worker, /sample-oyakodon\.jpg/);
});

test("owner migration backup falls back to download when native sharing fails", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const start = app.indexOf("async function backupLegacyArchive()");
  const end = app.indexOf("async function moveLegacyArchive()", start);
  const migrationBackup = app.slice(start, end);

  assert.match(migrationBackup, /await navigator\.share/);
  assert.match(migrationBackup, /if \(error\?\.name === "AbortError"\) throw error;/);
  assert.match(migrationBackup, /catch \(error\)[\s\S]*downloadBackupBlob\(blob, fileName\);/);
});
