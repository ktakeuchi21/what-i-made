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
  assert.match(worker, /what-i-made-capture-v56/);
  assert.match(worker, /\.\/app\.js\?v=56/);
  assert.match(worker, /\.\/auth-session\.js\?v=51/);
  assert.match(worker, /\.\/activity-client\.js\?v=51/);
  assert.match(worker, /\.\/capture-draft\.js\?v=17/);
  assert.match(worker, /\.\/styles\.css\?v=56/);
  assert.match(html, /\.\/app\.js\?v=56/);
  assert.match(html, /\.\/auth-session\.js\?v=51/);
  assert.match(html, /\.\/activity-client\.js\?v=51/);
  assert.match(html, /\.\/capture-draft\.js\?v=17/);
  assert.match(html, /\.\/styles\.css\?v=56/);
  assert.match(app, /\.\/sw\.js\?v=56/);
  assert.match(worker, /requestUrl\.pathname\.includes\("\/admin\/"\)/);
  assert.match(html, /id="entry-photo-credit"/);
  assert.match(html, /id="idea-photo-credit"/);
  assert.match(html, /id="photo-dialog-credit"/);
  assert.match(app, /source\.textContent = attribution\.sourceTitle/);
  assert.match(app, /renderPhotoCredit\(\$\("#photo-dialog-credit"\), photo\.attribution\)/);
  assert.match(app, /licenseGroup\.append\(license, " · cropped"\)/);
});

test("new cook capture exposes and validates an explicit historical date", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const worker = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");

  assert.match(html, /id="capture-date"[\s\S]*type="date"[\s\S]*min="2026-01-01"/);
  assert.match(html, /back to January 1, 2026/);
  assert.match(html, /id="confirm-date"[\s\S]*min="2026-01-01"[\s\S]*id="confirm-date-error"/);
  assert.match(app, /captureDate\.value = currentDateValue\(\)/);
  assert.match(app, /confirmDate\.value = captureDate\.value \|\| currentDateValue\(\)/);
  assert.match(app, /validateNewCookDateControl\(captureDate, captureDateError\)/);
  assert.match(app, /validateNewCookDateControl\(confirmDate, confirmDateError\)/);
  assert.match(worker, /\.\/archive-store\.js\?v=32/);
  assert.match(html, /\.\/archive-store\.js\?v=32/);
});

test("new cook capture exposes a map-safe optional country before review", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  assert.match(html, /for="capture-country">Country <span>Optional<\/span>/);
  assert.match(html, /id="capture-country"[^>]*aria-describedby="capture-country-helper"/);
  assert.match(html, /Select a country to place this dish on your culinary map/);
  assert.match(html, /id="capture-country-provenance"[^>]*hidden/);
  assert.match(html, /id="capture-country-suggestion"[^>]*hidden/);
  assert.match(app, /setupCountryPicker\(captureCountry\)/);
  assert.match(app, /validateCountryInput\(captureCountry\)/);
  assert.match(app, /captureCountry\.value\.trim\(\) \|\| \(countryWasEdited \|\| failed \? "" : state\.suggestedCountry \|\| inferredCountry\)/);
  assert.match(app, /setCountryValue\(captureCountry, reviewCountry\)/);
  assert.match(app, /state\.touchedFields\.has\("country"\)/);

  const postParseConflictChecks = app.match(/if \(state\.touchedFields\.has\("country"\)\) suppressPrimaryRecognitionForCountry\(captureCountry\.value\);/g) || [];
  assert.equal(postParseConflictChecks.length, 2, "local and server parsing must both respect a manual country");

  const reviewSuggestionHandler = app.slice(
    app.indexOf('$("#country-suggestion-action").addEventListener'),
    app.indexOf('[$("#confirm-dish"), $("#confirm-country")]', app.indexOf('$("#country-suggestion-action").addEventListener')),
  );
  assert.match(reviewSuggestionHandler, /markCountryEdited\(\)/);
  assert.ok(reviewSuggestionHandler.indexOf("markCountryEdited()") < reviewSuggestionHandler.indexOf("suppressPrimaryRecognitionForCountry"));
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

test("sample archive ships a product-led tour of current features", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

  assert.match(html, /What I Made — Private cooking journal/);
  assert.match(html, /See what a year of cooking can become/);
  assert.match(html, /Fictional · Read only/);
  assert.deepEqual([...html.matchAll(/data-demo-destination="([^"]+)"/g)].map((match) => match[1]), ["map", "journal", "recap", "ideas"]);
  assert.match(html, /Density, peaks &amp; regions/);
  assert.match(html, /Search, filter &amp; revisit/);
  assert.match(html, /Every cook, month by month/);
  assert.match(html, /Recipes saved for later/);
  assert.match(app, /function openDemoDestination\(destination\)/);
  assert.match(app, /welcomePhotos\.forEach/);
  assert.match(css, /\.prototype-panel \{[\s\S]*?display: none;/);
  assert.match(css, /\.show-prototype-panel \.prototype-panel \{[\s\S]*?display: block;/);
  assert.match(css, /\.demo-tour-card \{[\s\S]*?min-height: 62px;/);
});

test("account access and secure sign-out are reachable throughout the private archive", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

  assert.equal((html.match(/data-open-account/g) || []).length, 6);
  assert.match(html, /id="account-dialog"[\s\S]*aria-labelledby="account-dialog-title"/);
  assert.match(html, /Signing out hides this private archive on this device/);
  assert.match(html, />Sign out on this device</);
  assert.match(html, /invited email address[\s\S]*one-time code/i);
  assert.match(app, /\$\$\('\[data-open-account\]'\).*openAccountDialog/);
  assert.match(app, /accountDialog\.addEventListener\("keydown"[\s\S]*trapModalFocus/);
  assert.match(app, /await archive\.closeDatabase\(\);[\s\S]*clearPrivateArchiveView\(\);[\s\S]*finishSignOutCleanup\(\)/);
  assert.match(app, /showSignedOut\("signedOut"\)/);
  assert.match(css, /\.account-dialog > div/);
  assert.doesNotMatch(html, /id="account-section"/);
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
