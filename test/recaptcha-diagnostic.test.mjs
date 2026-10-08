import assert from "node:assert/strict";
import test from "node:test";
import { diagnosticConfig, diagnosticError, runDiagnostic, STAGING_ORIGIN } from "../diagnostics/recaptcha.mjs";

const siteKey = "test_staging_site_key_1234567890";
const config = { mode: "recaptcha-diagnostic", allowedOrigin: STAGING_ORIGIN, recaptchaSiteKey: siteKey, action: "institutional_rc1_test" };
const client = (execute) => ({ ready: (callback) => callback(), execute });
const run = (api, load = async () => {}) => {
  const evidence = [];
  return runDiagnostic({ siteKey, action: config.action, load, api: () => api, report: (result) => evidence.push(result), timeoutMs: 10 }).then((result) => ({ result, evidence }));
};

test("diagnostics require the exact staging origin and reject a submission destination", () => {
  assert.ok(diagnosticConfig(config, STAGING_ORIGIN));
  for (const origin of ["https://common-ground-standard.org", "https://other.onrender.com", `${STAGING_ORIGIN}:443`]) {
    assert.equal(diagnosticConfig(config, origin), null);
  }
  assert.equal(diagnosticConfig({ ...config, formEndpoint: "https://formspree.io/f/example" }, STAGING_ORIGIN), null);
  assert.equal(diagnosticConfig({ ...config, secretKey: "private" }, STAGING_ORIGIN), null);
});

test("token issuance reports only length and never returns the token", async () => {
  const token = "synthetic_sensitive_token_".repeat(10);
  const { result, evidence } = await run(client((key, options) => {
    assert.equal(key, siteKey);
    assert.equal(options.action, "institutional_rc1_test");
    return Promise.resolve(token);
  }));
  assert.deepEqual(result, { stage: "token-issued", status: "passed", tokenLength: token.length });
  assert.doesNotMatch(JSON.stringify(evidence), new RegExp(token));
});

test("execute rejection retains the failure stage and redacts credentials", async () => {
  const { result } = await run(client(() => Promise.reject(Object.assign(new Error(`Invalid site key: ${siteKey}`), { code: "browser-error" }))));
  assert.equal(result.stage, "execute");
  assert.equal(result.status, "failed");
  assert.equal(result.error.code, "browser-error");
  assert.equal(result.error.message, "Invalid site key: [redacted key]");
});

test("script failures and API availability failures are distinguished", async () => {
  const { result: scriptFailure } = await run(null, () => Promise.reject(new Error("Script blocked")));
  assert.equal(scriptFailure.stage, "script-load");
  assert.equal(scriptFailure.error.message, "Script blocked");
  const { result: apiFailure } = await run({});
  assert.equal(apiFailure.stage, "api-ready");
  assert.equal(apiFailure.error.code, "api-unavailable");
});

test("null, string and empty-token failures remain bounded and informative", async () => {
  assert.equal(diagnosticError(null, siteKey).type, "null");
  assert.equal(diagnosticError("browser-error", siteKey).message, "browser-error");
  const { result } = await run(client(() => ""));
  assert.equal(result.error.code, "empty-token");
});

test("a stalled ready callback times out without executing", async () => {
  let executed = false;
  const { result } = await run({ ready: () => {}, execute: () => { executed = true; } });
  assert.equal(result.stage, "api-ready");
  assert.equal(result.error.code, "timeout");
  assert.equal(executed, false);
});
