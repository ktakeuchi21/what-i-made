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

- Use quiet bundled Natural Earth 1:110m country geometry in a Natural Earth projection with fixed-size photo cells. Do not use external tiles, conventional pins, persistent country fill, bubbles, or flags.
- Place each dish near the dataset's representative country label point. Selection may temporarily tint the matching country, but repetition never changes country geometry or fill.
- One cell represents one canonical dish. A numeric label always exposes the exact cook count.
- Different dishes at the same country point receive deterministic neighboring positions.
- Full-map cells are native buttons with a minimum 44 by 44 CSS-pixel target and visible selected state.
- The geographic list duplicates every mapped dish, country, and exact count for keyboard and screen-reader access.
- Unmapped dishes appear in “Needs a map location” and never receive invented coordinates.

## Drill-down hierarchy

- The full map progresses through world, culinary region, country sheet, and canonical dish history.
- Active regions show at most three overlapping dish photos plus a numeric remainder. Limited slots favor different countries before filling by dish frequency.
- Region focus is tap-driven with a preset viewport. Free pan, pinch zoom, and horizontal scrolling inside the map are not used.
- A focused region pairs its map controls with a horizontally scrolling country shelf. Each country card shows its leading photo and exact dish and cook totals.
- Country dishes open in a modal bottom sheet with a visible Close control, keyboard focus containment, and focus restoration.
- Dish history is a normal screen and shows all saved cooks; Back restores the selected country sheet and region context.

## Advanced dish controls

- Focused regions expose one labeled segmented control for Photo Density and Needle Field. Photo Density is the initial mode; the last owner choice is remembered on-device.
- Both modes use five repeat bands: 1, 2, 3–4, 5–7, and 8+ selected-year cooks. Photo cells never grow; needles change height. Exact numeric counts remain visible.
- Collision groups preserve 44-pixel targets with 8-pixel separation. Same-country groups open a fitted country close-up; mixed-country groups open a nearby-dishes sheet grouped by country.
- Country close-ups remain tap-driven. Free pan, pinch zoom, and horizontal scrolling inside the map are not introduced.
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
