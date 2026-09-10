# What I Made Design System

> **Status:** Proposed visual direction. Validate with the capture, dashboard, map, and dish-history prototypes before treating it as final.
>
> Page-specific decisions belong in `pages/<page-name>.md` and override this file.

## 1. Design thesis

What I Made should feel like a well-kept culinary field journal laid over a quiet world atlas. It is warm, tactile, photographic, and exploratory. It is not a sterile analytics product, a restaurant ordering app, a scrapbook full of decoration, or a game.

Photography is the strongest visual material. Maps and small data displays organize the memories without competing with them. Editorial serif type adds warmth to dish names and year summaries; a system sans serif keeps controls fast and familiar on iPhone.

Design dials:

- Personality: 6/10. Distinctive, but the food stays central.
- Motion: 3/10. Subtle and causal.
- Density: 5/10. Comfortable for touch without wasting the phone screen.
- Texture: 2/10. A slight paper or grain effect may appear in large empty surfaces, never over photos or text.

## 2. Color

### Light appearance

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#F7F1E7` | App background, reminiscent of warm paper |
| Surface | `#FFFCF7` | Sheets, fields, and focused content |
| Ink | `#24231F` | Primary text and icons |
| Muted ink | `#665F56` | Secondary text |
| Terracotta | `#8A3F2D` | Primary action, selection, active state |
| Moss | `#465641` | Secondary emphasis and exploration context |
| Saffron | `#D49A43` | Highlights with dark ink, never small white text |
| Atlas water | `#E7ECE8` | Map water |
| Atlas land | `#D6CDBC` | Inactive land |
| Border | `#CFC4B4` | Dividers and control boundaries |
| Destructive | `#A52A2A` | Delete and destructive confirmation |

### Dark appearance

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#171814` | App background |
| Surface | `#21231D` | Sheets, fields, and focused content |
| Ink | `#F3EEE5` | Primary text and icons |
| Muted ink | `#C8C0B5` | Secondary text |
| Terracotta | `#E49A7F` | Primary emphasis with dark content |
| Moss | `#A8BC98` | Secondary emphasis |
| Saffron | `#E3B769` | Highlights with dark content |
| Atlas water | `#252B28` | Map water |
| Atlas land | `#42443C` | Inactive land |
| Border | `#5A574E` | Dividers and control boundaries |
| Destructive | `#FF9B95` | Delete and destructive confirmation |

Rules:

- Text and meaningful controls must meet WCAG AA contrast in both appearances.
- Never use color alone to communicate newness, rating change, or dish attempt count.
- Food photographs keep their natural color. Do not apply a global sepia or vintage filter.
- Map geography stays quiet. Dish cells and relief carry the emphasis.

## 3. Typography

