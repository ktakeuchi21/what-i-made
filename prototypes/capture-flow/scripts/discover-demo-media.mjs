#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const searches = Object.freeze({
  noodles: "mul naengmyeon food",
  adobo: "chicken adobo food",
  jollof: "jollof rice food",
  shakshuka: "shakshuka food",
  dumplings: "gyoza dumplings food",
  chana: "chana masala food",
  tacos: "fish tacos food",
  pasta: "tagliatelle tomato food",
  poutine: "poutine food",
  "shepherds-pie": "shepherd's pie food",
  moqueca: "moqueca food",
  pavlova: "pavlova dessert food",
  lamington: "lamington cake food",
  "jerk-chicken": "Jamaican jerk chicken food",
  plov: "Uzbek plov food",
  gumbo: "chicken sausage gumbo food",
  arepas: "arepas food",
  ratatouille: "ratatouille food",
  spanakopita: "spanakopita food",
  pierogi: "pierogi food",
  tagine: "Moroccan tagine food",
  mujadara: "mujadara food",
  egusi: "egusi soup food",
  dosa: "masala dosa food",
  oyakodon: "oyakodon food",
  "curry-rice": "Japanese curry rice food",
  "khao-soi": "khao soi food",
  "pad-kra-pao": "pad kra pao food",
  "pantry-soup": "vegetable soup food",
});

const allowedLicenses = /^(?:CC0|CC BY(?:-SA)? [234]\.0|Public domain)$/i;

function plain(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url, label) {
  let response;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    response = await fetch(url, { headers: { "User-Agent": "WhatIMadeDemoMedia/1.0 (https://main.dk27yiqjy46kx.amplifyapp.com; non-commercial prototype)" } });
    if (response.ok || response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  if (!response?.ok) throw new Error(`Commons request failed (${response?.status}) for ${label}`);
  return response.json();
}

async function titlesFor(query) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query",
    list: "search",
    srnamespace: "6",
    srlimit: "6",
    srsearch: query,
    format: "json",
    origin: "*",
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson(url, query);
  return (payload.query?.search || []).map((entry) => entry.title);
}

async function metadataFor(titles) {
  const pages = [];
  for (let start = 0; start < titles.length; start += 40) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    Object.entries({
      action: "query",
      titles: titles.slice(start, start + 40).join("|"),
      prop: "imageinfo",
      iiprop: "url|mime|size|extmetadata",
      iiurlwidth: "900",
      format: "json",
      origin: "*",
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    const payload = await fetchJson(url, `metadata batch ${start / 40 + 1}`);
    pages.push(...Object.values(payload.query?.pages || {}));
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return new Map(pages.map((page) => {
      const info = page.imageinfo?.[0] || {};
      const metadata = info.extmetadata || {};
      return [page.title, {
        title: page.title,
        width: info.width,
        height: info.height,
        mime: info.mime,
        thumbnailUrl: info.thumburl,
        sourcePage: info.descriptionurl,
        creator: plain(metadata.Artist?.value),
        license: plain(metadata.LicenseShortName?.value),
        licenseUrl: metadata.LicenseUrl?.value || "",
        description: plain(metadata.ImageDescription?.value),
      }];
    }));
}

const result = {};
const titlesByKey = {};
for (const [key, query] of Object.entries(searches)) {
  titlesByKey[key] = await titlesFor(query);
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const metadata = await metadataFor([...new Set(Object.values(titlesByKey).flat())]);
for (const [key, titles] of Object.entries(titlesByKey)) {
  result[key] = titles.map((title) => metadata.get(title)).filter((candidate) =>
    candidate?.mime?.startsWith("image/") && allowedLicenses.test(candidate.license));
}
const output = process.argv[2];
if (output) {
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${output}\n`);
} else {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
