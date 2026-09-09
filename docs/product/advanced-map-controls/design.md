# Cook Density and Culinary Peaks

## Summary

The Map compares selected-year cooking activity by country. **Cook Density** is the default choropleth: progressively warmer, stronger country fills mean more cooking occasions. **Culinary Peaks** uses the same scale while adding restrained vertical peaks whose height also increases with cook count. Both views present the same country totals and preserve the tap-driven World → culinary region → country → dish-history flow.

Photographs remain primary in the region and country shelves, country dish sheets, and dish history. They no longer encode density on the map itself. This separation makes geographic comparison immediate while retaining the personal archive character in drill-down surfaces.

Canonical dishes may still store an owner-selected default map photograph and one versioned approximate in-country point. These presentation preferences remain useful in dish history and future map detail work but do not alter country-level density totals.

## Interaction

- Cook Density is the initial mode. A legacy Photo Density preference resolves to Cook Density, and a legacy Needle Field preference resolves to Culinary Peaks.
- Five fixed selected-year cook bands drive both modes: 1, 2, 3–4, 5–7, and 8+ cooks. A persistent visible legend explains every band.
- World colors every represented country and provides a photographic shelf of active culinary regions. Tapping a country enters its culinary region; the shelf provides an equivalent large-target route.
- A focused region retains the country shelf. Tapping an active country polygon or its card opens the existing country sheet with every dish and exact totals.
- Cook Density uses fill color plus the exact ranked text summary and shelves. Culinary Peaks adds height as a second visual channel, with a numeric count on each peak.
- Countries without selected-year cooks stay visually quiet. Unknown-country dishes remain in Needs a map location and never affect a country fill or peak.
- Free pan, pinch zoom, and horizontal scrolling inside the map remain out of scope.

## Data and rules

The dashboard's existing year-scoped country aggregates are the sole source for map intensity. A country's `cookCount` is the sum of its canonical dishes' selected-year attempts. The map never uses all-time dish history for its visual scale.

Both modes use one deterministic activity model. It removes zero-count countries, assigns the five fixed bands, sorts by cook count and stable country identity, and derives a capped peak height from the square root of cook count so large histories remain legible without overwhelming smaller totals.

The map uses country associations rather than claiming continuous or street-level geographic density. Approximate dish points do not change a country's count or peak.

## Accessibility and failure behavior

Color is never the only explanation: Culinary Peaks adds height, the live summary names the three most-cooked countries with exact counts, and region/country shelves expose all destinations with 44×44-pixel or larger controls. Country boundaries remain visible in every band.

The segmented control uses `aria-pressed`, the map's accessible name reflects the active view and year, and a polite status announces the view explanation and ranked leaders. Reduced motion removes map viewport animation. Dense geographic areas remain operable through shelves rather than requiring precise map taps.

Deleted photos, invalid geometry, or missing country totals leave the map usable and do not alter archive data. All aggregation and rendering remain local and offline.

## Acceptance criteria

- World and focused-region maps visibly distinguish countries with different selected-year cook totals.
- Cook Density and Culinary Peaks use the same five bands, country set, totals, and deterministic order.
- Culinary Peaks increase monotonically with cook count and remain capped at a legible mobile height.
- The visible legend and live ranked summary explain the encoding without requiring color perception or precise map interaction.
- World and region shelves preserve photographic browsing and provide large-target alternatives to country geometry.
- Country drill-down, dish history, custom location/default photograph editing, Back restoration, and year scoping remain unchanged.
- Both modes work offline, with keyboard input, reduced motion, dark mode, large text, portrait, and landscape.
