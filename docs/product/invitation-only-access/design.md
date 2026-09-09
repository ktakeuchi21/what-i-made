# Invitation only private archives

Status: Deployed for the owner; canary invitation and installed-iPhone acceptance pending

## 1. Executive summary

What I Made can become an invitation-only PWA without using the App Store. Everyone receives the same app URL, but only email addresses invited by the owner can sign in. Each signed-in person receives a separate local archive on each device. Cooks, photos, Ideas, notes, and backups remain on that device and are never placed in a shared cloud database.

Amazon Cognito will replace the shared owner token with individual accounts and short-lived access tokens. Self-registration will be disabled. The first release will use owner-managed invitations and email one-time-code sign-in, with no password to remember. Existing AI routes will move behind an API Gateway JWT authorizer and will apply limits per invited account.

This is private access, not cloud sync. Signing into the same account on another device creates an empty archive unless the person restores a backup. Revoking an invitation stops future sign-in and network services, but cannot remotely erase data already stored on an offline device.

## 2. Context and scope

Today the application has one shared owner token and one fixed IndexedDB archive name. That is appropriate for a single owner, but unsafe for account switching because another signed-in person could otherwise open the same local records.

The goal is to let a small invited group use the deployed PWA while preserving its local-first privacy and offline behavior. This design covers invitations, sign-in, account-scoped local storage, API authorization, sign-out, revocation, and migration of the current owner's archive.

Confirmed product choice:

- Every invited person has a separate private archive.
- There is no household, shared, or collaborative archive.
- The app continues to be installed from a web link rather than an app store.

## 3. System context

```text
Owner                    Invited person
  |                            |
  | creates/disabled user      | opens shared PWA URL
  v                            v
Amazon Cognito <------ email code sign-in
                               |
                               v
                    Static PWA on Amplify
                         |             |
             account-scoped IDB       | access token
              cooks, photos, ideas    v
                                  API Gateway
                                  JWT authorizer
                                       |
                           +-----------+-----------+
                           |                       |
                    Capture assistance       Recipe services
```

The static application shell is downloadable by anyone who knows the URL. Security does not depend on keeping that URL secret. Cognito membership protects app access and API Gateway protects paid network services. Local data is protected primarily by account scoping, explicit sign-out behavior, and the iPhone's device security.

## 4. Proposed design

### How it works

1. The owner creates an allowed user in a Cognito User Pool. Public self-registration is disabled.
2. The owner sends the person the regular What I Made URL. The invited email address is the membership credential; possession of the URL alone grants nothing.
3. The person enters the invited email address and a one-time code delivered by Cognito. A successful session is retained so a code is not required on every launch.
4. The PWA derives a stable, non-readable archive namespace from the Cognito user `sub` claim and opens only that account's IndexedDB databases.
5. Local features read and write only that archive. AI features attach the person's short-lived access token to requests.
6. API Gateway validates token issuer, audience, expiration, and route scope before invoking a Lambda.
7. Signing out closes database handles, clears in-memory content and temporary URLs, removes the local auth session, and displays the sign-in screen. It does not delete the archive.

### Components and responsibilities

#### Cognito User Pool

- Keeps the invitation allowlist and account status.
- Disables self-registration.
- Provides passwordless email one-time-code authentication.
- Issues short-lived access tokens and renewable sessions.
- Lets the owner create, disable, or delete invited accounts through the AWS console in the first release.

AWS documents both [passwordless email OTP authentication](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html) and [administrator-only user creation](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-admin-create-user-policy.html).

#### PWA authentication boundary

- Shows sign-in before opening any account archive.
- Uses Authorization Code with PKCE and the Cognito managed sign-in experience to avoid implementing password or code handling in application code.
- Stores tokens in a separate authentication database, excluded from backup and archive erasure.
- Derives the archive key from a SHA-256 digest of the stable Cognito `sub`, never from an email address.
- Maintains a `lastAuthorizedAt` entitlement timestamp for bounded offline use.

#### Account-scoped local storage

The fixed database names are replaced with versioned, account-scoped names such as:

```text
what-i-made-archive-v1-<subject-digest>
what-i-made-auth-v1
```

The subject digest is a namespace, not a security secret. Every archive service must receive an authenticated archive context rather than selecting a database globally. Object URLs and cached view models are also discarded when that context changes.

#### Protected service API

Existing direct Lambda Function URLs move behind one API Gateway HTTP API. A Cognito JWT authorizer validates access tokens as described in the [API Gateway JWT authorizer documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html). Existing routes and provider integrations remain separate behind that gateway.

Rate limits and usage counters use a one-way digest of the Cognito `sub`. They do not use email addresses and do not contain transcript, recipe, photo, or archive content.

