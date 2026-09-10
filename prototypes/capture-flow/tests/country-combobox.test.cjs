"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const geography = require("../assets/world-map-data.js");
const countries = require("../country-combobox.js");

test("Korea remains ambiguous while autocomplete offers both map countries", () => {
  assert.equal(geography.findCountry("Korea"), null);
  assert.deepEqual(countries.searchCountries(geography.countries, "Korea").map((country) => country.name), ["North Korea", "South Korea"]);
});

test("country search is punctuation-, case-, and diacritic-insensitive", () => {
  assert.equal(countries.searchCountries(geography.countries, "south kor")[0].key, "KOR");
  assert.equal(countries.searchCountries(geography.countries, "COTE D IVOIRE")[0].key, "CIV");
  assert.equal(countries.searchCountries(geography.countries, "korea rep")[0].key, "KOR");
});

test("country search is deterministic and bounded", () => {
  const first = countries.searchCountries(geography.countries, "united", 3);
  const second = countries.searchCountries(geography.countries, "united", 3);
  assert.deepEqual(first.map((country) => country.key), second.map((country) => country.key));
  assert.ok(first.length <= 3);
});

test("validation requires an explicit selection after typing", () => {
  assert.equal(countries.selectionStatus(geography, { value: "South Korea", selectedKey: "", userEdited: true }).valid, false);
  assert.equal(countries.selectionStatus(geography, { value: "J", selectedKey: "", userEdited: true }).valid, false);
  assert.equal(countries.selectionStatus(geography, { value: "South Korea", selectedKey: "KOR", userEdited: true }).country.key, "KOR");
});

test("an untouched unresolved historical value remains preservable only when configured", () => {
  const preserved = countries.selectionStatus(geography, { value: "Korea", userEdited: false, allowPristineUnresolved: true });
  assert.equal(preserved.valid, true);
  assert.equal(preserved.preserved, true);
  assert.equal(countries.selectionStatus(geography, { value: "Korea", userEdited: true, allowPristineUnresolved: true }).valid, false);
});
