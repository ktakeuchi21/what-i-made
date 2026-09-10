# What I Made User Story Map

> **Status:** Draft release map  
> **Date:** August 30, 2026  
> **Source:** [PRD](./PRD.md) and [discovery brief](./DISCOVERY_BRIEF.md)

## Who

### Segment

One frequent home cook building and maintaining a private iPhone app for personal use.

### Persona

The owner cooks seven to nine lunches and dinners in a typical week, wants very low post-cooking friction, prefers voice to typing, and values pride, memory, and exploration more than productivity or gamification.

## Narrative

After cooking, preserve the meal before its context disappears, then use the growing archive to understand what is new, what improved, and where the cooking journey has gone.

## Backbone

| 1. Preserve the cook | 2. Confirm its meaning | 3. Revisit the archive | 4. Understand progression | 5. Protect the history |
| --- | --- | --- | --- | --- |
| Capture the moment with minimal interruption. | Turn informal input into trustworthy records. | Find a dish, date, country, or memory later. | Recognize new dishes, improvement, and exploration. | Keep the archive portable and recoverable. |

## Activities, steps, and tasks

### 1. Preserve the cook

**Steps**

1. Start a cooking occasion.
2. Add a main photograph.
3. Name the first dish.
4. Add optional context.
5. Add another dish when needed.

**Tasks**

- Open capture from the installed Home Screen app.
- Take a photo with the camera or choose one from the library.
- Preview, replace, or remove the selected photo.
- Enter a dish name by voice or typing.
- Accept the automatic date or edit it.
- Optionally add a whole-number rating, notes, and informal ingredients.
- Optionally add a second dish and a dish-specific photo.
- Preserve a local draft before any network request.
- Recover the draft after accidental navigation or service failure.

### 2. Confirm its meaning

**Steps**

1. Review the cleaned transcript after filler words and false starts are removed.
2. Review proposed fields.
3. Decide whether the dish already exists.
4. Confirm the country.
5. Save or correct the entry.

**Tasks**

- Edit the cleaned transcript; retain verbatim text when assistance fails.
- Review up to six dish-specific proposals extracted from one note.
- Accept an explicit or high-confidence country, or choose a lower-confidence country suggestion.
- Accept, clear, or change proposed dish name, rating, notes, and ingredients.
- Accept or change the proposed country.
- Search canonical countries and aliases, then select one map-safe country; ambiguous text such as “Korea” remains unresolved until selected.
- Review, undo, or replace a uniquely strong international-dish spelling correction.
- Confirm a unique exact existing-dish match, select an unselected fuzzy candidate, or keep the dish new.
- Continue manually when voice or parsing fails.
- Keep uncertain dish transcriptions unchanged and learn confirmed mishearings only as local aliases.
- Commit the required photo and dish data together.
- See a clear saved confirmation.

### 3. Revisit the archive

**Steps**

1. Browse recent cooking.
2. Search or filter.
3. Open an occasion.
4. Open a canonical dish.
5. Correct history.

**Tasks**

- Browse a reverse-chronological photographic journal.
- Search canonical dish names with case-, punctuation-, and diacritic-insensitive matching.
- Filter individual cooks by one country, optional calendar year and month, minimum rating, or Unrated.
- Combine search and filters, remove active filters individually, and preserve the Journal state after opening a cook.
- View all dishes and photographs in one occasion.
- Add another independently rated dish before or after the occasion is first saved.
- Remove a dish with confirmation while protecting the occasion's final dish.
- Edit any saved date, rating, note, ingredient text, country, or map location.
- Add optional photos later; assign each to one dish or the whole occasion, promote a main photo, and delete extras.
- Merge mistakenly separated canonical dishes without losing attempts.

### 4. Understand progression

**Steps**

1. Compare attempts of one dish.
2. Notice new and revisited dishes.
3. Reflect on the current year.
4. Explore geographically.
5. Curate a dish’s visual identity.

**Tasks**

- Lead dish history with photo and rating progression.
- Read chronological notes and a summary of changed details.
- Identify dishes first tried in the last 30 days.
- See revisited dishes whose ratings or notes changed.
- Open a calendar-year photo recap from Year or Journal, grouped by nonempty months with every cook photograph represented.
- Switch between Cook Density and Culinary Peaks.
- Compare selected-year country totals through a five-band color scale, capped peak height, and exact ranked summary.
- Change the default photograph used by a dish’s geographic drill-down and history.
- Use photographic region and country shelves when a geographic area is too small or dense to tap precisely.
- Adjust a dish inside its confirmed country by tap, drag, or directional nudge, or reset it to automatic placement.

### 5. Protect the history

**Steps**

1. Understand local storage status.
2. Export a portable backup.
3. Save it through Apple Files.
4. Validate a backup.
5. Restore an empty installation.

**Tasks**

- See that local storage is not itself a backup.
- Create a versioned archive containing data and optimized photographs.
- Share or download the archive to Apple Files.
- Reject corrupt, truncated, or unsupported archives without writing records.
- Restore all supported data into an empty installation.
- Confirm restored counts, relationships, and readable optimized images.

### 6. Enter a private invited archive

**Steps**

