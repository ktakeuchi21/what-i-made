(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WhatIMadeCaptureParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const NUMBER_WORDS = Object.freeze({
    one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  });

  const DISH_COUNTRIES = Object.freeze([
    [/\b(oyakodon|katsu curry|okonomiyaki|ramen|udon|soba|yakisoba|gyudon|onigiri|tonkatsu)\b/i, "Japan"],
    [/\b(carbonara|pizza|risotto|lasagna|cacio e pepe|amatriciana|osso buco)\b/i, "Italy"],
    [/\b(bibimbap|bulgogi|japchae|tteokbokki|kimchi jjigae)\b/i, "South Korea"],
    [/\b(pad thai|green curry|tom yum|khao soi|pad kra pao)\b/i, "Thailand"],
    [/\b(tacos?|enchiladas?|chilaquiles|pozole|mole poblano)\b/i, "Mexico"],
    [/\b(butter chicken|palak paneer|biryani|dal makhani|chana masala)\b/i, "India"],
    [/\b(coq au vin|ratatouille|cassoulet|croque monsieur|bouillabaisse)\b/i, "France"],
    [/\b(paella|tortilla española|gazpacho|patatas bravas)\b/i, "Spain"],
    [/\b(pho|bánh mì|banh mi|bún chả|bun cha)\b/i, "Vietnam"],
    [/\b(mapo tofu|char siu|dan dan noodles|kung pao chicken|hot pot)\b/i, "China"],
  ]);

  const ISO_COUNTRY_CODES = "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW".split(" ");
  const COUNTRY_ALIASES = Object.freeze({
    america: "United States",
    "czech republic": "Czechia",
    england: "United Kingdom",
    "ivory coast": "Côte d’Ivoire",
    laos: "Laos",
    "north korea": "North Korea",
    russia: "Russia",
    scotland: "United Kingdom",
    "south korea": "South Korea",
    syria: "Syria",
    taiwan: "Taiwan",
    turkey: "Turkey",
    "u k": "United Kingdom",
    "u s": "United States",
    "u s a": "United States",
    uk: "United Kingdom",
    "united states of america": "United States",
    usa: "United States",
    vietnam: "Vietnam",
    wales: "United Kingdom",
  });
  const AMBIGUOUS_BARE_COUNTRIES = new Set(["chad", "georgia", "jordan", "turkey"]);

  function normalizeForCountryMatch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLowerCase();
  }

  function buildCountryNames() {
    const names = new Map();
    if (typeof Intl?.DisplayNames === "function") {
      const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
      ISO_COUNTRY_CODES.forEach((code) => {
        const country = displayNames.of(code);
        if (country && country !== code) names.set(normalizeForCountryMatch(country), country);
      });
    }
    Object.entries(COUNTRY_ALIASES).forEach(([alias, country]) => names.set(alias, country));
    return [...names.entries()].sort(([left], [right]) => right.length - left.length);
  }

  const COUNTRY_NAMES = buildCountryNames();

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "").trim();
  }

  function sentenceCase(value) {
    const text = clean(value);
    return text ? text[0].toUpperCase() + text.slice(1) : "";
  }

  function extractRating(text) {
    const match = text.match(/(?:rating(?:\s+(?:is|was))?\s*)?(10|[1-9]|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:out of|\/|of)\s*(?:10|ten)\b/i);
    if (!match) return "";
    return NUMBER_WORDS[match[1].toLowerCase()] || match[1];
  }

  function extractOpeningDishName(text) {
    const openingSentence = text.match(/^([^.!?;\n]{1,80})[.!?;\n]/)?.[1];
    if (!openingSentence) return "";

    const openingClause = clean(openingSentence.split(",")[0]);
    const openingPhrase = clean(openingClause.split(/\s+(?:came|felt|is|looks?|seems?|tasted|turned|was|went|were)\b/i)[0]);
    const wordCount = openingPhrase.split(/\s+/).filter(Boolean).length;
    if (!openingPhrase || wordCount > 6) return "";
    if (/^(?:a|an|the)\b/i.test(openingPhrase)) return "";
    if (/^(?:breakfast|brunch|dinner|food|lunch|meal)\b/i.test(openingPhrase)) return "";
    if (/^(?:he|i|it|she|that|they|this|we|you)\b/i.test(openingPhrase)) return "";
    if (/^(?:added|adding|cooked|cooking|made|making|prepared|preparing|served|serving|tried|trying|used|using)\b/i.test(openingPhrase)) return "";
    return sentenceCase(openingPhrase);
  }

  function extractDishName(text) {
    const match = text.match(/\b(?:i\s+(?:made|cooked|prepared)|dish(?:\s+name)?\s+(?:is|was)|this\s+is)\s+([^.!?;]+)/i);
    const directMatch = text.match(/^([^,.!?;]{2,60}),?\s+(?:(?:rating\s+)?(?:is|was)\s+)?(?:10|[1-9]|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:out of|\/|of)\s*(?:10|ten)\b/i);
    const candidate = match?.[1] || directMatch?.[1] || extractOpeningDishName(text);
    if (!candidate) return "";
    const withoutRating = candidate.split(/,?\s+(?:(?:rating\s+)?(?:is|was)\s+)?(?:10|[1-9]|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:out of|\/|of)\s*(?:10|ten)\b/i)[0];
    const withoutMarkers = withoutRating.split(/,?\s+(?:ingredients?|notes?)\s*(?:are|were|include|included|is|was|:)/i)[0];
    return sentenceCase(withoutMarkers);
  }

  function extractMarkedSection(text, marker, followingMarker) {
    const expression = new RegExp(
      `\\b${marker}\\s*(?::|are|were|include|included|is|was)?\\s+([\\s\\S]+?)(?=(?:\\b${followingMarker}\\s*(?::|are|were|is|was))|$)`,
      "i",
    );
    const match = text.match(expression);
    return clean(match?.[1] || "");
  }

  function inferCountry(dishName) {
    const rule = DISH_COUNTRIES.find(([pattern]) => pattern.test(dishName));
    return rule?.[1] || "";
  }

  function extractCountry(text) {
    const normalized = ` ${normalizeForCountryMatch(text)} `;
    const standaloneClauses = new Set(
      String(text || "")
        .split(/[.!?;,]+/)
        .map(normalizeForCountryMatch)
        .filter(Boolean),
    );
    let firstMatch = null;

    COUNTRY_NAMES.forEach(([countryName, canonicalName]) => {
      const token = ` ${countryName} `;
      let index = normalized.indexOf(token);
      while (index !== -1) {
        const prefix = normalized.slice(Math.max(0, index - 24), index + 1);
        const isMarked = /\b(?:country(?: is| was)?|from|in|origin(?: is| was)?) $/.test(prefix);
        const isStandalone = standaloneClauses.has(countryName);
        if (isMarked || (isStandalone && !AMBIGUOUS_BARE_COUNTRIES.has(countryName))) {
          if (!firstMatch || index < firstMatch.index) firstMatch = { index, country: canonicalName };
          break;
        }
        index = normalized.indexOf(token, index + token.length);
      }
    });

    return firstMatch?.country || "";
  }

  function removeCountryOnlySentences(notes, country) {
    if (!notes || !country) return notes;
    const acceptedNames = new Set(
      COUNTRY_NAMES
        .filter(([, canonicalName]) => canonicalName === country)
        .map(([countryName]) => countryName),
    );
    acceptedNames.add(normalizeForCountryMatch(country));

    let notesWithoutInitialismSentence = notes;
    if (country === "United States") {
      notesWithoutInitialismSentence = notesWithoutInitialismSentence.replace(
        /(^|[.!?]\s*)(?:(?:the\s+)?(?:country|origin)(?:\s+(?:is|was))?\s+|(?:from|in)\s+)?U(?:\.\s*|\s+)S\.?(?:\s*A\.?)?(?=\s*(?:[.!?]|$))/gi,
        "$1",
      );
    } else if (country === "United Kingdom") {
      notesWithoutInitialismSentence = notesWithoutInitialismSentence.replace(
        /(^|[.!?]\s*)(?:(?:the\s+)?(?:country|origin)(?:\s+(?:is|was))?\s+|(?:from|in)\s+)?U(?:\.\s*|\s+)K\.?(?=\s*(?:[.!?]|$))/gi,
        "$1",
      );
    }

    const keptSentences = (notesWithoutInitialismSentence.match(/[^.!?]+[.!?]?/g) || []).filter((sentence) => {
      const normalizedSentence = normalizeForCountryMatch(sentence)
        .replace(/^(?:the )?(?:country|origin)(?: is| was)? /, "")
        .replace(/^(?:from|in) /, "");
      return !acceptedNames.has(normalizedSentence);
    });
    return clean(keptSentences.join(" "));
  }

  function extractFallbackNotes(text, dishName, rating, ingredients) {
    if (!text) return "";
    let remainder = text;
    remainder = remainder.replace(/\b(?:i\s+(?:made|cooked|prepared)|dish(?:\s+name)?\s+(?:is|was)|this\s+is)\s+[^.!?;]+[.!?]?/i, " ");
    if (dishName) {
      const escapedDishName = dishName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      remainder = remainder.replace(new RegExp(`^${escapedDishName}\\s*[.!?;,]?\\s*`, "i"), " ");
    }
    if (rating) {
      remainder = remainder.replace(/(?:rating(?:\s+(?:is|was))?\s*)?(?:10|[1-9]|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:out of|\/|of)\s*(?:10|ten)\b[.,;]?/i, " ");
    }
    if (ingredients) {
      remainder = remainder.replace(/\bingredients?\s*(?::|are|were|include|included|is|was)?\s+[\s\S]+$/i, " ");
    }
    const result = clean(remainder);
    return result && result.toLowerCase() !== dishName.toLowerCase() ? sentenceCase(result) : "";
  }

  function parseCaptureTranscript(value) {
    const text = clean(value);
    const dishName = extractDishName(text);
    const rating = extractRating(text);
    const ingredients = extractMarkedSection(text, "ingredients?", "notes?");
    const markedNotes = extractMarkedSection(text, "notes?", "ingredients?");
    const country = extractCountry(text) || inferCountry(dishName);
    const extractedNotes = markedNotes ? sentenceCase(markedNotes) : extractFallbackNotes(text, dishName, rating, ingredients);
    const notes = removeCountryOnlySentences(extractedNotes, country);
    return {
      dishName,
      rating,
      notes,
      ingredients: sentenceCase(ingredients),
      country,
    };
  }

  return { parseCaptureTranscript, inferCountry, extractCountry };
});
