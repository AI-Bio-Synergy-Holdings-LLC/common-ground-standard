import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertFreshConfig, buildFixtures, cachePolicy, configUrl, evaluateConfig, fingerprint, holdPolicy, ModeledCache,
} from "./helpers/deployment-safety.mjs";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => readFile(path.join(sourceRoot, name), "utf8");

test("source hold disables deploys and both preview mechanisms", async () => {
  assert.equal(holdPolicy(await read("render.yaml")), true);
});

test("hold-policy negative controls reject omissions, legacy fields and nested preview enablement", async () => {
  const source = (await read("render.yaml")).replaceAll("\r\n", "\n");
  assert.equal(holdPolicy(source), true, "negative controls start from a valid policy");
  for (const mutation of [
    source.replace("autoDeployTrigger: off", "autoDeployTrigger: commit"),
    source.replace("autoDeployTrigger: off", "autoDeployTrigger: checksPass"),
    source.replace("    autoDeployTrigger: off\n", ""),
    source.replace(/generation: off/, "generation: automatic"),
    source.replace(/\npreviews:[\s\S]*$/, "\n"),
    source.replace("    headers:", "    previews:\n      generation: automatic\n    headers:"),
    source.replace("    headers:", "    autoDeploy: true\n    headers:"),
    source.replace("    headers:", "    pullRequestPreviewsEnabled: true\n    headers:"),
    source.replace("    headers:", "    autoDeployTrigger: commit\n    headers:"),
  ]) assert.throws(() => holdPolicy(mutation));
});

test("Render and exact-head CI share the same exact Node pin without a competing selector", async () => {
  const pin = (await read(".node-version")).trim();
  assert.equal(pin, "24.22.1");
  const manifest = JSON.parse(await read("package.json"));
  assert.equal(manifest.engines.node, pin);
  assert.equal(Object.keys(manifest.dependencies || {}).length, 0);
  assert.equal(Object.keys(manifest.devDependencies || {}).length, 0);
  const workflow = await read(".github/workflows/public-evidence-validator.yml");
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/m,
    "required checks must run for runtime changes and documentation-only PRs alike");
  assert.match(workflow, /node-version-file: "\.node-version"/);
  assert.doesNotMatch(workflow, /^\s+node-version:/m);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /package-manager-cache: false/);
  assert.match(workflow, /persist-credentials: false/);
  const render = await read("render.yaml");
  assert.doesNotMatch(render, /(?:key:\s*NODE_VERSION|NODE_VERSION:)/);
});

test("both the institutional HTML and runtime config declare non-storage cache policy", async () => {
  const render = await read("render.yaml");
  for (const pathname of ["/institutional-alignment.html", "/institutional-rc1-config.js"]) {
    assert.ok(cachePolicy(render, pathname));
  }
});

test("cache-policy negative controls reject wrong paths, duplicates and weaker directives", async () => {
  const source = await read("render.yaml");
  for (const pathname of ["/institutional-alignment.html", "/institutional-rc1-config.js"]) {
    assert.ok(cachePolicy(source, pathname), "negative controls start from a valid policy");
    for (const mutation of [
      source.replace(`path: ${pathname}`, "path: /unrelated.html"),
      source.replaceAll("no-store, ", ""),
      source.replaceAll("max-age=0", "max-age=3600"),
      source + `\n      - path: ${pathname}\n        name: Cache-Control\n        value: public, max-age=3600\n`,
    ]) assert.throws(() => cachePolicy(mutation, pathname));
  }
});

test("sealed modeled transitions cover a previously loaded client, current fingerprints and rollback", async (t) => {
  const { fixtures } = await buildFixtures(sourceRoot);
  const render = await read("render.yaml");
  const htmlPolicy = cachePolicy(render, "/institutional-alignment.html");
  const configPolicy = cachePolicy(render, "/institutional-rc1-config.js");
  let active;
  const cache = new ModeledCache();
  const load = (url) => ({
    body: url === "/institutional-alignment.html" ? active.html : active.config,
    cacheControl: url === "/institutional-alignment.html" ? htmlPolicy : configPolicy,
  });
  const navigate = () => {
    const html = cache.fetch("/institutional-alignment.html", load).body;
    const url = configUrl(html);
    const source = cache.fetch(url, load).body;
    return { url, config: assertFreshConfig(html, source, active) };
  };
  const observed = [];
  for (const [name, mode] of [
    ["inert", null], ["verification", "production-verification"],
    ["verificationChanged", "production-verification"],
    ["liveConfigOnly", "production-live"], ["rollback", null],
  ]) {
    active = fixtures[name];
    const client = navigate();
    assert.equal(client.config?.mode || null, mode);
    observed.push(client);
  }
  assert.notEqual(observed[1].url, observed[2].url);
  assert.notEqual(observed[2].url, observed[3].url);
  assert.equal(observed[0].url, observed[4].url);
  assert.equal(cache.entries.size, 0);
  assert.ok(cache.reads.every((read) => read.source === "fixture"));

  await t.test("old HTML policy demonstrably holds a stale fingerprint across a transition", () => {
    const stale = new ModeledCache();
    const first = stale.fetch("/institutional-alignment.html", () => ({ body: fixtures.verification.html }));
    const next = stale.fetch("/institutional-alignment.html", () => ({ body: fixtures.liveConfigOnly.html }));
    assert.equal(next.body, first.body);
    assert.notEqual(configUrl(next.body), configUrl(fixtures.liveConfigOnly.html));
    assert.throws(() => assertFreshConfig(next.body, fixtures.verification.config, fixtures.liveConfigOnly),
      /HTML must reference the current artifact/);
    assert.notEqual(new URL(configUrl(next.body), "https://offline.invalid").searchParams.get("v"),
      fingerprint(fixtures.liveConfigOnly.config));
  });

  await t.test("a cache ignoring query strings or no-store is detected, not counted as success", () => {
    const oldSource = fixtures.verification.config;
    assert.notEqual(evaluateConfig(oldSource).mode, "production-live");
    assert.notEqual(fingerprint(oldSource),
      new URL(configUrl(fixtures.liveConfigOnly.html), "https://offline.invalid").searchParams.get("v"));
    assert.throws(() => assertFreshConfig(fixtures.liveConfigOnly.html, oldSource, fixtures.liveConfigOnly),
      /response bytes must match the requested fingerprint/);
  });

  await t.test("missing, duplicate, and mismatched script fingerprints are detected", () => {
    assert.throws(() => configUrl(fixtures.verification.html.replace(/\?v=[a-f0-9]{16}/, "")));
    assert.throws(() => configUrl(fixtures.verification.html + fixtures.verification.html));
    const swapped = configUrl(fixtures.verification.html);
    assert.notEqual(new URL(swapped, "https://offline.invalid").searchParams.get("v"),
      fingerprint(fixtures.liveConfigOnly.config));
  });
});
