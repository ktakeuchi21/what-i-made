# Capture Flow Prototype

This installable prototype validates post-cooking capture and now includes the first durable local-journal path.

## Run locally

From the project root:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173/prototypes/capture-flow/`.

Use **Camera** or **Photo library** to exercise browser file inputs. **Use sample meal** loads the bundled generated Oyakodon photograph. **Use a sample voice note** fills a representative transcript without requiring microphone access.

The **Speak your cook** button uses the validated Amazon Transcribe streaming adapter. In invitation mode, the current Cognito access token opens a short-lived transcription session through the protected API. Audio streams directly from the browser to Amazon Transcribe while the button is active; What I Made does not store it.

For a safe local simulation, open `http://localhost:4173/prototypes/capture-flow/?voice=fake&assist=fake&recipes=fake`. Add `&voiceFailure=connect` to exercise the recoverable connection-failure state. Smart assistance cleans the finalized voice segment, fills only confident values, and leaves every suggestion editable. Without `assist=fake` or a deployed endpoint, the conservative local parser remains available.

All capture and edit country fields use the bundled map catalog. Typing filters canonical names and aliases; for example, `Korea` offers South Korea and North Korea. Blank remains valid, while unresolved non-empty text must be corrected before save. A versioned on-device international-dish catalog can visibly correct one uniquely strong transcription such as `mool nang myun` → **Mul naengmyeon**, suggest South Korea, and learn the misheard phrase locally after the owner saves.

For invitation deployment, generate an allowlisted static directory with `infrastructure/invitation-access/package-pwa.mjs`. It injects the Cognito domain, public client ID, AWS region, single JWT-protected service API base URL, optional owner-migration digest, strict CSP, and Amplify response-security headers without modifying tracked source. The client requests `openid`, `email`, `what-i-made/capture`, and `what-i-made/recipes`. If invitation auth is present without a valid API base, every network-only feature stays disabled rather than falling back to a legacy endpoint.

In an authenticated archive, **Account** is available from each top-level app bar as well as capture and Backup & storage. It shows the current invited email and provides **Sign out on this device**. Sign-out closes the account database, revokes temporary photograph URLs, clears rendered archive state, removes the retained local session, and visits Cognito's managed logout endpoint. Signing in again always presents managed email-code authentication; only administrator-created Cognito users can complete it.

The **Ideas** tab stores recipes to cook later separately from cooking history. The local recipe fixture supports URL import, a three-choice description search, and an AI-fallback state without making network calls. Use a description containing `no results` to exercise the fallback. Production configuration points `WIM_RECIPE_CONFIG.endpoint` at the protected service in `services/recipe-ideas`; saved recipe snapshots and their optimized images remain in IndexedDB.

The public sample archive uses locally bundled, metadata-free derivatives of real Wikimedia Commons food photographs. Its version-2 manifest records the creator, source page, license, and local crop/resize conversion for every image. Attribution appears in sample cook and Idea details. The signed-out page does not fetch the manifest or photographs until **Explore a sample archive** is chosen.

The deployable stack and cutover instructions live in `infrastructure/invitation-access/`. API Gateway rejects missing, expired, wrong-audience, or wrongly scoped tokens before Lambda invocation. Every paid route also consumes an atomic, expiring per-account counter keyed by a digest rather than an email or raw account identifier.

Saved cooks, Ideas, and optimized photographs persist in an account-scoped IndexedDB database on the current device. They are not uploaded or synchronized. Backups exclude transient Idea drafts and all authentication state. The original owner can use the controlled one-time migration prompt to back up and move the former fixed archive into the configured empty owner account; the source database remains untouched.

The **Journal** shows one card per cooking occasion, searches its canonical dish names locally, and combines country, year/month, minimum-rating, and Unrated filters. Dish-level criteria must match the same dish in the occasion. Active filters appear as removable chips and survive cook-detail navigation. **Photo recap** opens from Year or Journal and groups every saved photograph by month for the selected calendar year.

On Review, **Add another dish** keeps sides and components in the same occasion with their own country, rating, notes, ingredients, history, and optional photograph. A saved occasion can accept more dishes and photographs later. Its gallery supports dish/occasion assignment, main-photo promotion, and deletion of extra photographs; another main must be selected before the active main can be deleted.

## Test scenarios

