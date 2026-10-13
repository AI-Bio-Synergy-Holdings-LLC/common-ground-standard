import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Script } from "node:vm";

const execFileAsync = promisify(execFile);
export const modeFlags = [
  "CGS_INSTITUTIONAL_RC1_ENABLED",
  "CGS_INSTITUTIONAL_DIAGNOSTIC_ENABLED",
  "CGS_INSTITUTIONAL_PRODUCTION_CANDIDATE_ENABLED",
  "CGS_INSTITUTIONAL_PRODUCTION_VERIFICATION_ENABLED",
  "CGS_INSTITUTIONAL_PRODUCTION_LIVE_ENABLED",
];

// This is deliberately not a YAML parser. Accept only this site's small,
// unquoted hold-policy shape and reject ambiguity instead of ignoring it.
export function holdPolicy(source) {
  assert.match(source, /^services:\r?\n/, "expected a top-level services list");
  const split = source.split(/^previews:\r?$/m);
  assert.equal(split.length, 2, "one explicit root preview policy is required");
  const services = split[0].split(/^  - type: /m).slice(1);
  assert.equal(services.length, 1, "qualify exactly the existing static service");
  const service = services[0];
  assert.match(service, /^web\r?\n/);
  assert.match(service, /^    name: common-ground-standard\r?$/m);
  assert.match(service, /^    runtime: static\r?$/m);
  assert.match(service, /^    branch: main\r?$/m);
  assert.doesNotMatch(service.split(/^    headers:/m)[0] + split[1], /\t|[&*!]|\b(?:autoDeploy|previewsEnabled|pullRequestPreviewsEnabled):/,
    "aliases, tabs, wildcards and legacy policy fields require explicit review");
  // The CSP and wildcard header paths are unrelated to deployment policy.
  const policyLines = service.split(/\r?\n/).filter((line) =>
    /^    (?:autoDeployTrigger|previews):/.test(line));
  assert.deepEqual(policyLines, ["    autoDeployTrigger: off"],
    "auto-deploy must be off; omit service previews.generation to disable PR previews");
  assert.equal((service.match(/autoDeployTrigger:/g) || []).length, 1);
  assert.equal(split[1].trim(), "generation: off", "Blueprint preview environments must be off");
  return true;
}

export function cachePolicy(source, pathname) {
  // Require one exact, single-line Cache-Control rule for the specified file.
  const rules = [...source.matchAll(/^      - path: ([^\r\n]+)\r?\n        name: Cache-Control\r?\n        value: ([^\r\n]+)\r?$/gm)]
    .filter((match) => match[1] === pathname);
  assert.equal(rules.length, 1, `one exact Cache-Control rule required for ${pathname}`);
  const tokens = rules[0][2].toLowerCase().split(",").map((token) => token.trim());
  for (const token of ["no-store", "no-cache", "must-revalidate", "max-age=0"]) {
    assert.ok(tokens.includes(token), `${pathname} must declare ${token}`);
  }
  assert.equal(tokens.length, 4, "conflicting/extra cache directives require explicit review");
  return rules[0][2];
}

export function fingerprint(configSource) {
  return createHash("sha256").update(configSource).digest("hex").slice(0, 16);
}

export function configUrl(html) {
  const matches = [...html.matchAll(/\bsrc="(institutional-rc1-config\.js\?v=[a-f0-9]{16})"/g)];
  assert.equal(matches.length, 1, "exactly one fingerprinted config script is required");
  return new URL(matches[0][1], "https://offline.invalid/").pathname + "?" + matches[0][1].split("?")[1];
}

export function evaluateConfig(source) {
  // Execute only the generated public config, never site.js/live transport code.
  const context = { window: {} };
  new Script(source).runInNewContext(context, {
    timeout: 1000, contextCodeGeneration: { strings: false, wasm: false },
  });
  const config = context.window.__CGS_INSTITUTIONAL_RC1__;
  assert.ok(config === null || Object.isFrozen(config));
  return config;
}

