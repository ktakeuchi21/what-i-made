# Capture Flow Prototype Test Report

> **Updated:** September 9, 2026
> **Target:** `prototypes/capture-flow/index.html` served locally over HTTP  
> **Scope:** Invitation accounts and private archives, capture, multi-dish occasions, expandable photo galleries, voice suggestions, canonical local archive, searchable Journal, calendar-year photo recap, Year dashboard, Natural Earth culinary activity map, Ideas, backup/restore, navigation, and responsive behavior

## Reachable account sign-in and sign-out — September 9, 2026

### Automated proof

- Cognito remains administrator-create-only with public self-registration disabled and email OTP enabled. Authorization Code with PKCE now requests an interactive managed-login screen after an explicit sign-out, while ordinary retained-session launches continue directly into the private archive.
- Browser-facing checks prove that Account is reachable from Year, Map, Journal, Ideas, capture, and Backup & storage; its bottom sheet has modal semantics, focus trapping, a visible close action, current invited identity, and **Sign out on this device**.
- Sign-out tests prove that the account database closes before rendered archive state and owned photograph URLs are cleared, the retained session is tombstoned and removed, late refreshes cannot reopen it, and Cognito receives only the registered client ID and logout URI.

### Browser proof

- In an isolated fake invited account, Account opened from capture with `alice@example.test`, trapped focus in the modal sheet, and Escape returned focus to the originating Account control.
- **Sign out on this device** closed the archive and displayed the signed-out discovery screen with **Sign in with email** and its one-time-code explanation. Explicit sign-in reopened only Alice's local test archive; the browser logged zero errors or warnings.
- At 375×812 and 812×375, the Account sheet kept its full identity, privacy explanation, Close action, and 48-pixel sign-out control visible without horizontal overflow.

### Remaining device proof

- A production or canary invited account must complete the real managed email-code flow and hosted logout redirect on an iPhone after this static release is deployed. The existing Cognito membership and allowed callback/logout URLs do not require a stack migration.

## Licensed sample photography — September 9, 2026

### Automated proof

- The version-2 demo manifest records 29 distinct Wikimedia Commons photographs with work title, creator, source page, approved open license, license link, and modification disclosure. Validation rejects missing attribution, unsupported rights, mismatched license links, mismatched Commons file titles, and non-Commons source pages.
- All 58 locally bundled derivatives are metadata-free WebP files with exact 320×240 thumbnail and 1200×900 display dimensions. Every thumbnail remains below 50 KB, every display remains below 250 KB, and the complete set is about 5.1 MB against the 12 MB budget.
- Jerk chicken, plov, pavlova, and lamingtons now use their own real photographs instead of unrelated shared imagery. The packaging test proves that only the 58 manifest-referenced files ship and rejects renamed, malformed, incorrectly sized, or metadata-bearing WebP files.
- Browser-facing tests prove that full work-title, creator, license, and crop attribution is rendered for cook and Idea photographs, including the selected photograph in a multi-photo action dialog.

### Browser proof

- The real in-app Chromium browser rendered the new lamington and Mul naengmyeon photographs in the Year, cook, and Idea flows. Cook and Idea details exposed keyboard-accessible photographer and license links plus the visible crop disclosure in the accessibility tree.
- On the phone-width application panel, attribution wrapped without horizontal overflow and remained visually subordinate to the photograph and dish title. Meaningful image labels continued to identify the fictional dish rather than exposing source filenames.
- A fresh signed-out origin requested the application shell but no demo manifest or food photograph. Demo media still begins loading only after the visitor chooses the sample archive.

## Cook Density and Culinary Peaks — September 9, 2026

### Automated proof

- The complete client, domain, and voice regression suite passes all 182 tests after removing the retired per-dish collision model.
- New geometry coverage proves the fixed 1, 2, 3–4, 5–7, and 8+ country cook bands; zero-count exclusion; deterministic count/name/key ordering; monotonic square-root peak height; and the 62-pixel cap.
- Static UI checks prove the new labels, legend, year-scoped explanation, version-44 service-worker assets, and absence of the retired Photo Density and Needle Field controls.

