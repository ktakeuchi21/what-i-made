const voiceParameters = new URLSearchParams(window.location.search);
const localFakeVoice = ["127.0.0.1", "localhost"].includes(window.location.hostname) && voiceParameters.get("voice") === "fake";
const localFakeAuth = ["127.0.0.1", "localhost"].includes(window.location.hostname) && voiceParameters.get("auth") === "fake";

const configuredAuthDomain = document.querySelector('meta[name="wim-auth-domain"]')?.content.trim() || "";
const configuredAuthClientId = document.querySelector('meta[name="wim-auth-client-id"]')?.content.trim() || "";
const invitationAuthConfigured = localFakeAuth || Boolean(configuredAuthDomain && configuredAuthClientId);
const configuredServiceApiEndpoint = document.querySelector('meta[name="wim-service-api-endpoint"]')?.content.trim() || "";
let serviceApiEndpoint = "";
try {
  const parsedServiceApi = new URL(configuredServiceApiEndpoint);
  if (parsedServiceApi.protocol === "https:" && !parsedServiceApi.username && !parsedServiceApi.password) {
    serviceApiEndpoint = parsedServiceApi.toString().replace(/\/$/, "");
  }
} catch {}
window.WIM_AUTH_CONFIG = Object.freeze({
  enabled: invitationAuthConfigured,
  fake: localFakeAuth,
  fakeSubject: localFakeAuth ? voiceParameters.get("account") || "local-owner" : "",
  fakeEmail: localFakeAuth ? `${voiceParameters.get("account") || "owner"}@example.test` : "",
  domain: configuredAuthDomain,
  clientId: configuredAuthClientId,
  redirectUri: `${window.location.origin}${window.location.pathname}`,
  scopes: ["openid", "email", "what-i-made/capture", "what-i-made/recipes"],
  legacyOwnerArchiveKey: document.querySelector('meta[name="wim-legacy-owner-archive-key"]')?.content.trim().toLowerCase() || "",
});

window.WIM_VOICE_CONFIG = Object.freeze({
  enabled: invitationAuthConfigured && (localFakeVoice || Boolean(serviceApiEndpoint)),
  sessionEndpoint: serviceApiEndpoint ? `${serviceApiEndpoint}/v1/transcribe-session` : "",
  region: "us-east-2",
  maxCaptureSeconds: 45,
  fake: localFakeVoice,
  fakeFailure: localFakeVoice ? voiceParameters.get("voiceFailure") || "" : "",
});

const localCaptureAssistance = ["127.0.0.1", "localhost"].includes(window.location.hostname)
  && voiceParameters.get("assist") === "fake";
const configuredCaptureAssistanceEndpoint = serviceApiEndpoint;
let deployedCaptureAssistanceEndpoint = "";
try {
  const parsedCaptureEndpoint = new URL(configuredCaptureAssistanceEndpoint);
  if (parsedCaptureEndpoint.protocol === "https:" && !parsedCaptureEndpoint.username && !parsedCaptureEndpoint.password) {
    deployedCaptureAssistanceEndpoint = parsedCaptureEndpoint.toString().replace(/\/$/, "");
  }
} catch {
  // Manual capture and the local parser remain available without this optional service.
}

window.WIM_CAPTURE_ASSISTANCE_CONFIG = Object.freeze({
  enabled: invitationAuthConfigured && (localCaptureAssistance || Boolean(deployedCaptureAssistanceEndpoint)),
  endpoint: deployedCaptureAssistanceEndpoint,
  fake: localCaptureAssistance,
  timeoutMs: 10000,
});

const localRecipeService = ["127.0.0.1", "localhost"].includes(window.location.hostname)
  && voiceParameters.get("recipes") === "fake";
const configuredRecipeEndpoint = serviceApiEndpoint;
let deployedRecipeEndpoint = "";
try {
  const parsedRecipeEndpoint = new URL(configuredRecipeEndpoint);
  if (parsedRecipeEndpoint.protocol === "https:" && !parsedRecipeEndpoint.username && !parsedRecipeEndpoint.password) {
    deployedRecipeEndpoint = parsedRecipeEndpoint.toString().replace(/\/$/, "");
  }
} catch {
  // A missing or invalid deployment value leaves online Ideas safely disabled.
}

window.WIM_RECIPE_CONFIG = Object.freeze({
  enabled: invitationAuthConfigured && (localRecipeService || Boolean(deployedRecipeEndpoint)),
  endpoint: deployedRecipeEndpoint,
  fake: localRecipeService,
});
