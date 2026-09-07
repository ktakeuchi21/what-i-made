# Capture assistance service

Protected Lambda Function URL service for `POST /v1/parse-cook`. It sends only the submitted text to Amazon Bedrock and logs only request ID, route, status, latency, and available aggregate token counts.

Required environment variables are documented in `.env.example`: `CAPTURE_ASSISTANCE_ENABLED=true`, `OWNER_TOKEN_SHA256`, `AWS_REGION`, and optionally `BEDROCK_MODEL_ID`. The provider uses the Mantle Responses endpoint for supported GPT models and Bedrock InvokeModel for `openai.gpt-oss-*` models, retaining strict structured output in both cases. Configure reserved concurrency at 2, exact-origin Function URL CORS, the existing $5/$8 budget alarms, and `iam-policy.json`. Keep Bedrock invocation logging disabled. The handler also applies a best-effort ten-request-per-minute warm-instance guard for the single owner token; reserved concurrency, budgets, and the kill switch remain the hard operational backstops across cold starts. Package the contents of this directory with `lambda.handler` as the handler.

The function URL is public only at the network layer; every request still requires the private owner token, verified in constant time. Set `CAPTURE_ASSISTANCE_ENABLED=false` as the independent kill switch. Logs contain request ID, route, status, latency, and available aggregate token counts only.
