const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const demo = require("../demo-archive.js");
const regions = require("../assets/culinary-regions.js");
const manifestPath = path.join(__dirname, "..", "assets", "demo", "demo-content.json");

function manifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

test("validates the complete fictional sample and all regional references", () => {
  const source = demo.validateManifest(manifest());
  const countries = new Set(source.dishes.map((dish) => dish.countryCode).filter(Boolean));
  const representedRegions = new Set([...countries].map((key) => regions.findRegionByCountryKey(key)?.id));
  assert.equal(source.occasions.length, 36);
  assert.equal(source.occasions.flatMap((occasion) => occasion.dishes).length, 40);
  assert.equal(source.dishes.length, 28);
  assert.equal(source.ideas.length, 8);
  assert.equal(countries.size, 22);
  assert.equal(representedRegions.size, 13);
  assert.equal(source.fictional, true);
});

test("builds a previous-year, read-only repository with stable linked records", async () => {
  const repository = demo.createRepository(manifest(), { now: new Date("2026-09-09T12:00:00Z") });
  const [occasions, attempts, ideas] = await Promise.all([
    repository.listOccasions(), repository.listDishAttempts(), repository.listIdeas(),
  ]);
  assert.equal(repository.year, 2025);
  assert.equal(occasions.length, 36);
  assert.equal(attempts.length, 40);
  assert.equal(occasions.flatMap((occasion) => occasion.photos).length, 40);
  assert.equal(ideas.filter((idea) => idea.made).length, 2);
  assert.ok(occasions.every((occasion) => occasion.id.startsWith("demo-occasion-") && occasion.cookedAt.startsWith("2025-")));
  assert.deepEqual(await repository.getOccasion("demo-occasion-001"), occasions.find((occasion) => occasion.id === "demo-occasion-001"));
  const attempt = attempts.find((candidate) => candidate.occasionId === "demo-occasion-001");
  assert.deepEqual(await repository.getCook(attempt.id), attempt);
  assert.equal(typeof repository.saveCook, "undefined");
  assert.equal(typeof repository.openDatabase, "undefined");
});

test("filters Ideas locally and preserves Made linkage", async () => {
  const repository = demo.createRepository(manifest(), { year: 2025 });
  const made = await repository.listIdeas({ filter: "made" });
  const unmade = await repository.listIdeas({ filter: "unmade" });
  const searched = await repository.listIdeas({ query: "buckwheat" });
  assert.equal(made.length, 2);
  assert.equal(unmade.length, 6);
  assert.deepEqual(searched.map((idea) => idea.id), ["demo-idea-002"]);
});

test("demo mode fails closed instead of resolving a private repository", () => {
  const privateRepository = { kind: "private" };
  const sampleRepository = { kind: "sample" };
  assert.equal(demo.repositoryForMode("account", null, privateRepository), privateRepository);
  assert.equal(demo.repositoryForMode("demo", sampleRepository, privateRepository), sampleRepository);
  assert.throws(() => demo.repositoryForMode("demo", null, privateRepository), /sample archive is unavailable/i);
});

test("rejects bad references, country drift, dates, and escaping asset paths", () => {
  const missingDish = manifest();
  missingDish.occasions[0].dishes[0] = "not-real";
  assert.throws(() => demo.validateManifest(missingDish), /missing dish/);

  const countryDrift = manifest();
  countryDrift.dishes[0].countryCode = "CAN";
  assert.throws(() => demo.validateManifest(countryDrift), /country does not match/);

  const badDate = manifest();
  badDate.occasions[0].month = 13;
  assert.throws(() => demo.validateManifest(badDate), /invalid month/);

  const impossibleDate = manifest();
  impossibleDate.occasions[0].month = 2;
  impossibleDate.occasions[0].day = 31;
  assert.throws(() => demo.validateManifest(impossibleDate), /invalid calendar date/);

  const escapedAsset = manifest();
  escapedAsset.media.noodles.thumbnail = "../private/photo.webp";
  assert.throws(() => demo.validateManifest(escapedAsset), /stay inside assets\/demo/);
});

test("every manifest media reference exists and remains inside its file budget", () => {
  const source = manifest();
  let total = 0;
  Object.values(source.media).forEach((media) => {
    [[media.thumbnail, 50 * 1024], [media.display, 250 * 1024]].forEach(([relative, limit]) => {
      const file = path.join(__dirname, "..", relative.replace(/^\.\//, ""));
      const size = fs.statSync(file).size;
      assert.ok(size <= limit, `${relative} is ${size} bytes`);
      total += size;
    });
  });
  assert.ok(total <= demo.MAX_MEDIA_BYTES);
});