### Browser proof

- In the real in-app Chromium browser, the fictional world map colored all 22 represented countries and exposed all 13 culinary regions in the photographic shelf. Cook Density named Japan, India, and Nigeria as the exact top three without horizontal overflow or console errors.
- Switching to Culinary Peaks produced 22 peaks using the same country totals and correct `aria-pressed` state. Peak heights ranged from 25 to 44 pixels in the sample, and Japan's five-cook peak was visibly taller and warmer than one- and two-cook countries.
- East Asia isolated Japan at five cooks and South Korea at two cooks in both modes. The country shelf exposed both exact totals, and opening Japan moved focus into a three-dish sheet reporting five cooks.
- At a 565-pixel mobile panel, controls measured 44 pixels high, the document width matched the viewport, the five-band legend remained on one line, and the bottom navigation remained usable. A separate 1280-pixel pass preserved the same 22-country/13-region content and logged no console errors.
- The demo legend reported “Cooks in 2025.” A maximum 62-pixel Canada peak in the world-map harness retained 22 pixels of clearance above its count at the 398-pixel phone-frame width, proving the reserved northern margin prevents clipping.

## Dense map-mode correction — September 9, 2026

### Automated proof

- The full client, domain, and voice regression suite passes all 183 tests. New coverage proves deterministic frequency/recency/name ranking, Photo Density's three-image limit, Needle Field's five-column limit, repeat-band assignment, exact aggregate cook counts, and hidden-item counts for dense clusters.
- Syntax checks pass for the updated browser and geometry modules. The existing collision tests continue to prove deterministic grouping, same-country versus mixed-country behavior, and the 44-pixel minimum separation boundary.

### Browser proof

- At 375×812, dense East Asia changed visibly between a three-photograph stack and a four-column Needle Field while keeping the same four dishes and seven cooks.
- The segmented control exposed the correct `aria-pressed` state, the live status named the active mode, and the dense control's accessible name stated dish count, cook count, mode, location, and action.
- The dense control measured 52×52 CSS pixels, the document width matched the 375-pixel viewport, and its sheet exposed all four underlying dishes with exact counts. The exercised flow produced no console errors or warnings.
- Visual inspection confirmed both treatments remain readable over the map, retain the warm journal styling, and do not create overlapping hit areas.
- Amplify production deployment job 18 succeeded on September 9, 2026. The live `?demo=1` archive loaded the version-43 assets; East Asia switched from three photographs to four needles, retained its four-dish/seven-cook label and 52×52 control, and opened all four underlying dishes.

## Public sample archive — September 9, 2026

### Automated proof

- Focused tests validate exactly 36 occasions, 40 attempts, 28 canonical dishes, 22 countries, all 13 culinary regions, 40 photographs, eight Ideas, two Made links, deterministic IDs, previous-year derivation, references, country parity, local search/filtering, and a repository with no database or mutation methods.
- Manifest media validation proves every asset exists, remains under 50 KB or 250 KB as appropriate, and totals about 4.1 MB. Packaging copies only the 52 referenced variants and preserves the 12 MB rejection boundary.
- Static-boundary checks prove the signed-out actions, fictional/sample disclosures, `demo=1` addition/removal, OAuth precedence branch, explicit demo repository selection, write-control interception, and absence of demo JSON/photographs from the service-worker shell.

### Browser proof

- The local signed-out page displayed Explore first and sign-in second. Server requests showed no demo JSON or food photograph before Explore.
- Explore preserved `release=boundary-test`, added `demo=1`, opened a 2025 sample with 28 dishes, 36 cooks, 22 countries, and 40 photos, and Browser Back returned to the signed-out URL while preserving the unrelated parameter.
- The map exposed all 13 culinary regions and drilled into North America with country alternatives and both temporary map modes. Journal rendered all 36 occasions including four multi-dish entries. Ideas rendered eight cards with two Made states and complete recipe detail.
- New cook opened the accessible invitation modal and Keep exploring restored focus to its originating control. The Backup card was absent. The exercised browser flow logged no console warnings or errors.
- Visual inspection in the in-app browser confirmed the established dark culinary-journal treatment, persistent sample label, readable welcome hierarchy, fixed four-tab navigation, and no page-level horizontal overflow.

