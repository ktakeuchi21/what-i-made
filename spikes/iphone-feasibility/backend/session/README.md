# Transcription session signer

This dependency-free Node.js Lambda verifies the private owner token and returns a 15-second Amazon Transcribe Streaming WebSocket URL. It never receives audio or transcript text.

Required environment variables:

- `VOICE_ENABLED=true`
- `OWNER_TOKEN_SHA256=<lowercase SHA-256 hex>`
- `PRESIGN_EXPIRES_SECONDS=15`

Lambda supplies `AWS_REGION` and its temporary execution-role credentials. Configure the Function URL CORS layer, not the handler, to allow only the deployed Amplify origin, `POST`, and the `Authorization` and `Content-Type` headers. The included IAM policy must be resolved to the account-specific CloudWatch log-group ARN during deployment.

Before enabling `VOICE_ENABLED`, verify an effective AWS Organizations service-improvement opt-out policy for Amazon Transcribe and create the documented budget alerts. If the opt-out cannot be verified, leave the feature disabled and send no real audio.

The static page ships with `connect-src 'self'`. During deployment, replace that directive with `'self'`, the exact Function URL origin, and `wss://transcribestreaming.us-east-2.amazonaws.com:8443`; then set the same endpoint in `config.js`. Do not broaden the policy to all Lambda Function URLs.
