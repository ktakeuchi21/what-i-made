# Capture Flow Prototype Test Report

> **Updated:** September 8, 2026
> **Target:** `prototypes/capture-flow/index.html` served locally over HTTP  
> **Scope:** Invitation accounts and private archives, capture, multi-dish occasions, expandable photo galleries, voice suggestions, canonical local archive, searchable Journal, calendar-year photo recap, Year dashboard, accurate Natural Earth photo map, Ideas, backup/restore, navigation, and responsive behavior

## Invitation-only private archives

### Automated proof

- The client/domain suite passes 133 tests. Account tests prove deterministic opaque archive keys, separate database names, stale-open race rejection, account-scoped map preferences, retained sessions, PKCE state and nonce checks, refresh subject continuity, fail-closed cleanup across deletion errors and relaunch, sign-out versus refresh ordering, and the exact seven-day offline boundary. Static-boundary coverage also proves the owner-token controls and legacy service endpoint fallbacks are absent and missing invitation configuration locks the archive.
- Capture assistance passes 21 tests, Recipe Ideas passes 28, and the Transcribe signer passes 6. Every service requires trusted API Gateway access-token claims for the configured Cognito client and explicitly rejects the retired shared-token path. Missing durable-limit configuration fails closed. Atomic DynamoDB counter tests prove pseudonymous route/minute keys, TTL, and conditional rejection.
- The invitation SAM template passes `cfn-lint` 1.46 with SAM translator 1.109. Every paid route declares JWT scope authorization, optional quota-safe reserved concurrency, a kill switch, and DynamoDB counter access. All three Lambda packages have audited dependency lockfiles, and the locked DynamoDB SDK loads locally. Legacy Function URLs were removed from PWA source configuration.
- Legacy migration unit tests prove owner-digest gating and inclusion of all seven local stores. `test-fixtures/private-migration.html`, kept outside the deployable PWA directory, uses a unique fixture-only database name, migrates it into an empty account namespace, and checks that the source remains intact; its browser run is pending because the Mac was locked during this pass.

### Browser proof

- In an isolated Chromium session, the unconfigured build rendered only the invitation screen, disabled sign-in with “Invitation sign-in is not configured,” created no IndexedDB databases, made no application API request, and logged no console errors. The fake invited-account harness then opened Alice’s empty private archive, showed no owner-token controls or copy, and rendered the Account/backup screen at 375×812 with a 375-pixel document width.
- In Chromium, Alice saved one Oyakodon cook. Bob then opened an empty archive at the same app origin. Returning to Alice restored exactly one dish, one cook, and one country. The Account screen showed only the active email and local-archive status; owner-token setup was absent.
- Production Cognito redirects, API Gateway pre-Lambda rejection, legacy-owner migration UI, old Function URL removal, and installed-iPhone suspend/resume and VoiceOver remain deployment evidence gaps.

## Smarter voice capture assistance

### Automated proof

- The complete browser/domain/voice suite passes all 113 tests. New coverage proves strict bounded response validation, the text-only request contract, filler cleanup with meaningful “like” preservation, shared confidence thresholds, cleaned-segment isolation, useful-only alias learning, country-code rejection, unique exact canonical and alias matching, unselected fuzzy candidates, country-conflict exclusion, and deterministic ranking.
- Capture-assistance service coverage now uses only trusted Cognito access-token claims; the retired shared-token path is absent. Tests also cover the kill switch, bounded and rate-limited requests, privacy-safe token-count metrics, non-stored deterministic Bedrock output through Mantle Responses and Bedrock InvokeModel, safe isolation of GPT OSS final JSON after private reasoning, new-segment-only cleanup, provider timeout and size failures, country-catalog parity, cleanup fixtures, and the supported structured-output schema subset.
- The unchanged Recipe Ideas service passes all 26 security and contract tests. JavaScript syntax checks pass for the updated browser and service modules.

### Browser proof

Using headed Chromium with local voice and assistance fixtures:

- Completing the sample voice note changed the finalized text to “I made Oyakodon, eight out of ten. Use less soy next time.” and populated Oyakodon, rating 8, notes, and Japan. The longer on-screen audio and device-storage disclosure paragraphs were removed as requested.
- A controlled two-dish response rendered Chicken adobo and Garlic rice as separate review sections with their own ratings, ingredients, notes, and Philippines country values.
- An existing Oyakodon archive produced one preselected exact match. Renaming the capture to Chicken Oyakodon surfaced Oyakodon only as an unselected possible match and kept **Make a new dish** selected.
- A 0.72 inferred Philippines result did not fill Country; it exposed an explicit **Use Philippines** action. A manually entered dish name survived the response.
- A simulated service failure retained the verbatim transcript, applied the conservative local fallback, kept review and save usable, and exposed one explicit **Retry smart suggestions** action. Switching the fixture to success and choosing Retry removed the warning and populated the missing ingredients, notes, and Philippines value.
- Editing the transcript during a delayed assistance request aborted that request; the subsequent review retained the owner’s corrected text and dish instead of accepting the late service result.
- Retrying from confirmation preserved an owner-edited note and a manually added Side salad while filling previously untouched primary ingredients and the suggested Philippines country. A server-declared unknown country kept Oyakodon’s Country field blank instead of reviving a local guess.
- Retrying also preserved an explicit **Make a new dish** choice in the presence of a unique exact Oyakodon match, preventing an unintended merge.
- A rating deliberately cleared after local parsing remained blank after both another transcript edit and a high-confidence remote rating response.
- Additional dishes use the same field thresholds as the primary dish. A deliberately low-confidence secondary rating stayed blank, and a 0.72 inferred country appeared only as **Use Philippines**.
- At 375×812 in dark appearance, reduced motion, and 125% root text, document width equaled viewport width and every measured interactive target was at least 44×44 pixels. At 812×375, document width again matched the viewport. The exercised flows produced no console warnings or errors.

Artifact: `output/playwright/smarter-capture-375-dark.png`.

### Remaining deployment and real-device evidence

This workspace has no AWS CLI or recorded capture-assistance Lambda target, and the production endpoint meta value remains intentionally blank. Deploy the service first, verify its token protection and redacted CloudWatch logs, then configure the HTTPS endpoint and repeat the voice, timeout, VoiceOver, network-payload, and installed-iPhone checks before calling the production rollout complete.

## Multi-dish occasions and expandable galleries

### Automated proof

- The archive model tests prove IndexedDB schema version 5, a non-unique occasion-to-attempt relationship, deterministic dish order, one nested occasion with several dish attempts, flat dish projections for Year/Map/history, and main/extra photograph assembly.
- Journal tests prove that dish-name, country, and rating criteria must match the same attempt inside an occasion and that the recap includes every main, dish-assigned, and occasion-wide photograph.
- Dashboard tests prove two dish attempts in one occasion produce two dishes but one cook. Backup tests accept multiple attempts and extra photographs while retaining schema-v2 portability.
- The complete browser/domain/voice regression command passed 101 tests; the Recipe Ideas service retained all 26 passing contract and security tests. JavaScript syntax checks passed.

### Browser proof

Using headed Chromium with an isolated local archive:

- Review saved Oyakodon and Miso soup in one atomic occasion. IndexedDB contained one occasion and two attempts; Year showed 2 dishes, 1 cook, and 1 photo; the success copy used correct plural grammar.
- Journal rendered one occasion card naming both dishes. Occasion detail exposed two independently editable dish cards and the shared photograph gallery.
- Adding Spinach goma-ae after save with an optional photograph atomically increased the occasion to three attempts and two photos; the new photograph was assigned to that dish.
- Removing two dishes retained the occasion, its photographs, and the remaining Spinach goma-ae attempt; **Remove dish** became disabled when only that final dish remained.
- Promoting the dish photograph updated the stored `mainPhotoId` and roles. The active main photograph disabled both **Make main photo** and **Delete photo** with a replacement explanation; the former main then allowed deletion. Deleting it preserved the promoted main and the occasion.
- Reassigning a dish's default extra photograph to the whole occasion kept the image and repaired that dish's map-photo reference to the still-eligible main photograph.
- Adding another photograph later through the Library control restored a two-photo gallery. Photo recap then displayed both images and announced “2 photos across 1 month.”
- A real version-one IndexedDB fixture upgraded to version 5, retained both legacy cooks and occasions, and changed `attempts.occasionId` from unique to non-unique.
- At 375×812 in dark appearance, reduced motion, and 125% root text, the recap had zero horizontal overflow and no visible target below 44×44 pixels. At 812×375 it also had zero horizontal overflow. The exercised flow produced no console warnings or errors.