export function assertFreshConfig(html, source, expected) {
  const actual = configUrl(html);
  assert.equal(actual, configUrl(expected.html), "HTML must reference the current artifact");
  assert.equal(new URL(actual, "https://offline.invalid").searchParams.get("v"), fingerprint(source),
    "response bytes must match the requested fingerprint");
  assert.equal(source, expected.config, "a cache must not supply another generation's config bytes");
  return evaluateConfig(source);
}

// Deterministic cache model, NOT a native browser/CDN implementation. The
// response header governs storage and the complete URL (including query) is
// the key. Negative controls deliberately break each assumption.
export class ModeledCache {
  entries = new Map();
  reads = [];
  fetch(url, load) {
    if (this.entries.has(url)) {
      this.reads.push({ url, source: "modeled-cache" });
      return this.entries.get(url);
    }
    const response = load(url);
    assert.ok(response && typeof response.body === "string");
    this.reads.push({ url, source: "fixture" });
    if (!response.cacheControl?.toLowerCase().split(",").map((v) => v.trim()).includes("no-store")) {
      this.entries.set(url, response);
    }
    return response;
  }
}

export async function buildFixtures(sourceRoot) {
  const parent = await mkdtemp(path.join(os.tmpdir(), "cgs-deployment-safety-"));
  const isolated = path.join(parent, "source");
  // The builder removes dist-render recursively. It can only target this
  // freshly created source fixture, never the checkout's existing artifact.
  assert.equal(path.dirname(isolated), parent);
  assert.equal(path.dirname(path.join(isolated, "dist-render")), isolated);
  await mkdir(isolated);
  const entries = [
    ...(await readdir(sourceRoot)).filter((entry) => entry.endsWith(".html")),
    "assets", "review", "standards", "favicon.svg", "robots.txt", "sitemap.xml",
    "institutional-rc1-config.js", "institutional-confirmation.mjs", "site.js", "styles.css",
    "scripts/prepare-render-site.mjs",
  ];
  for (const entry of entries) {
    await mkdir(path.dirname(path.join(isolated, entry)), { recursive: true });
    await cp(path.join(sourceRoot, entry), path.join(isolated, entry), { recursive: true });
  }
  const baseEnvironment = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => !name.startsWith("CGS_INSTITUTIONAL_")));
  for (const flag of modeFlags) baseEnvironment[flag] = "false";
  const fixtures = {};
  try {
    for (const [name, mode, id] of [
      ["inert", null, "A"],
      ["verification", "PRODUCTION_VERIFICATION", "A"],
      ["verificationChanged", "PRODUCTION_VERIFICATION", "B"],
      ["liveConfigOnly", "PRODUCTION_LIVE", "C"],
      ["rollback", null, "A"],
    ]) {
      const env = { ...baseEnvironment };
      if (mode) {
        // Obvious placeholders used only in this isolated build. These values
        // are not credentials, provider changes, or activation authorization.
        env[`CGS_INSTITUTIONAL_${mode}_ENABLED`] = "true";
        env.CGS_INSTITUTIONAL_PRODUCTION_FORM_ENDPOINT = "https://formspree.io/f/mrpezwok";
        env.CGS_INSTITUTIONAL_PRODUCTION_RECAPTCHA_SITE_KEY = "offline_fixture_not_a_google_key_1234567890";
        env.CGS_INSTITUTIONAL_FINAL_AUTHORIZATION_ID = `CGS-INSTITUTIONAL-LIVE-2099-01-01-OFFLINE-NOT-AUTHORIZATION-${id}`;
      }
      await execFileAsync(process.execPath, ["scripts/prepare-render-site.mjs"], {
        cwd: isolated, env, timeout: 30000,
      });
      const directory = path.join(parent, name);
      await cp(path.join(isolated, "dist-render"), directory, { recursive: true });
      fixtures[name] = {
        directory,
        html: await readFile(path.join(directory, "institutional-alignment.html"), "utf8"),
        config: await readFile(path.join(directory, "institutional-rc1-config.js"), "utf8"),
      };
    }
    return { parent, fixtures };
  } catch (error) {
    error.message += ` (isolated fixture retained at ${parent})`;
    throw error;
  }
}
