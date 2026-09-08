# Recipe Ideas service

CommonJS code for a Node.js Lambda behind the invitation API Gateway. It supplies the network-only portion of **Ideas**; saved recipes and optimized images remain in the PWA's IndexedDB.

## Routes

Every route requires a Cognito access token with `what-i-made/recipes` and `RECIPE_IDEAS_ENABLED=true`.

- `POST /v1/recipes/import` with `{ "url": "https://…" }` retrieves a public HTML page, parses inert Schema.org `Recipe` JSON-LD, and returns an editable normalized recipe. If the recipe declares an image, the response includes a five-minute image token rather than exposing an unrestricted proxy URL.
- `POST /v1/recipes/search` with `{ "description": "…" }` calls an injected `searchProvider.searchRecipes({ description, limit: 3 })`. It returns `503 unavailable` when no provider is configured.
- `POST /v1/recipes/generate` calls an injected `generateProvider.generateRecipe({ description })`, sanitizes its structured result, labels it `generated`, and deliberately supplies no remote photograph. It also fails closed when unconfigured.
- `GET /v1/recipes/image?token=…` validates the HMAC token and proxies only bounded JPEG, PNG, or WebP bytes.

Responses are `no-store` JSON except image bytes. API Gateway CORS should allow only the deployed app origin, listed methods, `Authorization`, and `Content-Type`.

## Configuration

- `RECIPE_IDEAS_ENABLED`: exactly `true` to enable requests.
- `COGNITO_CLIENT_ID`: expected public web-client ID for handler defense in depth.
- `RATE_LIMIT_TABLE`: DynamoDB table for atomic per-account route windows; requests fail closed without it.
- `IMAGE_TOKEN_SECRET`: at least 32 unpredictable bytes used only for short-lived image-fetch tokens.

Deploy `lambda.handler`. That entrypoint lazily constructs the concrete Amazon Bedrock providers on the first request and uses Lambda's rotating temporary credentials; there is no SDK dependency or long-lived Bedrock API key. `createHandler({ searchProvider, generateProvider })` remains available for tests and alternate adapters.

Both providers call the fixed regional Bedrock Mantle Responses endpoint. Search enables the server-side `web_search` tool with `external_web_access: false`, requests a low search context, preserves each AWS `url_citation`, and rejects every model-proposed recipe URL that lacks a matching citation. Generation does not enable web search; it requests strict JSON Schema output and validates the structured recipe locally before returning it. The wire schemas use Bedrock's supported JSON Schema subset; length and maximum-array bounds that Bedrock does not support are enforced after inference. Both requests set `store: false`.

This library does not log request bodies, URLs, descriptions, recipes, citations, or image bytes. Its default log record contains only request ID, known route template, status, and latency.

Additional deployment configuration:

- `AWS_REGION`: `us-east-1`, `us-east-2`, or `us-west-2`; defaults to `us-east-2`. Web Search is regional.
- `BEDROCK_MODEL_ID`: a Mantle Responses model that supports Web Search and structured output; defaults to `openai.gpt-5.6-terra`.
- Lambda's standard `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN` are read at call time and used only for SigV4 signing.

Attach the narrow permissions in `iam-policy.json` to the Lambda execution role, adjusting its `aws:RequestedRegion` conditions if deployment moves. It grants `bedrock-mantle:CreateInference`, `bedrock-websearch:InvokeSearch`, and `bedrock-websearch:InvokeFetch`. It intentionally omits `bedrock-websearch:ExternalWebAccess`; the request also sets `external_web_access: false`, so Fetch uses only the AWS-hosted cache. The Web Search actions currently support only the `*` resource type. CloudWatch logging permissions belong in the Lambda platform policy, not this service policy.

AWS references: [Bedrock Web Search](https://docs.aws.amazon.com/bedrock/latest/userguide/web-search.html), [Web Search IAM](https://docs.aws.amazon.com/bedrock/latest/userguide/security-web-search.html), [structured outputs](https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html), and [Bedrock endpoints](https://docs.aws.amazon.com/bedrock/latest/userguide/endpoints.html).

## Fetch safety

Imports and images require HTTPS, standard port 443, no URL credentials, a bounded response, an allowed MIME type, manual bounded redirects, and a fresh public-address DNS check for every hop. Private, loopback, link-local, multicast, documentation, carrier-NAT, and other reserved address ranges are rejected. No cookies are sent and page scripts are never executed.

The default Node `https.request` transport pins the TLS connection to an address approved by the lookup performed for that request, preventing an independent second DNS lookup. An injected `fetchImpl` receives the full `approvedAddresses` list and must preserve that pinning in production; the seam exists primarily for deterministic tests and specialized deployment transports.

## Development

```sh
npm test
```

Tests use injected DNS, fetch, clock, logger, and providers; they make no network calls.