1. Open the shared PWA link.
2. Sign in with an invited email and one-time code.
3. Use only that account's local archive.
4. Sign out without deleting it.

**Tasks**

- Reject self-registration and uninvited identities.
- Retain a verified session so normal launches do not require another code.
- Derive a non-readable account namespace before opening IndexedDB.
- Keep local features available for up to seven days offline.
- Require a current scoped token for voice and recipe services.
- Open Account from every top-level archive view and sign out on this device without erasing its archive.
- Move the original owner's fixed archive once, only into the configured empty owner archive.

### 7. Understand the product before joining

**Steps**

1. Open the shared app link without an account session.
2. Enter a fictional sample archive.
3. Explore the real read-only product surfaces.
4. Return to sign-in or start an invited session.

**Tasks**

- See a clear sample-archive action before sign-in.
- Explore a fictional Year, all 13 map regions, Journal discovery, photo recap, histories, and Ideas.
- See believable real-food photography while retaining access to each photograph's creator, source, license, and disclosed local crop.
- Keep the sample visibly labeled and route personal actions to invitation sign-in.
- Enter a private archive without sample state or records.

## Vertical release slices

The slices below are delivery milestones within version one. Each ends in something the owner can use or validate; none requires building the entire horizontal layer first.

### Enabling proof — iPhone feasibility spikes

Not a product release. Before feature breadth, prove Home Screen installation, camera and library inputs, HEIC/orientation handling, local photo optimization, IndexedDB persistence, Apple Files export, and browser voice behavior on the actual device.

### Slice 1 — Durable personal archive

**Outcome:** A meal can be captured, corrected, found later, and recovered from backup.

- Photo plus dish-name capture.
- Automatic/editable date.
- Local draft and atomic save.
- Manual optional rating, notes, and ingredients.
- Reverse-chronological journal and dish-name search.
- Edit a saved entry.
- Export and empty-install restore through Apple Files.

**Why first:** It delivers the core job without depending on AI, maps, or a cloud service, and protects valuable data from the first real use.

### Slice 2 — Effortless assisted capture

**Outcome:** Natural speech reduces post-cooking effort while the owner remains in control.

- Browser voice adapter or selected AWS fallback.
- Editable transcript.
- Proposed dish, rating, notes, ingredients, and country.
- Quick confirmation screen.
- Local existing-dish suggestion and owner confirmation.
- Manual multi-dish occasion.
- Saved-occasion dish additions and expandable photo gallery.
- Manual dish merge.

### Slice 3 — Visible progression

**Outcome:** Repeated cooking becomes a coherent story rather than a list of records.

- Canonical dish detail.
- Photo and rating progression.
- Chronological notes and changed-detail summary.
- Current-year dashboard.
- New dishes in the last 30 days.
- Revisited dishes with meaningful changes.
- Dish-name search plus country, year/month, minimum-rating, and Unrated filters.
- Month-grouped calendar-year photo recap with direct cook navigation and Back restoration.

### Slice 4 — Culinary atlas

**Outcome:** The archive becomes an inspiring, immediately comparable geographic landscape.

- Approximate owner-editable dish locations.
- Cook Density choropleth view.
- Culinary Peaks height-and-color view.
- Visible five-band legend, ranked exact-count summary, and accessible geographic shelves.
- Tap-driven world → region → country → dish navigation with shelf alternatives in dense areas.
- Editable default map photograph per canonical dish.

### Slice 5 — Invitation-only private archives

**Outcome:** A small invited group can use one app link without sharing archive data or service credentials.

- Owner-administered Cognito membership with email one-time-code managed login.
- Separate account-scoped IndexedDB archives on the same device.
- Bounded offline access and complete sign-out cleanup.
- JWT- and scope-protected paid services with durable pseudonymous rate limits.
- Controlled, verified migration of the original owner's local archive.

### Slice 6 — Public sample archive

**Outcome:** A prospective invitee can understand the product before signing in without creating or contaminating an archive.

- Lazy-loaded, versioned in-memory fixture with original optimized photography.
- Explicit `signedOut`, `demo`, and `account` modes with no demo fallback to IndexedDB.
- Read-only exploration, invitation dialog, URL/Back behavior, runtime caching, and bounded deployment packaging.

## Deferred releases

### Decide what to cook

- **Delivered next slice:** Ideas collection with public recipe import, sourced dish search, editable local snapshots, and linked cooking capture.
- Later: ingredients-and-time recommendations grounded in history and preferences.

### Help while cooking

- Conversational technique support.
- Context-aware recipe and timing guidance.

### Nutrition and deeper analysis

- Macros and nutrition.
- Structured ingredients and recipes.
- Sentiment analysis.

## Gaps and opportunities

- The highest-risk gap is not feature scope; it is whether capture is fast enough during the real post-cooking moment.
- Backup belongs in the first usable slice because a local-only archive becomes more valuable and more vulnerable with every photo.
- AI is an enhancement to capture, not a dependency for creating a valid record.
- Multi-dish support should remain progressive disclosure so the common one-dish case stays fast.
- The map needs an accessible list alternative and exact counts because tiny cells, brightness, and 3D height cannot carry meaning alone.
- The first default-photo rule remains open. Manual replacement is confirmed; the initial automatic choice should be tested in the dish-history flow.
