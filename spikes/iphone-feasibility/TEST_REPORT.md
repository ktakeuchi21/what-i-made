# iPhone Feasibility Lab Test Report

> **Date:** September 3, 2026  
> **Hosted surface:** `https://main.dk27yiqjy46kx.amplifyapp.com/`  
> **Automated surface:** `http://127.0.0.1:4173/spikes/iphone-feasibility/?run=automated`  
> **Browser evidence:** Codex in-app browser on macOS  
> **Scope boundary:** This report validates the static implementation, desktop-browser behavior, and AWS Amplify HTTPS deployment. It does not substitute for the physical-iPhone run.

## Results

| Criterion | Result | Evidence | Remaining gap |
| --- | --- | --- | --- |
| AC-1 — Installed context | Unverified | Secure context reported, service worker registered, and manifest parsed. | Standalone Home Screen mode must be proven from the iPhone icon over HTTPS. |
| AC-2 — Photo entry | Pass locally | Browser file-chooser flows exercised both camera and library inputs. After a working JPEG, an intentionally invalid `.heic` still recorded the picker as successful while the processing card failed separately; the old preview disappeared and the report's photo evidence became `null`. A subsequent JPEG recovered normally. | Actual camera capture and iOS library picker remain device-only. |
| AC-3 — Photo processing | Pass locally | A 1448×1086, 373.4 KB JPEG became a 1448×1086, 232.7 KB JPEG (38% smaller); the preview was upright. The manual rotated-image failure state changed to **Needs adapter** and recovered after correction. | HEIC, wide-gamut, high-resolution, and EXIF-orientation samples remain device-only. |
| AC-4 — Durable storage | Device issue under diagnosis | Desktop IndexedDB metadata and a real optimized-photo Blob matched immediately and survived reload. On September 1, the physical iPhone reported the original generic **IndexedDB write failed** result. The revised diagnostic tests metadata, direct Blob storage, and an ArrayBuffer adapter separately and preserves Safari's underlying error. Both the direct path and a simulated Blob-failure adapter path pass locally and survive reload. The revised AWS deployment also reached **Passed with adapter** after a forced hosted Blob rejection and reload. | Rerun on the physical iPhone and record whether metadata fails, the direct Blob alone fails, or the ArrayBuffer adapter also fails. |
| AC-5 — Voice | Pass through custom AWS route | The physical iPhone granted microphone access, but Safari `SpeechRecognition` returned no words and the local-only control was unusable. Keyboard Dictation entered text successfully. After the signer correction, the installed app's dedicated **Speak your cook** route successfully completed a real Amazon Transcribe run on September 3. | Detailed background, screen-lock, and interruption behavior remains for the broader resilience pass. |
| AC-6 — Apple Files | Unverified | File-sharing capability detection, native-share attempt, manual confirmation, and standard-download fallback are implemented. | Confirm that Save to Files appears and that the file can be reopened on iPhone. |
| AC-7 — Report and privacy | Pass locally | Report preview is visible and excludes photo bytes, photo names, and transcript text. Copy/download actions provide explicit feedback. Source scan found no external scripts, analytics, `sendBeacon`, or app-owned cross-origin request. Safari's potentially server-backed speech recognition is disclosed before activation and in the report. | Browser download-event capture was unavailable in the local automation surface; file creation is closed by the iPhone Files check. Safari speech privacy must be accepted or the owner should skip that check. |
| AC-8 — Mobile accessibility | Partially verified | No horizontal overflow at 320, 375, or 390 CSS pixels or at 844×390 landscape. The smallest visible control was 48 CSS pixels. Native headings, buttons, labels, fieldsets, progress semantics, skip link, one polite live region, SVG icons, safe-area insets, reduced-motion CSS, and explicit status text were present. Browser console warnings/errors were empty. | VoiceOver, largest text size, actual safe areas, and rendered dark appearance require device/manual checks. |

## Parse and asset checks

- `app.js` parsed successfully with Node's JavaScript parser.
- `sw.js` parsed successfully.
- `manifest.webmanifest` parsed as valid JSON.
- The live page loaded its application shell and registered its service worker without console warnings or errors.
- AWS Amplify reported the `main` branch as **Deployed**. The public HTTPS surface loaded the expected What I Made lab, reported a secure context and registered service worker, exposed the manifest-backed install check, and produced no browser console warnings or errors.

## September 1 storage diagnostic revision