- Display and dish names: `ui-serif, Georgia, Cambria, "Times New Roman", serif`.
- Interface and body: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif`.
- Data and ratings: the interface family with tabular numerals.
- Body text starts at 16 CSS pixels with a line height of at least 1.5.
- Use serif type selectively for dish names, year titles, and reflective summaries. Forms, filters, navigation, and dense data stay sans serif.
- Do not use handwriting fonts. They make the product feel themed and reduce scanability.

Suggested mobile scale:

| Role | Size | Weight |
| --- | --- | --- |
| Year/display | `34px` | 600 |
| Screen title | `28px` | 600 |
| Dish title | `22px` | 600 |
| Body | `16px` | 400 |
| Label | `14px` | 600 |
| Metadata | `13px` | 400 |

## 4. Layout and surfaces

- Use a 4/8-point spacing rhythm with 16px phone gutters.
- Respect the iPhone safe areas above fixed headers and below bottom navigation.
- Keep every primary tap target at least 44 by 44 CSS pixels and leave at least 8px between adjacent targets.
- Prefer one continuous photographic canvas over a dashboard made from many floating cards.
- Use rounded surfaces only for real interaction groups, selected details, sheets, and image frames. Do not put every statistic in a card.
- Image frames use restrained radii between 12px and 18px. Avoid exaggerated pill shapes for content.
- The dashboard defaults to the current year and establishes a visual rhythm of one hero memory, a small set of progress summaries, and direct paths to the map and journal.

## 5. Navigation

- Use four labeled bottom destinations on iPhone: Year, Map, Journal, and Ideas.
- Capture is the single primary action and remains reachable without competing with the bottom destinations.
- Preserve scroll position and filter state when navigating back.
- Dish detail is a normal navigable screen, not a modal.

## 6. Photography

- Crop previews consistently but always offer a way to view the full optimized image.
- Lead repeat-dish pages with the photo sequence and rating progression.
- Reserve image dimensions before load to prevent layout movement.
- Load below-the-fold images lazily and use dedicated optimized thumbnails in grids, map shelves, selected country details, and dish history.
- Provide concise alt text generated from the confirmed dish name and date; allow later editing.

## 7. Culinary activity map

- The map behaves like a culinary data landscape, not a collection of conventional pins.
- Country-level selected-year cook totals drive both accepted views: Cook Density and Culinary Peaks.
- Cook Density fills countries with one of five sequential warm tones. Culinary Peaks adds a capped vertical height and exact count using the same bands.
- Countries without selected-year cooks remain quiet; unresolved countries receive no invented geography.
- A visible legend, ranked exact-count summary, and photographic region/country shelves ensure color and precise polygon tapping are never the only ways to understand or navigate the map.
- Photographs lead the shelves, country sheets, and dish histories rather than acting as the density encoding.
- The owner can still choose any eligible photo from a dish's cooking history as its default and adjust an approximate in-country location. These choices do not change country totals or past cooking records.
- Free map pan, pinch zoom, flags, conventional pins, growing bubbles, and a freely rotatable 3D scene remain rejected.

## 8. Motion

- Use motion to connect an action with its result: a saved cook joins its dish history, a selected dish cell reveals its detail, or a rating changes the progression line.
- Standard state changes use 160 to 220ms; exits are slightly faster than entrances.
- Do not use parallax, looping animation, confetti, or scroll-driven storytelling.
- Animate transforms and opacity, not layout dimensions.
- Respect `prefers-reduced-motion` and show the final state immediately.

## 9. Forms and voice capture

- Capture uses progressive disclosure: photo and dish name first; rating, notes, and ingredients remain optional.
- Labels remain visible. Placeholder text is never the only label.
- The microphone control shows recording state, elapsed time, stop, and cancel.
- A transcript remains editable before structured fields are confirmed.
- Errors stay next to the affected field and explain how to recover.
- Unsaved capture drafts survive accidental navigation.

## 10. Iconography and accessibility

- The installed app icon uses a centered ivory ceramic bowl with three steam strokes on a full-bleed terracotta field. It contains no text, lettermark, garnish, or baked-in corner mask; the platform applies its own icon shape.
- Keep the bowl and steam inside the central mask-safe area and preserve a strong silhouette at 32 pixels. The production raster master is `prototypes/capture-flow/assets/app-icon-master.png`.
- Use one consistent outline SVG icon family such as Lucide.
- Never use emoji as navigation or structural icons.
- Decorative icons are hidden from assistive technology. Icon-only controls have accessible names.
- Meaningful photos have alt text; decorative map texture does not.
- Support keyboard navigation, VoiceOver reading order, text scaling, landscape layout, and visible focus.
- Primary behavior never depends on hover, precision tapping, a swipe, or color alone.

## 11. Anti-patterns

- Country choropleths that imply all of Italy changes because pizza was repeated
- Conventional map pins, glowing halos, growing bubbles, and milestone rings for dish repetition
- Streaks, guilt-based prompts, badges, confetti, or competitive language
- Generic KPI-card walls
- Heavy map saturation that competes with dish photography
- Handwriting fonts for body copy or controls
- Decorative flags as the sole representation of country or origin
- Hidden labels, tiny map targets, and swipe-only actions
- Uploading or filtering photographs without an explicit product requirement

## 12. Prototype acceptance checklist

- Works at 375px wide, in iPhone landscape, and with enlarged text.
- No content sits under the notch, browser chrome, or home indicator.
- All tap targets meet the 44px minimum with 8px spacing where adjacent.
- Light and dark text and controls meet contrast requirements.
- Dish repetition remains understandable without color or 3D perspective.
- Reduced motion retains every state change and piece of information.
- Capture can be completed with only a photo and dish name.
- Photos remain the most visually prominent content.
