import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the committed institutional form remains structurally fail-closed", async () => {
  const html = await read("institutional-alignment.html");
  const form = html.match(/<form[\s\S]*?<\/form>/)?.[0] || "";

  assert.match(form, /data-intake-mode="test"/);
  assert.doesNotMatch(form.match(/<form[\s\S]*?>/)?.[0] || "", /\saction=/i);
  assert.match(form, /<fieldset[^>]*data-test-form-guard[^>]*disabled/);
  assert.match(form, /<button[^>]*type="button"[^>]*data-fs-submit-btn/);
  assert.doesNotMatch(html, /recaptcha\/api\.js/i);
  assert.doesNotMatch(html, /formspree\.io\/f\//i);
});

test("the committed RC1 configuration is inert", async () => {
  const config = await read("institutional-rc1-config.js");

  assert.match(config, /window\.__CGS_INSTITUTIONAL_RC1__\s*=\s*null/);
  assert.doesNotMatch(config, /formspree\.io\/f\//i);
  assert.doesNotMatch(config, /recaptchaSiteKey\s*:/i);
});

test("the staging build requires a complete non-production configuration", async () => {
  const build = await read("scripts/prepare-render-site.mjs");
  const site = await read("site.js");

  for (const variable of [
    "CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN",
    "CGS_INSTITUTIONAL_RC1_FORM_ENDPOINT",
    "CGS_INSTITUTIONAL_RC1_RECAPTCHA_SITE_KEY",
    "CGS_INSTITUTIONAL_RC1_AUTHORIZATION_CODE",
    "CGS_INSTITUTIONAL_RC1_RECORD_ID",
  ]) {
    assert.match(build, new RegExp(variable));
  }

  assert.match(build, /cannot be enabled for the production origin/);
  assert.match(site, /allowedOrigin\.origin !== window\.location\.origin/);
  assert.match(site, /formEndpoint\.origin !== "https:\/\/formspree\.io"/);
  assert.doesNotMatch(site, /\/f\/mykqwozd/);
});
