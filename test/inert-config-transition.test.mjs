import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFreshConfig, configUrl, evaluateConfig, fingerprint, modeFlags } from "./helpers/deployment-safety.mjs";
import { inertFixture, assertInertFixture, fixtureResponse, startInertFixtureServer,
  fixturePath, noStore, fixtureCsp, historyDisposition } from "./helpers/inert-config-transition.mjs";

test("C-04 A/B fixtures change bytes/fingerprints, not the null intake config or false flags", () => {
  const a = inertFixture("A");
  const b = inertFixture("B");
  assert.notEqual(a.config, b.config);
  assert.notEqual(a.version, b.version);
  assert.notEqual(configUrl(a.html), configUrl(b.html));
  for (const fixture of [a, b]) {
    assert.ok(Object.isFrozen(fixture));
    assert.equal(assertInertFixture(fixture), true);
    assert.equal(evaluateConfig(fixture.config), null);
    assert.equal(assertFreshConfig(fixture.html, fixture.config, fixture), null);
  }
  assert.equal(inertFixture("A").config, a.config, "rollback reproduces exact A bytes");
  assert.throws(() => inertFixture("production-live"));
});

test("C-04 structural negative controls reject forms, foreign scripts, transport and enabled flags", () => {
  const a = inertFixture("A");
  for (const html of [a.html + '<form action="/submit"></form>',
    a.html.replace('src="fixture-view.js"', 'src="https://example.invalid/loader.js"'),
    a.html.replace('defer src="fixture-view.js"', 'onclick="run()" defer src="fixture-view.js"')]) {
    assert.throws(() => assertInertFixture({ ...a, html }));
  }
  for (const config of [a.config.replace(':false', ':true'), a.config + 'fetch("/submit");']) {
    const version = fingerprint(config);
    assert.throws(() => assertInertFixture({ ...a, config, version, html: a.html.replace(a.version, version) }));
  }
});

test("C-04 history disposition never counts stale, missing or unchanged configuration as fresh", () => {
  const a = inertFixture("A");
  const b = inertFixture("B");
  const guard = { config: null, forms: 0, flags: Object.fromEntries(modeFlags.map((flag) => [flag, false])) };
  for (const observation of [null, {}, { generation: "A", fingerprint: a.version },
    { generation: "B", fingerprint: a.version }]) {
    assert.equal(historyDisposition(observation, b).status, "HOLD");
  }
  assert.equal(historyDisposition({ ...guard, generation: "B", fingerprint: b.version }, b).status, "PASS-BOUNDED");
});

test("C-04 response policy is fixed, no-index and GET/HEAD-only with no control/file surface", () => {
  const current = inertFixture("B");
  const respond = (method, rawUrl, host = "127.0.0.1:1234") => fixtureResponse({
    method, rawUrl, host, expectedHost: "127.0.0.1:1234", current });
  for (const rawUrl of [fixturePath, configUrl(current.html), "/institutional-rc1-config.js", "/fixture-view.js", "/away.html"]) {
    const get = respond("GET", rawUrl);
    assert.equal(get.status, 200);
    assert.equal(get.headers["Cache-Control"], noStore);
    assert.equal(get.headers["Content-Security-Policy"], fixtureCsp);
    assert.equal(get.headers["X-Robots-Tag"], "noindex, nofollow");
    assert.equal(respond("HEAD", rawUrl).body, "");
  }
  // Pure response-function probes; no transmitting HTTP request is made.
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) assert.equal(respond(method, fixturePath).status, 405);
  assert.equal(respond("GET", fixturePath, "example.invalid:1234").status, 421);
  for (const target of ["/../site.js", "/%2e%2e/site.js", "http://example.invalid/a", "/a?token=x", "/a?v=abcd"]) {
    assert.equal(respond("GET", target).status, 400);
  }
  for (const target of ["/activate", "/site.js", "/settings", "/package.json"]) assert.equal(respond("GET", target).status, 404);
});

test("C-04 stale HTML/config negatives are detected independently of the null global", () => {
  const a = inertFixture("A");
  const b = inertFixture("B");
  assert.throws(() => assertFreshConfig(a.html, b.config, b), /HTML must reference the current artifact/);
  assert.throws(() => assertFreshConfig(b.html, a.config, b), /response bytes must match the requested fingerprint/);
  assert.equal(evaluateConfig(a.config), evaluateConfig(b.config), "null alone cannot prove freshness");
});

test("C-04 loopback server switches operator-side generations, records read-only requests and closes", async () => {
  const server = await startInertFixtureServer();
  try {
    assert.equal(new URL(server.origin).hostname, "127.0.0.1");
    const initial = server.snapshot();
    assert.equal(await (await fetch(server.origin + fixturePath, { redirect: "error" })).text(), initial.html);
    const changed = server.activate("B");
    assert.equal(await (await fetch(server.origin + configUrl(changed.html), { redirect: "error" })).text(), changed.config);
    assert.equal(initial.generation, "A", "old snapshot is not mutated");
    server.activate("A");
    assert.equal(server.snapshot().config, initial.config);
    assert.ok(server.requests.every((request) => request.method === "GET" && request.status === 200));
    assert.throws(() => server.activate("B", "activate-live"));
    assert.throws(() => server.activate("A", "stale-config"));
  } finally { await server.close(); }
});

test("C-04 harness is test-only and not copied by the unchanged public builder", async () => {
  const builder = await readFile(new URL("../scripts/prepare-render-site.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(builder, /inert-config-transition|test\/browser|test\/helpers/);
  const harness = await readFile(new URL("./browser/inert-config-transition.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(harness, /\.route\(|setCacheDisabled|setExtraHTTPHeaders|cache_bust=/);
  assert.match(harness, /about:blank/);
  assert.match(harness, /stale BFCache restoration is a real HOLD/);
});
