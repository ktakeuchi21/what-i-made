# What I Made Product Requirements Document

> **Status:** Draft for owner review  
> **Version:** 0.2
> **Date:** September 8, 2026
> **Author and approver:** Product owner, with Codex support  
> **Sources:** [Discovery brief](./DISCOVERY_BRIEF.md), [PWA foundation](../technical/pwa-foundation/design.md), [story map](./USER_STORY_MAP.md), and [design system](../../design-system/what-i-made/MASTER.md)

## 1. Executive summary

What I Made is a private, invitation-only iPhone web app for frequent home cooks who want the context and progress behind their cooking to stop disappearing. Each invited person gets a separate device-local archive. Immediately after cooking, they can preserve a photo and dish name in under 20 seconds, optionally add a spoken rating, notes, and ingredients, and confirm suggested structure. Over time, the archive becomes a photographic journal, annual reflection, and culinary map. Membership is cloud-verified, but cooks, photos, Ideas, and backups remain local.

## 2. Problem statement

### Who has this problem?

The product owner is a frequent home cook who makes approximately four or five dinners and three or four lunches per week. They use an iPhone, prefer speaking to typing, have limited technical expertise, and will build and maintain the product with Codex assistance.

### What is the problem?

The owner normally eats the food without recording it. They may photograph a particularly successful result or say a review aloud, but the dish name, context, rating, and learning are not preserved together. Apple Photos can retain images, but it does not organize those images as cooking attempts or show how a dish evolved.

### Why is it painful?

- Years of cooking are difficult to remember or appreciate as a body of work.
- New culinary exploration is not visible over time.
- Improvements and mistakes across repeated attempts are lost.
- Structured journaling at the moment food is ready would introduce too much friction.

### Evidence

- Direct owner observation: “I just eat the food.”
- Direct owner observation: “The context mostly disappears after the meal.”
- Current behavior: no structured cooking journal; occasional food photography; spoken reviews are not retained.
- Explicit motivation: the owner wants greater satisfaction, pride, inspiration, and a visible sense of culinary exploration—not streaks or reminders.

No market evidence is required for this private, single-user product. The owner is both the customer and research participant.

## 3. Target user and Jobs to Be Done

### Primary persona: the owner-cook

- **Role:** Frequent home cook and solo product owner.
- **Context:** Cooks seven to nine lunches and dinners in a typical week, usually has connectivity, uses an iPhone, and does not want App Store distribution.
- **Goals:** Preserve cooking memories, recognize exploration, understand improvement, and revisit a satisfying archive.
- **Pain points:** Low tolerance for post-cooking data entry; unstructured photo history; ambiguous dish names and origins; concern about losing a valuable local archive.
- **Current behavior:** Eats immediately, sometimes takes a photo, and often expresses an informal review aloud.

### Jobs to Be Done

- **Functional:** When I have just finished cooking, help me preserve a recognizable record with almost no effort so the meal and what I learned do not disappear.
- **Emotional:** When I look back, help me feel proud and inspired by the dishes I explored and the skills I developed.
- **Social:** When I share or discuss my cooking with my wife, help me recall what changed and what was worth making again.

## 4. Strategic context

### Product goal

Create a useful personal archive without creating another maintenance burden. Product value, privacy, portability, and solo maintainability matter more than distribution or market scale.

### Why now?

The owner already cooks often enough for the missing archive to compound every week, and discovery has resolved the essential workflow, platform, data ownership, and visual direction. Beginning now also creates a clean archive from adoption onward; historical import is deliberately unnecessary.

### Differentiation from current alternatives

- Apple Photos preserves images but not canonical dishes, attempts, ratings, countries, or cooking notes.
- Notes and spreadsheets can preserve text but add friction and do not provide photographic or geographic reflection.
- Generic recipe apps center recipes and meal planning; What I Made centers the owner’s actual cooking history.

Market sizing, competitive monetization, and growth strategy are intentionally omitted because this is a private product for one owner.

## 5. Solution overview

