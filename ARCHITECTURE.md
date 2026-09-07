# What I Made architecture

## Executive summary

What I Made is a static, installable iPhone web app for keeping a private cooking archive. IndexedDB is the source of truth for cooks, canonical dishes, cooking attempts, photographs, saved recipe Ideas, and Idea images. The app may send a live microphone stream to Amazon Transcribe and may send explicitly submitted transcript text or recipe requests to small protected AWS services. Archive records and personal photographs never leave the device.

The most important rule is that remote services may propose editable text, but they never read or write the archive. Identity resolution, confirmation, and every archive mutation remain local and transactional.

### System architecture

```text
Owner on iPhone
      |
      v
Static PWA + service worker
      |
      +----> IndexedDB archive and recipe snapshots
      |
      +----> local photo processing and local dish matching
      |
      +----> Transcribe session signer ----> Amazon Transcribe
      |
      +----> capture-assistance Lambda ----> Bedrock Mantle / Runtime
      |
      +----> Recipe Ideas Lambda ----------> public recipe pages / Bedrock
```

The capture-assistance and Recipe Ideas packages are deployable Lambda handlers. Their production Function URL endpoints are configured in the checked-in PWA. The Transcribe session endpoint is configured separately.

### Dependency hierarchy

```text
screens and event handlers (`app.js`)
        |
        +--> pure view models, parsers, matchers, and request clients
        |
        +--> IndexedDB repositories and backup validation
        |
        +--> browser device adapters

Lambda handlers
        |
        +--> strict request/response validation
        |
        +--> bounded external providers
```

UI code may depend on domain and storage modules. Domain modules do not depend on the UI. Lambda services do not depend on or receive IndexedDB data. Do not move canonical dish matching, saved aliases, photo processing, or archive persistence across the network boundary.

## Local archive

`prototypes/capture-flow/archive-store.js` owns IndexedDB version 5. It stores occasions, dishes, attempts, and cooking photos. `idea-store.js` owns saved recipe Ideas, Idea images, and recoverable drafts in the same database. Dish IDs are stable UUIDs; normalized names and aliases support local discovery but are not identity.

One cooking occasion can contain several dish attempts and photographs. Capture assistance proposes at most six dishes, while the owner can still add another dish manually. `saveOccasion()` validates the complete input and writes the occasion, dishes, attempts, and photos in one read-write transaction. A selected `matchedDishId` is resolved inside that transaction. A captured spelling is added as a local alias when it differs meaningfully from the canonical name. Missing selected IDs, duplicate dishes within one occasion, invalid dates, or invalid photos abort the write.

The map, Year, Journal, recap, dish history, and Made status are derived views over local records. They are not separately persisted. The one exception is optional dish presentation preference: `defaultMapPhotoId` and a versioned in-country `mapLocation` live on the canonical dish. Recipe Ideas do not affect archive counts until a saved attempt links to an Idea through `sourceIdeaId`.

`map-geometry.js` is the shared authority for map-data versioning, country polygon membership, guaranteed interior fallback points, repeat bands, and deterministic collision groups. Year, Map, and dish history read `listDishAttempts()` so every dish in a multi-dish occasion participates, while occasion counts remain deduplicated. World-level region clusters stay photographic. Focused regions render Photo Density or Needle Field; dense same-country groups open a fitted close-up and mixed-country groups open an accessible chooser.

Map customization loads only photographs eligible for that canonical dish. It saves the selected photo reference and optional approximate point in one IndexedDB transaction. Archive writes and backup inspection reuse the same geometry and photo-eligibility rules. A country change clears an incompatible point. The last map mode is a UI preference in local storage rather than archive data.

## Capture lifecycle

1. The owner selects or takes a photograph. `photo-processor.js` decodes and creates metadata-free display and thumbnail blobs locally.
2. The owner types a note or starts `transcribe-adapter.js`. The adapter obtains a short-lived signed session and streams audio directly to Amazon Transcribe. The PWA retains returned text, not audio.
3. On voice Done, `app.js` combines existing typed text with the new segment. `capture-assistance.js` sends only `transcript`, `voiceSegment`, and `locale` to the configured capture service. Typed or keyboard-dictated text is assisted when Review is selected.
4. The capture service authenticates the owner token, enforces the 8 KB body, 5,000-character transcript, and 2,000-character voice-segment limits, then makes one bounded Amazon Bedrock request. Supported GPT models use Mantle Responses with storage disabled; the deployed account-compatible GPT OSS model uses synchronous InvokeModel, which does not create stored response state.
5. Client and server both reject extra response properties, unknown country codes, invalid ratings, oversized fields, and more than six dishes. The client replaces only the finalized voice segment with cleaned text. It fills only untouched fields above their thresholds.
6. `dish-matcher.js` compares proposed names with local canonical names and aliases. A single exact, country-compatible result may be selected automatically. Up to three fuzzy results are choices only.
7. The owner edits and confirms the proposal. `archive-store.js` performs the only persistent write.

