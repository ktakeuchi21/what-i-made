# Invitation access deployment

This SAM stack creates the invitation-only Cognito user pool, managed-login client, JWT-protected HTTP API, and the three private service Lambdas. Public self-registration is disabled. Every API route requires an access token and its matching service scope before Lambda invocation.

Use the ordered [production rollout checklist](../../docs/product/invitation-only-access/ROLLOUT_CHECKLIST.md) as the release record. The first stack deployment keeps `ServicesEnabled=false`; paid services are enabled only after authorizer rejection and owner migration gates pass.

## Deploy

1. Install and authenticate the AWS and SAM CLIs for the intended account and region.
2. Run `sam validate --lint --template-file infrastructure/invitation-access/template.yaml`.
3. Run `sam build --template-file infrastructure/invitation-access/template.yaml`.
4. Run `sam deploy --guided` and supply the exact deployed PWA origin/callback, a globally unique Cognito domain prefix, and a random image-token secret of at least 32 characters. Set `ServicesEnabled=false` for the initial identity-and-authorization deployment. Leave `ReservedConcurrency` at `0` until the account quota has been raised enough to retain ten unreserved executions; then redeploy with `2`.
5. Use the stack outputs to build a new static directory without editing tracked source. The packager copies only runtime files, injects the public Cognito/API values and strict CSP, validates the region and optional migration digest, and refuses to overwrite an existing destination:

   ```sh
   node infrastructure/invitation-access/package-pwa.mjs \
     --output /private/tmp/what-i-made-owner-rollout \
     --auth-domain https://<prefix>.auth.<region>.amazoncognito.com \
     --client-id <WebClientId> \
     --api-base-url https://<api-id>.execute-api.<region>.amazonaws.com \
     --aws-region <AwsRegion> \
     --legacy-owner-archive-key <64-character-owner-archive-digest>
   ```

   Omit `--legacy-owner-archive-key` after the controlled owner migration. The requested scopes are `openid email what-i-made/capture what-i-made/recipes`. Authenticated builds intentionally disable network assistance if the API base URL is absent or invalid.
6. Inspect the generated directory before uploading it to Amplify. It excludes tests, reports, source-generation scripts, and the high-resolution icon master. The packager accepts only the regional Cognito and API Gateway host forms emitted by this stack, preventing a mistyped arbitrary host from receiving access tokens. The generated `customHttp.yml` applies CSP, anti-framing, MIME-sniffing, referrer, permissions, and transport headers using [Amplify Hosting’s supported custom-header format](https://docs.aws.amazon.com/amplify/latest/userguide/setting-custom-headers.html). Do not publish the temporary owner-migration bundle to invited users.

## One-time owner archive move

After creating the owner's Cognito user, read that user's immutable `sub` in the Cognito console or `admin-get-user`. Derive the rollout key as the lowercase SHA-256 hex of the UTF-8 string `what-i-made-archive:<sub>`; for example, `printf %s 'what-i-made-archive:<sub>' | shasum -a 256`. Pass only that 64-character digest to the packager for the owner's temporary rollout bundle. The owner will be offered a backup and a verified move from the fixed local database into the empty scoped archive. After successful migration, build and deploy a fresh bundle without the migration argument before creating invitees. Never put the raw subject or email in the page.

Create invited users only through Cognito administration. Set their email as verified; possession of the public PWA link alone does not grant access.

## Required cutover

Before enabling invitation metadata in the PWA, turn off the old services with their kill switches, delete each Lambda Function URL configuration (or its public invoke permission), and revoke the shared owner token. Verify that every former Function URL rejects a direct request. Do not leave the owner-token endpoints as a parallel authorization path.