Artifact: `output/playwright/multi-dish-recap-375-dark.png`.

### Remaining real-device evidence

Camera/library handoff, VoiceOver focus and announcements, physical safe areas, and largest iPhone Dynamic Type still require the installed-iPhone pass.

## Stronger Journal and photo recap slice

### Automated proof

- The Journal model tests cover punctuation- and diacritic-insensitive dish search, mapped country aliases, deterministic country/year options, combined country/year/month/minimum-rating filters, Unrated filtering, individual repeat attempts, stable reverse chronology, month grouping, and an empty recap year.
- The complete 95-test regression suite and JavaScript syntax checks pass.

### Browser proof

Using headed Chromium with five disposable cooks across two years:

- Searching `creme brulee` returned the saved `Crème brûlée` cook. Applying September 2026 and 9+ together retained that result and displayed removable date and rating chips.
- Unrated returned exactly the two unrated cooks. A nonmatching query showed the result count, recovery explanation, and **Clear search and filters** action.
- The modal filter sheet exposed labeled country, year, month, and rating controls; month remained disabled until a year was chosen. Escape closed the sheet and returned focus to **Filters**.
- Opening a cook and returning restored the Journal query, filters, result count, originating cook focus, and the exact 249-pixel scroll position used by the test archive.
- Photo recap showed all four 2026 cook photographs under September and August. Switching to 2025 showed its January cook; opening it and returning restored 2025 and the originating photo, then Back restored the filtered Journal.
- A separate archive containing only a 2025 cook opened the 2026 recap with an explicit empty state and a 2025 alternative, without borrowing the older photograph. Its browser console contained no warnings or errors.
- At 375×812 the Journal, filter sheet, and two-column recap had no horizontal overflow. Every measured filter-sheet control was at least 44 pixels high. At 812×375 with dark appearance, reduced motion, and a 150% root font size, recap width matched the viewport and every interactive control remained at least 52 pixels high.

### Remaining real-device evidence

VoiceOver gestures, physical safe-area behavior, and largest iPhone Dynamic Type still require the installed-iPhone pass.

## Backup and restore slice

### Automated proof

- The 95-test browser/domain regression command passed, including backup naming and summaries, required-field and relationship validation, malformed image rejection, progress reporting, transient-draft exclusion, single-transaction empty-only restoration, and atomic archive clearing.
- JavaScript syntax checks passed for `app.js` and `archive-backup.js`.

### Browser proof

Using headed Chromium against `http://localhost:4173/prototypes/capture-flow/?voice=fake&recipes=fake`:

- The Year card opened Backup & storage with current cook, dish, Idea, image, browser-storage, and persistence information.
- Export produced `what-i-made-backup-2026-09-06.json`; a denied native share attempt correctly fell back to download and announced “Backup prepared.”
- Selecting that file showed its date, size, schema, and contents without writing. Restore remained disabled while the test archive contained data.
- The erase dialog focused its labeled field, kept its action disabled until `ERASE` was entered, returned focus on cancel, and atomically emptied the disposable browser archive.
- The retained inspection became restorable after erasure. Restore returned the cook and photograph with matching counts, and **View restored archive** reloaded Year successfully.
- An unsupported JSON file produced a focused error and did not change the existing count.
- The screen had no horizontal overflow at 375×812 or 812×375. Dark appearance, reduced motion, and a 150% root font-size simulation retained all content without horizontal overflow.

### Remaining real-device evidence

The native iPhone share sheet, Save to Files, restore from Files, VoiceOver announcements, and the measured one-year archive size still require the planned installed-iPhone pass.

## Ideas slice

### Automated proof

- `node --test prototypes/capture-flow/tests/*.test.cjs`: 60 tests passed, including complete backup-reference validation, canonical URL duplicate keys, normalized recipe snapshots, search across title/source/author/ingredients, newest-first All/Unmade/Made derivation, service-payload section adaptation, and `sourceIdeaId` on cooking attempts.
- `npm test` in `services/recipe-ideas`: service tests pass authentication, kill switch, Schema.org import, signed image proxy, provider schemas, sanitization, redirects, DNS rebinding/private-address rejection, byte/MIME limits, and whole-operation timeouts without live network calls.
- `node --check` passes for the changed browser and service JavaScript.

