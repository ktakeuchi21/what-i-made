# What I Made architecture

## Executive summary

What I Made is a static, invitation-only iPhone web app for keeping separate private cooking archives. An account-scoped IndexedDB database is the source of truth for cooks, dishes, attempts, photographs, recipe Ideas, and Idea images. Cognito establishes membership but stores no archive content. The app may stream a live microphone to Amazon Transcribe and send explicitly submitted text to JWT-protected AWS services. Archive records and personal photographs stay on the device.

The load-bearing rule is that an authenticated account context must be selected before an archive opens. Remote services may propose editable text, but they never read or write the archive.

### System architecture

```text
Invited cook on iPhone
      |
      v
Static PWA + Cognito managed login
      |
      +----> account-scoped IndexedDB archive
      |
      +----> local photo processing, country lookup, and dish recognition
      |
      +----> API Gateway JWT authorizer
                    |
                    +----> Transcribe session signer ----> Amazon Transcribe
                    +----> capture assistance -----------> Bedrock
                    +----> Recipe Ideas -----------------> recipe sites / Bedrock
                    +----> DynamoDB pseudonymous rate windows
```

`infrastructure/invitation-access/template.yaml` defines the Cognito pool, scoped web client, HTTP API, Lambdas, and rate-limit table. The PWA accepts one protected API base URL and fails closed when invitation auth is enabled without it.

### Dependency hierarchy

```text
screens and handlers (`app.js`)
        |
        +--> authentication boundary --> opaque archive context
        +--> pure view models, parsers, and request clients
        +--> IndexedDB repositories and backup validation
        +--> browser device adapters

API Gateway JWT authorizer --> Lambda handlers
        |
        +--> strict validation and durable rate decision
        +--> bounded external providers
```

UI code may depend on authentication, domain, and storage modules. Storage modules receive a SHA-256 archive key, not an email address or raw Cognito subject. Domain modules do not depend on the UI. Lambda services never receive IndexedDB data. Canonical dish matching, saved aliases, international-dish correction, photo processing, and archive persistence must remain local. The shared Transcribe vocabulary is built only from bundled public terms.

## Identity and local archives

`auth-session.js` implements Cognito Authorization Code with PKCE, nonce and state verification, refresh, sign-out, and a retained session in the separate `what-i-made-auth-v1` database. It verifies the user-info subject before accepting a session. Refresh cannot change the active subject, and generation plus abort guards prevent an older request from reviving a signed-out session.

`account-context.js` derives a non-readable archive key from the Cognito subject. `archive-store.js` uses that key in an account-specific IndexedDB name and closes stale handles during account changes. IndexedDB version 5 holds occasions, dishes, attempts, cooking photos, Ideas, Idea images, and recoverable Idea drafts. Account-specific map mode uses the same archive key in local storage.

A previously verified account may open its local archive offline for seven days after its last successful authorization. `pageshow` and visible `visibilitychange` checks enforce that deadline for a suspended PWA. Network assistance always requires a current access token.

`legacy-migration.js` is the controlled owner-only bridge from the former fixed database. A configured owner archive digest gates inspection. The migration validates a schema-v2 representation, requires an empty destination, copies all seven stores in one destination transaction, verifies counts, and leaves the legacy database untouched.

## Archive behavior

One cooking occasion can contain several dish attempts and photographs. `saveOccasion()` validates the complete input and writes the occasion, dishes, attempts, and photos in one transaction. A selected `matchedDishId` is resolved inside that transaction. Missing IDs, duplicate dishes within an occasion, invalid dates, or invalid photos abort the write.

Country fields resolve through `world-map-data.js`. A non-empty edited value must resolve to one catalog entry before save. Dishes retain the canonical display name and resolved ISO alpha-3 code without changing the IndexedDB schema. Historical unresolved strings remain untouched until the cook edits them.

Year, Map, Journal, recap, dish history, and Made status are derived from local records. Optional `defaultMapPhotoId` and versioned `mapLocation` values live on the canonical dish. Recipe Ideas affect archive counts only after an attempt links through `sourceIdeaId`.

`map-geometry.js` owns map-data versioning, country polygon membership, interior fallbacks, repeat bands, and collision groups. Map customization loads only photographs eligible for the dish and writes the selected reference and approximate point transactionally.

## Capture lifecycle

