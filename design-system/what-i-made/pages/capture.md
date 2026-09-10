# Capture and Confirmation

> **Status:** Prototype rules  
> **Overrides:** These decisions refine the [What I Made master design system](../MASTER.md) for the post-cooking capture flow.

## Purpose

Let the owner preserve a valid cooking occasion while the food is still hot. The common path must require only a photograph and dish name, remain understandable at a glance, and make voice feel like a shortcut rather than a prerequisite.

## Flow

1. Add or take the main photograph.
2. Speak naturally or type the dish name.
3. After Done, replace the final voice segment with a meaning-preserving cleaned version and reveal recognized fields.
4. Review structured suggestions, including country, on one confirmation screen.
5. Optionally add more dishes, each with its own details and photograph.
6. Save and show the occasion’s dishes in their individual histories.

The confirmation screen is one step, not a wizard. Back navigation returns to the intact capture draft.

## Visual hierarchy

- The selected meal photograph is the largest element on capture and confirmation.
- Use the serif display face for the prompt and confirmed dish name only.
- One terracotta primary action appears per screen.
- Voice uses a bordered interaction group with explicit idle, listening, transcribing, stopped, and error states.
- The short **Organizing your note…** state is a stable polite live region. It does not replace or move the transcript control.
- Required and optional status is written beside visible labels; placeholders never carry that meaning.
- **Cooked on** is required on Review, defaults to the current local date, and uses the native date control. It accepts January 1, 2026 through today and explains that range beside the field.
- Extracted values use **From your note**; inferred values use **Suggested**. Both remain visually editable. Do not show numeric confidence, sparkle icons, or anthropomorphic AI language.
- Country is the only origin field in capture. Do not ask for cuisine, region, or precise map location.
- Country uses a searchable combobox backed by the map catalog. Suggestions appear while typing, options and errors remain reachable by keyboard and VoiceOver, blank is valid, and unresolved non-empty text cannot be saved.
- A unique strong international-dish correction is labeled **Suggested from your note** with 44-pixel Undo and Change actions. Uncertain text remains untouched.

## Interaction

- Camera, photo-library, microphone, stop, back, and save targets are at least 44 by 44 CSS pixels.
- The microphone announces recording state and elapsed time, exposes a visible Stop action, and retains partial transcript after failure.
- A typed alternative remains visible before microphone permission is requested.
- Photo plus either a dish name or a describable note control whether Review is enabled; optional fields never block it.
- A unique exact local canonical-name or alias match may be selected initially. Fuzzy archive candidates are never selected initially, and every archive match remains a labeled radio choice rather than an automatic merge. This is separate from the visible, undoable spelling correction applied to a uniquely recognized international dish.
- **More dishes** is progressive disclosure on Review. Each added dish keeps its own country, rating, notes, ingredients, canonical-match choice, and optional photograph.
- One submit commits the occasion, every reviewed dish, and every prepared photograph; partially saved occasions are never shown.
- The confirmed country seeds an initial map point; precise adjustment belongs to the later dish or map view.
- Submission shows an `aria-busy` state, preserves layout, and ends with explicit success or recovery feedback.
- Capture is a child of the journal. Its header uses a leading **Journal** back action, a centered **New cook** title, and no inert **Cancel** control.
- Leaving capture with unsaved changes requires confirmation. The trailing header cell aligns to the far edge so centered titles do not crowd actions at iPhone text sizes.

## Responsive behavior

- At phone widths, the flow fills the viewport and respects top and bottom safe areas.
- On larger screens, the phone surface is centered beside prototype notes; application content remains phone-width to preserve the target context.
- Landscape uses a wider photograph and a single vertical document scroll. It does not create nested scroll regions.
- Enlarged text may increase screen length; controls and labels wrap rather than truncate.

## Accessibility

- Focus moves to each screen heading after forward or back navigation.
- Recording and submission status use polite live regions and never steal focus.
- Every icon is paired with visible text or an accessible name.
- Error messages state what happened and how to continue.
- An invalid, pre-2026, or future cooking date is announced inline and receives focus before save.
- Reduced motion removes transitions but not state feedback.
- Photograph alt text uses the confirmed dish name and date when available.

## Prototype validation

- Complete ten minimum captures with a real photograph and dish name; target median is no more than 20 seconds.
- Complete ten representative voice notes and record latency plus correction effort.
- Test camera permission denial, unavailable speech recognition, and failed classification without losing the visible draft.
- Test at 375 CSS pixels, iPhone landscape, enlarged text, reduced motion, and dark appearance.
