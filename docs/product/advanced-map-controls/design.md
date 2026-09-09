# Advanced culinary map controls

## Summary

The Map keeps its photographic world-level region clusters and adds dish-level Photo Density and Needle Field views after a region is selected. Dense controls never overlap: same-country groups open a fitted country close-up, while mixed-country groups open an accessible nearby-dishes chooser. Free pan and pinch zoom remain out of scope.

Collision groups remain faithful to the active view instead of becoming a third generic marker style. Photo Density groups show up to three deterministically ranked dish photographs with a dish-count badge. Needle Field groups show up to five individual repeat-banded columns with the same dish-count badge. In either mode, the single 52-pixel group control exposes the exact dish and cook totals to assistive technology and opens a list containing every grouped dish.

Canonical dishes may store an owner-selected default map photograph and one versioned approximate point inside their confirmed country. Both remain local, editable presentation preferences. They do not change attempts, photographs, country totals, or all-time history.

## Interaction

- Photo Density is the initial mode. The last chosen mode is remembered locally across launches.
- Repeat strength uses five bands: 1, 2, 3–4, 5–7, and 8+ selected-year cooks. Every marker also exposes the exact count.
- World remains `world → region`. Region markers open dish history directly unless collision-safe targets require a country close-up or nearby chooser.
- Country polygons and country shelf cards retain the existing country dish sheet.
- Back restores region, detail, sheet, selected mode, shelf position, and focus.
- Dish history exposes **Customize map**, containing the eligible photograph picker and country-clipped location editor. Drag, tap, directional nudges, and Reset are equivalent inputs. Save is atomic; Cancel changes nothing.

## Data and rules

`Dish.defaultMapPhotoId` remains a reference. A photograph is eligible only when it is assigned to one of the dish's attempts or is the current main photo for an occasion containing the dish.

`Dish.mapLocation` is optional and contains projected `x` and `y` percentages, the resolved ISO alpha-3 `countryKey`, and `mapDataVersion`. A shared country change clears an incompatible custom location atomically. Older or absent locations fall back to a deterministic interior point derived from the bundled polygon geometry.

The map reads every dish attempt, including every dish in a multi-dish occasion. Selected-year cook counts drive the map; selecting a dish opens all-time history.

Backup schema v2 accepts the optional field. A well-formed point from an older geography version restores the rest of the archive and resets only that point with a preview warning. Malformed, unknown-country, or current-version out-of-country points reject without writes.

## Accessibility and failure behavior

Every marker, cluster, nudge, mode, photo, and sheet control has at least a 44 by 44 CSS-pixel target. Dense controls use at least 8 pixels of separation. Geographic shelves and sheets expose every dish without requiring precise map operation. Dialogs contain focus, provide visible Close and Cancel actions, and restore the originating control.

Reduced motion removes viewport animation. Deleted photos, stale dish identities, invalid geometry, or failed transactions leave the saved archive unchanged and show a recoverable error. All map work remains local and offline.

## Acceptance criteria

- World clusters remain readable and a focused region can switch between both dish-level modes.
- The same canonical dishes and exact selected-year counts appear in both modes.
- Every dish in a multi-dish occasion reaches Year, Map, and all-time dish history.
- Dense same-country and mixed-country areas have operable, deterministic drill-down without overlapping targets.
- An eligible photo and valid in-country point save together; Cancel, invalid placement, and transaction failure write nothing.
- Mode choice survives reload; custom locations survive schema-v2 backup and restore under the documented geography-version rule.
- The complete flow works offline, with keyboard input, reduced motion, dark mode, large text, portrait, and landscape.
