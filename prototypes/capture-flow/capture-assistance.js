(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeCaptureAssistance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_TRANSCRIPT = 5000;
  const MAX_VOICE_SEGMENT = 2000;
  const MAX_DISHES = 6;
  const FIELD_LIMITS = Object.freeze({ dishName: 200, notes: 2000, ingredientsText: 2000 });

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function exactKeys(value, allowed) {
    return isPlainObject(value) && Object.keys(value).every((key) => allowed.includes(key));
  }

  function optionalText(value, limit) {
    if (value === null) return null;
    if (typeof value !== "string" || value.length > limit) throw new Error("The assistance response was not valid.");
    const result = value.trim();
    return result || null;
  }

  function validateConfidence(value) {
    const keys = ["dishName", "rating", "notes", "ingredientsText", "country"];
    if (!exactKeys(value, keys) || keys.some((key) => typeof value[key] !== "number" || value[key] < 0 || value[key] > 1)) {
      throw new Error("The assistance response was not valid.");
    }
    return Object.fromEntries(keys.map((key) => [key, value[key]]));
  }

  function validateDish(value, countryKeys) {
    const keys = ["dishName", "rating", "notes", "ingredientsText", "countryCode", "countrySource", "confidence"];
    if (!exactKeys(value, keys)) throw new Error("The assistance response was not valid.");
    const rating = value.rating;
    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) throw new Error("The assistance response was not valid.");
    const countryCode = value.countryCode === null ? null : String(value.countryCode || "").toUpperCase();
    if (countryCode && !countryKeys.has(countryCode)) throw new Error("The assistance response was not valid.");
    if (!["explicit", "inferred", "unknown"].includes(value.countrySource)) throw new Error("The assistance response was not valid.");
    if ((countryCode === null) !== (value.countrySource === "unknown")) throw new Error("The assistance response was not valid.");
    return {
      dishName: optionalText(value.dishName, FIELD_LIMITS.dishName),
      rating,
      notes: optionalText(value.notes, FIELD_LIMITS.notes),
      ingredientsText: optionalText(value.ingredientsText, FIELD_LIMITS.ingredientsText),
      countryCode,
      countrySource: value.countrySource,
      confidence: validateConfidence(value.confidence),
    };
  }

  function validateResponse(value, countryCodes = []) {
    if (!exactKeys(value, ["cleanedVoiceText", "dishes", "warnings"])) throw new Error("The assistance response was not valid.");
    if (typeof value.cleanedVoiceText !== "string" || value.cleanedVoiceText.length > MAX_VOICE_SEGMENT) throw new Error("The assistance response was not valid.");
    if (!Array.isArray(value.dishes) || value.dishes.length > MAX_DISHES) throw new Error("The assistance response was not valid.");
    if (!Array.isArray(value.warnings) || value.warnings.length > 6 || value.warnings.some((item) => typeof item !== "string" || item.length > 120)) {
      throw new Error("The assistance response was not valid.");
    }
    const countryKeys = new Set(countryCodes);
    return {
      cleanedVoiceText: value.cleanedVoiceText.trim(),
      dishes: value.dishes.map((dish) => validateDish(dish, countryKeys)),
      warnings: value.warnings.slice(),
    };
  }

  function acceptedDishFields(dish = {}) {
    return {
      dishName: (dish.confidence?.dishName || 0) >= 0.8 ? dish.dishName : null,
      rating: (dish.confidence?.rating || 0) >= 0.9 ? dish.rating : null,
      notes: (dish.confidence?.notes || 0) >= 0.7 ? dish.notes : null,
      ingredientsText: (dish.confidence?.ingredientsText || 0) >= 0.7 ? dish.ingredientsText : null,
    };
  }

  function cleanedTokensComeFromSegment(voiceSegment, cleanedVoiceText) {
    const tokens = (value) => String(value || "").normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const source = tokens(voiceSegment);
    const cleaned = tokens(cleanedVoiceText);
    let sourceIndex = 0;
    return cleaned.every((token) => {
      while (sourceIndex < source.length && source[sourceIndex] !== token) sourceIndex += 1;
      if (sourceIndex >= source.length) return false;
      sourceIndex += 1;
      return true;
    });
  }

  async function parseCook(options) {
    const transcript = String(options.transcript || "");
    const voiceSegment = String(options.voiceSegment || "");
    if (!transcript.trim() || transcript.length > MAX_TRANSCRIPT || voiceSegment.length > MAX_VOICE_SEGMENT) {
      throw new Error("Keep the note under 5,000 characters and try again.");
    }
    if (!options.endpoint || !options.token) throw new Error("Smart assistance is not configured.");
    const controller = new AbortController();
    const relayAbort = () => controller.abort();
    options.signal?.addEventListener("abort", relayAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
    try {
      const response = await (options.fetchImpl || fetch)(`${options.endpoint.replace(/\/$/, "")}/v1/parse-cook`, {
        method: "POST",
        headers: { authorization: `Bearer ${options.token}`, "content-type": "application/json" },
        body: JSON.stringify({ transcript, voiceSegment, locale: options.locale || "en-US" }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Your private service session was not accepted. Sign in again." : "Smart suggestions are temporarily unavailable.");
      const result = validateResponse(await response.json(), options.countryCodes || []);
      if ((!voiceSegment && result.cleanedVoiceText)
        || result.cleanedVoiceText.length > voiceSegment.length + 16
        || !cleanedTokensComeFromSegment(voiceSegment, result.cleanedVoiceText)) {
        throw new Error("The assistance response was not valid.");
      }
      return result;
    } catch (error) {
      if (controller.signal.aborted && !options.signal?.aborted) throw new Error("Smart suggestions took too long. Your note is still here.");
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", relayAbort);
    }
  }

  function fakeParseCook({ transcript, voiceSegment, parseFallback, countryLookup }) {
    const source = String(voiceSegment || transcript || "");
    const cleanedVoiceText = source
      .replace(/(^|[\s,;])(?:uh+|um+|uhm+|erm+|hmm+)(?=$|[\s,;.!?])/gi, "$1")
      .replace(/\b(?:you know|I mean|basically)\b\s*,?/gi, "")
      .replace(/\s*,?\s+like\s*,\s*/gi, " ")
      .replace(/\s+([,.;!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
    const finalCleanedVoiceText = cleanedVoiceText.replace(/^\s*[,;]\s*/, "");
    const parsed = typeof parseFallback === "function" ? parseFallback(String(transcript || cleanedVoiceText)) : {};
    const country = countryLookup?.(parsed.country || "");
    return Promise.resolve({
      cleanedVoiceText: finalCleanedVoiceText,
      dishes: parsed.dishName ? [{
        dishName: parsed.dishName, rating: parsed.rating ? Number(parsed.rating) : null,
        notes: parsed.notes || null, ingredientsText: parsed.ingredients || null,
        countryCode: country?.key || null, countrySource: country ? "inferred" : "unknown",
        confidence: { dishName: 0.97, rating: parsed.rating ? 0.98 : 0, notes: parsed.notes ? 0.9 : 0, ingredientsText: parsed.ingredients ? 0.9 : 0, country: country ? 0.94 : 0 },
      }] : [],
      warnings: [],
    });
  }

  return { MAX_DISHES, MAX_TRANSCRIPT, MAX_VOICE_SEGMENT, acceptedDishFields, cleanedTokensComeFromSegment, fakeParseCook, parseCook, validateResponse };
});