Restarting voice, cancelling capture, leaving the screen, or `pagehide` aborts active assistance. Request generations prevent a late response from changing a newer draft. A timeout, disabled endpoint, invalid response, or service failure retains the verbatim text, applies the conservative local parser, and leaves Review and Save available.

## Capture-assistance service boundary

`services/capture-assistance/lambda.js` wires the Lambda entry point. `index.js` owns bearer authentication, route and body validation, the kill switch, response redaction, and metadata-only logs. `bedrock-provider.js` owns SigV4, the configured model, one deterministic structured-output request, a 9.5-second provider timeout, safe extraction of final JSON from GPT OSS reasoning, and a 512 KB response ceiling. `parser.js` performs runtime schema validation and meaning-preserving cleanup. `country-catalog.js` is a compact server copy whose test must remain in parity with the bundled client geography.

The service has no database and no photo permission. Its deployment permissions allow only Bedrock Mantle inference and Bedrock InvokeModel in `us-east-2`. Function URL CORS, concurrency controls, model-invocation logging, and budget alarms are deployment configuration rather than application code.

## Recipe Ideas service boundary

`services/recipe-ideas` provides authenticated search, public HTTPS recipe import, AI fallback generation, and bounded image proxying. URL validation, redirect and DNS revalidation, response-size limits, script-free Schema.org parsing, signed image tokens, and strict provider schemas keep public page data untrusted. The service returns drafts. The PWA optimizes and saves the selected snapshot and image locally.

## Backup and recovery

`archive-backup.js` owns schema-v2 JSON export, full structural and reference validation, empty-only restore, and atomic archive clearing. Backups contain all persistent archive stores and encoded optimized images. They exclude unfinished Idea drafts and the owner token. Restore never merges with or silently replaces a non-empty archive.

The owner token is stored in a separate IndexedDB database and survives archive erasure. Backup sharing uses the native file share sheet when supported and falls back to a browser download.

## Offline and update behavior

`sw.js` pre-caches the versioned app shell and uses network-first GET handling with an offline cache fallback. IndexedDB-backed archive, Journal, Map, recap, Ideas, and backup inspection remain usable offline. Transcription, recipe retrieval, and smart capture assistance fail independently and preserve local drafts.

## Source map

- App entry and interaction state: `prototypes/capture-flow/app.js`
- PWA shell and accessibility structure: `prototypes/capture-flow/index.html`, `styles.css`, and `sw.js`
- Capture request and response validation: `prototypes/capture-flow/capture-assistance.js`
- Local existing-dish matching: `prototypes/capture-flow/dish-matcher.js`
- Archive transactions: `prototypes/capture-flow/archive-store.js`
- Map geometry and collision rules: `prototypes/capture-flow/map-geometry.js`
- Year and culinary-region derivation: `prototypes/capture-flow/dashboard-model.js`
- Recipe and draft persistence: `prototypes/capture-flow/idea-store.js`
- Backup format and restore: `prototypes/capture-flow/archive-backup.js`
- Capture Lambda: `services/capture-assistance`
- Recipe Lambda: `services/recipe-ideas`
- Detailed product and technical decisions: `docs/product/PRD.md` and `docs/technical/pwa-foundation/design.md`

## Verification

The client and domain suite is `node --test tests/*.test.cjs` from `prototypes/capture-flow`. Each Lambda package runs `npm test` in its own directory. The capture service tests cover authentication, redacted logs, bounded and strict schemas, provider timeouts, cleanup behavior, and country-catalog parity. The browser evidence and remaining physical-iPhone gaps are recorded in `prototypes/capture-flow/TEST_REPORT.md`.

Deployment was verified on 2026-09-07: the capture-assistance Lambda is active in `us-east-2`, its exact-origin Function URL is configured in the PWA, invalid tokens return 401, Bedrock invocation logging is unconfigured, and an authenticated disposable-clone smoke test returned cleaned Chicken Adobo data with `PHL`. AWS rejected reserved concurrency two because it would reduce the account's unreserved pool below the required minimum of ten; the service therefore currently relies on its warm-instance rate guard, kill switch, and existing budget controls until the account concurrency quota is raised. An installed-iPhone acceptance pass remains external evidence.
