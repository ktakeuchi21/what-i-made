import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const templateUrl = new URL("./template.yaml", import.meta.url);

test("keeps invitation access email-code-first while satisfying Cognito's pool policy", async () => {
  const template = await readFile(templateUrl, "utf8");

  assert.match(template, /AllowAdminCreateUserOnly:\s+true/);
  assert.match(template, /Name:\s+admin_only/);
  assert.match(template, /AllowedFirstAuthFactors:\s+\[PASSWORD, EMAIL_OTP\]/);
  assert.doesNotMatch(template, /AllowAdminCreateUserOnly:\s+false/);
  assert.match(template, /ManagedLoginBranding:\s+Type: AWS::Cognito::ManagedLoginBranding/);
  assert.match(template, /DependsOn: ManagedLoginDomain/);
  assert.match(template, /UseCognitoProvidedValues:\s+true/);
});

test("configures independent models and optional culinary vocabulary", async () => {
  const template = await readFile(templateUrl, "utf8");
  assert.match(template, /CaptureBedrockModelId:[\s\S]*Default: openai\.gpt-oss-20b/);
  assert.match(template, /RecipeBedrockModelId:[\s\S]*Default: openai\.gpt-5\.6-terra/);
  assert.match(template, /TRANSCRIBE_VOCABULARY_NAME: !Ref TranscribeVocabularyName/);
  assert.match(template, /BEDROCK_MODEL_ID: !Ref CaptureBedrockModelId/);
  assert.match(template, /BEDROCK_MODEL_ID: !Ref RecipeBedrockModelId/);
  assert.doesNotMatch(template, /^  BedrockModelId:/m);
});

test("adds owner-only metadata analytics without archive storage", async () => {
  const template = await readFile(templateUrl, "utf8");
  assert.match(template, /AnalyticsTable:[\s\S]*TimeToLiveSpecification:[\s\S]*AttributeName: expiresAt/);
  assert.match(template, /GroupName: what-i-made-admins/);
  assert.match(template, /PostAuthentication: !GetAtt AnalyticsPostAuthenticationFunction\.Arn/);
  assert.match(template, /Path: \/v1\/activity\/events[\s\S]*AuthorizationScopes: \[what-i-made\/activity\]/);
  assert.match(template, /Path: \/v1\/admin\/analytics\/summary[\s\S]*AuthorizationScopes: \[what-i-made\/admin\]/);
  assert.match(template, /CallbackURLs: \[!Ref CallbackUrl, !Ref AdminCallbackUrl\]/);
  assert.match(template, /AllowMethods: \[GET, POST, DELETE, OPTIONS\]/);
  assert.doesNotMatch(template, /dishName|recipeTitle|photoBlob/);
});