#### Invitation administration

The initial owner workflow uses the AWS console to create and disable users. This avoids adding an administrative backend and authorization surface for a very small private beta. A branded in-app invitation console is deferred until repeated invitation management justifies it.

### Key decisions

- Use one shared PWA URL plus authenticated membership, not a unique security-bearing link for each person.
- Use email one-time codes, not a reusable shared owner token or user-chosen passwords.
- Keep archives local and account-scoped, with no cloud database or automatic synchronization.
- Use the immutable Cognito subject identifier for storage identity; email is display and delivery data only.
- Put API authorization at API Gateway so invalid tokens are rejected before paid model services run.
- Preserve backup schema v2. A backup contains archive content but no user identity or auth token and restores only into the current account's empty archive.

## 5. Invariants and requirements

- INV-1: An uninvited email address cannot create an account or obtain an authenticated session.
- INV-2: An authenticated account can open only the archive namespace derived from its own Cognito subject.
- INV-3: Changing accounts closes the prior account's database and clears its rendered and in-memory data before the next archive opens.
- INV-4: Archive records, cooking photos, and Idea images remain local unless a person explicitly creates or restores a backup.
- INV-5: Authentication tokens, Cognito identifiers, and entitlement timestamps are never included in backups.
- INV-6: Missing, expired, invalid, or wrongly scoped access tokens cannot invoke an AI Lambda.
- INV-7: Explicit sign-out hides the local archive without deleting it.
- INV-8: Revocation never claims to erase a person's existing offline archive remotely.
- INV-9: The legacy owner archive cannot be claimed or viewed by a newly invited account.
- INV-10: Signing into another device does not imply synchronization and never silently transfers records.

## 6. Interfaces and data

### Authentication state

```ts
type AuthState =
  | { kind: "signedOut" }
  | { kind: "authorizing" }
  | {
      kind: "signedIn";
      subject: string;
      email: string;
      accessTokenExpiresAt: number;
      lastAuthorizedAt: number;
    }
  | { kind: "offlineGrace"; subject: string; lastAuthorizedAt: number };
```

The raw subject is held only in the authentication boundary. Archive modules receive an opaque `archiveKey` digest.

### Network authorization

All protected requests use:

```http
Authorization: Bearer <cognito-access-token>
```

The gateway validates issuer, audience, expiration, signature, and required route scopes. Lambdas receive the validated subject claim for pseudonymous limits. They must not accept an email or account identifier from the request body as identity.

### Backup behavior

- Export continues to produce schema-v2 JSON and excludes authentication state.
- Restore still requires an empty archive, now meaning the currently signed-in account's archive.
- Restoring another person's file is possible if the file holder deliberately selects it. The backup file itself is therefore sensitive and must retain the existing privacy warning.

### Legacy owner migration

Before invitations are enabled, the owner signs into the newly created owner account and is offered a one-time archive move:

1. Require or strongly prompt creation of a current backup.
2. Copy the legacy fixed-name database into the empty owner-scoped database.
3. Validate all counts and references before marking the copy complete.
4. Open and verify the scoped archive.
5. Keep the legacy database untouched until the owner explicitly confirms cleanup in a later step.

The migration path is exposed only during the controlled owner rollout. Invited accounts never probe or open the legacy database.

## 7. Failure behavior and lifecycle

- Incorrect or expired code: keep the email entered, show an inline error, and allow another code request subject to throttling.
- Offline before first sign-in: explain that one online sign-in is required before an archive can be created.
- Offline after authorization: allow local archive use for up to seven days since the last successful authorization. Disable network-only assistance and explain that it needs a connection.
- Offline grace expired: retain all data but require an online authorization before opening it again.
- Token refresh failure while online: close the visible archive and return to sign-in without deleting records.
- Disabled account: API access ends no later than access-token expiry, targeted at 15 minutes. Local access ends on the next online validation or after the seven-day offline grace, whichever comes first.
- Account switch: complete sign-out cleanup before another archive is opened. A partial cleanup is treated as a blocking error, not permission to reuse the existing database handle.
- Migration copy failure: leave the legacy archive untouched, delete or disregard the incomplete destination, and offer retry after reporting the failure.
- Cognito or gateway outage: saved local content remains usable within offline grace; AI actions show a retryable unavailable state.

## 8. Security, privacy, and operations

