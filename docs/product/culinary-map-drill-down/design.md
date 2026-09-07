# Culinary Map Drill-Down

> **Status:** Implemented in the capture-flow prototype; pending deployed iPhone validation

## Outcome

The culinary map is a photographic exploration path: world, culinary region, country, then canonical dish history. Map totals use the selected calendar year; dish history shows every saved cook across all years.

## Interaction

- The world view shows no more than three photos per active region. A `+N` label exposes hidden dishes.
- Region photos favor different countries first. Countries rank by cook count and recency; remaining slots rank dishes by cook count and recency.
- Selecting a region uses a preset focus view rather than free pan or pinch zoom.
- The focused region offers equivalent country controls on the map and in a horizontally scrolling photo shelf.
- Selecting a country opens a modal bottom sheet with year totals and every dish ordered by cook count and recency.
- Selecting a dish opens a normal all-time history screen with each photo, date, rating, note, and ingredient record.
- Back restores the country sheet and the region shelf position. Closing a sheet restores focus to its country control.

## Geography and privacy

The bundled Natural Earth country identifier resolves into one of 13 single-membership culinary browsing regions. The taxonomy is stored separately from archive records, so it can be reviewed without migrating cooking history. Mexico belongs to Central America & Caribbean, Turkey to North Africa & Middle East, and Russia to Eastern Europe. All derivation and rendering stay on-device.

## Accessibility and responsive behavior

All visible alternatives use native buttons with at least 44-pixel targets. The country shelf avoids precision map tapping, the sheet has visible and keyboard dismissal, focus is trapped while modal, and reduced motion removes the focus animation. The map does not contain nested horizontal scrolling; only the country shelf scrolls horizontally.

## Proof

- Model tests cover complete single-membership geography, selected-year aggregation, frequency ordering, country diversity, and taxonomy assumptions.
- Browser checks cover world-to-region-to-country-to-history navigation, sheet focus and Escape behavior, restored country state, dark appearance, phone and landscape layouts, and console errors.