1. `photo-processor.js` creates metadata-free display and thumbnail blobs locally.
2. `transcribe-adapter.js` obtains a short-lived signed session and streams audio directly to Amazon Transcribe. The signer adds the configured public culinary vocabulary. If that enhanced socket cannot open, the adapter obtains one session without the vocabulary and continues. The app keeps returned text, not audio.
3. On Done, `capture-assistance.js` sends only `transcript`, `voiceSegment`, and `locale` to the configured service. Typed text is assisted at Review.
4. API Gateway validates the Cognito issuer, client audience, expiry, and `what-i-made/capture` scope before Lambda invocation.
5. The Lambda rechecks trusted access-token claims, consumes an atomic per-account rate window, validates hard input limits, and performs one bounded Bedrock request.
6. Client and server reject extra fields, invalid ratings, unknown countries, oversized values, and more than six dishes. Only untouched fields are populated.
7. `dish-recognizer.js` compares the extracted phrase with saved local names and the bundled, versioned international catalog. It corrects only one country-compatible candidate above the strict score and margin, shows Undo and Change, and leaves uncertain text untouched.
8. `dish-matcher.js` separately compares the reviewed proposal against canonical archive identities. Only one exact, country-compatible result may be preselected.
9. `country-combobox.js` resolves every edited country against the map catalog. `Korea` stays ambiguous; a selected `South Korea` resolves to `KOR`.
10. The cook edits and confirms. `archive-store.js` performs the persistent write and may learn the accepted raw phrase as a private alias.

Restarting voice, canceling, leaving the screen, or `pagehide` aborts assistance. A timeout or invalid response preserves the verbatim note and leaves manual review available.

## Protected service boundary

API Gateway is the public authorization boundary. Every route requires a Cognito access token and either the capture or recipes scope. Handler-side claim checks require `token_use=access`, the configured client ID, and a bounded subject. Direct Function URL events have no trusted authorizer claims and fail closed in Cognito mode.

All paid routes use an atomic DynamoDB counter keyed by SHA-256 subject digest, route, and minute. TTL removes old windows. Missing rate-limit configuration in Cognito mode fails closed. Reserved concurrency and service kill switches provide separate global controls.

The capture service may invoke Bedrock Mantle or the bounded Runtime fallback. Capture and Recipe Ideas have separate model parameters, so a model availability change in one workflow does not silently change the other. The Recipe Ideas service may invoke Mantle and Bedrock Web Search, and may fetch only validated public HTTPS recipe or image resources. The capture, Recipe Ideas, and transcription routes accept only API Gateway-validated Cognito access-token claims and have no shared-token or direct Function URL fallback. Neither service can read an archive. Logs contain operational status, latency, and aggregate token counts, not transcripts, recipes, photos, email addresses, or raw subjects.

## Backup and recovery

`archive-backup.js` owns schema-v2 JSON export, structural and reference validation, empty-only restore, and atomic archive clearing. Backups contain all persistent archive stores and optimized images. They exclude unfinished Idea drafts and authentication state. Restore applies only to the current account and never merges with a non-empty archive.

## Offline and updates

`sw.js` pre-caches the versioned shell and uses network-first GET with cache fallback. Within the authorization window, Journal, Map, recap, Ideas, capture, and backup remain available offline. Network actions fail independently and preserve local drafts.

## Source map

- App and interaction state: `prototypes/capture-flow/app.js`
- Cognito session boundary: `prototypes/capture-flow/auth-session.js`
- Account namespaces and migration: `account-context.js`, `archive-store.js`, `legacy-migration.js`
- Backup format: `prototypes/capture-flow/archive-backup.js`
- Map authority: `prototypes/capture-flow/map-geometry.js`
- Country catalog and selection: `prototypes/capture-flow/assets/world-map-data.js`, `country-combobox.js`
- International dish catalog and resolver: `assets/international-dishes.js`, `dish-recognizer.js`
- Capture service: `services/capture-assistance`
- Recipe service: `services/recipe-ideas`
- Transcribe signer: `spikes/iphone-feasibility/backend/session`
- AWS stack: `infrastructure/invitation-access/template.yaml`
- Detailed product decision: `docs/product/invitation-only-access/design.md`

## Verification

The client suite covers account namespace isolation, session restoration, refresh and sign-out races, callback-parameter cleanup, the seven-day boundary, backup exclusions, country ambiguity, dish-recognition thresholds, local alias learning, and migration rules. Service tests cover trusted JWT claims, atomic pseudonymous rate counters, redacted logs, hard limits, provider timeouts, and country parity. Infrastructure tests cover separate model configuration, the optional vocabulary name, public vocabulary generation, and Transcribe fallback. The SAM template passes `cfn-lint` 1.46 with SAM translator 1.109, and all three Lambda packages have audited dependency lockfiles. A tested deployment packager produces an allowlisted runtime-only PWA directory, injects only validated public stack outputs and the temporary owner-migration digest, and adds the origin-specific CSP plus Amplify response-security headers without modifying tracked source.

The culinary vocabulary has not been created in AWS from this workspace. Vocabulary readiness, the live enhanced transcription path, and installed-iPhone VoiceOver behavior remain evidence gaps until deployment and device testing.
