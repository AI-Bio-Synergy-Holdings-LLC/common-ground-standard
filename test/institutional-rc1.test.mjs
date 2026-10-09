import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const execFileAsync = promisify(execFile);
const repoRoot = new URL("../", import.meta.url);
const publicRecaptchaSiteKey = "6Le28TctAAAAAM9iexmAPszMLNAS8iGSqJrcGxfA";

const runBuild = (environment = {}) =>
  execFileAsync(process.execPath, ["scripts/prepare-render-site.mjs"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CGS_INSTITUTIONAL_RC1_ENABLED: "false",
      CGS_INSTITUTIONAL_DIAGNOSTIC_ENABLED: "false",
      CGS_INSTITUTIONAL_PRODUCTION_CANDIDATE_ENABLED: "false",
      CGS_INSTITUTIONAL_PRODUCTION_VERIFICATION_ENABLED: "false",
      CGS_INSTITUTIONAL_PRODUCTION_LIVE_ENABLED: "false",
      ...environment,
    },
  });

test("the committed institutional form remains structurally fail-closed", async () => {
  const html = await read("institutional-alignment.html");
  const form = html.match(/<form[\s\S]*?<\/form>/)?.[0] || "";

  assert.match(form, /data-intake-mode="test"/);
  assert.doesNotMatch(form.match(/<form[\s\S]*?>/)?.[0] || "", /\saction=/i);
  assert.match(form, /<fieldset[^>]*data-test-form-guard[^>]*disabled/);
  assert.match(form, /<button[^>]*type="button"[^>]*data-fs-submit-btn/);
  assert.match(
    form,
    /<input\s+type="hidden"\s+name="g-recaptcha-response"\s+data-recaptcha-response\s+\/>/,
  );
  assert.doesNotMatch(html, /recaptcha\/api\.js/i);
  assert.doesNotMatch(html, /formspree\.io\/f\//i);
  assert.match(html, /Final activation authority has been issued/);
  assert.match(html, /production verification and the enable-last controls pass/);
});

test("the committed RC1 configuration is inert", async () => {
  const config = await read("institutional-rc1-config.js");

  assert.match(config, /window\.__CGS_INSTITUTIONAL_RC1__\s*=\s*null/);
  assert.doesNotMatch(config, /formspree\.io\/f\//i);
  assert.doesNotMatch(config, /recaptchaSiteKey\s*:/i);
});

test("the institutional runtime config cannot remain cached across activation modes", async () => {
  const build = await read("scripts/prepare-render-site.mjs");
  const render = await read("render.yaml");

  assert.match(build, /createHash\("sha256"\)/);
  assert.match(build, /institutional-rc1-config\\\.js\(\?:\\\?\[\^"'\]\*\)\?/);
  assert.match(render, /path: \/institutional-rc1-config\.js/);
  assert.match(render, /value: no-store, no-cache, must-revalidate, max-age=0/);

  const commonEnvironment = {
    CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT: "https://formspree.io/f/mrpezwok",
    CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY: publicRecaptchaSiteKey,
    CGS_INSTITUTIONAL_FINAL_AUTHORIZATION_ID:
      "CGS-INSTITUTIONAL-LIVE-2026-10-05-CHARTER-V0-4",
  };

  await runBuild({
    ...commonEnvironment,
    CGS_INSTITUTIONAL_PRODUCTION_VERIFICATION_ENABLED: "true",
  });
  const verificationHtml = await read("dist-render/institutional-alignment.html");
  const verificationVersion = verificationHtml.match(
    /institutional-rc1-config\.js\?v=([a-f0-9]{16})/,
  )?.[1];

  await runBuild({
    ...commonEnvironment,
    CGS_INSTITUTIONAL_PRODUCTION_LIVE_ENABLED: "true",
  });
  const liveHtml = await read("dist-render/institutional-alignment.html");
  const liveVersion = liveHtml.match(/institutional-rc1-config\.js\?v=([a-f0-9]{16})/)?.[1];

  assert.ok(verificationVersion);
  assert.ok(liveVersion);
  assert.notEqual(verificationVersion, liveVersion);

  await runBuild();
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

test("the controlled integration route exercises the in-form reCAPTCHA token field", async () => {
  const site = await read("site.js");

  assert.match(
    site,
    /const tokenInput = form\.querySelector\('input\[name="g-recaptcha-response"\]'\)/,
  );
  assert.match(site, /!\(tokenInput instanceof HTMLInputElement\)/);
  assert.match(site, /tokenInput\.value = token/);
  assert.match(
    site,
    /payload\.append\("g-recaptcha-response", tokenInput\.value\)/,
  );
  assert.match(site, /Verification configuration is unavailable\. No information was sent\./);
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
  assert.match(
    site,
    /if \(isProductionCandidate\)[\s\S]*const operatingCopy = document\.querySelector\("\[data-rc1-operating-copy\]"\);[\s\S]*if \(operatingCopy\)/,
  );
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

test("production verification mode is exact-origin and structurally non-transmitting", async () => {
  const build = await read("scripts/prepare-render-site.mjs");
  const site = await read("site.js");

  assert.match(build, /CGS_INSTITUTIONAL_PRODUCTION_VERIFICATION_ENABLED/);
  assert.match(site, /Production verification — institutional intake is not open\./);
  assert.match(site, /production verification mode does not load, contact, or submit to either service\./i);
  assert.match(site, /Held during production verification/);

  await assert.rejects(
    runBuild({
      CGS_INSTITUTIONAL_PRODUCTION_VERIFICATION_ENABLED: "true",
      CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT: "https://formspree.io/f/mrpezwok",
      CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY: publicRecaptchaSiteKey,
    }),
    /authorizationId/,
  );

  await runBuild({
    CGS_INSTITUTIONAL_PRODUCTION_VERIFICATION_ENABLED: "true",
    CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT: "https://formspree.io/f/mrpezwok",
    CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY: publicRecaptchaSiteKey,
    CGS_INSTITUTIONAL_FINAL_AUTHORIZATION_ID:
      "CGS-INSTITUTIONAL-LIVE-2026-10-05-CHARTER-V0-4",
  });

  const verificationConfig = await read("dist-render/institutional-rc1-config.js");
  const verificationHtml = await read("dist-render/institutional-alignment.html");
  assert.match(verificationConfig, /"mode":"production-verification"/);
  assert.match(verificationConfig, /"allowedOrigin":"https:\/\/common-ground-standard\.org"/);
  assert.match(verificationConfig, /"formEndpoint":"https:\/\/formspree\.io\/f\/mrpezwok"/);
  assert.doesNotMatch(verificationHtml.match(/<form[\s\S]*?>/)?.[0] || "", /\saction=/i);
  assert.match(verificationHtml, /<fieldset[^>]*data-test-form-guard[^>]*disabled/);
  assert.doesNotMatch(verificationHtml, /recaptcha\/api\.js/i);

  await runBuild();
});

test("production live mode publishes current processing disclosure", async () => {
  const site = await read("site.js");

  assert.match(site, /Live submission uses the dedicated institutional Formspree route/);
  assert.doesNotMatch(
    site.match(/if \(isProductionLive\)[\s\S]*?return;\n        }/)?.[0] || "",
    /only after operating approval/,
  );
});

test("the integration thank-you route distinguishes a synthetic transmission from local validation", async () => {
  const html = await read("institutional-thank-you.html");
  const site = await read("institutional-confirmation.mjs");

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

test("the institutional confirmation route leaves live receipt and activation unverified", async () => {
  const site = await read("institutional-confirmation.mjs");
  const html = await read("institutional-thank-you.html");

  assert.doesNotMatch(site, /mode === "live"|Your review note was received\.|Submitted privately through Formspree|Active under published operating controls/);
  assert.match(html, /data-institutional-result-title>Result not verified\./);
  assert.match(html, /data-institutional-result-transmission>Not established by this page/);
  assert.match(html, /data-institutional-result-live>Not established by this page/);
  assert.match(html, /It will not create[\s\S]*endorsement, partnership, membership, accreditation, certification/);
});

test("the staging builder and confirmation renderer share the same record contract", async () => {
  const { isInstitutionalRc1Record } = await import("../institutional-confirmation.mjs");
  const environment = {
    CGS_INSTITUTIONAL_RC1_ENABLED: "true",
    CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN: "https://common-ground-standard-institutional.onrender.com",
    CGS_INSTITUTIONAL_RC1_FORM_ENDPOINT: "https://formspree.io/f/offline_test",
    CGS_INSTITUTIONAL_RC1_RECAPTCHA_SITE_KEY: "offline_public_site_key_1234567890",
    CGS_INSTITUTIONAL_RC1_AUTHORIZATION_CODE: "offline_selector_1234567890123456",
  };
  try {
    for (const record of ["CGS-INSTITUTIONAL-RC1-2026-10-08", "CGS-INSTITUTIONAL-RC1-20261008-7CB67E4-RECEIPT"]) {
      assert.equal(isInstitutionalRc1Record(record), true);
      await runBuild({ ...environment, CGS_INSTITUTIONAL_RC1_RECORD_ID: record });
      assert.match(await read("dist-render/institutional-rc1-config.js"), new RegExp(record));
      assert.equal(await read("dist-render/institutional-confirmation.mjs"), await read("institutional-confirmation.mjs"));
    }
    for (const record of ["bad", "CGS-INSTITUTIONAL-RC1--RECEIPT", "CGS-INSTITUTIONAL-RC1-lowercase", "CGS-INSTITUTIONAL-RC1-20261008\n", "CGS-INSTITUTIONAL-RC1-" + "A".repeat(107)]) {
      assert.equal(isInstitutionalRc1Record(record), false);
      await assert.rejects(runBuild({ ...environment, CGS_INSTITUTIONAL_RC1_RECORD_ID: record }), /record ID is malformed/);
    }
  } finally {
    await runBuild();
  }
  assert.match(await read("dist-render/institutional-rc1-config.js"), /window\.__CGS_INSTITUTIONAL_RC1__\s*=\s*null/);
  assert.doesNotMatch(await read("site.js"), /const initInstitutionalThankYou/);
});

test("diagnostic staging excludes form submission and is unavailable in the default artifact", async () => {
  const environment = {
    CGS_INSTITUTIONAL_DIAGNOSTIC_ENABLED: "true",
    CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN: "https://common-ground-standard-institutional.onrender.com",
    CGS_INSTITUTIONAL_RC1_RECAPTCHA_SITE_KEY: "test_staging_site_key_1234567890",
  };
  await assert.rejects(runBuild({ ...environment, CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN: "https://common-ground-standard.org" }), /exact institutional staging hostname/);
  await assert.rejects(runBuild({ ...environment, CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN: "https://other.onrender.com" }), /exact institutional staging hostname/);
  await assert.rejects(runBuild({ ...environment, CGS_INSTITUTIONAL_RC1_ENABLED: "true" }), /Only one/);
  await runBuild(environment);
  const config = await read("dist-render/institutional-rc1-config.js");
  const html = await read("dist-render/institutional-alignment.html");
  const script = await read("dist-render/recaptcha-diagnostic.mjs");
  assert.match(config, /"mode":"recaptcha-diagnostic"/);
  assert.doesNotMatch(config, /formEndpoint|secretKey|formspree/);
  assert.doesNotMatch(html, /<form\b|<input\b|<textarea\b|site\.js|formspree\.io/i);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /type="button" disabled data-run/);
  assert.match(html, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(script, /FormData|fetch\(|sendBeacon|localStorage|sessionStorage|console\./);
  assert.match(html, /institutional-rc1-config\.js\?v=[a-f0-9]{16}/);
  await runBuild();
  await assert.rejects(access(new URL("../dist-render/recaptcha-diagnostic.mjs", import.meta.url)), /ENOENT/);
  assert.doesNotMatch(await read("dist-render/institutional-alignment.html"), /recaptcha-diagnostic\.mjs/);
});
