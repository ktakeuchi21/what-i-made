# What I Made Development Plan

## Current constraints

- One primary user: the owner of the app.
- Must be comfortable to use on an iPhone.
- The first-release platform is an installable web app optimized for iPhone.
- Maintenance effort, privacy, and low operating cost matter more than broad-market scale.

## Decision sequence

### 1. Product discovery

Produce a problem statement, proto-persona, Jobs-to-be-Done analysis, goals, non-goals, assumptions, and success signals. Because the owner is also the user, use a structured self-interview and observation of the current cooking workflow instead of invented market research.

### 2. Platform decision (complete)

The requirements were compared across three viable paths:

| Option | Strong fit when | Main trade-off |
| --- | --- | --- |
| Installable web app (PWA) | Fastest build, link-based access, modest device integration | iOS background behavior and native integrations are more limited |
| React Native with Expo | Mobile-first UX, camera/notifications or richer device access, possible future Android support | More tooling and release complexity than a web app |
| Native SwiftUI | Deepest Apple integration and best native fit | Highest iOS-specific learning and maintenance cost |

An installable web app was selected because it satisfies the confirmed iPhone, camera, photo-library, microphone, local-storage, manual-backup, and home-screen requirements with the lowest release and maintenance burden. The comparison, trade-offs, AWS boundary, and React Native migration boundary are recorded in `docs/technical/pwa-foundation/design.md`.

### 3. Product definition (draft complete)

The engineering-ready product definition is captured in `docs/product/PRD.md` and `docs/product/USER_STORY_MAP.md`. It includes the feature inventory, out-of-scope list, vertical release slices, user stories, Gherkin acceptance criteria, risks, and open validation questions. The first usable slice completes one durable cooking workflow end to end without requiring AI.

### 4. Experience design (capture prototype and feasibility lab ready)

The design system is recorded in `design-system/what-i-made/MASTER.md`, with capture-specific rules in `design-system/what-i-made/pages/capture.md` and feasibility-lab rules in `design-system/what-i-made/pages/feasibility-lab.md`. The interactive prototype at `prototypes/capture-flow/index.html` covers minimum capture, voice-assisted confirmation, back navigation, save feedback, and an assistance-failure fallback. The diagnostic surface at `spikes/iphone-feasibility/index.html` exercises install context, camera and library inputs, photo optimization, IndexedDB persistence, browser voice, and Apple Files export. Its physical-iPhone results remain required before the production UI and device adapters are treated as validated.

### 5. Technical design

Define the data model, local-versus-cloud storage, sync/backup approach, privacy boundaries, error/offline behavior, and testing strategy. Avoid accounts, servers, and subscriptions unless the PRD proves they are needed.

### 6. Incremental delivery

Implement one vertical slice at a time. Each slice must map to acceptance criteria and include automated checks plus real-device, simulator, or mobile-browser evidence appropriate to the chosen platform.

## Installed project skills

- Product: problem framing, problem statements, proto-personas, Jobs-to-be-Done, PRD development, prioritization, story mapping, user stories, and story splitting.
- Design: UI UX Pro Max for mobile/web design systems, accessibility, touch interaction, and stack-specific guidance.
- Engineering: technical design, architecture documentation/review, implementation planning, task delivery, testing, code review, and simplification.

## Plugins and tools

No external plugin is required during discovery. Markdown, Git, web research, visual generation, and the installed skills are sufficient.

Add integrations only at the point of need:

- Figma: only if editable collaborative design files become valuable.
- A task tracker such as Trello or Asana: only if the Markdown backlog becomes hard to manage.
- Grocery or commerce integrations: only if the validated product scope includes ordering or retailer data.
- Web deployment tools: only if the platform decision selects a web app.
- Xcode/Simulator or Expo tooling: only after selecting SwiftUI or React Native.

## Next milestone

The owner’s iPhone has now validated Home Screen installation, camera and library input, HEIC/orientation handling, IndexedDB persistence, Apple Files export support, and the custom Amazon Transcribe button. The capture prototype now uses that proven voice route and turns recognized text into editable dish, rating, notes, ingredients, and country suggestions.

The integrated capture flow now saves atomic multi-dish cooking occasions, supports later dishes and photographs, provides Journal discovery and photo recap, and exposes local backup and restore. Smarter capture assistance is implemented as a separate protected Lambda: after Done it cleans only the finalized voice segment, proposes up to six editable dishes, validates countries against the bundled catalog, and leaves matching against canonical names and aliases entirely on-device.

The capture-assistance Lambda and HTTPS endpoint are deployed with model logging disabled. The account currently cannot reserve two executions without violating AWS's minimum unreserved-concurrency pool, so the service uses its rate guard, kill switch, and budget controls until that quota is raised. Next, run the installed-iPhone acceptance pass to measure correction effort, country acceptance, exact and fuzzy match choices, ten-second timeout recovery, VoiceOver announcements, and confirmation that network inspection contains transcript text only—never photographs or archive records.
