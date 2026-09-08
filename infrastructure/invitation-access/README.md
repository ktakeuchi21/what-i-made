# Invitation access deployment

This SAM stack creates the invitation-only Cognito user pool, managed-login client, JWT-protected HTTP API, and the three private service Lambdas. Public self-registration is disabled. Every API route requires an access token and its matching service scope before Lambda invocation.

## Deploy

1. Install and authenticate the AWS and SAM CLIs for the intended account and region.
2. Run `sam validate --lint --template-file infrastructure/invitation-access/template.yaml`.
3. Run `sam build --template-file infrastructure/invitation-access/template.yaml`.
4. Run `sam deploy --guided` and supply the exact deployed PWA origin/callback, a globally unique Cognito domain prefix, and a random image-token secret of at least 32 characters. Leave `ReservedConcurrency` at `0` until the account quota has been raised enough to retain ten unreserved executions; then redeploy with `2`.
5. Put the output domain, client ID, and API base URL into the PWA configuration. The requested scopes are `openid email what-i-made/capture what-i-made/recipes`. Authenticated builds intentionally disable network assistance if the API base URL is absent or invalid.

## One-time owner archive move

After creating the owner's Cognito user, read that user's immutable `sub` in the Cognito console or `admin-get-user`. Derive the rollout key as the lowercase SHA-256 hex of the UTF-8 string `what-i-made-archive:<sub>`; for example, `printf %s 'what-i-made-archive:<sub>' | shasum -a 256`. Put only that 64-character digest in `wim-legacy-owner-archive-key` before the owner's first authenticated launch. The owner will be offered a backup and a verified move from the fixed local database into the empty scoped archive. After successful migration, remove the meta value and redeploy. Never put the raw subject or email in the page.

Create invited users only through Cognito administration. Set their email as verified; possession of the public PWA link alone does not grant access.

## Required cutover

Before enabling invitation metadata in the PWA, turn off the old services with their kill switches, delete each Lambda Function URL configuration (or its public invoke permission), and revoke the shared owner token. Verify that every former Function URL rejects a direct request. Do not leave the owner-token endpoints as a parallel authorization path.
