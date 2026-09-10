# Owner analytics rollout checklist

Status: Implementation ready for deployment validation

This release adds first-party metadata analytics. Never place emails, Cognito subjects, access tokens, event IDs, or private archive content in this checklist.

## Infrastructure first

- Deploy the updated SAM stack with the production app callback and the additional `/admin/` callback.
- Record the non-secret `AnalyticsTableName` and `AnalyticsAdminGroupName` outputs.
- Add only the owner Cognito user to `what-i-made-admins`; confirm an invited canary is not a member.
- Verify the post-authentication trigger returns successfully when DynamoDB is unavailable so analytics cannot block sign-in.
- Confirm the analytics table uses TTL on `expiresAt`, on-demand billing, retained deletion policy, and the existing AWS budget alarms.

## Authorization proof

- Call activity ingestion with an invitee access token carrying `what-i-made/activity`; confirm a valid metadata batch succeeds.
- Confirm missing, malformed, expired, wrong-client, and wrong-scope tokens are rejected by API Gateway.
- Confirm an authenticated invitee with the admin scope but without the admin group receives `403` from every admin route.
- Confirm only the owner group can load summary, users, user detail, and erase routes.
- Confirm account and timeline cursors return bounded pages, malformed cursors fail closed, and the 10,000-record operational ceiling produces an explicit unavailable state rather than an oversized response.
- Inspect CloudWatch logs and DynamoDB items for absence of email, raw subject, dish names, ratings, countries, notes, recipes, photographs, and archive identifiers.

## Static release

- Package the PWA and confirm `/admin/` receives the same public Cognito and API configuration as the main app.
- Confirm `/privacy/` is public and linked from sign-in and Account.
- Confirm neither authenticated admin responses nor `/admin/` navigation enter the consumer service-worker cache.
- Load `/admin/` at 375 pixels and desktop width; verify all ranges, account detail, accessible chart table, empty and partial states, sign-out, and focus restoration.
- Record one canary cook and Idea offline, reconnect as that same account, and verify the queued events are attributed correctly.
- Switch accounts with one account’s events still queued; confirm no event can be submitted under another account.

## Destructive proof

- Use only synthetic canary analytics for the erase test.
- Type `ERASE ANALYTICS`, confirm the new generation is immediately empty, and wait for the dashboard to report physical purge completion.
- Race a canary event submission against erasure and confirm the write moves to the new generation while the retired generation completes a consistent empty verification pass.
- Confirm Cognito users and every account’s local archive remain unchanged.

## Release boundary

- Analytics history begins on the configured `AnalyticsLaunchDate`; do not backfill or infer earlier activity.
- Detailed events expire after 12 months. Lifetime counters persist until global analytics erasure.
- Do not add third-party analytics, page views, search terms, feature tracking, IP enrichment, device fingerprinting, or archive content.