### Browser proof

Using the real in-app Chromium browser against `http://127.0.0.1:4173/prototypes/capture-flow/?recipes=fake`:

- `AC-I1` passed: importing the sample Oyakodon URL opened attributed editable fields and saved an optimized local photograph; detail showed ingredients, steps, source, and Open original.
- `AC-I2` passed: a `no results` description exposed refinement copy and Create AI draft; review identified it as AI-generated and showed no fabricated photograph.
- `AC-I3` passed: the saved card appeared in Ideas and exposed accessible All/Unmade/Made filters and text search.
- `AC-I4` passed: Start a cook prefilled Oyakodon and its ingredients, still required a cook photograph, and the saved attempt changed the retained Idea to Made.
- `AC-I5` passed for refresh: Refresh from source opened Review with an explicit changed-field summary and did not overwrite on entry.
- `AC-I6` passed for draft recovery: reloading during an AI review and choosing Add idea restored the editable draft; discard required confirmation.
- `AC-I7` passed in Chromium at 375×812 and 812×375 with no document-level horizontal overflow, correct heading focus, visible labels, and semantic buttons, tabs, and status regions. Console warnings and errors were empty during URL import and save.

### Remaining real-device evidence

Installed-iPhone VoiceOver announcements, camera handoff from an Idea, largest Dynamic Type behavior, and production AWS search/import calls remain to be exercised on the owner’s phone after deploying the Recipe Ideas endpoint. Browser and automated evidence do not substitute for those checks.

## Results

### Criterion: Capture can be completed with only a photo and dish name

**Result:** Pass

**Evidence:** At a 375 by 812 CSS-pixel viewport, **Review cook** was disabled before required input, became enabled after selecting **Use sample meal** and entering “Oyakodon,” and opened the populated confirmation screen.

**Gap:** Camera and Apple Photos sources passed the feasibility lab but remain to be rechecked in the integrated page.

### Criterion: Voice is optional and a typed alternative remains available

**Result:** Pass

**Evidence:** The initial screen exposes a labeled transcript textarea before microphone use. With `?voice=fake`, **Speak your cook** moved through connecting, listening, and finalizing states; partial words appeared in a separate live region; the final transcript populated dish name, rating, and notes; and each field remained editable. The already-deployed identical adapter has separately returned a usable transcript on the owner’s installed iPhone PWA.

**Gap:** The integrated capture page itself still needs one deployed iPhone pass. Browser speech recognition is intentionally no longer used.

### Criterion: Recorded details automatically fill all applicable fields

**Result:** Pass for the prototype parser

**Evidence:** Automated parser tests cover natural Oyakodon and carbonara notes. The rendered voice flow populated Oyakodon, rating 8, improvement notes, and Japan; the assisted sample additionally populated informal ingredients. Explicitly spoken country names populate Country and override dish-based inference. Bare countries must form a standalone clause, preventing false countries for “turkey sandwich,” “Chile relleno,” “Guinea fowl,” “Brazil nut cookies,” and “India pale ale”; marked U.S. and U.K. speech variants are supported. Browser flows verified Mexico autofill and verified that “Country is U.S. Notes: remind us to add less salt” produced United States while preserving “Remind us to add less salt.” Replacing that transcript with “Chile relleno was delicious” cleared the earlier country instead of carrying stale data forward. Unknown country values remain blank instead of being invented, and the final browser console had no errors.

**Gap:** Country coverage is an intentionally small rule set. Measure correction effort before deciding whether to add a production classification endpoint.

### Criterion: Voice failure retains an editable recovery path

**Result:** Pass

**Evidence:** With `?voice=fake&voiceFailure=connect`, the button returned to **Speak your cook**, the error explained that typing remained available, the transcript stayed enabled, and the console remained clean.

**Gap:** The deployed capture page still needs an iPhone denial/interruption check.

### Criterion: Back navigation preserves the capture draft

**Result:** Pass

**Evidence:** After reaching confirmation, **Back** returned to capture with `photoReady=true`, dish name “Oyakodon,” and **Review cook** still enabled.

**Gap:** Production persistence across reload, process termination, and service-worker update is not implemented in this prototype.

