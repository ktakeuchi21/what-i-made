(function (root, factory) {
  const geography = typeof module === "object" && module.exports
    ? require("./assets/world-map-data.js")
    : root?.WhatIMadeWorldMap;
  const api = factory(geography);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WhatIMadeMapGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (geography) {
  "use strict";

  const MAP_DATA_VERSION = Number(geography?.mapDataVersion || 1);
  const WIDTH = Number(geography?.width || 1000);
  const HEIGHT = Number(geography?.height || 500);
  const parsedCountries = new Map();

  function parsePath(path) {
    const tokens = String(path || "").match(/[MLZ]|-?\d+(?:\.\d+)?/g) || [];
    const rings = [];
    let ring = null;
    for (let index = 0; index < tokens.length;) {
      const token = tokens[index++];
      if (token === "M" || token === "L") {
        const x = Number(tokens[index++]);
        const y = Number(tokens[index++]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (token === "M") {
          ring = [];
          rings.push(ring);
        }
        ring?.push([x, y]);
      } else if (token === "Z") ring = null;
    }
    return rings.filter((candidate) => candidate.length >= 3);
  }

  function pointOnSegment(point, start, end, epsilon = 0.01) {
    const [x, y] = point;
    const [x1, y1] = start;
    const [x2, y2] = end;
    const cross = ((x - x1) * (y2 - y1)) - ((y - y1) * (x2 - x1));
    if (Math.abs(cross) > epsilon) return false;
    return x >= Math.min(x1, x2) - epsilon && x <= Math.max(x1, x2) + epsilon
      && y >= Math.min(y1, y2) - epsilon && y <= Math.max(y1, y2) + epsilon;
  }

  function pointInRings(point, rings) {
    let inside = false;
    for (const ring of rings) {
      for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
        const currentPoint = ring[index];
        const previousPoint = ring[previous];
        if (pointOnSegment(point, previousPoint, currentPoint)) return true;
        const intersects = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1])
          && point[0] < ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1]))
            / (previousPoint[1] - currentPoint[1]) + currentPoint[0];
        if (intersects) inside = !inside;
      }
    }
    return inside;
  }

  function ringArea(ring) {
    return Math.abs(ring.reduce((sum, point, index) => {
      const next = ring[(index + 1) % ring.length];
      return sum + (point[0] * next[1]) - (next[0] * point[1]);
    }, 0) / 2);
  }

  function ringCentroid(ring) {
    let area = 0;
    let x = 0;
    let y = 0;
    ring.forEach((point, index) => {
      const next = ring[(index + 1) % ring.length];
      const cross = (point[0] * next[1]) - (next[0] * point[1]);
      area += cross;
      x += (point[0] + next[0]) * cross;
      y += (point[1] + next[1]) * cross;
    });
    return Math.abs(area) < 0.0001 ? ring[0] : [x / (3 * area), y / (3 * area)];
  }

  function boundsForRings(rings) {
    const points = rings.flat();
    return points.reduce((bounds, point) => ({
      minX: Math.min(bounds.minX, point[0]), maxX: Math.max(bounds.maxX, point[0]),
      minY: Math.min(bounds.minY, point[1]), maxY: Math.max(bounds.maxY, point[1]),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  }

  function scanlineInterior(rings, bounds) {
    const ys = [0.5, 0.35, 0.65, 0.2, 0.8].map((ratio) => bounds.minY + ((bounds.maxY - bounds.minY) * ratio));
    let best = null;
    ys.forEach((y) => {
      const intersections = [];
      rings.forEach((ring) => ring.forEach((point, index) => {
        const next = ring[(index + 1) % ring.length];
        if ((point[1] > y) === (next[1] > y) || point[1] === next[1]) return;
        intersections.push(point[0] + ((y - point[1]) * (next[0] - point[0])) / (next[1] - point[1]));
      }));
      intersections.sort((left, right) => left - right);
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        const start = intersections[index];
        const end = intersections[index + 1];
        const candidate = [(start + end) / 2, y];
        if (end > start && pointInRings(candidate, rings) && (!best || end - start > best.width)) best = { point: candidate, width: end - start };
      }
    });
    return best?.point || null;
  }

  function countryGeometry(countryKey) {
    if (parsedCountries.has(countryKey)) return parsedCountries.get(countryKey);
    const country = geography?.countries?.find((candidate) => candidate.key === countryKey);
    if (!country) return null;
    const rings = parsePath(country.path);
    const bounds = boundsForRings(rings);
    const largest = rings.slice().sort((left, right) => ringArea(right) - ringArea(left))[0];
    const centroid = largest ? ringCentroid(largest) : null;
    const anchor = centroid && pointInRings(centroid, rings) ? centroid : scanlineInterior(rings, bounds);
    const result = {
      country, rings, bounds,
      anchor: anchor ? { x: anchor[0] / WIDTH * 100, y: anchor[1] / HEIGHT * 100 } : { x: country.point[0], y: country.point[1] },
    };
    parsedCountries.set(countryKey, result);
    return result;
  }

  function isPointInCountry(countryKey, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return false;
    const geometry = countryGeometry(countryKey);
    return Boolean(geometry && pointInRings([x / 100 * WIDTH, y / 100 * HEIGHT], geometry.rings));
  }

  function validateMapLocation(value, options = {}) {
    if (value === null || value === undefined) return null;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a valid approximate map location.");
    const countryKey = String(value.countryKey || "");
    const x = Number(value.x);
    const y = Number(value.y);
    const mapDataVersion = Number(value.mapDataVersion);
    if (!geography?.countries?.some((country) => country.key === countryKey)) throw new Error("The map location uses an unknown country.");
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100 || !Number.isInteger(mapDataVersion) || mapDataVersion < 1) {
      throw new Error("Choose a valid approximate map location.");
    }
    if (mapDataVersion === MAP_DATA_VERSION && !isPointInCountry(countryKey, x, y)) throw new Error("Keep the approximate location inside the confirmed country.");
    if (options.requireCurrentVersion && mapDataVersion !== MAP_DATA_VERSION) throw new Error("This map location uses an older geography version.");
    return { x, y, countryKey, mapDataVersion };
  }

  function resolvedPosition(countryValue, mapLocation = null) {
    const country = geography?.findCountry?.(countryValue);
    if (!country) return null;
    try {
      const location = validateMapLocation(mapLocation);
      if (location && location.countryKey === country.key && location.mapDataVersion === MAP_DATA_VERSION) return { ...location };
    } catch {}
    const geometry = countryGeometry(country.key);
    return { ...geometry.anchor, countryKey: country.key, mapDataVersion: MAP_DATA_VERSION };
  }

  function repeatBand(count) {
    if (count >= 8) return 5;
    if (count >= 5) return 4;
    if (count >= 3) return 3;
    if (count >= 2) return 2;
    return 1;
  }

  function collisionGroups(items, options = {}) {
    const width = Math.max(1, Number(options.width || 320));
    const height = Math.max(1, Number(options.height || width / 2));
    const scale = Math.max(1, Number(options.scale || 1));
    const separation = Math.max(44, Number(options.separation || 52));
    const sorted = items.slice().sort((left, right) => String(left.dishId).localeCompare(String(right.dishId)));
    const parents = sorted.map((_, index) => index);
    const find = (index) => parents[index] === index ? index : (parents[index] = find(parents[index]));
    const join = (left, right) => { const a = find(left); const b = find(right); if (a !== b) parents[b] = a; };
    for (let left = 0; left < sorted.length; left += 1) for (let right = left + 1; right < sorted.length; right += 1) {
      const dx = Math.abs(sorted[left].position.x - sorted[right].position.x) / 100 * width * scale;
      const dy = Math.abs(sorted[left].position.y - sorted[right].position.y) / 100 * height * scale;
      if (Math.hypot(dx, dy) < separation) join(left, right);
    }
    const groups = new Map();
    sorted.forEach((item, index) => {
      const key = find(index);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.values()].map((members) => ({
      members,
      kind: members.length === 1 ? "dish" : new Set(members.map((item) => item.countryKey)).size === 1 ? "country" : "nearby",
      x: members.reduce((sum, item) => sum + item.position.x, 0) / members.length,
      y: members.reduce((sum, item) => sum + item.position.y, 0) / members.length,
    }));
  }

  return { MAP_DATA_VERSION, parsePath, pointInRings, countryGeometry, isPointInCountry, validateMapLocation, resolvedPosition, repeatBand, collisionGroups };
});
