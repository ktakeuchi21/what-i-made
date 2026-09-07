"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const geography = require("../assets/world-map-data.js");

test("bundles complete Natural Earth country geometry within the map budget", () => {
  assert.ok(geography.countries.length >= 175);
  assert.ok(geography.countries.every((country) => country.path.startsWith("M") && country.path.endsWith("Z")));
  assert.ok(geography.countries.every((country) => country.point.every((value) => value >= 0 && value <= 100)));
  const assetSize = fs.statSync(path.join(__dirname, "../assets/world-map-data.js")).size;
  assert.ok(assetSize < 250_000, `map asset was ${assetSize} bytes`);
});

test("resolves common names, aliases, and a country outside the old lookup table", () => {
  assert.equal(geography.findCountry("United States").key, "USA");
  assert.equal(geography.findCountry("U.S.A.").key, "USA");
  assert.equal(geography.findCountry("South Korea").key, "KOR");
  assert.equal(geography.findCountry("Côte d’Ivoire").key, "CIV");
  assert.equal(geography.findCountry("Norway").key, "NOR");
  assert.equal(geography.findCountry("Atlantis"), null);
});

test("gives every exact country name precedence over dependency aliases", () => {
  geography.countries.forEach((country) => {
    assert.equal(
      geography.findCountry(country.name)?.key,
      country.key,
      `${country.name} resolved to its own Natural Earth feature`,
    );
  });
  assert.equal(geography.findCountry("France").key, "FRA");
  assert.equal(geography.findCountry("Denmark").key, "DNK");
  assert.equal(geography.findCountry("Israel").key, "ISR");
});