### Criterion: AI failure does not block manual confirmation

**Result:** Pass

**Evidence:** The **AI failure fallback** scenario displayed “Suggestions were unavailable,” retained the photo, dish name, rating, and notes, left country blank for manual editing, and completed the save interaction without console errors.

**Gap:** Network timeout, retry limits, and production parsing-schema validation belong to the production slice.

### Criterion: Country is the only origin field in confirmation

**Result:** Pass

**Evidence:** The assisted confirmation exposed exactly one Country textbox populated with “Japan.” Browser role queries found zero Cuisine fields and zero Approximate map location fields. In the assistance-failure path, the single Country field remained available and blank for manual entry.

**Gap:** Country entry remains freeform rather than a controlled country picker. Recognized country names and aliases now resolve against the bundled 177-country Natural Earth atlas; owner-adjustable label points remain a later enhancement.

### Criterion: A representative capture takes less than 20 seconds

**Result:** Unverified on the target device

**Evidence:** A browser-automated sample photo-plus-voice path reached the prototype success screen in 2 seconds and reported “within target.” This proves the interaction does not contain an intentional long delay, but it is not human or real-device evidence.

**Gap:** Run ten representative captures on the owner’s iPhone and use the median result.

### Criterion: Works at 375px wide without horizontal overflow

**Result:** Pass

**Evidence:** At 375 by 812, document `scrollWidth` equaled viewport width at 375. The capture header exposed a 44-pixel-high **Journal** back action and a centered **New cook** title with a measured 51-pixel gap between them. The journal header kept a 65-pixel gap between its centered title and trailing **New cook** action. The inert **Cancel** control is absent. Optional-only and active-voice drafts both produced a discard confirmation; dismissing it retained the draft and kept capture visible. Unit coverage proves confirmed discard releases active voice ownership and cancels its adapter before navigation. All visible buttons, text inputs, textareas, and file-input labels met a 44 CSS-pixel minimum height; no measured button was narrower than 44 pixels.

**Gap:** Browser chrome and real safe-area insets require an installed iPhone test.

### Criterion: Works in iPhone landscape

**Result:** Pass for responsive layout

**Evidence:** At 812 by 375, the desktop prototype panel was hidden, the application surface filled all 812 pixels, and document `scrollWidth` remained 812 with no horizontal overflow. The capture header retained a 44-pixel **Journal** target and 269 pixels between that action and the centered title.

**Gap:** Physical-device rotation and browser/home-screen chrome remain unverified.

### Criterion: Light and dark text/control pairs meet contrast requirements

**Result:** Pass for primary tokens

**Evidence:** Computed WCAG contrast ratios were 14.00 for light ink/canvas, 5.60 for light muted/canvas, 7.42 for the light primary button, 15.44 for dark ink/canvas, 9.91 for dark muted/canvas, and 7.84 for the dark primary button.

**Gap:** A visual dark-appearance pass and every composed/translucent surface still require browser and real-device inspection.

### Criterion: A saved cook reopens to the Year dashboard

**Result:** Pass in the browser implementation

**Evidence:** After two Oyakodon saves, a full reload opened Year at scroll position zero with one canonical dish, two cooks, one country, the latest photograph, one map cell labeled with exact count two, and one meaningful repeat. Journal remained reachable and retained both individual cooking attempts.

**Gap:** The deployed build still needs the same save, close, and reopen check on the installed iPhone. Browser backup and restore now pass; the native Files round trip remains to be verified there.

### Criterion: Legacy duplicate dishes migrate without losing history

**Result:** Pass

**Evidence:** A browser fixture created a real version-one IndexedDB archive with two exact normalized Big Mac dish records, two occasions, two attempts, and two photo blobs. Loading the upgraded archive opened Year with one canonical dish and two cooks, showed one map cell with exact count two, and retained two separate Journal cards. A second real version-one fixture containing distinct Japanese names (`親子丼` and `ラーメン`) upgraded successfully and opened Year with two distinct canonical dishes, two cooks, and one country. The browser console remained clean.

**Gap:** Deliberately interrupted storage migration remains covered by transaction design and pure consolidation tests rather than a browser-forced disk failure.

### Criterion: Year includes the requested dashboard content

**Result:** Pass

