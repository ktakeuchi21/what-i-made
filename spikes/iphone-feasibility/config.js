const voiceParameters = new URLSearchParams(window.location.search);
const localFakeVoice = ["127.0.0.1", "localhost"].includes(window.location.hostname) && voiceParameters.get("voice") === "fake";

window.WIM_VOICE_CONFIG = Object.freeze({
  enabled: true,
  sessionEndpoint: "https://eh6h3acmwp2owyowv6s7vqnyii0ifons.lambda-url.us-east-2.on.aws/",
  region: "us-east-2",
  maxCaptureSeconds: 45,
  fake: localFakeVoice,
  fakeFailure: localFakeVoice ? voiceParameters.get("voiceFailure") || "" : "",
});
