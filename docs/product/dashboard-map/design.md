# Year Dashboard and Culinary Map

> **Status:** Implemented prototype; pending deployed iPhone validation

> **Follow-on:** Owner-editable locations, default-photo curation, Needle Field, Photo Density, and dense-area drill-down are implemented under `docs/product/advanced-map-controls/design.md`.

## 1. Executive summary

What I Made currently opens to capture or the journal, so saved cooks remain a list rather than becoming the reflective experience described in the product brief. The next product surface should be a current-year dashboard with a photographic map preview, recent new dishes, and meaningful revisits. Selecting the preview opens a dedicated Map destination that can later support the accepted Needle Field and Photo Density treatments. The main cost is that reliable repeat counts require canonical dish grouping before the map can represent repeated cooking honestly.

## 2. Context and scope

The feature inventory defines two related release slices. Visible Progression includes a current-year dashboard, recent new dishes, repeated-dish progress, filters, and a year recap. Culinary Atlas includes editable dish locations, Needle Field, Photo Density, exact attempt counts, and default map photographs.

This design combines their entry experience without collapsing them into one overloaded screen. Year becomes the reflective home destination and includes a map preview. Map remains a full destination for geographic exploration. Capture stays the primary creation action and Journal stays the chronological record.

The first dashboard increment uses only local records and photographs already saved on the iPhone. It does not add an external map provider, analytics, accounts, or cloud photo storage.

## 3. System context

```text
Capture and confirmation
          |
          v
Local IndexedDB archive
          |
          +--> Year dashboard --> map preview --> full Map
          |
          +--> Journal --> cook detail --> dish history
```

The current archive stores occasions, dishes, attempts, and photo blobs. It already has enough information for a basic current-year summary and country placement. It does not yet reuse canonical dish identities, store ISO country codes or coordinates, or manage a dish's default map photograph.

## 4. Proposed design

### How it works

When at least one cook exists, the app opens to Year. The top of the page shows the current year, the most recent food photograph, and a calm summary such as “4 dishes across 3 countries.” A Photo Density preview places one fixed-size photo cell for each recently active canonical dish around its confirmed country's default point. The preview is labeled as recent activity, not complete history. Selecting it opens Map, where all mapped dishes are independently selectable and an accessible list exposes the same names, countries, and exact attempt counts.

Below the preview, “New this month” shows dishes first recorded in the last 30 days. “Worth revisiting” shows repeated dishes with a changed rating or a new note. Journal remains one tap away, and the capture action remains visually primary.

An empty archive opens capture and offers a short explanation that the dashboard will appear after the first saved cook. Records without a confirmed country still appear in Year and Journal, but the map preview lists them under “Needs a country” instead of inventing a location.

### Components and responsibilities

**Archive repository.** Owns canonical dish reuse, backward-compatible schema migration, and queries for year summaries and map-ready dishes. It does not decide visual ranking or map layout.

**Year derivation.** Owns current-year counts, first-cooked dates, recent-new status, and meaningful revisit status. These values are derived, not stored.

**Bundled Natural Earth geography.** Owns reviewed ISO country codes, display names, aliases, representative label points, and accurate local country geometry. It does not infer cuisine or contact a geocoding service.

**Map layout.** Owns deterministic neighboring positions for dishes that share a country point, selection, zoom, and accessible equivalents. It does not change cooking records.

**Year screen.** Owns the reflective summary, map preview, recent-new section, revisit section, empty state, and navigation. It does not edit map locations.

**Map screen.** Owns complete geographic exploration and selected-dish detail. Location adjustment and default-photo curation can be added after the first map prototype is validated.

### Decisions

Year and Map remain separate bottom destinations. Putting the preview on Year gives the requested dashboard a map presence without forcing summary content and dense map controls into one screen. The downside is one extra tap for full exploration.

The dashboard preview begins with Photo Density because photographs are the product's strongest visual material and existing records already include usable blobs. The full Map adds Needle Field after canonical repeat counts are trustworthy. Shipping both treatments at once would delay the first useful dashboard and make iPhone validation harder.

Map assets stay local. Bundled Natural Earth 1:110m country vectors and label points avoid a map-service account, network dependency, location telemetry, and recurring cost. The downside is world-scale rather than street-level detail and deliberate asset updates when borders change.

The first eligible dish photo becomes the stable default map photo. A later owner choice replaces that reference without rewriting any cooking record. Automatically switching to the newest photo was rejected because it would make the map change without an explicit choice.

Existing same-name dishes are grouped through a reviewed migration before repeat visuals ship. Name normalization may suggest a match, but records with materially different names are never merged automatically.

## 5. Invariants and requirements

### Invariants

- `INV-1`: One map cell represents one canonical dish, never an entire country.
- `INV-2`: Repeating a dish changes only that dish's derived count and visual treatment.
- `INV-3`: Missing or unknown countries never receive invented coordinates.
- `INV-4`: Dashboard and map derivations never rewrite occasions, attempts, notes, ratings, or photographs.
- `INV-5`: Every mapped dish and exact attempt count is available without relying on color, image brightness, or precise tapping.
- `INV-6`: Photos and archive records remain on the device.

### Requirements