What I Made begins as a connected, installable PWA optimized for the owner’s iPhone. The archive and optimized photographs remain local to the device. Manual backup and restore use a portable archive saved through Apple Files. The physical-iPhone test selected Amazon Transcribe after Safari browser speech recognition failed; keyboard Dictation remains a fallback that Apple may process after its own disclosure. For the custom button, audio streams directly to Amazon Transcribe. What I Made and its Lambda do not durably store or log audio, and an AWS Transcribe service-improvement opt-out policy is required before real cooking notes are sent. After **Done**, the final transcript text—not audio or photographs—is sent to protected capture assistance, which removes conversational filler and proposes up to six editable dish records. Typed notes use the same assistance when Review is selected. Owner-created cooking photographs do not leave the phone; public recipe images may pass through the protected Recipe Ideas service solely to create the selected local snapshot.

The primary flow begins immediately after cooking: add or take a photo, speak or enter the dish and optional review, confirm the structured result, and save. The owner can later edit any record, match or merge canonical dishes, browse a chronological journal, compare repeated attempts, review the current year, and explore each canonical dish through Needle Field and Photo Density map views. A separate Ideas collection accepts public recipe links or sourced dish searches, keeps owner-confirmed recipe snapshots locally, and links them to capture only when cooked.

### Required first-release capabilities

1. **Fast capture:** Main photo and dish name required; date automatic and editable.
2. **Optional detail:** Whole-number rating from 1–10, notes, and informal ingredients; all editable later.
3. **Flexible occasions:** One dish by default with multiple dishes and optional dish-specific photos supported.
4. **Assisted confirmation:** Voice transcript and text classification propose structured fields; the owner confirms or corrects every suggestion.
5. **Canonical dish history:** Suggested existing-dish matches, manual merge, stable identity, and repeat-attempt progression.
6. **Journal and reflection:** Search by dish name; filter by dish, country, date, and rating; current-year dashboard; new dishes in the last 30 days; calendar-year recap.
7. **Dish-level map:** Switch between Needle Field and Photo Density. Repetition changes only the canonical dish marker, never the whole country.
8. **Portable ownership:** Local optimized photographs plus validated export and restore through Apple Files.
9. **Ideas for later:** Public recipe import, sourced search with an AI fallback, editable local recipe snapshots, and a direct link into cooking capture.

### Primary flow prototype

The interactive capture and confirmation prototype lives at [`prototypes/capture-flow/index.html`](../../prototypes/capture-flow/index.html). It is intended to validate hierarchy, interaction, and timing—not production storage or AI quality.

## 6. Success metrics

Because there is one owner and no third-party analytics, success is evaluated through direct use, small local counters, and explicit real-device tests.

### Primary metric

- **Cooking capture coverage:** Number of newly cooked occasions recorded divided by the owner’s recalled cooking occasions during a four-week trial.
- **Baseline:** Approximately 0% structured records today.
- **Target:** 🔶 **Assumption:** At least 80% during the first four weeks is a practical interpretation of “most dishes.”
- **Measurement:** A local weekly review; no external analytics.

### Secondary metrics

- **Capture time:** Median of ten representative photo-plus-name captures is no more than 20 seconds on the owner’s iPhone.
- **Recovery:** A schema-v2 JSON backup exported through Apple Files restores all supported records and photographs with matching counts and valid internal references.
- **Progress comprehension:** In a real-device review, the owner can identify a new dish and explain how a repeated dish changed using its photos, ratings, dates, and notes.
- **Reflection value:** 🔶 **Assumption:** After four weeks, the owner rates the dashboard or map at least 4 out of 5 for pride or inspiration.

### Guardrails

- Photos or photo-derived pixels never leave the device in version one.
- Manual entry and save remain available when voice or AI fails.
- Normal capture does not require optional fields.
- Ongoing AWS and hosting cost remains below $10 per month, with alerts at $5 and $8.
- No streaks, reminders, or guilt-based language are introduced.

## 7. User stories and requirements

### Epic hypothesis

We believe that a photo-first cooking archive with an under-20-second capture path and photographic progression will cause the owner to record at least 80% of newly cooked occasions during a four-week trial because it preserves the context that currently disappears without turning cooking into administrative work.

