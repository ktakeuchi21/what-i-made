# Ideas: Recipes to Cook Later

## Outcome

Ideas extends What I Made from reflection into lightweight cooking inspiration without turning it into a meal planner. The owner can paste a public recipe URL or describe a dish, review an editable recipe snapshot, and keep it locally until they choose to cook it. Ideas do not affect the Year, Map, Journal, or dish totals until a linked cooking attempt is saved.

## Experience

- **Ideas** is the fourth bottom destination. It opens a newest-first two-column photo grid with text search and All, Unmade, and Made filters.
- **Paste a link** accepts public HTTPS recipe pages. **Describe a dish** presents at most three sourced choices. Search failure offers refinement, manual entry, or an explicitly labeled AI-generated draft.
- Every retrieved or generated result passes through Review. Title, description, yield, times, ingredients, steps, notes, attribution, and photograph remain editable.
- Detail preserves the saved snapshot and source link. Refresh is explicit and opens another review; it never overwrites silently.
- **Start a cook** prefills the existing capture with title and ingredients. The owner's photograph is still required. Saving the attempt derives the Idea's Made state without removing it.
- Duplicate canonical source URLs reopen the existing Idea. Deletion removes only the Idea and cached source image; cooked history survives.

## Interaction and accessibility

The page extends the existing culinary-field-journal tokens: photography leads, recipe names use the editorial serif, and controls remain system sans. All targets are at least 44 CSS pixels. Search and network errors are announced and remain adjacent to their fields. Loading uses `aria-busy`; Back restores query, filter, and scroll position. Saved content remains available offline. Large text, dark appearance, reduced motion, iPhone safe areas, and portrait and landscape layouts must not clip content or introduce horizontal page scrolling.

## Acceptance criteria

- `AC-I1`: A valid public recipe URL opens an editable attributed recipe and saves locally with an optimized image when one is available.
- `AC-I2`: A dish description returns no more than three sourced choices; no result offers a labeled AI fallback and manual entry.
- `AC-I3`: Saved Ideas can be searched and filtered as All, Unmade, or Made, newest first, without changing archive totals.
- `AC-I4`: Starting from an Idea and saving a cook links the attempt and moves the Idea into Made while retaining the Idea.
- `AC-I5`: A duplicate source opens the existing Idea; refresh requires review; deletion preserves cooking records.
- `AC-I6`: Failed or offline network work retains entered text and any saved recipe or draft.
- `AC-I7`: The complete flow is usable with VoiceOver, keyboard, large text, reduced motion, and 44-pixel targets at 375 CSS pixels and in iPhone landscape.

## Non-goals

Meal planning, serving scaling, grocery lists, reminders, cooking checklists, social/video extraction, paywall bypassing, automatic refresh, and cloud recipe synchronization remain out of scope.
