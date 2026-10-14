import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import http from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildFixtures, evaluateConfig } from "./helpers/deployment-safety.mjs";
import { artifacts, contract, digest, extractController, faults, publicClientHash, startLab } from "./helpers/c04-artifact-qualification.mjs";

test("C04 package pins the exact public controller without loading intake callers", async () => {
  const source = (await readFile(new URL("../site.js", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const lab = await artifacts();
  assert.equal(digest(source), publicClientHash);
  assert.ok(lab.client.includes(extractController(source)));
  assert.throws(() => extractController(source + "\n"));
  assert.doesNotMatch(lab.client, /grecaptcha|formEndpoint|requestSubmit|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage/);
  assert.equal(contract.fullC04, "HOLD");
  assert.equal(contract.controllerTimeoutMs, 5000);
  assert.equal(contract.casesPerViewport, 26);
});

test("inert generations contain no endpoint or credentials; raw controls never transmit", async () => {
  const lab = await artifacts();
  for (const generation of ["A", "B"]) {
    const source = lab.configs[generation];
    assert.match(source, /OFFLINE-NOT-AN-INTAKE-MODE/);
    assert.doesNotMatch(source, /https?:|secret|siteKey|allowedOrigin|authorization|formEndpoint|true/);
    assert.notEqual(lab.configPath("A"), lab.configPath("B"));
    const html = lab.html(generation);
    assert.match(html, /<fieldset disabled data-test-form-guard>/);
    assert.match(html, /<button disabled type="button" data-fs-submit-btn>/);
    assert.doesNotMatch(html, /<form[^>]+(?:action|method)=|<input[^>]+type="(?!hidden)/);
    assert.match(html, /meta name="robots" content="noindex,nofollow"/);
  }
});

const request = (url, { method = "GET", host } = {}) => new Promise((resolve, reject) => {
  const call = http.request(url, { method, headers: host ? { Host: host } : {} }, (response) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { body += chunk; });
    response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
  });
  call.setTimeout(2000, () => call.destroy(new Error("finite local request deadline")));
  call.on("error", reject);
  call.end();
});

test("loopback lab strictly rejects host, target, query and mutating methods", { timeout: 6000 }, async () => {
  const lab = await startLab();
  try {
    for (const target of ["/", "/../site.js", "/%2e%2e/site.js", "/site.js", "/lab.css?x=1", "/institutional-alignment.html?integration=INERT"]) {
      assert.equal((await request(lab.origin + target)).status, 400);
    }
    assert.equal((await request(lab.origin + "/lab.css", { host: "foreign.invalid" })).status, 400);
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) assert.equal((await request(lab.origin + "/lab.css", { method })).status, 405);
    assert.throws(() => lab.setFault("unknown"));
    assert.throws(() => lab.setFault("production-live"));
  } finally { await lab.close(); }
});

test("loopback static artifact responses require local CSP and no-store/no-index", { timeout: 6000 }, async () => {
  const lab = await startLab();
  try {
    const response = await request(lab.origin + "/institutional-alignment.html");
    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(response.headers["content-security-policy"], /connect-src 'self'; form-action 'none'/);
    assert.match(response.headers["content-security-policy"], /worker-src 'none'/);
    const config = await request(lab.origin + lab.artifact.configPath("A"));
    assert.equal(config.body, lab.artifact.configs.A);
    assert.equal(config.headers["cache-control"], "no-store");
    assert.equal((await request(lab.origin + "/site.js?v=0000000000000000")).status, 404);
  } finally { await lab.close(); }
});

test("every finite HTTP fault is explicit and the server has no mutation endpoint", { timeout: 6000 }, async () => {
  const lab = await startLab();
  try {
    for (const fault of faults.filter((value) => !value.startsWith("hold-"))) {
      lab.setFault(fault);
      const html = await request(lab.origin + "/institutional-alignment.html");
      const config = await request(lab.origin + lab.artifact.configPath("A"));
      if (fault === "http-error") assert.equal(html.status, 503);
      if (fault === "redirect") { assert.equal(html.status, 302); assert.equal(html.headers.location, "/away.html"); }
      if (fault === "cache-header") assert.equal(html.headers["cache-control"], "public, max-age=600");
      if (fault === "generation-change") assert.ok(html.body.includes(lab.artifact.configPath("B")));
      if (fault === "stale-config") assert.equal(config.body, lab.artifact.configs.B);
      if (fault === "oversized-html") assert.ok(html.body.length > 262144);
      if (fault === "oversized-config") assert.ok(config.body.length > 16384);
    }
  } finally { await lab.close(); }
});

test("held response cleanup is finite even without a browser", { timeout: 4000 }, async () => {
  const lab = await startLab();
  lab.setFault("hold-html");
  const pending = request(lab.origin + "/institutional-alignment.html");
  try {
    for (let attempt = 0; !lab.pending.size && attempt < 100; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(lab.pending.size, 1);
    lab.release();
    assert.equal((await pending).status, 200);
    assert.equal(lab.pending.size, 0);
  } finally { await lab.close(); }
});

test("C04 qualification fixtures and diagnostics are never public build entries", { timeout: 30000 }, async () => {
  const builder = await readFile(new URL("../scripts/prepare-render-site.mjs", import.meta.url), "utf8");
  const start = builder.indexOf("const publicEntries = [");
  assert.ok(start >= 0);
  const publicEntries = builder.slice(start, builder.indexOf("];", start) + 2);
  assert.doesNotMatch(publicEntries, /test|docs|package\.json|c04/i);
  const { fixtures } = await buildFixtures(fileURLToPath(new URL("../", import.meta.url)));
  assert.equal(fixtures.inert.config, await readFile(new URL("../institutional-rc1-config.js", import.meta.url), "utf8"));
  assert.equal(evaluateConfig(fixtures.inert.config), null);
  assert.doesNotMatch(fixtures.inert.html, /C04_LAB|OFFLINE-NOT-AN-INTAKE-MODE|qualification lab/);
  const entries = await readdir(fixtures.inert.directory);
  for (const entry of ["test", "docs", "package.json"]) assert.ok(!entries.includes(entry));
});

test("C04 browser contract labels simulated lifecycle evidence and keeps native proof open", async () => {
  const runner = await readFile(new URL("./browser/run-c04-artifact-qualification.mjs", import.meta.url), "utf8");
  const record = await readFile(new URL("../docs/operations/C04_TRANSITION_QUALIFICATION_PACKAGE.md", import.meta.url), "utf8");
  assert.match(runner, /simulated-visibility-boundary/);
  assert.match(runner, /simulated-pagehide-boundary/);
  assert.match(runner, /trusted: false/);
  assert.match(runner, /nativeProof: false/);
  assert.match(record, /not native navigation or persisted-return proof/);
  assert.match(record, /independent native hosted background\/resume qualification/);
  assert.match(record, /Full C-04 \*\*HOLD\*\*/);
});

test("manual C04 runner has finite custody, no install/stdin/retry and loopback-only requests", async () => {
  const runner = await readFile(new URL("./browser/run-c04-artifact-qualification.mjs", import.meta.url), "utf8");
  assert.match(runner, /setTimeout\(\(\) => \{ context\.close\(\)/);
  assert.match(runner, /contract\.caseDeadlineMs/);
  assert.match(runner, /new URL\(request\.url\(\)\)\.origin !== lab\.origin/);
  assert.match(runner, /unexpected\.length, 0/);
  assert.match(runner, /sourceDirty/);
  assert.match(runner, /finally \{ if \(browser\) await browser\.close\(\); \}/);
  assert.doesNotMatch(runner, /process\.stdin|npm install|npx |requestSubmit|grecaptcha|formspree\.io/);
});