### Production rollout

- Amplify accepted the validated 5.2 MB static bundle and reported the `main` branch deployed on September 9, 2026.
- A live smoke test at the production origin opened the direct `demo=1` route with the current sample counts, Lamingtons as the latest cook, and the versioned sample media.
- Installed-iPhone checks remain for VoiceOver gestures, largest Dynamic Type, portrait/landscape safe areas, offline revisit after one online sample visit, and retained-account transition from sample sign-in.

## Country autocomplete and global dish recognition

### Automated proof

- The complete browser, domain, infrastructure, and Transcribe suite passes all 182 tests. New coverage proves ambiguous `Korea` search, explicit country selection, preservation of untouched unresolved history, canonical `KOR` resolution, strict dish-match thresholds and margins, country-conflict suppression, all-13-region catalog coverage, Mul naengmyeon transcription variants, locally learned aliases, optional Transcribe-vocabulary fallback, and independent capture and Recipe Ideas model configuration.
- Capture assistance passes 21 tests and Recipe Ideas passes 28 tests without regressions. Country codes in the recognition catalog and capture service remain in parity with the bundled geography catalog.
- The deployment helper builds a bounded, versioned public culinary vocabulary and tests create/update/readiness behavior without reading any private archive. The PWA packager and service-worker asset checks include the new country and dish-recognition modules.

### Browser proof

Using the real in-app Chromium browser against an isolated local account:

- `Mool nang myun` resolved to **Mul naengmyeon**, displayed a visible “Suggested from your note” explanation, populated rating and notes, and suggested **South Korea**. **Undo** restored the original words, cleared only the catalog-derived country, and returned focus to the dish field.
- Typing `Korea` opened an accessible combobox with **North Korea** and **South Korea** and did not silently choose either. Arrow-key selection chose South Korea; `Atlantis` produced an inline error, blocked saving, and retained focus for correction.
- Typing the full canonical name without choosing its option also remained invalid, preventing a shared or partial alias from being silently mapped. A spoken Japan association and a later explicit Japan selection both suppressed the Korean spelling correction and retained the original phrase.
- Saving the confirmed correction stored the canonical dish and South Korea. Year reported one country and the Map exposed **East Asia, 1 dish across 1 country**.
- The exercised 565-pixel browser surface had zero document-level horizontal overflow. Combobox/listbox roles, active focus, named Undo/Change controls, and the mapped-region label were exposed in the accessibility tree without console errors.

### Remaining deployment and real-device evidence

This workspace does not have the AWS CLI, so the shared vocabulary was not created in AWS. Run the documented vocabulary sync, wait for `READY`, deploy the configured name with the Transcribe signer, and then verify a live iPhone utterance, VoiceOver gestures, 375-pixel portrait, landscape, dark appearance, reduced motion, and unavailable-vocabulary fallback before calling the production rollout complete.

## Invitation-only private archives

### Automated proof

