# Year Dashboard and Map

> **Status:** Prototype rules
>
> Extends [MASTER.md](../MASTER.md). These rules apply to the Year and Map screens.

## Page hierarchy

- Year is the home destination after the first cook is saved. An empty archive opens capture.
- Year leads with one latest-cook photograph, then exact dish, cook, and country totals.
- The map preview is a direct path to the complete Map, not a miniature control surface.
- “New this month” means a canonical dish first cooked within the last 30 days.
- “Meaningful repeats” requires more than one attempt plus a changed rating or note.
- Year, Map, and Journal form a three-item bottom navigation. Capture remains the header action.

## Map treatment

- Use quiet bundled Natural Earth 1:110m country geometry in a Natural Earth projection. Do not use external tiles, conventional pins, growing bubbles, or flags.
- At world and focused-region levels, country color communicates selected-year cook density. Five fixed bands represent 1, 2, 3–4, 5–7, and 8+ cooks.
- Culinary Peaks uses the same country totals and colors, adding restrained vertical height and an exact count. Peak height is capped so large histories remain legible on an iPhone.
- Keep photographs in the world region shelf, focused-region country shelf, country sheet, and dish history rather than using them as density marks.
- Provide a visible scale, an exact ranked text summary, and photographic shelves so color or precise polygon tapping is never the only route.
- Unmapped dishes appear in “Needs a map location” and never receive invented coordinates or affect country totals.

## Drill-down hierarchy

- The full map progresses through world, culinary region, country sheet, and canonical dish history.
- Active regions show at most three overlapping dish photos plus a numeric remainder. Limited slots favor different countries before filling by dish frequency.
- Region focus is tap-driven with a preset viewport. Free pan, pinch zoom, and horizontal scrolling inside the map are not used.
- A focused region pairs its map controls with a horizontally scrolling country shelf. Each country card shows its leading photo and exact dish and cook totals.
- Country dishes open in a modal bottom sheet with a visible Close control, keyboard focus containment, and focus restoration.
- Dish history is a normal screen and shows all saved cooks; Back restores the selected country sheet and region context.

## Advanced dish controls

- World and focused regions expose one labeled segmented control for Cook Density and Culinary Peaks. Cook Density is the initial mode; the last owner choice is remembered on-device.
- Both views use the same country-level cook totals, deterministic five-band scale, and selected year. Switching presentation never changes data or navigation.
- Small and geographically dense countries remain discoverable through the corresponding region or country shelf, which provides 44-pixel targets and exact counts.
- Region focus remains tap-driven. Free pan, pinch zoom, and horizontal scrolling inside the map are not introduced.
- Dish history provides **Customize map**. Its sheet combines eligible-photo selection with approximate in-country placement, directional nudges, Reset, Save, and Cancel.
- Location drag is never the only interaction. Invalid out-of-country placement is rejected without changing the draft.

## Photography and performance

- The latest cook is the dashboard hero.
- The preview loads at most 12 map photographs and labels itself as recent geography.
- Reserve every photo frame before loading and use cropped optimized blobs already stored on-device.
- Food photographs retain natural color; the atlas remains visually quiet around them.

## Responsive behavior

- The header and bottom navigation respect all iPhone safe-area insets.
- Scrolling content remains separate from the fixed navigation and retains its position when returning from Map.
- Horizontal dish rows contain their own overflow and never widen the document.
- Portrait and landscape layouts preserve 44-pixel controls and expose all content by vertical scrolling.
