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