- The client/domain suite passes 139 tests. Account tests prove deterministic opaque archive keys, separate database names, stale-open race rejection, account-scoped map preferences, retained sessions, PKCE state and nonce checks, refresh subject continuity, fail-closed cleanup across deletion errors and relaunch, sign-out versus refresh ordering, and the exact seven-day offline boundary. Static-boundary coverage also proves the owner-token controls and legacy service endpoint fallbacks are absent, missing invitation configuration locks the archive, and OAuth callback parameters are removed on both success and failure without entering Cache Storage.
- Capture assistance passes 21 tests, Recipe Ideas passes 28, and the Transcribe signer passes 6. Every service requires trusted API Gateway access-token claims for the configured Cognito client and explicitly rejects the retired shared-token path. Missing durable-limit configuration fails closed. Atomic DynamoDB counter tests prove pseudonymous route/minute keys, TTL, and conditional rejection.
- The invitation SAM template passes `cfn-lint` 1.46 with SAM translator 1.109. Every paid route declares JWT scope authorization, optional quota-safe reserved concurrency, a kill switch, and DynamoDB counter access. All three Lambda packages have audited dependency lockfiles, and the locked DynamoDB SDK loads locally. Legacy Function URLs were removed from PWA source configuration.
- The deployment packager passes 2 tests. It copies only the explicit runtime allowlist, excludes tests/reports/source assets, injects the public Cognito domain, client ID, API origin, AWS region, and optional owner-only migration digest, emits a strict in-document CSP and Amplify `customHttp.yml` security headers, applies `no-referrer` before subresources load, rejects unsafe configuration, and never overwrites an existing output path.
- Legacy migration unit tests prove owner-digest gating and inclusion of all seven local stores. In Chromium, `test-fixtures/private-migration.html`, kept outside the deployable PWA directory, copied its unique fixture-only source into an empty account namespace, verified the migrated record and draft, preserved the source record, left both database names present, and logged no errors.

### Browser proof

- In an isolated Chromium session, the unconfigured build rendered only the invitation screen, disabled sign-in with “Invitation sign-in is not configured,” created no IndexedDB databases, made no application API request, and logged no console errors. The fake invited-account harness then opened Alice’s empty private archive, showed no owner-token controls or copy, and rendered the Account/backup screen at 375×812 with a 375-pixel document width.
- A generated runtime-only deployment directory loaded under its injected CSP with the invitation gate visible, no console warnings, and no non-static requests. An invalid OAuth callback displayed the expected accessible error and immediately removed `code` and `state` while retaining unrelated query/fragment state. A controlled-service-worker reproduction cached only canonical `index.html`; both its cache key and its reconstructed `Response.url` contained no callback value, and the reconstructed shell continued to reload offline when the source HTML was gzip-encoded. Browser inspection also confirmed that subresource requests carried an empty `Referer`, so callback values were not disclosed through asset requests.
- In Chromium, a separate fake Alice account saved one cook with one photograph and exported a 500 KB schema-v2 JSON backup containing exactly one occasion, dish, attempt, and photo. Inspection found none of Alice’s email, Cognito identifiers, auth database names, or token fields. A separate fake Bob account began with zero records, previewed the file’s date, size, version, and counts, restored it only while empty, then reloaded into a one-cook Year view with the restored photograph and no console errors.
- With that account and app shell still loaded, Chromium’s network transport was disconnected and the page reloaded successfully from the service-worker cache into the one-cook Year view with its photograph and no console errors. The browser harness does not emulate Cognito’s production offline session transition, which remains a deployed-runtime check.
- In Chromium, Alice saved one Oyakodon cook. Bob then opened an empty archive at the same app origin. Returning to Alice restored exactly one dish, one cook, and one country. The Account screen showed only the active email and local-archive status; owner-token setup was absent.
- The production Cognito managed login completed an owner email-code sign-in and restored its session after reload. The temporary owner rollout copied and verified a preview containing 1 cook, 1 dish, 0 Ideas, and 1 image; the clean replacement bundle retained that archive after reload, published an empty migration key, and no longer exposed the migration prompt.
- The Cognito/API stack is deployed in `us-east-2`. All retired Function URL configurations and shared-token hashes were removed. An unsigned API request returned `401`; observed Lambda logging contained operational metadata only. The complete wrong-client, wrong-scope, expired-token, and CloudWatch invocation-delta matrix remains open.
- Paid routes are enabled with reserved concurrency omitted. The authenticated Recipe Ideas request reached the service and failed closed with `503` because no Responses-API model is entitled for the AWS account. Capture assistance retains the tested local fallback. Model entitlement, complete authenticated service validation, canary isolation/revocation, and installed-iPhone suspend/resume and VoiceOver remain deployment evidence gaps.

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

**Gap:** Country entry now requires a canonical autocomplete selection when non-empty. Existing unresolved historical values remain unchanged until edited; owner-adjustable label points remain a separate map capability.

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