### US-01 — Preserve a meal before eating

**As the owner-cook, I want to save a photo and dish name immediately after cooking, so that the meal becomes part of my history before its context disappears.**

- **Scenario:** Save the minimum valid cooking occasion.
- **Given:** I have opened a new capture on my iPhone and selected or taken a photo.
- **When:** I enter a dish name and confirm the cook.
- **Then:** The photo, dish name, and editable cooking date are committed together and appear in my journal.

### US-02 — Speak an informal review

**As the owner-cook, I want to speak naturally about what I made, so that I can preserve useful detail without typing a form.**

- **Scenario:** Convert a voice note into an editable proposal.
- **Given:** A capture draft is already saved locally and microphone access is available.
- **When:** I record and stop a voice note containing one or more dishes, ratings, and comments.
- **Then:** The final transcript text is sent for parsing after Done, conversational filler is removed without changing meaning, and I receive editable dish-specific proposals without anything being saved automatically.

### US-03 — Finish manually when assistance fails

**As the owner-cook, I want to continue manually when voice or AI is unavailable, so that a service failure never costs me the meal record.**

- **Scenario:** Classification fails during capture.
- **Given:** My photo and current draft are saved locally and the parsing request fails or times out.
- **When:** I continue from the failure message.
- **Then:** I can edit the raw transcript or type the required dish name and save without retrying the service.

### US-04 — Confirm the proposed identity and country

**As the owner-cook, I want suggestions to remain proposals, so that my archive reflects my judgment rather than an AI guess.**

- **Scenario:** Review an assisted capture.
- **Given:** The app has proposed a dish name, country, and possible existing-dish match.
- **When:** I accept or edit the proposed values and confirm.
- **Then:** Only my confirmed values are saved to the occasion and canonical dish.
- **And:** A unique exact canonical-name or alias match may be preselected; fuzzy matches remain unselected choices and archive names never leave the device.

### US-05 — Record a multi-dish occasion

**As the owner-cook, I want one occasion to contain more than one dish, so that sides and components remain connected to the meal I cooked.**

- **Scenario:** Add a second dish to a cooking occasion.
- **Given:** My occasion already has a main photo and one named dish.
- **When:** I add another named dish and optionally associate an additional photo with it.
- **Then:** Both dish attempts share one occasion while retaining independent dish histories.
- **And:** I can add another dish before saving or from the saved occasion, remove any dish except the last one, and choose whether each extra photograph belongs to a dish or the whole occasion.
- **And:** Journal shows one card for the occasion, while dish totals, country totals, and canonical histories continue to count the individual dishes.

### US-06 — Correct and consolidate history

**As the owner-cook, I want to edit records and merge mistakenly separated dishes, so that my long-term history stays trustworthy.**

- **Scenario:** Merge two records that represent the same canonical dish.
- **Given:** Two dish records have separate attempts and I have selected which identity to retain.
- **When:** I confirm the merge.
- **Then:** Every attempt and eligible photo references the retained dish and no cooking record is lost.

### US-07 — Browse and find past cooking

**As the owner-cook, I want to browse and filter my journal, so that I can quickly revisit a dish or period I remember.**

- **Scenario:** Find a dish by name.
- **Given:** My archive contains cooking occasions across multiple dates and countries.
- **When:** I search for part of a dish name and optionally filter by one country, calendar year and month, or minimum rating.
- **Then:** I see matching occasions in reverse chronological order, can include unrated cooks explicitly, and can open an individual cook without losing my search, filters, or scroll position.

### US-08 — Understand repeated-dish evolution

**As the owner-cook, I want repeated attempts grouped into one photographic progression, so that I can see whether and how the dish improved.**

- **Scenario:** Review a repeated dish.
- **Given:** A canonical dish has multiple attempts with photos and at least some ratings or notes.
- **When:** I open the dish history.
- **Then:** I first see its photo and rating progression, with chronological notes and changed details available next.

### US-09 — Reflect on the current year

