# Accurate Offline Culinary Map

> **Status:** Implemented in prototype

## 1. Executive summary

The current atlas uses seven decorative polygons and a small hand-maintained country-point table, so it does not look geographically trustworthy and many valid countries cannot be mapped. Replace it with real Natural Earth country geometry projected into a compact local vector asset. Food photographs remain the primary interaction. The main cost is a larger bundled asset, kept below the existing 250 KB compressed map budget.

## 2. Context and scope

This changes the Year preview and full Map background, country lookup, marker placement, and selected-country treatment. It does not add street detail, precise cooking locations, map tiles, accounts, or network calls.

## 3. System context

```text
Natural Earth GeoJSON (build input)
              |
              v
local generator -> bundled projected country paths + label points
                                      |
IndexedDB cooks -> Year derivation ----+--> Year preview / full Map
```

## 4. Proposed design

### How it works

The build-time generator reads Natural Earth 1:110m Admin 0 countries, applies the Natural Earth projection, and emits compact JavaScript containing one path and representative label point per country. The Year and Map screens render those paths locally. A saved country name resolves through Natural Earth names, abbreviations, and ISO codes. Its photo cell is positioned at the dataset label point, with deterministic neighboring offsets for multiple dishes. Selecting a dish highlights its country and updates the existing detail card.

### Components and responsibilities

**Generated geography asset.** Owns projected shapes, country aliases, ISO identity, and label points. It does not read journal records.

**Dashboard model.** Resolves a saved country and adds deterministic dish offsets. It does not infer unknown countries or rewrite records.

**Map renderer.** Draws the local country paths and selected-country state. It does not fetch tiles or expose precise user location.

### Decisions

Use bundled Natural Earth vectors instead of Google Maps, Mapbox, or OpenStreetMap tiles. A world-scale culinary atlas does not need roads or live tiles, and local geometry preserves offline use, privacy, stable styling, and zero recurring cost. The tradeoff is that borders update only when the bundled asset is deliberately regenerated.

Use Natural Earth label points instead of mathematical centroids because large or irregular countries can have centroids in visually misleading places. The points remain country-level approximations, not claims about a dish's exact origin.

## 5. Invariants and requirements

### Invariants

- `INV-M1`: Every displayed country outline comes from the bundled Natural Earth dataset.
- `INV-M2`: Unknown country text remains visible but receives no invented map position.
- `INV-M3`: Map rendering and interaction perform no third-party network requests.
- `INV-M4`: One photo cell still represents one canonical dish and exposes its exact cook count.
- `INV-M5`: Selecting a dish changes only presentation state and never journal data.

### Requirements

- Both map surfaces use the same geometry and projection.
- Selected countries have a visible non-color-only companion state in the detail card and accessible dish list.
- Photo controls remain at least 44 by 44 CSS pixels on the full map.
- The generated map asset stays below 250 KB compressed.

## 6. Interfaces and data

The generated asset exports country records with a stable Natural Earth key, display name, aliases, projected SVG path, and projected label point. `mapPosition(country, siblingIndex)` continues to return percentages and additionally returns the resolved country key. IndexedDB records and existing country strings do not migrate.

## 7. Failure behavior and lifecycle

If the geography asset is absent, the map keeps its accessible dish list and places no photographs rather than guessing. A country that cannot be resolved appears under Needs a map location. Regenerating the asset changes geometry only after normal tests and review.

## 8. Security, privacy, and operations

Natural Earth data is public domain and is transformed during development. The deployed app makes no tile, geocoder, or map analytics request. The service worker caches the generated asset with the rest of the application shell.

## 9. Acceptance criteria

- `AC-M1`: Year and Map show recognizable, geographically accurate country outlines derived from Natural Earth.
- `AC-M2`: Existing supported values such as United States, Japan, Mexico, Canada, and South Korea resolve to their Natural Earth label points.
- `AC-M3`: A valid country outside the old hand-maintained list maps without an application-code change.
- `AC-M4`: Unknown countries stay under Needs a map location.
- `AC-M5`: Selecting a photo highlights the matching country and preserves the existing detail and list behavior.
- `AC-M6`: The map has no horizontal overflow at 375 by 812 or 812 by 375 and retains 44-pixel full-map targets.
- `AC-M7`: Loading and using the map makes no third-party requests.

## 10. Test approach

Generated-data tests prove country count, alias resolution, label-point bounds, and asset size for `INV-M1`, `INV-M2`, `AC-M2`, and `AC-M3`. Dashboard tests prove stable neighboring cells and unknown-country behavior for `INV-M4` and `AC-M4`. Browser checks cover recognizable rendering, selection, highlight, responsive layout, accessibility, console errors, and request logs for `INV-M3`, `INV-M5`, `AC-M1`, and `AC-M5` through `AC-M7`.

## 11. Risks and tradeoffs

- Border datasets encode political choices. Keep the source/version documented and avoid using country fill to imply ownership or achievement.
- Dense regions can overlap. Preserve deterministic offsets and the accessible geographic list; add zoom only when real usage proves it necessary.
- The vector asset can grow. Round projected coordinates and enforce the compressed-size budget in tests.

## 12. Open questions

- None block implementation. Owner-adjustable points remain a later enhancement.

## 13. Out of scope

- Street, restaurant, or GPS-level locations
- Live map tiles, satellite imagery, routing, or geocoding
- Pan and pinch zoom in this increment
- Editing country boundaries or political labels
