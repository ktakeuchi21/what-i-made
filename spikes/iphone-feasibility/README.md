# What I Made iPhone Feasibility Lab

This static, dependency-free test surface proves the iPhone capabilities that carry the most product risk before the production archive is built. It is not the app. It has no analytics or photo upload. The deployed **Speak your cook** route streams microphone audio directly to Amazon Transcribe only after the owner saves a private token and starts recording; a small protected Lambda issues only a short-lived signed connection URL and never receives audio. Keyboard Dictation and typing remain available.

## Hosted lab

Open the production HTTPS deployment in iPhone Safari:

`https://main.dk27yiqjy46kx.amplifyapp.com/`

The static lab is hosted by AWS Amplify in US East (Ohio). Hosting serves the application shell only; the lab does not upload photographs, transcripts, or diagnostic results to AWS.

## Acceptance criteria

- **AC-1 — Installed context:** The page reports whether it is secure, service-worker ready, and running in standalone Home Screen mode.
- **AC-2 — Photo entry:** Camera and photo-library inputs can each select a photograph without an app-owned upload. Picker success is tracked separately from subsequent image processing.
- **AC-3 — Photo processing:** A selected image is decoded locally, rendered upright, converted to JPEG, and reduced toward the production size limits. The owner manually confirms orientation.
- **AC-4 — Durable storage:** IndexedDB first round-trips metadata, then attempts the real photo `Blob`. If Safari rejects direct Blob storage, the lab tries an `ArrayBuffer` adapter and reports both results separately. The successful representation must survive a page reload. Persistent-storage status and quota are visible.
- **AC-5 — Voice:** Microphone permission, Safari browser speech recognition, and the optional custom Amazon Transcribe route are reported separately. The Safari test requires local-only processing when supported; the custom route is disabled until its AWS endpoint, owner token, and Transcribe service-improvement opt-out are configured. Any transcript stays editable; the report includes only its character count.
- **AC-6 — Apple Files:** The page attempts file sharing through the native share sheet and asks the owner to confirm whether Save to Files appeared. A standard download remains available as a fallback.
- **AC-7 — Report and privacy:** The owner can preview, copy, or download a diagnostic report that excludes photograph bytes, photograph names, owner tokens, signed URLs, and transcript text. Photos and reports remain local. Safari Dictation may use Apple; when configured, custom-button audio goes directly to Amazon Transcribe while active. These boundaries are disclosed before use.
- **AC-8 — Mobile accessibility:** The page is usable at 320 CSS pixels, respects safe areas and reduced motion, retains visible labels and focus indicators, and uses at least 44-by-44 CSS-pixel controls.

## Run locally

Serve the repository root over HTTP and open:

`http://127.0.0.1:4173/spikes/iphone-feasibility/`

Localhost is useful for desktop browser validation. Physical-iPhone camera, microphone, service-worker, and Home Screen checks require an HTTPS deployment; an iPhone cannot validate those capabilities from the Mac-only localhost address.

The optional `?run=<name>` query parameter creates an isolated local test session. Automated checks use `?run=automated`; the normal URL uses the clean `owner` session and is the one that should be added to the Home Screen.

## iPhone test order

1. Open the HTTPS URL in Safari.
2. Run the camera and photo-library checks with disposable images.
3. Confirm the processed image is upright and inspect its dimensions and byte reduction.
4. Run storage. If direct photo Blob storage fails, note whether the ArrayBuffer adapter passes. Reload the page and confirm the successful route changes to passed.
5. Check microphone permission, then try one spoken cooking note.
6. Open the share sheet, choose Save to Files, and confirm it appeared.
7. Add the page to the Home Screen, reopen it from the icon, and rerun the install check.
8. Copy or download the privacy-safe result report.

## Data handling

The lab stores diagnostic state, the most recently processed display copy, a small durability record, and—only after setup—the private owner token in local IndexedDB. **Clear lab data** removes IndexedDB records. **Reset all lab results** removes both diagnostic state and IndexedDB records. No photograph or report is sent to What I Made or AWS. If the browser supports `SpeechRecognition.processLocally`, the Safari diagnostic sets it to `true`. Keyboard Dictation may use Apple. When the optional custom route is enabled, audio streams directly to Amazon Transcribe and the transcript remains editable locally; What I Made and Lambda do not durably store either.

## Custom AWS transcription development

- The deployed `config.js` names the exact protected Function URL. Local UI checks can still use `?voice=fake`; that simulation is accepted only on `localhost` or `127.0.0.1`.
- The dependency-free session signer is under `backend/session/`. Its Function URL uses exact-origin CORS and the least-privilege policy in `iam-policy.json`. Reserved concurrency one was requested, but AWS rejected it because this new account must retain ten unreserved executions; the token, exact-origin policy, and account-wide budget alerts remain the active controls.
- Before enabling real audio, apply and verify the Transcribe-specific AWS Organizations service-improvement opt-out policy. AWS may still retain data needed to provide and maintain the service.
- Run unit tests with the workspace Node runtime:

  `/Users/hayleydearden/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test spikes/iphone-feasibility/tests/*.test.*`