- Enforce HTTPS, Authorization Code with PKCE, strict redirect URIs, short access-token lifetime, and limited refresh-token lifetime.
- Keep the existing strict content security policy and do not load third-party runtime scripts.
- Never place tokens in URLs, logs, backups, analytics, or error reports.
- Continue the existing rule that transcripts, generated content, photographs, and archive data are not retained in backend logs.
- Use per-account request limits, global reserved concurrency, kill switches, and AWS budget alarms. Revisit the current solo-user budget before inviting anyone.
- Use Cognito's default email sender only for a very small test group. Configure a verified Amazon SES identity before broader invitation volume or branded delivery is needed.
- Record only operational status, latency, token counts, and a pseudonymous subject digest.
- Make the privacy boundary visible: local archive and photos stay on device; transcript or recipe text is sent only when the person invokes an assistance feature.
- Treat the invitee's iPhone passcode and browser profile as part of local data protection. The application does not provide remote wipe.
- Follow Cognito's published [security best practices](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-security-best-practices.html).

## 9. Acceptance criteria

- AC-1: Given an email not created by the owner, when it attempts sign-in, then no account or session is created.
- AC-2: Given an invited user, when email-code sign-in succeeds, then the app opens that user's archive and does not ask for a code on every normal launch.
- AC-3: Given two invited accounts on one browser, when they alternate sign-in, then each sees only its own cooks, photos, Ideas, drafts, map state, and backups.
- AC-4: Given explicit sign-out, when the sign-out completes, then no prior archive content remains visible or reachable until that account signs in again.
- AC-5: Given a missing, expired, invalid, or wrong-audience token, when an AI endpoint is called, then API Gateway rejects it without invoking the Lambda.
- AC-6: Given a disabled account online, when its access token expires or the session refreshes, then it can no longer use the app or protected services.
- AC-7: Given a previously authorized device without a connection, when fewer than seven days have elapsed, then saved local content remains usable and network actions explain their unavailable state.
- AC-8: Given the same account on a new device, when it signs in, then it receives an empty archive and clear restore guidance rather than an implied sync.
- AC-9: Given a schema-v2 backup, when it is restored into the signed-in account's empty archive, then archive records restore and no authentication state changes.
- AC-10: Given the existing owner's legacy archive, when controlled migration succeeds, then counts and references match and no invited account can access the legacy database.

## 10. Test approach

- Unit tests cover subject-to-archive-key derivation, database selection, auth-state transitions, offline-grace calculation, token exclusion from backup, and account-switch cleanup.
- IndexedDB integration tests create two subjects in one browser and prove complete isolation across every persistent store, including drafts and images.
- Migration tests cover empty destination, interrupted copy, reference validation failure, successful verification, and prevention of legacy access by a non-owner account.
- Authentication tests cover invited and uninvited emails, expired codes, throttling, session restoration, explicit sign-out, disabled users, and expired offline grace.
- API contract tests prove JWT issuer, audience, expiration, signature, and scope validation, and prove rejection occurs before Lambda invocation.
- Browser tests cover first sign-in, return launch, offline launch, account switching, local capture, backup, restore, and protected AI calls.
- Privacy tests inspect network traffic and logs to confirm that local archive lists and images are not transmitted and that tokens never enter URLs or exported files.
- Real-iPhone testing verifies PWA installation, email-code handoff, offline behavior, session restoration, account switching, and VoiceOver announcements.

## 11. Risks and tradeoffs

- Local-only archives mean no automatic cross-device sync or recovery. Backup remains essential.
- Revocation has an unavoidable offline delay. A seven-day grace balances regular offline use against bounded access after revocation, but it is not remote wipe.
- Cognito adds identity operations, email delivery, and account-recovery support that the solo app does not have today.
- Moving Function URLs behind API Gateway adds cost and deployment work, but creates a reliable per-user authorization boundary.
- Managed sign-in is less visually integrated than a custom form, but reduces custom authentication code and security risk.
- Manual AWS-console invitations are appropriate for a small beta but become cumbersome at larger scale.
- A public static shell exposes application assets and code. It does not expose private records or grant service access.

## 12. Open questions

- Is seven days the preferred maximum offline grace, or should invited access require more frequent online validation?
- How many people are expected in the first invitation group? The recommendation is no more than ten before reviewing service quotas and cost alarms.
- Should invitation emails use Cognito's default sender for the beta, or is branded email important enough to configure SES before launch?
- When invitation management becomes frequent, should the owner receive an in-app administration screen or continue using AWS administration?

None of these questions blocks an initial implementation using the recommended defaults above.

## 13. Out of scope

- Shared household archives, collaboration, comments, or shared editing.
- Cloud synchronization, server-side archive storage, or automatic multi-device recovery.
- App Store distribution or native application packaging.
- Public profiles, recipe publishing, social discovery, or shareable cook pages.
- In-app invitation administration in the first release.
- Remote deletion of data already stored on an invitee's device.
- Hiding the downloadable static application code from unauthenticated visitors.
