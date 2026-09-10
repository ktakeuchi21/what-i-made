const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("admin and privacy pages ship without private archive repositories", () => {
  const admin = fs.readFileSync(path.join(root, "admin/index.html"), "utf8");
  const adminScript = fs.readFileSync(path.join(root, "admin/admin.js"), "utf8");
  const privacy = fs.readFileSync(path.join(root, "privacy/index.html"), "utf8");
  assert.match(admin, /Owner analytics/);
  assert.match(admin, /\.\.\/auth-session\.js/);
  assert.doesNotMatch(admin, /archive-store|idea-store|archive-backup|demo-archive/);
  assert.doesNotMatch(adminScript, /setAttribute\("role", "listitem"\)/);
  assert.match(adminScript, /show\("dashboard"\); \$\("#sign-out"\)\.hidden = false; reportError\(errorValue\)/);
  assert.match(privacy, /They are not uploaded for analytics/);
});

test("activity code cannot submit archive content or another account key", () => {
  const client = fs.readFileSync(path.join(root, "activity-client.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.match(client, /publicEvents = batch\.events\.map/);
  assert.match(client, /event\.accountKey === accountKey/);
  assert.doesNotMatch(client, /dishName|country|rating|notes|ingredients|photo|recipe/i);
  assert.doesNotMatch(app.match(/function recordActivity[\s\S]*?\n  }/)?.[0] || "", /dish|photo|note|rating|country/i);
});

test("the consumer service worker leaves admin and privacy navigation uncached", () => {
  const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.match(worker, /pathname\.includes\("\/admin\/"\)/);
  assert.match(worker, /pathname\.includes\("\/privacy\/"\)/);
  assert.doesNotMatch(worker, /admin\/index|privacy\/index/);
});
