(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeCookDate = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MIN_COOK_DATE = "2026-01-01";

  function isCalendarDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return false;
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
  }

  function localDateValue(now = new Date()) {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error("A valid current date is required.");
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function dateBounds(now = new Date()) {
    return { min: MIN_COOK_DATE, max: localDateValue(now) };
  }

  function validateCookDate(value, options = {}) {
    const bounds = options.bounds || dateBounds(options.now);
    const date = String(value || "").trim();
    if (!isCalendarDate(date)) return { valid: false, message: "Choose a valid cooking date." };
    if (date < bounds.min) return { valid: false, message: "Choose January 1, 2026 or later." };
    if (date > bounds.max) return { valid: false, message: "The cooking date cannot be in the future." };
    return { valid: true, message: "" };
  }

  return { MIN_COOK_DATE, isCalendarDate, localDateValue, dateBounds, validateCookDate };
});