1. Minimum capture: photograph, dish name, review, save. **Cooked on** defaults to today and accepts earlier dates back to January 1, 2026; the confirmed date drives Journal, Year, history, and photo-recap placement.
2. Voice-assisted capture: sample photograph, **Speak your cook**, correct fields, save.
3. Assistance failure: select **AI failure fallback** in the desktop prototype panel and verify that the draft reaches manual confirmation.
4. Back navigation: move to confirmation, return, and verify inputs remain.
5. Responsive and accessible behavior: 375px, landscape, enlarged text, dark appearance, reduced motion, keyboard, and screen reader order.
6. Journal durability: save a cook, open **View journal**, reload the page, and verify the journal and entry details remain available.
7. Culinary map: open **Map**, select a photographic region, browse the country shelf, open a country sheet, and select a dish to see its complete history. Back should restore the country sheet.
8. Ideas URL: open **Ideas**, import the sample Oyakodon URL, review it, save it, and verify it reopens after reload.
9. Advanced map: compare countries in Cook Density, switch to Culinary Peaks, use the photographic region/country shelves for dense areas, then use dish history → **Customize map** to choose a photograph and adjust or reset its approximate point.
9. Ideas search: describe a dish, choose one of at most three sourced cards, and verify no-result recovery offers manual entry and an explicitly labeled AI draft.
10. Cook an idea: select **Start a cook**, verify the title and ingredients are prefilled, add the required owner photo, save, and verify the Idea appears under Made without changing its saved recipe.
11. Backup and restore: open **Backup & storage** from Year, create a backup, inspect it, verify non-empty restore is blocked, erase with the typed confirmation, restore, and compare counts and photographs.
12. Journal discovery: search without accents or punctuation, combine country/date/rating filters, remove chips, recover from no results, and verify Back restores the query, filters, scroll position, and originating cook.
13. Photo recap: open it from Year and Journal, switch years, open a photograph, and verify Back restores the year, scroll position, photograph, and original screen.
14. Multi-dish occasion: add a second dish on Review and a third dish with a photograph after save; verify Journal has one card, Year has one cook, dish counts remain individual, and all photos appear in recap.
15. Gallery management: reassign an extra photo, make it main, confirm the former main can then be deleted, and confirm the current main and final dish remain protected.
16. Smart assistance: with `assist=fake`, finish a filler-heavy voice note and verify the cleaned text and fields; review multiple server-proposed dishes; retry a failed request; and confirm manual edits survive late responses.
17. Dish matching: verify a unique exact name or alias is preselected, fuzzy matches remain unselected, country conflicts are excluded, and selecting a match adds the captured spelling to its local aliases.
18. Private accounts: open Account from Year, Map, Journal, Ideas, capture, and Backup & storage; dismiss it with Close and Escape to verify focus restoration; alternate two local fake accounts and verify complete archive and map-preference isolation; sign out and confirm no previous content remains visible.
19. Owner migration: from a separate disposable browser origin, run `test-fixtures/private-migration.html` and verify all stores move into the empty fixture namespace while its isolated source remains intact. The fixture lives outside the deployable PWA directory and never opens or deletes the production legacy database name.
20. Country autocomplete: type `Korea`, choose South Korea, save, and verify the dish appears in East Asia; confirm unresolved text is blocked and focus moves to its inline error.
21. International dish recognition: parse `mool nang myun`, verify the labeled Mul naengmyeon correction and South Korea suggestion, exercise Undo and Change, then save and verify the misheard phrase is a local alias.

## Automated checks

Using the bundled Node runtime, run:

```bash
node --test prototypes/capture-flow/tests/*.test.cjs \
  spikes/iphone-feasibility/tests/transcribe-codec.test.cjs \
  spikes/iphone-feasibility/tests/transcribe-adapter.test.cjs \
  spikes/iphone-feasibility/tests/session-handler.test.mjs
```

## Sample asset

`assets/sample-oyakodon.jpg` was generated with the built-in image-generation tool for this prototype and optimized locally to a 373 KB JPEG.

This capture-only fixture is separate from `assets/demo/`, whose public-tour photographs are curated from Wikimedia Commons. Maintainers can run `scripts/discover-demo-media.mjs`, inspect candidates with `scripts/review-demo-media.py`, and regenerate approved thumbnail/display derivatives with `scripts/curate-demo-media.py`. The curator fails closed on unsupported licenses or missing attribution.

Final prompt:

> Natural editorial food photograph of a freshly cooked bowl of Japanese Oyakodon with softly set egg, chicken, rice, and a little sliced scallion on a warm home table. Vertical 4:3 close overhead three-quarter composition, entire bowl visible, soft window light, realistic home-cooked texture, no people, logos, text, watermark, flags, or restaurant branding.
