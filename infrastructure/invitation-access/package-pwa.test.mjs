import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { DEMO_MEDIA_BUDGET, STATIC_FILES, demoMediaFiles, inspectWebp, packagePwa, validateConfiguration } from "./package-pwa.mjs";

const configuration = [
  "--auth-domain", "https://what-i-made.auth.us-east-2.amazoncognito.com",
  "--client-id", "12345678abcdefgh",
  "--api-base-url", "https://abc123.execute-api.us-east-2.amazonaws.com",
  "--aws-region", "us-east-2",
];

test("packages only allowlisted runtime files with public invitation configuration and CSP", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "wim-package-"));
  const output = join(temporaryRoot, "site");
  try {
    await packagePwa(["--output", output, ...configuration, "--legacy-owner-archive-key", "a".repeat(64)]);
    const html = await readFile(join(output, "index.html"), "utf8");
    const adminHtml = await readFile(join(output, "admin/index.html"), "utf8");
    assert.match(html, /wim-auth-domain" content="https:\/\/what-i-made\.auth\.us-east-2\.amazoncognito\.com"/);
    assert.match(html, /wim-auth-client-id" content="12345678abcdefgh"/);
    assert.match(html, /wim-service-api-endpoint" content="https:\/\/abc123\.execute-api\.us-east-2\.amazonaws\.com"/);
    assert.match(html, /wim-legacy-owner-archive-key" content="a{64}"/);
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.match(adminHtml, /wim-auth-domain" content="https:\/\/what-i-made\.auth\.us-east-2\.amazoncognito\.com"/);
    assert.match(adminHtml, /wim-service-api-endpoint" content="https:\/\/abc123\.execute-api\.us-east-2\.amazonaws\.com"/);
    assert.match(adminHtml, /http-equiv="Content-Security-Policy"/);
    assert.match(html, /meta name="referrer" content="no-referrer"/);
    assert.match(html, /connect-src 'self' https:\/\/what-i-made\.auth\.us-east-2\.amazoncognito\.com https:\/\/abc123\.execute-api\.us-east-2\.amazonaws\.com wss:\/\/transcribestreaming\.us-east-2\.amazonaws\.com:8443/);
    assert.deepEqual((await readdir(output)).sort(), [...new Set([...STATIC_FILES.map((path) => path.split("/")[0]), "customHttp.yml"])].sort());
    const headers = await readFile(join(output, "customHttp.yml"), "utf8");
    assert.match(headers, /Content-Security-Policy/);
    assert.match(headers, /frame-ancestors 'none'/);
    assert.match(headers, /Referrer-Policy'[\s\S]*value: 'no-referrer'/);
    assert.match(headers, /Permissions-Policy'[\s\S]*camera=\(self\), microphone=\(self\), geolocation=\(\)/);
    assert.equal((await readdir(join(output, "assets"))).includes("app-icon-master.png"), false);
    const demoFiles = await demoMediaFiles(join(process.cwd(), "prototypes/capture-flow"));
    const demoManifest = JSON.parse(await readFile(join(process.cwd(), "prototypes/capture-flow/assets/demo/demo-content.json"), "utf8"));
    assert.equal(demoFiles.length, Object.keys(demoManifest.media).length * 2);
    assert.ok((await Promise.all(demoFiles.map((relative) => stat(join(output, relative))))).every((entry) => entry.isFile()));
    assert.equal(DEMO_MEDIA_BUDGET, 12 * 1024 * 1024);
    assert.equal((await readdir(output)).includes("tests"), false);
    assert.equal((await readdir(output)).includes("TEST_REPORT.md"), false);
    assert.ok((await stat(join(output, "privacy/index.html"))).isFile());
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("rejects unsafe public configuration and existing output without modifying it", async () => {
  assert.throws(() => validateConfiguration(Object.fromEntries([
    ["auth-domain", "https://user:secret@example.com"],
    ["client-id", "12345678"],
    ["api-base-url", "https://api.example.com"],
    ["aws-region", "us-east-2"],
  ])), /Auth domain/);
  assert.throws(() => validateConfiguration(Object.fromEntries([
    ["auth-domain", "https://what-i-made.auth.us-east-2.amazoncognito.com"],
    ["client-id", "12345678"],
    ["api-base-url", "https://api.example.com/path"],
    ["aws-region", "us-east-2"],
  ])), /API base URL/);
  assert.throws(() => validateConfiguration(Object.fromEntries([
    ["auth-domain", "https://what-i-made.auth.us-east-2.amazoncognito.com"],
    ["client-id", "12345678"],
    ["api-base-url", "https://abc123.execute-api.us-east-2.amazonaws.com"],
    ["aws-region", "not-a-region"],
  ])), /AWS region/);
  assert.throws(() => validateConfiguration(Object.fromEntries([
    ["auth-domain", "https://attacker.example"],
    ["client-id", "12345678"],
    ["api-base-url", "https://abc123.execute-api.us-east-2.amazonaws.com"],
    ["aws-region", "us-east-2"],
  ])), /regional Cognito domain/);
  assert.throws(() => validateConfiguration(Object.fromEntries([
    ["auth-domain", "https://what-i-made.auth.us-east-2.amazoncognito.com"],
    ["client-id", "12345678"],
    ["api-base-url", "https://attacker.example"],
    ["aws-region", "us-east-2"],
  ])), /regional API Gateway origin/);
  assert.throws(() => validateConfiguration(Object.fromEntries([
    ["auth-domain", "https://what-i-made.auth.us-west-2.amazoncognito.com"],
    ["client-id", "12345678"],
    ["api-base-url", "https://abc123.execute-api.us-east-2.amazonaws.com"],
    ["aws-region", "us-east-2"],
  ])), /regional Cognito domain/);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "wim-package-existing-"));
  const output = join(temporaryRoot, "site");
  try {
    await writeFile(output, "keep", "utf8");
    await assert.rejects(() => packagePwa(["--output", output, ...configuration]), /already exists/);
    assert.equal(await readFile(output, "utf8"), "keep");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("inspects WebP dimensions and rejects renamed or metadata-bearing media", async () => {
  const source = join(process.cwd(), "prototypes/capture-flow/assets/demo/thumb/noodles.webp");
  const clean = await readFile(source);
  assert.deepEqual(inspectWebp(clean), { width: 320, height: 240 });
  assert.throws(() => inspectWebp(Buffer.from("not really a webp")), /valid WebP/);
  const withExif = Buffer.concat([clean, Buffer.from("EXIF"), Buffer.alloc(4)]);
  withExif.writeUInt32LE(withExif.length - 8, 4);
  assert.throws(() => inspectWebp(withExif), /must not contain metadata/);
});
