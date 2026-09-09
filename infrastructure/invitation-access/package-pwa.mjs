#!/usr/bin/env node

import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STATIC_FILES = Object.freeze([
  "index.html",
  "styles.css",
  "config.js",
  "transcribe-codec.js",
  "transcribe-adapter.js",
  "capture-parser.js",
  "capture-assistance.js",
  "dish-matcher.js",
  "capture-draft.js",
  "photo-url.js",
  "photo-processor.js",
  "map-geometry.js",
  "account-context.js",
  "auth-session.js",
  "archive-store.js",
  "idea-store.js",
  "archive-backup.js",
  "legacy-migration.js",
  "recipe-client.js",
  "dashboard-model.js",
  "journal-model.js",
  "audio-worklet.js",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "assets/world-map-data.js",
  "assets/culinary-regions.js",
  "assets/app-icon-192.png",
  "assets/app-icon-512.png",
  "assets/apple-touch-icon.png",
  "assets/favicon-32.png",
  "assets/sample-oyakodon.jpg",
]);

function parseArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${key || "argument"}.`);
    result[key.slice(2)] = value;
  }
  return result;
}

function exactHttpsOrigin(value, label) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${label} must be an HTTPS origin.`); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${label} must be an HTTPS origin without credentials, path, query, or fragment.`);
  }
  return parsed.origin;
}

function replaceMeta(html, name, value) {
  const pattern = new RegExp(`(<meta\\s+name=["']${name}["']\\s+content=["'])[^"']*(["']\\s*/?>)`, "i");
  if (!pattern.test(html)) throw new Error(`Source index is missing ${name}.`);
  return html.replace(pattern, `$1${value}$2`);
}

function contentSecurityPolicy({ authDomain, apiBaseUrl, awsRegion }) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' blob: data:",
    `connect-src 'self' ${authDomain} ${apiBaseUrl} wss://transcribestreaming.${awsRegion}.amazonaws.com:8443`,
    "font-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ].join("; ");
}

function amplifyHeaders(csp) {
  return `customHeaders:
  - pattern: '**/*'
    headers:
      - key: 'Strict-Transport-Security'
        value: 'max-age=31536000; includeSubDomains'
      - key: 'Content-Security-Policy'
        value: "${csp}; frame-ancestors 'none'"
      - key: 'X-Content-Type-Options'
        value: 'nosniff'
      - key: 'X-Frame-Options'
        value: 'DENY'
      - key: 'Referrer-Policy'
        value: 'no-referrer'
      - key: 'Permissions-Policy'
        value: 'camera=(self), microphone=(self), geolocation=()'
`;
}

function injectConfiguration(html, configuration) {
  let result = html;
  result = replaceMeta(result, "wim-auth-domain", configuration.authDomain);
  result = replaceMeta(result, "wim-auth-client-id", configuration.clientId);
  result = replaceMeta(result, "wim-service-api-endpoint", configuration.apiBaseUrl);
  result = replaceMeta(result, "wim-aws-region", configuration.awsRegion);
  result = replaceMeta(result, "wim-legacy-owner-archive-key", configuration.legacyOwnerArchiveKey);
  const csp = contentSecurityPolicy(configuration);
  const marker = '<meta name="color-scheme" content="light dark" />';
  if (!result.includes(marker)) throw new Error("Source index is missing the CSP insertion marker.");
  return result.replace(marker, `${marker}\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
}

function validateConfiguration(argumentsMap) {
  const clientId = argumentsMap["client-id"] || "";
  const awsRegion = argumentsMap["aws-region"] || "";
  const legacyOwnerArchiveKey = (argumentsMap["legacy-owner-archive-key"] || "").toLowerCase();
  if (!/^[A-Za-z0-9]{8,128}$/.test(clientId)) throw new Error("Client ID must be 8–128 ASCII letters or digits.");
  if (!/^[a-z]{2}-[a-z]+-\d$/.test(awsRegion)) throw new Error("AWS region is invalid.");
  if (legacyOwnerArchiveKey && !/^[a-f0-9]{64}$/.test(legacyOwnerArchiveKey)) throw new Error("Legacy owner archive key must be an empty value or 64 lowercase hexadecimal characters.");
  const authDomain = exactHttpsOrigin(argumentsMap["auth-domain"] || "", "Auth domain");
  const apiBaseUrl = exactHttpsOrigin(argumentsMap["api-base-url"] || "", "API base URL");
  const authHost = new URL(authDomain).hostname;
  const apiHost = new URL(apiBaseUrl).hostname;
  if (!new RegExp(`^[a-z0-9-]+\\.auth\\.${awsRegion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.amazoncognito\\.com$`).test(authHost)) {
    throw new Error("Auth domain must be the regional Cognito domain emitted by this stack.");
  }
  if (!new RegExp(`^[a-z0-9]+\\.execute-api\\.${awsRegion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.amazonaws\\.com$`).test(apiHost)) {
    throw new Error("API base URL must be the regional API Gateway origin emitted by this stack.");
  }
  return {
    authDomain,
    apiBaseUrl,
    clientId,
    awsRegion,
    legacyOwnerArchiveKey,
  };
}

async function assertSourceFiles(source) {
  for (const relativePath of STATIC_FILES) {
    const information = await stat(join(source, relativePath));
    if (!information.isFile()) throw new Error(`Static source is not a file: ${relativePath}`);
  }
}

async function copyStaticFiles(source, destination) {
  for (const relativePath of STATIC_FILES) {
    const target = join(destination, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(source, relativePath), target);
  }
}

async function packagePwa(values = process.argv.slice(2)) {
  const argumentsMap = parseArguments(values);
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const source = resolve(argumentsMap.source || join(scriptDirectory, "../../prototypes/capture-flow"));
  const outputValue = argumentsMap.output;
  if (!outputValue) throw new Error("--output is required.");
  const output = resolve(outputValue);
  const configuration = validateConfiguration(argumentsMap);
  await assertSourceFiles(source);
  try {
    await stat(output);
    throw new Error("Output path already exists; choose a new destination.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const staging = join(dirname(output), `.${basename(output)}.tmp-${process.pid}`);
  try {
    await mkdir(staging);
    await copyStaticFiles(source, staging);
    const sourceHtml = await readFile(join(staging, "index.html"), "utf8");
    const configuredHtml = injectConfiguration(sourceHtml, configuration);
    await writeFile(join(staging, "index.html"), configuredHtml, "utf8");
    await writeFile(join(staging, "customHttp.yml"), amplifyHeaders(contentSecurityPolicy(configuration)), "utf8");
    await rename(staging, output);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  process.stdout.write(`${output}\n`);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packagePwa().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

export { STATIC_FILES, amplifyHeaders, contentSecurityPolicy, injectConfiguration, packagePwa, parseArguments, validateConfiguration };