**Evidence:** The current-year home screen rendered the latest food photo, canonical dish count, cook count, countries explored, photo map preview, New this month, Meaningful repeats, Open journal, and complete Map navigation. Fixed-date model tests prove year filtering and last-30-day behavior.

**Gap:** The dashboard uses the current browser year only; calendar-year switching and recap are outside this increment.

### Criterion: Map represents dishes without inventing locations

**Result:** Pass

**Evidence:** Two Oyakodon attempts rendered one independently selectable Japan photo cell with count two and a matching accessible geographic-list button. A Family casserole with no country remained in Year, produced zero mapped dishes, and appeared under Needs a map location instead of receiving a point.

**Gap:** Owner-adjustable coordinates remain outside this increment.

### Criterion: Map uses accurate bundled geography

**Result:** Pass

**Evidence:** Both Year and Map rendered 177 Natural Earth 1:110m country paths through the same Natural Earth projection. A Norway cook, which was outside the former hand-maintained lookup table, appeared at Natural Earth's representative label point. Exact country names take precedence over territory aliases: regression coverage proves France, Denmark, Israel, and every bundled display name resolve to their own feature. Equivalent United States and USA records count as one country and receive neighboring dish positions. Selecting a photo applied selected state to the matching country geometry while the existing detail card and geographic list exposed the dish, country, and exact count. The generated asset is 151,180 bytes raw and 54,822 bytes gzip-compressed, below the 250 KB map budget.

**Gap:** Country borders are only as current as the deliberately bundled Natural Earth source. Owner-adjustable dish points and dense-region zoom remain later increments.

### Criterion: Dashboard and Map work at iPhone sizes

**Result:** Pass for browser layout

**Evidence:** At 375×812, Year reopened at scroll position zero with document `scrollWidth` 375 and three 52-pixel-high navigation targets. The complete Map exposed a selected photo cell, exact count, selected-dish detail, and geographic list. At 812×375, document `scrollWidth` remained 812 and the 65-pixel navigation bar left all content reachable by vertical scrolling.

The accurate-map pass retained `scrollWidth` equal to the viewport at both 375×812 and 812×375. The full-map photo target remained 46×46 pixels, 354 country paths were present across the two map surfaces, exactly one full-map country was selected, and the browser console contained no warnings or errors. The photo layer and SVG map now share the same centered 2:1 coordinate canvas at both sizes, eliminating marker drift from letterboxing. The local server log showed only same-origin application-shell requests.

**Gap:** Enlarged system text, VoiceOver gestures, and physical safe-area behavior require the installed iPhone pass.

### Criterion: A saved cook can be corrected without recreating it

**Result:** Pass

**Evidence:** A migrated Big Mac entry opened a prepopulated edit screen. Saving changed its name to Classic Big Mac, date to September 4, rating to 9, notes, ingredients, and country to Canada, then returned to the same cook detail with a visible “Changes saved” status. Reopening the app retained every value. Both journal attempts adopted the shared canonical name while the older attempt retained its original date and rating.

**Gap:** The deployed build still needs the same edit-and-reopen check on the installed iPhone.

### Criterion: A saved cook photo can be replaced locally

**Result:** Pass

**Evidence:** The edit screen accepted a local JPEG through Library, displayed processing feedback beside the photo controls, replaced the preview with the optimized image, saved it, and returned to detail with the new photograph. The archive update tests verify that the photo ID remains stable while the blob, MIME type, and byte length change.

**Gap:** Real Camera replacement and HEIC replacement need the integrated deployed-iPhone pass; both formats already passed the underlying photo-processing feasibility test.

### Criterion: Edit validation and cancellation protect saved data

**Result:** Pass

**Evidence:** Clearing the required dish name kept the form open, focused the invalid field, and exposed the browser validation message. Attempting to cancel a changed form produced “Discard your unsaved changes?” while an unchanged form returned immediately. Unit tests reject missing names, invalid dates, and empty replacement photos before update records can be committed.

Calendar validation rejects impossible month/day combinations at the storage boundary, and a cook whose required original photo record is missing cannot partially update shared dish data. Photo processing uses a request token so a superseded or canceled conversion cannot write late state; Save remains unavailable until the active conversion finishes.

