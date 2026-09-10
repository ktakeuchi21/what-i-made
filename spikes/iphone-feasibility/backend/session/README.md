# Transcription session signer

This Node.js Lambda runs behind the invitation API Gateway and returns a 15-second Amazon Transcribe Streaming WebSocket URL. It never receives audio or transcript text.

Required environment variables:

- `VOICE_ENABLED=true`
- `COGNITO_CLIENT_ID=<public web client ID>`
- `RATE_LIMIT_TABLE=<DynamoDB table name>`
- `PRESIGN_EXPIRES_SECONDS=15`

API Gateway validates the access token and `what-i-made/capture` scope before invocation. The handler rechecks access-token claims and consumes an atomic per-account DynamoDB rate window. Lambda supplies `AWS_REGION` and temporary execution-role credentials. Deployment is owned by `infrastructure/invitation-access/template.yaml`; do not create a Function URL.

Before enabling `VOICE_ENABLED`, verify an effective AWS Organizations service-improvement opt-out policy for Amazon Transcribe and create the documented budget alerts. If the opt-out cannot be verified, leave the feature disabled and send no real audio.

Allow only the exact protected API origin and `wss://transcribestreaming.<region>.amazonaws.com:8443` in the deployed `connect-src` policy. Never restore the retired Function URL as a parallel owner-token path.
