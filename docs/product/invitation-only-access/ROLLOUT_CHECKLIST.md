# Invitation-only rollout checklist

Status: Pending production execution

This is the release gate for invitation-only private archives. Complete it in order. Do not create an invited user until the owner archive has been migrated, verified, and the migration-only bundle has been replaced. Record evidence without copying access tokens, authorization codes, raw Cognito subjects, email codes, transcripts, photographs, recipe content, or archive data into this file.

## Release record

- Date and operator:
- AWS account alias or non-secret identifier:
- Region:
- CloudFormation stack name:
- Production PWA origin:
- Source commit:
- Prior archive backup filename and counts:
- Final static artifact location or deployment ID:

## 1. Prepare and freeze the old boundary

- [ ] Create and inspect a current schema-v2 backup of the owner's archive. Record its filename and aggregate counts above; keep the file outside the repository.
- [ ] Record the three retired Function URL origins in a private operator note so each can be checked after removal. Do not place their shared token here.
- [ ] Set each old transcription, capture-assistance, and Recipe Ideas service's enabled flag to `false`; verify its former endpoint returns the disabled response before removing that endpoint.
- [ ] Confirm the current branch is clean and the full automated suite, deployment-packager tests, CloudFormation lint, and independent review are green for the source commit above.
- [ ] Confirm AWS budget notifications and the Transcribe service-improvement opt-out remain effective in the deployment account.

## 2. Deploy identity and authorization first

- [ ] Deploy `infrastructure/invitation-access/template.yaml` initially with `ServicesEnabled=false` and `ReservedConcurrency=0` unless the account can retain the required unreserved concurrency.
- [ ] Record the stack outputs `AwsRegion`, `UserPoolId`, `WebClientId`, `ManagedLoginDomain`, and `ApiBaseUrl` in the private release record—not in source control.
- [ ] In Cognito, verify self-registration and self-service password recovery are disabled; email OTP and the API-required password compatibility factor are allowed; the app client has no secret; Authorization Code is the only OAuth flow; callback/logout URLs exactly match production; and access-token lifetime is 15 minutes.
- [ ] Create only the owner account without a temporary or reusable password; allow managed email OTP sign-in. Do not create invitees yet.
- [ ] Remove every retired Lambda Function URL configuration or public invoke permission and revoke the shared owner token. Direct requests to every former URL must fail.

## 3. Prove rejection happens before Lambda

For each protected route, capture the API Gateway response and compare the corresponding Lambda `Invocations` metric before and after a quiet test interval. A `401` or `403` alone is insufficient proof; the invocation sum must remain unchanged. Obtain test tokens only through Authorization Code with PKCE, keep them transient, and never paste them into this checklist, shell history, screenshots, or logs. Use one access token allowed only `what-i-made/capture`, one allowed only `what-i-made/recipes`, one retained until its `exp` is past, and one issued by a temporary public test client in the same pool whose client ID is not `WebClientId`. Delete the temporary client after the test.

- [ ] Record a baseline timestamp and invocation count for all three Lambdas.
- [ ] Call both capture routes with no authorization, a malformed bearer token, the expired token, the wrong-client token, and the recipes-only token. Every request is rejected before either capture Lambda runs.
- [ ] Call every Recipe Ideas route with no authorization, a malformed bearer token, the expired token, the wrong-client token, and the capture-only token. Every request is rejected before the Recipe Ideas Lambda runs.
- [ ] Inspect the deployed authorizer and each route: issuer and audience exactly match the stack outputs, and capture versus recipes authorization scopes match the template.
- [ ] After CloudWatch metrics settle, confirm the Lambda invocation sums did not increase during those rejected requests.
- [ ] Confirm API and Lambda logs contain status/latency metadata only and contain no bearer token, authorization code, subject, email, transcript, recipe, photograph, or archive record.

## 4. Migrate the owner before invitations

