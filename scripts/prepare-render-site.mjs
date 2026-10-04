#!/usr/bin/env node

import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  "site.js",
  "styles.css",
];

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });

for (const entry of publicEntries) {
  await cp(path.join(repoRoot, entry), path.join(artifactRoot, entry), { recursive: true });
}

const rc1Enabled = process.env.CGS_INSTITUTIONAL_RC1_ENABLED === "true";

if (rc1Enabled) {
  const requiredEnvironment = {
    allowedOrigin: process.env.CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN,
    formEndpoint: process.env.CGS_INSTITUTIONAL_RC1_FORM_ENDPOINT,
    recaptchaSiteKey: process.env.CGS_INSTITUTIONAL_RC1_RECAPTCHA_SITE_KEY,
    authorizationCode: process.env.CGS_INSTITUTIONAL_RC1_AUTHORIZATION_CODE,
    recordId: process.env.CGS_INSTITUTIONAL_RC1_RECORD_ID,
  };
  const missing = Object.entries(requiredEnvironment)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Institutional Route RC1 is enabled but missing: ${missing.join(", ")}`);
  }

  const allowedOrigin = new URL(requiredEnvironment.allowedOrigin);
  const formEndpoint = new URL(requiredEnvironment.formEndpoint);

  if (allowedOrigin.protocol !== "https:" || allowedOrigin.pathname !== "/") {
    throw new Error("Institutional Route RC1 allowed origin must be an HTTPS origin without a path");
  }
  if (allowedOrigin.origin === "https://common-ground-standard.org") {
    throw new Error("Institutional Route RC1 cannot be enabled for the production origin");
  }
  if (
    formEndpoint.origin !== "https://formspree.io" ||
    !/^\/f\/[A-Za-z0-9_-]+$/.test(formEndpoint.pathname)
  ) {
    throw new Error("Institutional Route RC1 requires a Formspree /f/{form-id} endpoint");
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(requiredEnvironment.recaptchaSiteKey)) {
    throw new Error("Institutional Route RC1 reCAPTCHA site key is malformed");
  }
  if (!/^[A-Za-z0-9_-]{24,}$/.test(requiredEnvironment.authorizationCode)) {
    throw new Error("Institutional Route RC1 authorization code must be at least 24 URL-safe characters");
  }
  if (!/^CGS-INSTITUTIONAL-RC1-[A-Z0-9-]+$/.test(requiredEnvironment.recordId)) {
    throw new Error("Institutional Route RC1 record ID is malformed");
  }

  const publicConfig = {
    mode: "integration-test",
    allowedOrigin: allowedOrigin.origin,
    formEndpoint: formEndpoint.href,
    recaptchaSiteKey: requiredEnvironment.recaptchaSiteKey,
    authorizationCode: requiredEnvironment.authorizationCode,
    recordId: requiredEnvironment.recordId,
  };
  const configSource = `window.__CGS_INSTITUTIONAL_RC1__ = Object.freeze(${JSON.stringify(publicConfig)});\n`;

  await writeFile(path.join(artifactRoot, "institutional-rc1-config.js"), configSource, "utf8");
  console.log(`Institutional Route RC1 enabled for ${allowedOrigin.origin}`);
}

console.log(`Common Ground Standard Render artifact prepared at ${path.relative(repoRoot, artifactRoot)}`);
console.log(`Included public entries: ${publicEntries.join(", ")}`);
