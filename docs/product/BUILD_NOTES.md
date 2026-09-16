# What I Made build notes

## Why this document exists

This is the concise retrospective behind the current product. It records the deliberate development-model constraint, the pivots that materially changed the product, and the lessons that should shape future work. Detailed requirements and current implementation remain authoritative in the [PRD](PRD.md), [development plan](DEVELOPMENT_PLAN.md), and [architecture](../../ARCHITECTURE.md).

## Development-model constraint

What I Made was intentionally developed in Codex using **GPT-5.6 Sol at medium reasoning**. The owner chose one consistent, mid-reasoning configuration to see how far it could carry a real product across discovery, product definition, interaction design, implementation, debugging, testing, AWS deployment, and documentation.

The experiment went well. The model was capable of sustaining the end-to-end build, including privacy and failure-path work that is easy to skip in a prototype. Its strongest results came when the work supplied clear boundaries and observable proof: one vertical slice at a time, explicit acceptance criteria, small modules, focused tests, real-browser inspection, physical-iPhone validation, and short owner-feedback loops.

The constraint also exposed the limits of treating model output as inherently correct. UI details needed visual inspection. AWS state needed live verification. Browser and device behavior sometimes contradicted assumptions. Security and data-loss risks required explicit invariants and adversarial tests. Product direction improved when the owner reacted to working software rather than when the model extrapolated further on its own.

This note describes the model used for the Codex development process. It does **not** describe the production inference model inside the app. Capture assistance and Recipe Ideas use independently configurable AWS Bedrock model IDs.

## Pivots

### 1. From platform assumption to device proof

The project did not begin by declaring PWA, React Native/Expo, or SwiftUI the winner. It first documented the core job and tested the capabilities that mattered on the actual iPhone: Home Screen installation, camera and library input, HEIC orientation, local photo optimization, IndexedDB persistence, microphone behavior, and Apple Files export.

An installable PWA won because it met those confirmed needs with the lowest release and solo-maintenance burden. The trade-off remains explicit: richer native integration or future requirements may justify migration later.

### 2. From browser speech recognition to Amazon Transcribe

The first voice approach depended on browser speech recognition. Physical-iPhone testing showed that Safari did not provide a dependable path for the custom experience. The app pivoted to a short-lived, authenticated Amazon Transcribe stream and kept keyboard Dictation as a fallback.

Audio is not retained by What I Made. Only the resulting text is passed to capture assistance, and a failure preserves the note for manual review.

### 3. From form parsing to bounded assistance

Early parsing rules could identify a leading dish name, ratings such as “eight out of ten,” labeled notes and ingredients, and a small set of countries. They remain valuable as an offline and service-failure fallback.

The production path added a bounded capture-assistance service that can structure up to six dishes, but it does not silently decide what gets saved. Strict response schemas, country allowlists, confidence thresholds, untouched-field protection, local dish matching, and an editable confirmation step keep the owner in control.

### 4. From one dish to a cooking occasion

The original prototype effectively equated one save with one dish. Real meals exposed the mismatch: a cooking occasion may include a main, sides, and several photographs. The archive moved to an occasion containing one or more dish attempts and photographs. Canonical dishes then group repeated attempts without collapsing the history of each cook.

This pivot changed Journal cards, Year counts, dish histories, photo recap, editing, matching, and atomic persistence—not just the capture form.

### 5. From capture screen to a durable archive

Saving a cook was not enough if reopening the app returned only to “What did you cook?” The product added the Journal as durable history, then made Year the reflective home screen and connected Year, Map, Journal, photo recap, and dish history through persistent navigation.

The lesson was simple: successful input is not the product. Retrieval, correction, and recovery are part of the same core job.

### 6. From illustrative map to trustworthy geography

The first map used hand-made continent-like shapes to test whether geographic reflection felt valuable. Once the feature proved useful, that approximation became misleading. It was replaced with Natural Earth country geometry, a separate culinary-region taxonomy, exact country counts, density bands, and equivalent region/country controls for people who cannot or do not want to use precise map tapping.

Map photographs and adjustable approximate points remain personal presentation choices. Country identity and aggregation stay deterministic.

### 7. From one local owner to invitation-only accounts

The early deployment used a fixed local archive and a shared owner-token boundary. The decision to invite other people made that insufficient. The product moved to Cognito administrator-created users, managed email one-time-code login, account-scoped IndexedDB archives, scoped JWT-protected APIs, pseudonymous rate counters, sign-out isolation, and a controlled one-time owner migration.

Accounts verify membership and protect paid services; they do not turn the cloud into the archive. Cooks and personal photographs still remain on the device.

### 8. From an opaque private app to a safe public sample

Invitation-only access protected the product but made it difficult for prospective users and repository visitors to understand. A public, fictional sample archive now reuses the real Year, Map, Journal, recap, history, and Ideas interfaces. It is read-only, lazy-loaded, uses licensed food photography, and has no data path into a signed-in archive.

## Lessons to carry forward

1. **Prove the smallest complete job first.** Photo, dish name, review, save, reopen, edit, and backup provide durable value without depending on AI.
2. **Treat model output as a suggestion.** Confidence, provenance, validation, undo, and manual fallback are product features, not implementation details.
3. **Separate identity from storage.** Invitation membership can be cloud-verified while the archive remains account-scoped and local.
4. **Model the real-world event.** A cooking occasion and a canonical dish are different entities; the data model should preserve both.
5. **Use authoritative data when accuracy carries meaning.** Natural Earth geometry and ISO country identifiers replaced visual guesses once geography drove counts and navigation.
6. **Test the target surface.** Desktop simulation found many defects, but Safari, installed-PWA, camera, microphone, Files, offline, and accessibility behavior need the actual iPhone.
7. **Design failure as a normal path.** Transcription, AI, recipe lookup, authentication refresh, and analytics can fail without taking the local archive down with them.
8. **Keep public demonstration data isolated.** A product tour is safer and more credible when it exercises real read paths without seeding or touching personal storage.
9. **A capable model still needs a disciplined loop.** GPT-5.6 Sol at medium was effective because decisions, tests, reviews, and owner feedback constrained and corrected the work.

## Current boundaries

What I Made is still intentionally a private cooking archive rather than a social network, streak tracker, meal planner, or automatic recommendation feed. Archive sync is not implemented. Manual backup and restore are the portability mechanism. New cloud infrastructure or external services should be added only when a validated requirement justifies the operational and privacy cost.
