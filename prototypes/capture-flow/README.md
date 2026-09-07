# Capture Flow Prototype

This installable prototype validates post-cooking capture and now includes the first durable local-journal path.

## Run locally

From the project root:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173/prototypes/capture-flow/`.

Use **Camera** or **Photo library** to exercise browser file inputs. **Use sample meal** loads the bundled generated Oyakodon photograph. **Use a sample voice note** fills a representative transcript without requiring microphone access.

The **Speak your cook** button uses the validated Amazon Transcribe streaming adapter. On the deployed Amplify origin it reuses the private owner token already saved by the iPhone feasibility lab. If the token is missing, open **Private voice setup** and save it once. Audio streams directly from the browser to Amazon Transcribe while the button is active; What I Made does not store the audio.

For a safe local simulation, open `http://localhost:4173/prototypes/capture-flow/?voice=fake&assist=fake&recipes=fake`. Add `&voiceFailure=connect` to exercise the recoverable connection-failure state. Smart assistance cleans the finalized voice segment, fills only confident values, and leaves every suggestion editable. Without `assist=fake` or a deployed endpoint, the conservative local parser remains available.

For production, set `<meta name="wim-capture-assistance-endpoint">` to the HTTPS origin of `services/capture-assistance`. The owner token is reused for its bearer authorization. Configure `CAPTURE_ASSISTANCE_ENABLED=true`, the token hash, Bedrock permission, reserved concurrency 2, and the existing budget alarms; keep model invocation logging disabled. The client sends only `transcript`, `voiceSegment`, and `locale`.

The **Ideas** tab stores recipes to cook later separately from cooking history. The local recipe fixture supports URL import, a three-choice description search, and an AI-fallback state without making network calls. Use a description containing `no results` to exercise the fallback. Production configuration points `WIM_RECIPE_CONFIG.endpoint` at the protected service in `services/recipe-ideas`; saved recipe snapshots and their optimized images remain in IndexedDB.

For production, replace the empty `content` of `<meta name="wim-recipe-endpoint">` during deployment with the Recipe Ideas Function URL or API origin. `config.js` enables online Ideas only when that HTTPS endpoint is present. The owner token remains device-local and is sent as the existing bearer authorization; no credential is embedded in the page.

Saved cooks, Ideas, and their optimized photographs persist in IndexedDB on the current device. They are not uploaded. Open **Backup & storage** near the bottom of Year to inspect local storage, prepare a schema-v2 JSON backup for Files, validate and restore a backup into an empty archive, or use the separately confirmed erase flow. Backups include saved records and optimized images while excluding transient Idea drafts and the private owner token. The prototype does call AWS for voice when opened without the local fake query parameter.

The **Journal** shows one card per cooking occasion, searches its canonical dish names locally, and combines country, year/month, minimum-rating, and Unrated filters. Dish-level criteria must match the same dish in the occasion. Active filters appear as removable chips and survive cook-detail navigation. **Photo recap** opens from Year or Journal and groups every saved photograph by month for the selected calendar year.

On Review, **Add another dish** keeps sides and components in the same occasion with their own country, rating, notes, ingredients, history, and optional photograph. A saved occasion can accept more dishes and photographs later. Its gallery supports dish/occasion assignment, main-photo promotion, and deletion of extra photographs; another main must be selected before the active main can be deleted.

## Test scenarios

1. Minimum capture: photograph, dish name, review, save.
2. Voice-assisted capture: sample photograph, **Speak your cook**, correct fields, save.
3. Assistance failure: select **AI failure fallback** in the desktop prototype panel and verify that the draft reaches manual confirmation.
4. Back navigation: move to confirmation, return, and verify inputs remain.
5. Responsive and accessible behavior: 375px, landscape, enlarged text, dark appearance, reduced motion, keyboard, and screen reader order.
6. Journal durability: save a cook, open **View journal**, reload the page, and verify the journal and entry details remain available.
7. Culinary map: open **Map**, select a photographic region, browse the country shelf, open a country sheet, and select a dish to see its complete history. Back should restore the country sheet.
8. Ideas URL: open **Ideas**, import the sample Oyakodon URL, review it, save it, and verify it reopens after reload.
9. Advanced map: open a region, switch Photo Density and Needle Field, open a dense-country close-up, then use dish history → **Customize map** to choose a photograph and adjust or reset its approximate point.
9. Ideas search: describe a dish, choose one of at most three sourced cards, and verify no-result recovery offers manual entry and an explicitly labeled AI draft.
10. Cook an idea: select **Start a cook**, verify the title and ingredients are prefilled, add the required owner photo, save, and verify the Idea appears under Made without changing its saved recipe.
11. Backup and restore: open **Backup & storage** from Year, create a backup, inspect it, verify non-empty restore is blocked, erase with the typed confirmation, restore, and compare counts and photographs.
12. Journal discovery: search without accents or punctuation, combine country/date/rating filters, remove chips, recover from no results, and verify Back restores the query, filters, scroll position, and originating cook.
13. Photo recap: open it from Year and Journal, switch years, open a photograph, and verify Back restores the year, scroll position, photograph, and original screen.
14. Multi-dish occasion: add a second dish on Review and a third dish with a photograph after save; verify Journal has one card, Year has one cook, dish counts remain individual, and all photos appear in recap.
15. Gallery management: reassign an extra photo, make it main, confirm the former main can then be deleted, and confirm the current main and final dish remain protected.
16. Smart assistance: with `assist=fake`, finish a filler-heavy voice note and verify the cleaned text and fields; review multiple server-proposed dishes; retry a failed request; and confirm manual edits survive late responses.
17. Dish matching: verify a unique exact name or alias is preselected, fuzzy matches remain unselected, country conflicts are excluded, and selecting a match adds the captured spelling to its local aliases.

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

Final prompt:

> Natural editorial food photograph of a freshly cooked bowl of Japanese Oyakodon with softly set egg, chicken, rice, and a little sliced scallion on a warm home table. Vertical 4:3 close overhead three-quarter composition, entire bowl visible, soft window light, realistic home-cooked texture, no people, logos, text, watermark, flags, or restaurant branding.
