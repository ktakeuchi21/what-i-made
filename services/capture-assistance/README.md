# Capture assistance service

Lambda service for the API Gateway-protected `POST /v1/parse-cook` route. It sends only submitted text to Amazon Bedrock and logs only request ID, route, status, latency, and aggregate token counts.

Required variables are documented in `.env.example`. API Gateway supplies validated JWT claims and the handler rechecks access-token use and the configured client ID. There is no shared-token fallback. `RATE_LIMIT_TABLE` is mandatory and provides atomic, expiring per-subject limits; missing configuration fails closed. Configure reserved concurrency, budgets, and disabled model-invocation logging through the invitation stack. Package with `lambda.handler`.

Set `CAPTURE_ASSISTANCE_ENABLED=false` as the independent kill switch. Do not expose a Lambda Function URL after invitation cutover.

`BEDROCK_MODEL_ID` belongs only to capture assistance. The invitation stack configures it through `CaptureBedrockModelId`, independently from Recipe Ideas, so an unavailable search-capable model does not disable voice parsing. Client-side international-dish resolution remains the final authority and never sends saved archive names to this service.
