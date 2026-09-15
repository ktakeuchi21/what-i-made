"use strict";

const { COUNTRY_CODES } = require("./country-catalog");

const MAX_DISHES = 6;
const FIELD_LIMITS = Object.freeze({ dishName: 200, notes: 2000, ingredientsText: 2000 });
const RESPONSE_KEYS = ["cleanedVoiceText", "dishes", "warnings"];
const DISH_KEYS = ["dishName", "rating", "notes", "ingredientsText", "countryCode", "countrySource", "confidence"];
const CONFIDENCE_KEYS = ["dishName", "rating", "notes", "ingredientsText", "country"];
const VOCAL_FILLER = "(?:ah+|uh+|um+|uhm+|erm+|hmm+|mm+)";
const COOKING_CUE = "(?:(?:i|we)\\s+(?:made|cooked|prepared|tried|served)|(?:dish(?:\\s+name)?|rating|notes?|ingredients?|country)(?:\\s+(?:is|was|are|were))?)";
const CONTENT_CUE = `(?:${COOKING_CUE}|(?:i|we|it|they|this|that)\\s+\\p{L}+)`;

function plainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, keys) { return plainObject(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key)); }

function cleanVoiceText(value, options = {}) {
  let text = String(value || "").normalize("NFKC");
  text = text
    .replace(new RegExp(`(^|[.!?]\\s+)(?:i|we)\\s+(?:was|were)\\s+going\\s+to\\s*[,–—-]\\s*(?=(?:i|we)\\s+(?:made|cooked|prepared)\\b)`, "gi"), "$1")
    .replace(/\b((?:i|we)\s+(?:made|cooked|prepared))\s*[,–—-]\s*\1\b/gi, "$1")
    .replace(new RegExp(`\\b((?:i|we)\\s+(?:made|cooked|prepared)\\s+)${VOCAL_FILLER}\\s+(?!(?:ali)\\b)`, "gi"), "$1")
    .replace(new RegExp(`(^|[.!?]\\s+)(?:(?:oh|okay|well|so)\\b[\\s,;:]*)+(?=(?:${VOCAL_FILLER}\\b[\\s,;:]*)*${CONTENT_CUE})`, "giu"), "$1")
    .replace(new RegExp(`^${VOCAL_FILLER}\\s+(?!(?:ali)\\b)`, "gi"), options.removeLeadingFiller ? "" : "$&")
    .replace(new RegExp(`(^|[.!?;:]\\s+)${VOCAL_FILLER}\\s*,\\s*`, "gi"), "$1")
    .replace(new RegExp(`\\s*,\\s*${VOCAL_FILLER}\\s*,\\s*`, "gi"), options.preserveListComma ? ", " : " ")
    .replace(new RegExp(`(^|[.!?]\\s+)${VOCAL_FILLER}[.!?](?=\\s|$)`, "gi"), "$1")
    .replace(new RegExp(`\\s*,\\s*${VOCAL_FILLER}(?=\\s*[.!?]|$)`, "gi"), "")
    .replace(new RegExp(`(^|[.!?]\\s+)${VOCAL_FILLER}[\\s,;:]+(?=${CONTENT_CUE})`, "giu"), "$1")
    .replace(new RegExp(`(^|\\s)${VOCAL_FILLER}(?=\\s+${CONTENT_CUE})`, "giu"), "$1")
    .replace(/\b(\p{L}[\p{L}'’-]*)(?:\s*[,–—-]\s*|\s+)\1\b/giu, "$1")
    .replace(/\s*,\s*like\s*,\s*/gi, " ")
    .replace(/\b(?:you know|I mean|basically)\b\s*,?/gi, "")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([.!?])(?:\s*[,;:])+\s*/g, "$1 ")
    .replace(/\b(is|was|were|felt|tasted|seemed),\s*,/gi, "$1 ")
    .replace(/:\s*,/g, ": ")
    .replace(/,\s*,/g, ", ")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[,;:]\s*|\s*[,;:]\s*$/g, "")
    .trim();
  return text;
}

function optionalText(value, limit, cleanupOptions) {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > limit) throw new Error("invalid_provider_response");
  return cleanVoiceText(value, cleanupOptions) || null;
}

function validateConfidence(value) {
  if (!exactKeys(value, CONFIDENCE_KEYS) || CONFIDENCE_KEYS.some((key) => typeof value[key] !== "number" || value[key] < 0 || value[key] > 1)) {
    throw new Error("invalid_provider_response");
  }
  return Object.fromEntries(CONFIDENCE_KEYS.map((key) => [key, value[key]]));
}

function validateDish(value) {
  if (!exactKeys(value, DISH_KEYS)) throw new Error("invalid_provider_response");
  if (value.rating !== null && (!Number.isInteger(value.rating) || value.rating < 1 || value.rating > 10)) throw new Error("invalid_provider_response");
  const countryCode = value.countryCode === null ? null : String(value.countryCode || "").toUpperCase();
  if (countryCode && !COUNTRY_CODES.has(countryCode)) throw new Error("invalid_provider_response");
  if (!["explicit", "inferred", "unknown"].includes(value.countrySource)) throw new Error("invalid_provider_response");
  if ((countryCode === null) !== (value.countrySource === "unknown")) throw new Error("invalid_provider_response");
  return {
    dishName: optionalText(value.dishName, FIELD_LIMITS.dishName, { removeLeadingFiller: true }),
    rating: value.rating,
    notes: optionalText(value.notes, FIELD_LIMITS.notes),
    ingredientsText: optionalText(value.ingredientsText, FIELD_LIMITS.ingredientsText, { preserveListComma: true }),
    countryCode,
    countrySource: value.countrySource,
    confidence: validateConfidence(value.confidence),
  };
}

function validateProviderResult(value) {
  if (!exactKeys(value, RESPONSE_KEYS) || typeof value.cleanedVoiceText !== "string" || value.cleanedVoiceText.length > 2000) throw new Error("invalid_provider_response");
  if (!Array.isArray(value.dishes) || value.dishes.length > MAX_DISHES) throw new Error("invalid_provider_response");
  if (!Array.isArray(value.warnings) || value.warnings.length > 6 || value.warnings.some((warning) => typeof warning !== "string" || warning.length > 120)) throw new Error("invalid_provider_response");
  return { cleanedVoiceText: cleanVoiceText(value.cleanedVoiceText), dishes: value.dishes.map(validateDish), warnings: value.warnings };
}

const responseSchema = {
  type: "object", additionalProperties: false, required: RESPONSE_KEYS,
  properties: {
    cleanedVoiceText: { type: "string" },
    dishes: { type: "array", items: {
      type: "object", additionalProperties: false, required: DISH_KEYS,
      properties: {
        dishName: { type: ["string", "null"] },
        rating: { type: ["integer", "null"], minimum: 1, maximum: 10 },
        notes: { type: ["string", "null"] },
        ingredientsText: { type: ["string", "null"] },
        countryCode: { type: ["string", "null"], enum: [null, ...COUNTRY_CODES] },
        countrySource: { type: "string", enum: ["explicit", "inferred", "unknown"] },
        confidence: { type: "object", additionalProperties: false, required: CONFIDENCE_KEYS,
          properties: Object.fromEntries(CONFIDENCE_KEYS.map((key) => [key, { type: "number", minimum: 0, maximum: 1 }])) },
      },
    } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

module.exports = { cleanVoiceText, responseSchema, validateProviderResult };