**As the owner-cook, I want a current-year summary of new and revisited dishes, so that the archive gives me a sense of exploration and progress.**

- **Scenario:** Open the Year view.
- **Given:** My archive contains at least one cooking occasion in the current calendar year.
- **When:** I open the Year destination.
- **Then:** I see recent new dishes, meaningful repeat dishes, and a photographic path into a month-grouped calendar-year recap containing every cook photograph.

### US-10 — Explore dishes geographically

**As the owner-cook, I want two dish-level map views, so that I can experience the breadth and density of my cooking without misrepresenting an entire country.**

- **Scenario:** Switch map treatments.
- **Given:** Multiple canonical dishes have approximate map locations and attempt counts.
- **When:** I switch between Needle Field and Photo Density.
- **Then:** The same independently selectable dishes appear with exact counts available, and only the repeated dish’s own column or photo cell changes strength.

### US-11 — Choose a map photograph

**As the owner-cook, I want to choose the representative photograph for a dish, so that its Photo Density cell uses the image that best represents it to me.**

- **Scenario:** Replace the default map photograph.
- **Given:** A canonical dish has more than one eligible photograph.
- **When:** I select a different photograph as its map default.
- **Then:** The Photo Density cell updates without changing any cooking occasion, attempt, rating, note, or photograph.

### US-12 — Protect and restore the archive

**As the owner-cook, I want to export and restore a portable backup, so that years of cooking are not dependent on one browser installation.**

- **Scenario:** Restore a valid archive into an empty installation.
- **Given:** I have selected a supported What I Made schema-v2 JSON backup whose record counts, identities, relationships, and encoded images are valid.
- **When:** I confirm restore into an empty archive.
- **Then:** Every occasion, dish, attempt, Idea, field, map location, and optimized photograph is restored with matching counts into an empty archive.

### US-13 — Open a separate invited archive

**As an invited cook, I want my own private archive behind a retained email-code sign-in, so that sharing the app link never shares anyone else's cooking history.**

- **Scenario:** Two invited people use one browser.
- **Given:** Each has a valid Cognito membership and a previously verified session.
- **When:** They sign out and alternate accounts.
- **Then:** Each account opens only its SHA-256-scoped local database, the prior account disappears before the next opens, and no archive record or photograph is synchronized to AWS.

### Cross-cutting constraints

- The target surface is an iPhone Home Screen PWA over HTTPS.
- Camera and photo-library sources are both supported.
- A main photo and dish name are the only required capture fields.
- Ratings are optional whole numbers from 1 through 10.
- Country is the only origin classification in version one; there is no cuisine or region taxonomy.
- A confirmed country seeds the dish’s initial map point, which can be adjusted later from the dish or map view.
- Reheating leftovers does not create a new cooking occasion.
- Required data and its main photo commit atomically.
- All AI-derived fields remain editable and require confirmation.
- The app contains no shipped AWS credentials and sends no photographs externally.
- Invitation membership uses Cognito managed login; self-registration is disabled and protected services require scoped access tokens.
- Offline archive access ends seven days after the last successful authorization without deleting local data.
- Touch targets are at least 44 by 44 CSS pixels, visible labels remain present, and core behavior works with VoiceOver, keyboard navigation, enlarged text, landscape, and reduced motion.
- Detailed technical invariants and acceptance criteria remain authoritative in the [PWA foundation](../technical/pwa-foundation/design.md).

## 8. Out of scope

The following are explicitly excluded from version one:

- Meal recommendations based on available ingredients or time, meal planning, and grocery lists. A separate owner-confirmed Ideas collection is now specified in `docs/product/ideas/design.md`.
- Live conversational cooking assistance.
- Nutrition, macros, or structured ingredient quantities.
- Sentiment analysis of notes.
- Automatic cloud backup, synchronization, or multi-device history.
- Historical Apple Photos import.
- Shared household archives, public profiles, social features, and cloud synchronization. Invitation accounts are separate and private.
- Cooking streaks, reminders, badges, and gamified pressure.
- App Store distribution.
- AI analysis of photographs.
- Automatic recipe publishing, sharing, serving scaling, and cloud recipe synchronization.
- Merging a restored backup into a non-empty archive.

