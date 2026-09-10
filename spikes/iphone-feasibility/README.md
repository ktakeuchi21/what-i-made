# What I Made iPhone Feasibility Lab

> **Historical boundary:** This diagnostic lab preserves the original owner-token controls so its prior device findings remain reproducible. It is not part of the deployable application bundle. Invitation production uses Cognito access tokens and API Gateway as documented in [`docs/product/invitation-only-access/design.md`](../../docs/product/invitation-only-access/design.md); do not redeploy this lab or its retired Function URL as an application authorization path.

This static, dependency-free test surface recorded the iPhone capability work that preceded the production archive. It is not the app and has no analytics or photo upload. During the historical test, **Speak your cook** used a private owner token to obtain a short-lived signed connection URL; that authorization path is retired. Keyboard Dictation and typing findings remain useful.

## Historical hosted evidence

The original validation deployment was:

`https://main.dk27yiqjy46kx.amplifyapp.com/`

Do not use this URL as the current application or reactivate its Function URL. It is retained only as historical evidence and may no longer be available. Current production validation follows the [invitation-only rollout checklist](../../docs/product/invitation-only-access/ROLLOUT_CHECKLIST.md).

## Acceptance criteria

- **AC-1 — Installed context:** The page reports whether it is secure, service-worker ready, and running in standalone Home Screen mode.
- **AC-2 — Photo entry:** Camera and photo-library inputs can each select a photograph without an app-owned upload. Picker success is tracked separately from subsequent image processing.
- **AC-3 — Photo processing:** A selected image is decoded locally, rendered upright, converted to JPEG, and reduced toward the production size limits. The owner manually confirms orientation.
- **AC-4 — Durable storage:** IndexedDB first round-trips metadata, then attempts the real photo `Blob`. If Safari rejects direct Blob storage, the lab tries an `ArrayBuffer` adapter and reports both results separately. The successful representation must survive a page reload. Persistent-storage status and quota are visible.
- **AC-5 — Voice:** Microphone permission, Safari browser speech recognition, and the historical custom Amazon Transcribe route were reported separately. Any transcript remained editable; the report included only its character count.
- **AC-6 — Apple Files:** The page attempts file sharing through the native share sheet and asks the owner to confirm whether Save to Files appeared. A standard download remains available as a fallback.
- **AC-7 — Report and privacy:** The diagnostic report excludes photograph bytes, photograph names, owner tokens, signed URLs, and transcript text. Photos and reports remain local. The original test separately recorded Safari Dictation and direct Transcribe behavior.
- **AC-8 — Mobile accessibility:** The page is usable at 320 CSS pixels, respects safe areas and reduced motion, retains visible labels and focus indicators, and uses at least 44-by-44 CSS-pixel controls.

## Run locally

Serve the repository root over HTTP and open:

`http://127.0.0.1:4173/spikes/iphone-feasibility/`

Localhost may be used to inspect or regression-test this historical surface. Keep current runs local-only; do not expose the lab through a new HTTPS deployment. Current physical-iPhone acceptance belongs to the invitation rollout checklist.

The optional `?run=<name>` query parameter creates an isolated local test session. Automated checks use `?run=automated`; the clean `owner` session was the one used during the completed historical Home Screen test.

## Historical iPhone test order

This sequence documents the completed feasibility experiment; do not use it to reactivate the retired endpoint. Use the invitation rollout checklist for current device acceptance.

1. The owner opened the historical HTTPS URL in Safari.
2. The owner ran the camera and photo-library checks with disposable images.
3. The owner confirmed the processed image orientation, dimensions, and byte reduction.
4. The owner ran the storage tests, reloaded, and confirmed the successful persistence route.
5. The owner checked microphone permission and tried one spoken cooking note.
6. The owner opened the share sheet and confirmed Save to Files appeared.
7. The owner added the historical page to the Home Screen, reopened it, and reran the install check.
8. The owner copied or downloaded the privacy-safe result report.

## Historical data handling

The lab stored diagnostic state, a processed display copy, a durability record, and—during the retired setup—the private owner token in local IndexedDB. **Clear lab data** and **Reset all lab results** remove those records. No photograph or report was sent to What I Made or AWS. This describes historical test behavior, not the current invitation architecture.

## Archived implementation notes — do not deploy

- The archived `config.js` and UI preserve the former Function URL/owner-token experiment only so prior results can be reproduced locally. Do not publish them.
- The dependency-free signer source under `backend/session/` is packaged for production only through the Cognito-protected API Gateway stack; its README describes the current boundary. It has not yet passed the invitation rollout deployment gate.
- The Transcribe service-improvement opt-out remains a production prerequisite, independent of authentication.
- Historical unit tests remain runnable with the workspace Node runtime:

  `node --test spikes/iphone-feasibility/tests/*.test.*`