- [ ] Read the owner's immutable Cognito `sub` privately and derive only the documented SHA-256 owner archive digest.
- [ ] Generate and deploy a temporary owner-only static bundle containing that digest. Inspect the bundle before upload and confirm it contains no raw subject, email, token, code, or backup.
- [ ] On the owner's existing iPhone, complete managed email-code sign-in and confirm the migration prompt appears only for the owner destination.
- [ ] Use **Download backup first** and save the newly prepared backup to Files.
- [ ] Record the displayed legacy counts, run **Move archive**, and confirm the destination counts and references match.
- [ ] Open Year, Map, Journal, Ideas, cook detail, and representative photographs from the account-scoped archive. Confirm the legacy source remains intact.
- [ ] Sign out and confirm all archive content disappears without being erased. Sign back in and confirm the same scoped archive returns.
- [ ] Generate and deploy a fresh bundle with no legacy-owner digest. Confirm the migration prompt is no longer reachable.

## 5. Enable services and validate the owner account

- [ ] Redeploy with `ServicesEnabled=true`; use reserved concurrency only if the account quota safely supports it.
- [ ] From the signed-in PWA, verify Transcribe session creation, capture assistance, recipe search/import, and image retrieval with scoped access tokens.
- [ ] Inspect browser traffic: archive listings, cooking records, Idea records, cooking photographs, and backup contents never leave the device. Only explicitly invoked transcript/recipe text and selected public recipe retrievals use the service API.
- [ ] Confirm access tokens and OAuth codes are absent from URLs after callback cleanup, Cache Storage keys and response metadata, referrers, application logs, analytics, and schema-v2 backups.
- [ ] Do not disable, delete, or erase the production owner account or its migrated archive during acceptance testing. Revocation and empty-archive restoration use the first canary in section 7.

## 6. Installed-iPhone acceptance

- [ ] Install or update the PWA from the production HTTPS origin and confirm the selected icon, safe-area layout, and four-tab navigation.
- [ ] Verify first sign-in, retained-session relaunch, email-code handoff, explicit sign-out, and sign-in restoration.
- [ ] Verify online-to-offline transition, relaunch within grace, network-action messaging, suspend/resume deadline enforcement, and expired-grace relocking without data loss.
- [ ] Verify capture, camera/photo library, voice Done, local fallback, Ideas, map, Journal, and owner backup to Files. Do not erase or test restore over the migrated owner archive.
- [ ] Verify VoiceOver announcements, focus restoration, large text, reduced motion, portrait, and landscape.
- [ ] Record device model, iOS version, installed-versus-Safari context, and any deviations in `prototypes/capture-flow/TEST_REPORT.md` without including personal content.

## 7. Invite one canary user

- [ ] Create one disposable, owner-approved Cognito user without a reusable password and send the ordinary PWA link separately. This is the first canary and the only account used for destructive restore and revocation checks.
- [ ] Confirm an uninvited email cannot self-register or obtain a session.
- [ ] Confirm the canary's first sign-in opens an empty archive with restore guidance and never shows the owner migration prompt.
- [ ] Restore a non-sensitive schema-v2 fixture backup into the canary's empty archive, verify counts and photographs, then erase only the canary archive and confirm the owner archive is unchanged.
- [ ] On one browser, alternate owner and canary sign-in and verify cooks, photos, Ideas, drafts, view state, backups, and cached in-memory content remain isolated.
- [ ] Disable the canary and verify protected services stop at access-token expiry or refresh, while the UI never claims remote deletion and local access remains bounded by the documented offline grace. Re-enable it only if further canary testing is required; otherwise leave it disabled or delete it after recording the result.
- [ ] Only after the canary passes, create any remaining invited users.

## Rollback without reopening the retired boundary

If a gate fails before a Cognito-configured shell is published, keep the legacy static shell available only as an inert local-archive reader: all old service enabled flags stay `false`, every old Function URL/public permission remains removed, and no shared token is restored. If a gate fails after the Cognito shell is published, set `ServicesEnabled=false`, stop creating users, and keep the last verified Cognito-gated artifact online. In either phase, local archives and the preserved legacy owner archive remain untouched; correct the failed layer and resume at its checklist section.

## Completion evidence

- [ ] All checklist items above have dated evidence.
- [ ] `prototypes/capture-flow/TEST_REPORT.md` links or summarizes the production and device proof without secrets or personal content.
- [ ] The owner confirms the migrated archive and backup are usable.
- [ ] Final regression and safety review approves the deployed configuration.
