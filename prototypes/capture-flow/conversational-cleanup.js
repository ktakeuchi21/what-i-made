(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeConversationalCleanup = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VOCAL_FILLER = "(?:ah+|uh+|um+|uhm+|erm+|hmm+|mm+)";
  const COOKING_CUE = "(?:(?:i|we)\\s+(?:made|cooked|prepared|tried|served)|(?:dish(?:\\s+name)?|rating|notes?|ingredients?|country)(?:\\s+(?:is|was|are|were))?)";
  const CONTENT_CUE = `(?:${COOKING_CUE}|(?:i|we|it|they|this|that)\\s+\\p{L}+)`;

  function cleanConversationalText(value, options = {}) {
    let text = String(value || "").normalize("NFKC");

    // Remove abandoned starts only when a complete cooking statement immediately follows.
    text = text
      .replace(new RegExp(`(^|[.!?]\\s+)(?:i|we)\\s+(?:was|were)\\s+going\\s+to\\s*[,–—-]\\s*(?=(?:i|we)\\s+(?:made|cooked|prepared)\\b)`, "gi"), "$1")
      .replace(/\b((?:i|we)\s+(?:made|cooked|prepared))\s*[,–—-]\s*\1\b/gi, "$1")
      .replace(new RegExp(`\\b((?:i|we)\\s+(?:made|cooked|prepared)\\s+)${VOCAL_FILLER}\\s+(?!(?:ali)\\b)`, "gi"), "$1");

    // Contextual discourse markers are removed only before a recognizable field/cooking cue.
    text = text.replace(
      new RegExp(`(^|[.!?]\\s+)(?:(?:oh|okay|well|so)\\b[\\s,;:]*)+(?=(?:${VOCAL_FILLER}\\b[\\s,;:]*)*${CONTENT_CUE})`, "giu"),
      "$1",
    );

    text = text
      .replace(new RegExp(`^${VOCAL_FILLER}\\s+(?!(?:ali)\\b)`, "gi"), options.removeLeadingFiller ? "" : "$&")
      .replace(new RegExp(`(^|[.!?;:]\\s+)${VOCAL_FILLER}\\s*,\\s*`, "gi"), "$1")
      .replace(new RegExp(`\\s*,\\s*${VOCAL_FILLER}\\s*,\\s*`, "gi"), options.preserveListComma ? ", " : " ")
      .replace(new RegExp(`(^|[.!?]\\s+)${VOCAL_FILLER}[.!?](?=\\s|$)`, "gi"), "$1")
      .replace(new RegExp(`\\s*,\\s*${VOCAL_FILLER}(?=\\s*[.!?]|$)`, "gi"), "")
      .replace(new RegExp(`(^|[.!?]\\s+)${VOCAL_FILLER}[\\s,;:]+(?=${CONTENT_CUE})`, "giu"), "$1")
      .replace(new RegExp(`(^|\\s)${VOCAL_FILLER}(?=\\s+${CONTENT_CUE})`, "giu"), "$1")
      .replace(/\b(\p{L}[\p{L}'’-]*)(?:\s*[,–—-]\s*|\s+)\1\b/giu, "$1")
      .replace(/\b(?:you know|i mean|basically)\b\s*,?/gi, "")
      .replace(/\s*,\s*like\s*,\s*/gi, " ")
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

  return { cleanConversationalText };
});