While the atomic IndexedDB write is in progress, Cancel and both photo pickers are disabled so another navigation or replacement cannot race the committed payload.

**Gap:** Browser automation confirmed the dirty-state prompt but did not automate both dialog outcomes; the control-flow condition is covered by source inspection.

### Criterion: Edit layout works at iPhone sizes

**Result:** Pass for browser layout

**Evidence:** At 375×812 the screen opened at the top with a readable hero photograph, two labeled 48-pixel photo controls, shared-dish disclosure, visible field labels, and no horizontal overflow. At 812×375, document and form `scrollWidth` both equaled 812; Cancel measured 44 pixels high, photo controls 48 pixels, and Save changes 48 pixels. The browser console contained no warnings or errors.

**Gap:** Enlarged system text, VoiceOver gestures, and physical safe-area behavior require the installed iPhone pass.

### Criterion: Browser flow produces no console warnings or errors

**Result:** Pass

**Evidence:** Console warning/error collection returned an empty list after minimum, assisted, and assistance-failure flows.

**Gap:** None for the prototype paths tested.

## Commands and browser evidence

- JavaScript syntax: bundled Node.js `--check prototypes/capture-flow/app.js` — pass.
- Automated regression suite: 95/95 tests passed across Journal filtering, recap grouping, latest-request and navigation-cancellation protection, backup/restore, Natural Earth geometry and country resolution, canonical archive records and editing, Year/map derivation, capture draft protection, capture parsing, Ideas, photo URL ownership, the Transcribe adapter and codec, and the protected session handler.
- A browser-forced out-of-order recap read left the newest 2026 selection authoritative, rendering exactly four tiles across September and August with no stale or duplicate month sections.
- Leaving recap while a delayed year read was pending kept the hidden recap unchanged and returned to Year with its blob-backed hero photograph loaded at full width, proving the abandoned read could not revoke destination image URLs.
- Local servers: Python `http.server` on `127.0.0.1:4178` through `:4184` for normal, migration, empty archive, Unicode migration, edit verification, and accurate-map verification origins.
- Rendered checks: in-app Chromium browser at 375×812 and 812×375, including canonical repeats, migration, empty archive, missing country, Year, Map, Journal, and voice routes.
- Desktop framing: at 1024×900 the prototype panel was visible, the phone frame was 430 pixels wide, and document width matched the viewport.

## Release implication

## Advanced culinary map controls — September 7, 2026

**Automated result:** Pass. The complete client suite passes 103 tests, including all-country interior anchors, polygon validation, current-country backup validation, geography-version fallback, five repeat bands, letterboxed-map collision grouping, canonical photo eligibility for shared occasion photos, country-change invalidation, multi-dish aggregation, and schema-v2 compatibility.

**Browser result:** Pass for the implemented local flow. In the in-app Chromium browser, a saved Oyakodon opened World → East Asia with Photo Density and Needle Field controls. Needle Field persisted after reload. Adding Miso soup to the same occasion produced two mapped dishes but one Year cook; the focused region replaced their overlapping controls with “2 dishes in Japan, open close-up,” and the country close-up exposed both map controls and both shelf cards. Dish history opened from a marker, Customize map exposed the default photograph and drag/tap/nudge/Reset controls, a valid nudge saved successfully, Back restored East Asia and Needle Field, and the browser console remained free of errors and warnings.

**Responsive and accessibility evidence:** Mode controls measured 44 pixels high and dish markers measured 52 by 52 pixels. The rendered phone frame showed no app-level horizontal overflow in portrait styling. DOM accessibility snapshots exposed the mode group, exact-count dish labels, dense-cluster label, country close-up shelf, customization fieldsets, and named nudge controls.

**Remaining target-device gap:** Physical iPhone VoiceOver gestures, drag behavior, largest Dynamic Type, landscape safe areas, and installed-PWA update behavior still require the owner-device pass.

The canonical archive, Year dashboard, advanced culinary map, saved-cook editing, Ideas, and browser backup/restore are ready to package for an owner iPhone pass. Home Screen installation, camera/library capture, HEIC optimization, IndexedDB persistence, Apple Files export support, and Amazon Transcribe have separately passed on the target iPhone. The next archive proof is the complete Save to Files and restore round trip in the installed build; the remaining map proof is the physical-iPhone accessibility and gesture pass described above.