- Direct metadata and optimized-photo Blob storage passed locally and remained **Passed** after reload.
- A forced direct-Blob `DataCloneError` selected the ArrayBuffer adapter, which remained **Passed with adapter** after reload.
- Seeded prior success followed by forced metadata, total-binary, and preflight-clear failures remained **Failed** after reload; no stale successful record could replace the latest failure.
- Every failure reports its operation stage and browser error name/message in the privacy-safe copied report.
- The revised code-only ZIP was deployed to the existing Amplify `main` branch on September 1. A clean public load showed the new staged-storage UI; the hosted forced-Blob-failure route reached **Passed with adapter** after reload with no console warnings or errors.
- WebKit documents substantially larger modern Safari storage quotas and equal quota treatment for standalone Home Screen apps, so this tiny failing write is not assumed to be a quota failure without the revised evidence. WebKit also tracks intermittent IndexedDB failures on Apple devices. See [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) and [WebKit bug 282093](https://bugs.webkit.org/show_bug.cgi?id=282093).

## September 2 custom voice revision

| Criterion | Result | Evidence | Remaining gap |
| --- | --- | --- | --- |
| AC-16 — Dedicated button returns editable text | Pass on installed iPhone | At 375×762, **Speak your cook** entered listening state without opening the keyboard; partial text appeared, **Done** finalized a longer transcript, and the textarea remained editable in simulation. On September 3, the owner confirmed that the corrected live Amazon Transcribe route passed from the installed iPhone app. | None for the representative transcription path. |
| AC-18 — Failure and cleanup | Partially verified | Production-adapter tests prove idempotent and concurrent-safe cleanup; release of tracks, audio context, socket, timers, and buffers; cancellation during pending microphone permission, session request, and socket opening; rejection of late events; whole-startup and socket deadlines; startup audio-context interruption; and stop/finalization. The browser simulation showed an inline connection failure while leaving typing available. | Physical permission denial, offline, background, screen-lock, and interruption checks. |
| AC-20 — Secret and frame safety | Pass for source and deployable artifact | Codec tests validate PCM bounds, required event-stream headers, message CRCs, and corrupted-frame rejection. The deployable static ZIP contains the public endpoint but no owner token, signed URL, AWS credential, or test credential. | Capture the real iPhone network trace during the device run. |
| AC-21 — Session authorization | Pass for deployed rejection path | Missing/wrong token, disabled service, malformed shape, oversized body, and wrong method return the expected safe statuses locally. The live Function URL returned HTTP 401 with `{"error":"unauthorized"}` when called without a token. A valid request returns only a fixed-parameter, 15-second regional Transcribe URL in unit tests. | Run one authorized session from the iPhone and inspect the returned URL and WebSocket behavior. |
| AC-22 — Responsive and accessible voice UI | Pass locally at target sizes | The success, failure, and disabled states were exercised at 375×762 and 844×390. No horizontal overflow or console warnings/errors appeared. The labeled textarea, 48-pixel controls, adjacent cancel action, pressed/busy states, disclosure, and atomic status remained available. | Large text, VoiceOver, dark appearance, and reduced motion on the physical iPhone. |
| AC-23 — AWS controls | Pass with documented concurrency exception | The account's effective Organizations policy is valid and sets `transcribe.opt_out_policy` to `optOut`. The Lambda is ARM64, uses exact-origin CORS, has no attached managed policies, and has only the reviewed inline Transcribe/logging policy. Voice was enabled only after the opt-out and a monthly $8 account budget with actual-spend alerts at $5 and $8 were created. | AWS rejected reserved concurrency one because this new account must retain at least ten unreserved executions. Budget alerts are notifications, not a hard cap. |

Automated result: 21 tests passed, 0 failed using Node's built-in test runner. The iPhone-sized browser success flow, connection-failure flow, disabled production-default flow, and landscape overflow check passed without console warnings or errors. A typed-note preservation check confirmed that live partial words stay separate and the final voice text is appended rather than overwriting existing text.

## September 3 AWS deployment

- The effective AWS Organizations policy contains `{ "services": { "transcribe": { "opt_out_policy": "optOut" } } }` and reports no validation issues.
- The pre-created Lambda log group retains logs for one week. The Lambda is deployed in US East (Ohio), and unauthenticated POST requests return HTTP 401 without exposing configuration.
- Function URL CORS allows only `https://main.dk27yiqjy46kx.amplifyapp.com`, `POST`, `Authorization`, and `Content-Type`.
- The execution role has the reviewed inline policy and zero attached managed policies.
- The monthly AWS cost budget is $8 with actual-spend email alerts at $5 and $8.
- The configured static ZIP passed all 21 automated tests, contained no owner token or AWS credential, and was deployed to Amplify. A clean hosted load reported a registered service worker and **Custom AWS transcription: Ready**.
- The first authorized iPhone attempt exposed an encoding mismatch in the hand-written WebSocket signer: the connection upgraded, then Transcribe reported an invalid security token. A credential-only live handshake reproduced the error without microphone audio. AWS's returned canonical request showed that its endpoint expected one RFC 3986 encoding pass for the temporary session token. The signer and fixed-vector regression test were corrected, all 21 tests passed again, and the redeployed signer upgraded to HTTP 101 with no credential or signature exception during the five-second diagnostic window.
- The owner then reran **Speak your cook** on the installed iPhone and confirmed that the end-to-end transcription passed.

## Decision rule after the iPhone run

- Browser transcription is viable only if it returns a usable sentence reliably in the actual post-cooking environment.
- If microphone capture works but browser speech recognition is unavailable or unreliable, retain the manual typed fallback and implement the planned Amazon Transcribe adapter in Slice 2.
- Any repeated HEIC rotation or decode failure blocks production photo capture until the photo adapter handles that file class explicitly.
- A denied persistent-storage request does not block the PWA, but it makes first-release backup/restore non-negotiable.
