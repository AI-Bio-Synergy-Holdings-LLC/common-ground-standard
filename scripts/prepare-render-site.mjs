#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isInstitutionalRc1Record } from "../institutional-confirmation.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(repoRoot, "dist-render");
const topLevelHtmlFiles = (await readdir(repoRoot)).filter((entry) => entry.endsWith(".html"));
const publicEntries = [
  ...topLevelHtmlFiles,
  "assets",
  "review",
  "standards",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
  "institutional-rc1-config.js",
  "institutional-confirmation.mjs",
  "site.js",
  "styles.css",
];

const productionOrigin = "https://common-ground-standard.org";
const diagnosticOrigin = "https://common-ground-standard-institutional.onrender.com";
const productionInstitutionalFormEndpoint = "https://formspree.io/f/mrpezwok";

const requireEnvironment = (label, values) => {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`${label} is enabled but missing: ${missing.join(", ")}`);
  }

  return values;
};

const parseHttpsOrigin = (value, label) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${label} must be an HTTPS origin without a path, query, or fragment`);
  }
  return url.origin;
};

const parseFormspreeEndpoint = (value, label, expectedEndpoint = null) => {
  const url = new URL(value);
  if (
    url.origin !== "https://formspree.io" ||
    !/^\/f\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} requires a Formspree /f/{form-id} endpoint`);
  }
  if (expectedEndpoint && url.href !== expectedEndpoint) {
    throw new Error(`${label} must use the dedicated production institutional form`);
  }
  return url.href;
};

const parseRecaptchaSiteKey = (value, label) => {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(value)) {
    throw new Error(`${label} reCAPTCHA site key is malformed`);
  }
  return value;
};

const writeInstitutionalConfig = async (config, message) => {
  const configSource = `window.__CGS_INSTITUTIONAL_RC1__ = Object.freeze(${JSON.stringify(config)});\n`;
  await writeFile(path.join(artifactRoot, "institutional-rc1-config.js"), configSource, "utf8");
  console.log(message);
};

const fingerprintInstitutionalConfig = async () => {
  const configPath = path.join(artifactRoot, "institutional-rc1-config.js");
  const htmlPath = path.join(artifactRoot, "institutional-alignment.html");
  const configSource = await readFile(configPath, "utf8");
  const html = await readFile(htmlPath, "utf8");
  const configVersion = createHash("sha256").update(configSource).digest("hex").slice(0, 16);
  const configReference = /institutional-rc1-config\.js(?:\?[^"']*)?/g;
  const matches = html.match(configReference) || [];

  if (matches.length !== 1) {
    throw new Error("Institutional config script reference must appear exactly once");
  }

  await writeFile(
    htmlPath,
    html.replace(configReference, `institutional-rc1-config.js?v=${configVersion}`),
    "utf8",
  );
  console.log(`Institutional config cache key prepared: ${configVersion}`);
};

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });

for (const entry of publicEntries) {
  await cp(path.join(repoRoot, entry), path.join(artifactRoot, entry), { recursive: true });
}

const rc1Enabled = process.env.CGS_INSTITUTIONAL_RC1_ENABLED === "true";
const diagnosticEnabled = process.env.CGS_INSTITUTIONAL_DIAGNOSTIC_ENABLED === "true";
const productionCandidateEnabled =
  process.env.CGS_INSTITUTIONAL_PRODUCTION_CANDIDATE_ENABLED === "true";
const productionVerificationEnabled =
  process.env.CGS_INSTITUTIONAL_PRODUCTION_VERIFICATION_ENABLED === "true";
const productionLiveEnabled = process.env.CGS_INSTITUTIONAL_PRODUCTION_LIVE_ENABLED === "true";

if (
  [rc1Enabled, diagnosticEnabled, productionCandidateEnabled, productionVerificationEnabled, productionLiveEnabled].filter(
    Boolean,
  ).length > 1
) {
  throw new Error("Only one institutional intake build mode may be enabled at a time");
}

if (diagnosticEnabled) {
  const requiredEnvironment = requireEnvironment("Institutional reCAPTCHA diagnostic", {
    allowedOrigin: process.env.CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN,
    recaptchaSiteKey: process.env.CGS_INSTITUTIONAL_RC1_RECAPTCHA_SITE_KEY,
  });
  if (parseHttpsOrigin(requiredEnvironment.allowedOrigin, "Diagnostic origin") !== diagnosticOrigin) {
    throw new Error("Diagnostic mode requires the exact institutional staging hostname");
  }
  await cp(
    path.join(repoRoot, "diagnostics/institutional-recaptcha.html"),
    path.join(artifactRoot, "institutional-alignment.html"),
  );
  await cp(path.join(repoRoot, "diagnostics/recaptcha.mjs"), path.join(artifactRoot, "recaptcha-diagnostic.mjs"));
  await cp(path.join(repoRoot, "diagnostics/diagnostic.css"), path.join(artifactRoot, "diagnostic.css"));
  await writeInstitutionalConfig({
    mode: "recaptcha-diagnostic",
    allowedOrigin: diagnosticOrigin,
    recaptchaSiteKey: parseRecaptchaSiteKey(requiredEnvironment.recaptchaSiteKey, "Diagnostic"),
    action: "institutional_rc1_test",
  }, "Institutional staging diagnostic prepared; no form or submission endpoint");
}

