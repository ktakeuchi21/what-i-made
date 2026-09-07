"use strict";

const { parseHttpsUrl } = require("./url-security");

const LIMITS = { title: 200, description: 1000, author: 200, item: 1000, sourceName: 200 };

function decodeEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', nbsp: " " };
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? match;
    const radix = entity[1].toLowerCase() === "x" ? 16 : 10;
    const point = Number.parseInt(entity.slice(radix === 16 ? 2 : 1), radix);
    return Number.isInteger(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : "";
  });
}

function plainText(value, maximum = 1000) {
  if (value === undefined || value === null) return "";
  return decodeEntities(String(value)).replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ").trim().slice(0, maximum);
}

function typesOf(node) {
  return (Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).map((type) => String(type).toLowerCase());
}

function findRecipes(node, found = []) {
  if (!node || typeof node !== "object") return found;
  if (typesOf(node).includes("recipe")) found.push(node);
  if (Array.isArray(node)) node.forEach((item) => findRecipes(item, found));
  else if (Array.isArray(node["@graph"])) findRecipes(node["@graph"], found);
  return found;
}

function extractJsonLd(html) {
  const documents = [];
  const pattern = /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json(?:;[^"']*)?["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      documents.push(JSON.parse(match[1].replace(/^\s*<!--|-->\s*$/g, "")));
    } catch {
      // Invalid data is ignored; scripts are never executed.
    }
  }
  return documents;
}

function flattenInstructions(value, section = "", output = []) {
  if (typeof value === "string") {
    const text = plainText(value, LIMITS.item);
    if (text) output.push({ section, text });
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenInstructions(item, section, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const type = typesOf(value);
  if (type.includes("howtosection")) {
    const nextSection = plainText(value.name, 120);
    flattenInstructions(value.itemListElement || value.steps, nextSection, output);
  } else if (type.includes("howtostep") || value.text) {
    flattenInstructions(value.text || value.name, section, output);
  } else if (value.itemListElement) {
    flattenInstructions(value.itemListElement, section, output);
  }
  return output;
}

function firstImage(value, sourceUrl) {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const raw = typeof candidate === "string" ? candidate : candidate?.url || candidate?.contentUrl;
    if (!raw) continue;
    try {
      const resolved = new URL(raw, sourceUrl).toString();
      parseHttpsUrl(resolved);
      return resolved;
    } catch {
      // Try the next image.
    }
  }
  return "";
}

function authorName(author) {
  const first = Array.isArray(author) ? author[0] : author;
  return plainText(typeof first === "string" ? first : first?.name, LIMITS.author);
}

function normalizeRecipe(recipe, sourceUrl) {
  const title = plainText(recipe.name || recipe.headline, LIMITS.title);
  const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
    .map((item) => plainText(item, LIMITS.item)).filter(Boolean).slice(0, 200);
  const instructions = flattenInstructions(recipe.recipeInstructions).slice(0, 100);
  if (!title || ingredients.length === 0 || instructions.length === 0) return null;
  return {
    title,
    description: plainText(recipe.description, LIMITS.description),
    servings: plainText(recipe.recipeYield, 100),
    prepTime: plainText(recipe.prepTime, 40),
    cookTime: plainText(recipe.cookTime, 40),
    totalTime: plainText(recipe.totalTime, 40),
    ingredientSections: [{ name: "", items: ingredients }],
    instructionSections: instructions.reduce((sections, step) => {
      let current = sections[sections.length - 1];
      if (!current || current.name !== step.section) {
        current = { name: step.section, steps: [] };
        sections.push(current);
      }
      current.steps.push(step.text);
      return sections;
    }, []),
    author: authorName(recipe.author),
    imageUrl: firstImage(recipe.image, sourceUrl),
  };
}

function parseRecipeHtml(html, sourceUrl) {
  const recipes = extractJsonLd(html).flatMap((document) => findRecipes(document));
  for (const recipe of recipes) {
    const normalized = normalizeRecipe(recipe, sourceUrl);
    if (normalized) return normalized;
  }
  return null;
}

module.exports = { extractJsonLd, findRecipes, flattenInstructions, normalizeRecipe, parseRecipeHtml, plainText };