These may be reconsidered only after the capture-and-reflection loop is used successfully.

## 9. Dependencies and risks

### Dependencies

- A recent iPhone and iOS/Safari version for installation, camera, photo-library, voice, Apple Files, safe-area, and performance tests.
- Static HTTPS hosting for the installable PWA when real-device testing begins.
- IndexedDB support for the local archive plus browser file sharing and download for manual schema-v2 JSON backups.
- AWS access only after browser voice and local prototype risks are evaluated.

### Risks and mitigations

| Risk | Type | Mitigation and trigger |
| --- | --- | --- |
| The capture flow still feels too slow at mealtime. | Value/usability | Prototype on the real iPhone; if median time exceeds 20 seconds, remove or defer steps before building secondary screens. |
| Browser speech is unavailable or inaccurate on the owner’s device. | Feasibility | Run ten representative voice trials; retain typing and implement the AWS streaming adapter only if browser speech fails the agreed quality test. |
| Local data is evicted or accidentally deleted. | Viability | Request persistent storage, expose storage status, make backup prominent, and prove restore before accumulating valuable history. |
| Large photo archives exceed storage or backup memory. | Feasibility | Store optimized display copies and thumbnails; measure the first 100 photos and a representative one-year JSON export on the owner’s iPhone, then add streaming ZIP export only if observed size requires it. |
| AI assigns the wrong country or canonical match. | Usability | Return confidence, constrain countries to a reviewed list, require confirmation, support later edits, and preserve manual merge. |
| Map cells become too dense to select or understand. | Usability | Validate zoom and nearest-cell selection on iPhone; provide a geographic summary list and exact-count details. |
| The personal backend is abused or exceeds budget. | Viability | Owner token, input and rate caps, reserved concurrency, redacted logs, $5/$8 alerts, and an AI kill switch. |
| A later Expo migration becomes necessary. | Feasibility | Keep domain models, validation, backup schema, and service contracts platform-neutral; accept that UI and device adapters would be rewritten. |

## 10. Open questions and validation plan

| Question | Owner | Resolve by | Status / validation |
| --- | --- | --- | --- |
| Does the capture prototype achieve a median under 20 seconds? | Product owner | Before production capture implementation | Open — test ten representative captures on the actual iPhone. |
| Does browser voice recognition meet acceptable latency and correction effort? | Product owner | Before selecting a transcription adapter | Open — record iPhone model/iOS version and run ten representative cooking notes. |
| Which photograph becomes the initial default map photo: first eligible, most recent, or an explicit choice? | Product owner | Before Photo Density implementation | Resolved — the first eligible photo stays stable until the owner changes it in Customize map. |
| Is a toggle within one Map screen preferable to two entry points? | Product owner | Before Map implementation | Resolved — one labeled segmented control appears in focused regions and remembers the last mode. |
| What exact brightness curve remains legible without overstating high repeat counts? | Product owner | Before Photo Density implementation | Resolved — five calm bands cover 1, 2, 3–4, 5–7, and 8+ cooks; exact counts are always exposed. |
| What product name and app icon should ship? | Product owner | Before installation testing | Resolved — ship as What I Made with the A1 ivory steaming-bowl mark on a full-bleed terracotta field. |
| Are annual backup parts ever needed? | Product owner | After approximately 100 optimized photos | Deferred until real archive size is measured. |

## PRD self-assessment

- **Strongest section:** Problem and target user. It is based on direct statements and observed current behavior from the sole intended user.
- **Weakest section:** Long-term reflection value. Pride and inspiration are essential but inherently qualitative and have not yet been observed through real use.
- **Highest-risk assumptions:** 80% capture coverage is realistic; the under-20-second flow is sufficient to change behavior; the two map treatments remain legible and motivating on an actual iPhone.
- **Recommended next validation:** Complete ten real-device capture trials with the interactive prototype before expanding the polished interface beyond capture and confirmation.
