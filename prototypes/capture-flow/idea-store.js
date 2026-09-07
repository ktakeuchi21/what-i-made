(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeIdeas = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  const TRACKING_KEYS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src"]);

  function createId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `idea-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanText(value, maximum = 20_000) {
    return String(value || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maximum);
  }

  function canonicalizeSourceUrl(value) {
    const input = cleanText(value, 2_048);
    if (!input) return null;
    let url;
    try { url = new URL(input); } catch { throw new Error("Enter a complete public HTTPS recipe link."); }
    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      throw new Error("Use a public HTTPS recipe link without credentials or a custom port.");
    }
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    [...url.searchParams.keys()].forEach((key) => {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_KEYS.has(key.toLowerCase())) url.searchParams.delete(key);
    });
    url.searchParams.sort();
    return url.toString();
  }

  function normalizeLines(value, maximumItems = 200) {
    const source = Array.isArray(value) ? value : cleanText(value).split("\n");
    return source.map((item) => cleanText(typeof item === "object" ? item.text || item.name : item, 2_000)).filter(Boolean).slice(0, maximumItems);
  }

  function normalizeIdea(input, now = new Date().toISOString(), ids = {}) {
    const title = cleanText(input.title, 200);
    if (!title) throw new Error("Add a recipe title.");
    const ingredients = normalizeLines(input.ingredients);
    const instructions = normalizeLines(input.instructions);
    if (!ingredients.length) throw new Error("Add at least one ingredient.");
    if (!instructions.length) throw new Error("Add at least one instruction.");
    const sourceUrl = cleanText(input.sourceUrl, 2_048) || null;
    const canonicalSourceUrl = sourceUrl ? canonicalizeSourceUrl(sourceUrl) : undefined;
    return {
      id: ids.ideaId || input.id || createId(),
      title,
      normalizedTitle: title.normalize("NFKC").toLocaleLowerCase(),
      description: cleanText(input.description, 2_000) || null,
      servings: cleanText(input.servings, 100) || null,
      prepTime: cleanText(input.prepTime, 100) || null,
      cookTime: cleanText(input.cookTime, 100) || null,
      ingredients,
      instructions,
      personalNotes: cleanText(input.personalNotes, 5_000) || null,
      sourceKind: ["url", "search", "generated", "manual"].includes(input.sourceKind) ? input.sourceKind : "manual",
      sourceUrl,
      canonicalSourceUrl,
      sourceName: cleanText(input.sourceName, 200) || null,
      sourceAuthor: cleanText(input.sourceAuthor, 200) || null,
      imageId: input.imageId || null,
      createdAt: input.createdAt || now,
      updatedAt: now,
      lastImportedAt: input.lastImportedAt || (sourceUrl ? now : null),
    };
  }

  function matchesIdea(idea, query) {
    const needle = cleanText(query, 200).toLocaleLowerCase();
    if (!needle) return true;
    return [idea.title, idea.sourceName, idea.sourceAuthor, ...(idea.ingredients || [])]
      .filter(Boolean).join("\n").toLocaleLowerCase().includes(needle);
  }

  function deriveIdeas(ideas, images, attempts, options = {}) {
    const madeIds = new Set(attempts.map((attempt) => attempt.sourceIdeaId).filter(Boolean));
    const imagesByIdea = new Map(images.map((image) => [image.ideaId, image]));
    const filter = options.filter || "all";
    return ideas.map((idea) => ({ ...idea, made: madeIds.has(idea.id), image: imagesByIdea.get(idea.id) || null }))
      .filter((idea) => matchesIdea(idea, options.query))
      .filter((idea) => filter === "all" || (filter === "made" ? idea.made : !idea.made))
      .sort((left, right) => `${right.createdAt}|${right.id}`.localeCompare(`${left.createdAt}|${left.id}`));
  }

  function archiveApi() {
    const archive = root.WhatIMadeArchive;
    if (!archive?.openDatabase) throw new Error("Local Ideas storage is unavailable.");
    return archive;
  }

  async function findBySourceUrl(value) {
    const canonical = canonicalizeSourceUrl(value);
    if (!canonical) return null;
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const transaction = database.transaction("ideas", "readonly");
    return archive.requestResult(transaction.objectStore("ideas").index("canonicalSourceUrl").get(canonical));
  }

  async function saveIdea(input, image = null) {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const now = new Date().toISOString();
    const ideaId = input.id || createId();
    const imageId = image?.blob instanceof Blob ? (input.imageId || createId()) : (input.imageId || null);
    const idea = normalizeIdea({ ...input, imageId }, now, { ideaId });
    const transaction = database.transaction(["ideas", "ideaImages"], "readwrite");
    const done = archive.transactionDone(transaction);
    transaction.objectStore("ideas").put(idea);
    if (image?.blob instanceof Blob) {
      transaction.objectStore("ideaImages").put({
        id: imageId,
        ideaId,
        displayBlob: image.blob,
        thumbnailBlob: image.thumbnailBlob || image.blob,
        mimeType: image.blob.type || "image/jpeg",
        width: image.width || null,
        height: image.height || null,
        thumbnailWidth: image.thumbnailWidth || image.width || null,
        thumbnailHeight: image.thumbnailHeight || image.height || null,
        byteLength: image.blob.size,
        alt: cleanText(image.alt, 300) || idea.title,
        createdAt: now,
      });
    }
    await done;
    return ideaId;
  }

  async function listIdeas(options = {}) {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const transaction = database.transaction(["ideas", "ideaImages", "attempts"], "readonly");
    const [ideas, images, attempts] = await Promise.all([
      archive.requestResult(transaction.objectStore("ideas").getAll()),
      archive.requestResult(transaction.objectStore("ideaImages").getAll()),
      archive.requestResult(transaction.objectStore("attempts").getAll()),
    ]);
    return deriveIdeas(ideas, images, attempts, options);
  }

  async function getIdea(id) {
    const all = await listIdeas();
    return all.find((idea) => idea.id === id) || null;
  }

  async function deleteIdea(id) {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const transaction = database.transaction(["ideas", "ideaImages", "attempts"], "readwrite");
    const done = archive.transactionDone(transaction);
    transaction.objectStore("ideas").delete(id);
    const imageIndex = transaction.objectStore("ideaImages").index("ideaId");
    const image = await archive.requestResult(imageIndex.get(id));
    if (image) transaction.objectStore("ideaImages").delete(image.id);
    const request = transaction.objectStore("attempts").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.sourceIdeaId === id) cursor.update({ ...cursor.value, sourceIdeaId: null });
      cursor.continue();
    };
    await done;
  }

  async function saveDraft(value) {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const transaction = database.transaction("ideaDrafts", "readwrite");
    const done = archive.transactionDone(transaction);
    transaction.objectStore("ideaDrafts").put({ id: "active", ...value, updatedAt: new Date().toISOString() });
    await done;
  }

  async function getDraft() {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    return archive.requestResult(database.transaction("ideaDrafts", "readonly").objectStore("ideaDrafts").get("active"));
  }

  async function clearDraft() {
    const archive = archiveApi();
    const database = await archive.openDatabase();
    const transaction = database.transaction("ideaDrafts", "readwrite");
    const done = archive.transactionDone(transaction);
    transaction.objectStore("ideaDrafts").delete("active");
    await done;
  }

  return { cleanText, canonicalizeSourceUrl, normalizeLines, normalizeIdea, matchesIdea, deriveIdeas, findBySourceUrl, saveIdea, listIdeas, getIdea, deleteIdea, saveDraft, getDraft, clearDraft };
});