- Year defaults to the current calendar year.
- The dashboard includes a hero memory, map preview, recent-new dishes, meaningful revisits, and direct paths to Map and Journal.
- Capture remains available in one tap.
- The map preview describes its scope when it shows recent activity rather than all history.
- The full Map exposes an accessible geographic list and selected-dish details.
- All map and navigation controls meet the 44 CSS-pixel touch minimum and respect iPhone safe areas.
- Missing-country and empty-archive states provide a useful next action.

## 6. Interfaces and data

The archive advances to a new IndexedDB schema version. Existing IDs remain stable. Dish records add a Unicode-safe normalized lookup value and an optional default map photo ID. The map resolves the existing country display name through bundled Natural Earth names, aliases, and ISO identifiers at read time; unrecognized names remain visible strings and receive no coordinates. Stored ISO country codes and owner-adjustable coordinates remain a later map-data enhancement.

The first implementation adds repository queries equivalent to:

```text
getYearSummary(year)
listCanonicalDishSummaries(year)
listMapDishes(year | all)
```

Each map dish returns stable dish ID, display name, country code, coordinates, attempt count, most recent rating, and a photo reference. Derived dashboard labels are calculated from cook dates and attempts at read time.

### Naming and identity

Dish identity remains UUID-based. A normalized name is only a matching aid. A migration may consolidate exact normalized-name duplicates after preserving every attempt and photo reference, but uncertain matches remain separate for later owner review. Country display names can change without changing their ISO identity or dish ID.

## 7. Failure behavior and lifecycle

If migration fails, the transaction aborts and the previous archive remains readable after retry. The app shows Journal rather than an empty dashboard and explains that the overview could not be prepared.

If a photo cannot be decoded, the dish remains in counts and the accessible list with a neutral image placeholder. If country mapping fails, the dish appears under “Needs a country.” If map rendering fails, the geographic list remains available and Journal is unaffected.

Dashboard derivation runs after archive reads and is recalculated after a save, edit, or merge. It does not poll or perform background network work.

## 8. Security, privacy, and operations

All dashboard derivation, country lookup, geometry, and photo rendering happen locally. No map SDK, geocoder, analytics call, or photo upload is introduced. The bundled geographic assets add download size, so the simplified outline and country table should stay below 250 KB compressed. Photo cells use existing optimized images and lazy loading; the dashboard preview loads no more than 12 thumbnails initially.

## 9. Acceptance criteria

- `AC-1`: With at least one current-year cook, reopening the app shows Year with correct locally derived counts and a map preview.
- `AC-2`: With no cooks, the app opens capture and explains how the dashboard becomes available.
- `AC-3`: A cook with no mapped country appears in Year and “Needs a country,” and does not appear at a fabricated map point.
- `AC-4`: Two attempts of one canonical dish show one selectable map cell with an exact count of two.
- `AC-5`: Two different dishes assigned to the same country remain independently selectable.
- `AC-6`: Selecting the dashboard preview opens the complete Map and preserves the selected year.
- `AC-7`: VoiceOver and keyboard users can reach every mapped dish through the geographic list and hear its name, country, and attempt count.
- `AC-8`: At 375 CSS pixels, landscape, and enlarged text, Year and Map have no horizontal overflow or obscured controls.
- `AC-9`: A schema migration failure leaves the previous records intact and gives a recoverable message.
- `AC-10`: No dashboard or map action sends archive records, map selections, or photos over the network.

## 10. Test approach

Repository tests prove migration atomicity and identity stability for `INV-1`, `INV-2`, `INV-3`, `INV-4`, `AC-4`, `AC-5`, and `AC-9`. Derivation tests use fixed dates to prove `AC-1`, `AC-2`, and `AC-3`. Browser tests cover navigation, selection, empty and missing-country states, lazy images, error fallback, keyboard use, VoiceOver names, and responsive layouts for `INV-5`, `AC-6`, `AC-7`, and `AC-8`. A network log assertion proves `INV-6` and `AC-10`. The final prototype is validated on the owner's installed iPhone.

## 11. Risks and tradeoffs

- Canonical migration could merge dishes that only look alike. Limit automatic migration to exact normalized names and preserve uncertain records separately.
- Dense country clusters may be hard to select. Use deterministic neighboring cells, zoom, a selected-detail sheet, and the geographic list.
- A photo-heavy dashboard can become slow. Load a maximum of 12 preview thumbnails initially and reserve image dimensions.
- Country centroids can overstate precision. Label locations as approximate and allow later adjustment.

## 12. Open questions

- Should the dashboard preview show the 12 most recently active dishes or all mapped dishes? Recommended default: 12 recent dishes for performance and honesty about preview scope. This does not block the data foundation.
- Should Year replace Journal as the reopen destination as soon as one cook exists? Recommended default: yes, with Journal remaining a bottom destination. This does not block the prototype.
- Which visual treatment should be implemented second after Photo Density proves the navigation and density model? Recommended default: Needle Field, as already selected in the product brief. This does not block the first dashboard increment.

## 13. Out of scope

- External map tiles, geocoding, or precise restaurant locations
- Country choropleths, conventional pins, bubbles, halos, streaks, or badges
- Recommendations, meal planning, nutrition, or social sharing
- Cloud sync or multi-device history
- Editing dish locations or default photographs in the first dashboard increment
- A full calendar-year recap in the first dashboard increment
