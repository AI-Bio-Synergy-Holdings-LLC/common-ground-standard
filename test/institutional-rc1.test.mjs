import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const execFileAsync = promisify(execFile);
const repoRoot = new URL("../", import.meta.url);
const publicRecaptchaSiteKey = "6Le28TctAAAAAM9iexmAPszMLNAS8iGSqJrcGxfA";

const runBuild = (environment = {}) =>
  execFileAsync(process.execPath, ["scripts/prepare-render-site.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, ...environment },
  });

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

test("the production candidate is exact-destination and structurally non-transmitting", async () => {
  const build = await read("scripts/prepare-render-site.mjs");
  const site = await read("site.js");
  const html = await read("institutional-alignment.html");

  for (const variable of [
    "CGS_INSTITUTIONAL_PRODUCTION_CANDIDATE_ENABLED",
    "CGS_INSTITUTIONAL_CANDIDATE_PREVIEW_ORIGIN",
    "CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT",
    "CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY",
  ]) {
    assert.match(build, new RegExp(variable));
  }

  assert.match(build, /https:\/\/common-ground-standard\.org/);
  assert.match(build, /https:\/\/formspree\.io\/f\/mrpezwok/);
  assert.match(site, /Production candidate — live intake is not authorized\./);
  assert.match(site, /This candidate does not contact either service\./);
  assert.match(site, /This production candidate does not transmit or store form-field data\./);
  assert.match(site, /submitButton\.type = "button"/);
  assert.match(site, /submitButton\.disabled = true/);
  assert.match(html, /name="email"/);
  assert.doesNotMatch(html, /name="institutional_email"/);

  await runBuild({
    CGS_INSTITUTIONAL_PRODUCTION_CANDIDATE_ENABLED: "true",
    CGS_INSTITUTIONAL_CANDIDATE_PREVIEW_ORIGIN:
      "https://common-ground-standard-institutional.onrender.com",
    CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT: "https://formspree.io/f/mrpezwok",
    CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY: publicRecaptchaSiteKey,
  });

  const candidateConfig = await read("dist-render/institutional-rc1-config.js");
  const candidateHtml = await read("dist-render/institutional-alignment.html");
  assert.match(candidateConfig, /"mode":"production-candidate"/);
  assert.match(candidateConfig, /"productionOrigin":"https:\/\/common-ground-standard\.org"/);
  assert.match(
    candidateConfig,
    /"previewOrigin":"https:\/\/common-ground-standard-institutional\.onrender\.com"/,
  );
  assert.match(candidateConfig, /"formEndpoint":"https:\/\/formspree\.io\/f\/mrpezwok"/);
  assert.doesNotMatch(candidateHtml.match(/<form[\s\S]*?>/)?.[0] || "", /\saction=/i);
  assert.match(candidateHtml, /<fieldset[^>]*data-test-form-guard[^>]*disabled/);
  assert.doesNotMatch(candidateHtml, /recaptcha\/api\.js/i);
});

test("production live mode remains unavailable without a separate final authorization ID", async () => {
  await assert.rejects(
    runBuild({
      CGS_INSTITUTIONAL_PRODUCTION_LIVE_ENABLED: "true",
      CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT: "https://formspree.io/f/mrpezwok",
      CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY: publicRecaptchaSiteKey,
    }),
    /authorizationId/,
  );

  await assert.rejects(
    runBuild({
      CGS_INSTITUTIONAL_PRODUCTION_LIVE_ENABLED: "true",
      CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT: "https://formspree.io/f/not-the-approved-form",
      CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY: publicRecaptchaSiteKey,
      CGS_INSTITUTIONAL_FINAL_AUTHORIZATION_ID: "CGS-INSTITUTIONAL-LIVE-2026-10-04-TEST",
    }),
    /dedicated production institutional form/,
  );

  await runBuild({
    CGS_INSTITUTIONAL_PRODUCTION_LIVE_ENABLED: "true",
    CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT: "https://formspree.io/f/mrpezwok",
    CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY: publicRecaptchaSiteKey,
    CGS_INSTITUTIONAL_FINAL_AUTHORIZATION_ID: "CGS-INSTITUTIONAL-LIVE-2026-10-04-TEST",
  });
  const liveConfig = await read("dist-render/institutional-rc1-config.js");
  assert.match(liveConfig, /"mode":"production-live"/);
  assert.match(liveConfig, /"allowedOrigin":"https:\/\/common-ground-standard\.org"/);
  assert.match(liveConfig, /"authorizationId":"CGS-INSTITUTIONAL-LIVE-2026-10-04-TEST"/);

  await runBuild();
});

test("the integration thank-you route distinguishes a synthetic transmission from local validation", async () => {
  const html = await read("institutional-thank-you.html");
  const site = await read("site.js");

  for (const hook of [
    "data-institutional-result-title",
    "data-institutional-result-summary",
    "data-institutional-result-status",
    "data-institutional-result-transmission",
    "data-institutional-result-live",
    "data-institutional-result-notice-title",
    "data-institutional-result-notice-copy",
  ]) {
    assert.match(html, new RegExp(hook));
  }

  assert.match(site, /mode !== "integration-success"/);
  assert.match(site, /One synthetic test record/);
  assert.match(site, /does not confirm inbox delivery or final classification/);
  assert.match(site, /Live institutional intake remains disabled/);
});

test("the institutional confirmation route distinguishes a live receipt", async () => {
  const site = await read("site.js");

  assert.match(site, /mode === "live"/);
  assert.match(site, /Your review note was received\./);
  assert.match(site, /Receipt does not create an institutional role or public association\./);
  assert.match(site, /Submitted privately through Formspree/);
});