if (rc1Enabled) {
  const requiredEnvironment = requireEnvironment("Institutional Route RC1", {
    allowedOrigin: process.env.CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN,
    formEndpoint: process.env.CGS_INSTITUTIONAL_RC1_FORM_ENDPOINT,
    recaptchaSiteKey: process.env.CGS_INSTITUTIONAL_RC1_RECAPTCHA_SITE_KEY,
    authorizationCode: process.env.CGS_INSTITUTIONAL_RC1_AUTHORIZATION_CODE,
    recordId: process.env.CGS_INSTITUTIONAL_RC1_RECORD_ID,
  });

  const allowedOrigin = parseHttpsOrigin(
    requiredEnvironment.allowedOrigin,
    "Institutional Route RC1 allowed origin",
  );
  const formEndpoint = parseFormspreeEndpoint(
    requiredEnvironment.formEndpoint,
    "Institutional Route RC1",
  );

  if (allowedOrigin === productionOrigin) {
    throw new Error("Institutional Route RC1 cannot be enabled for the production origin");
  }
  const recaptchaSiteKey = parseRecaptchaSiteKey(
    requiredEnvironment.recaptchaSiteKey,
    "Institutional Route RC1",
  );
  if (!/^[A-Za-z0-9_-]{24,}$/.test(requiredEnvironment.authorizationCode)) {
    throw new Error("Institutional Route RC1 authorization code must be at least 24 URL-safe characters");
  }
  if (!isInstitutionalRc1Record(requiredEnvironment.recordId)) {
    throw new Error("Institutional Route RC1 record ID is malformed");
  }

  const publicConfig = {
    mode: "integration-test",
    allowedOrigin,
    formEndpoint,
    recaptchaSiteKey,
    authorizationCode: requiredEnvironment.authorizationCode,
    recordId: requiredEnvironment.recordId,
  };
  await writeInstitutionalConfig(
    publicConfig,
    `Institutional Route RC1 enabled for ${allowedOrigin}`,
  );
}

if (productionCandidateEnabled) {
  const requiredEnvironment = requireEnvironment("Institutional production candidate", {
    previewOrigin: process.env.CGS_INSTITUTIONAL_CANDIDATE_PREVIEW_ORIGIN,
    formEndpoint: process.env.CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT,
    recaptchaSiteKey: process.env.CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY,
  });
  const previewOrigin = parseHttpsOrigin(
    requiredEnvironment.previewOrigin,
    "Institutional production-candidate preview origin",
  );
  if (previewOrigin === productionOrigin) {
    throw new Error("Institutional production candidate must use an isolated non-production preview origin");
  }

  const publicConfig = {
    mode: "production-candidate",
    productionOrigin,
    previewOrigin,
    formEndpoint: parseFormspreeEndpoint(
      requiredEnvironment.formEndpoint,
      "Institutional production candidate",
      productionInstitutionalFormEndpoint,
    ),
    recaptchaSiteKey: parseRecaptchaSiteKey(
      requiredEnvironment.recaptchaSiteKey,
      "Institutional production candidate",
    ),
    intakeOwner: "AI-Bio Synergy Holdings LLC",
  };
  await writeInstitutionalConfig(
    publicConfig,
    `Institutional production candidate prepared for isolated preview at ${previewOrigin}`,
  );
}

if (productionVerificationEnabled) {
  const requiredEnvironment = requireEnvironment("Institutional production verification mode", {
    formEndpoint: process.env.CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT,
    recaptchaSiteKey: process.env.CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY,
    authorizationId: process.env.CGS_INSTITUTIONAL_FINAL_AUTHORIZATION_ID,
  });
  if (!/^CGS-INSTITUTIONAL-LIVE-\d{4}-\d{2}-\d{2}-[A-Z0-9-]+$/.test(requiredEnvironment.authorizationId)) {
    throw new Error("Institutional production verification mode requires a valid final authorization ID");
  }

  const publicConfig = {
    mode: "production-verification",
    allowedOrigin: productionOrigin,
    formEndpoint: parseFormspreeEndpoint(
      requiredEnvironment.formEndpoint,
      "Institutional production verification mode",
      productionInstitutionalFormEndpoint,
    ),
    recaptchaSiteKey: parseRecaptchaSiteKey(
      requiredEnvironment.recaptchaSiteKey,
      "Institutional production verification mode",
    ),
    authorizationId: requiredEnvironment.authorizationId,
    intakeOwner: "AI-Bio Synergy Holdings LLC",
  };
  await writeInstitutionalConfig(
    publicConfig,
    `Institutional production verification mode prepared for ${productionOrigin}`,
  );
}

if (productionLiveEnabled) {
  const requiredEnvironment = requireEnvironment("Institutional production live mode", {
    formEndpoint: process.env.CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT,
    recaptchaSiteKey: process.env.CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY,
    authorizationId: process.env.CGS_INSTITUTIONAL_FINAL_AUTHORIZATION_ID,
  });
  if (!/^CGS-INSTITUTIONAL-LIVE-\d{4}-\d{2}-\d{2}-[A-Z0-9-]+$/.test(requiredEnvironment.authorizationId)) {
    throw new Error("Institutional production live mode requires a valid final authorization ID");
  }

  const publicConfig = {
    mode: "production-live",
    allowedOrigin: productionOrigin,
    formEndpoint: parseFormspreeEndpoint(
      requiredEnvironment.formEndpoint,
      "Institutional production live mode",
      productionInstitutionalFormEndpoint,
    ),
    recaptchaSiteKey: parseRecaptchaSiteKey(
      requiredEnvironment.recaptchaSiteKey,
      "Institutional production live mode",
    ),
    authorizationId: requiredEnvironment.authorizationId,
    intakeOwner: "AI-Bio Synergy Holdings LLC",
  };
  await writeInstitutionalConfig(
    publicConfig,
    `Institutional production live mode prepared for ${productionOrigin}`,
  );
}

await fingerprintInstitutionalConfig();

console.log(`Common Ground Standard Render artifact prepared at ${path.relative(repoRoot, artifactRoot)}`);
console.log(`Included public entries: ${publicEntries.join(", ")}`);
