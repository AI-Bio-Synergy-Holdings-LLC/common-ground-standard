import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";
import { actualFixture, actualResponse, startActualClientFixture, publicHashes, digest,
  restorationDisposition, blockedAction, localCsp } from "./helpers/actual-client-lifecycle.mjs";

test("C04 actual source resources remain exactly the approved public baseline", async () => {
  for (const file of Object.keys(publicHashes)) {
    const source = (await readFile(new URL(`../${file}`, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
    assert.equal(digest(source), publicHashes[file]);
  }
});

test("C04 actual HTML transformation changes only its config reference; config remains inert", async () => {
  const html = (await readFile(new URL("../institutional-alignment.html", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const a = actualFixture(html, "A");
  const b = actualFixture(html, "B");
  assert.notEqual(a.version, b.version);
  assert.equal(a.html.replace(a.version, b.version), b.html);
  assert.match(a.config, /Object\.freeze\(null\)/);
  assert.doesNotMatch(a.config, /formEndpoint|recaptchaSiteKey|production-live/);
  assert.throws(() => actualFixture(html.replace('data-intake-mode="test"', 'data-intake-mode="live"'), "A"));
});

test("C04 current pageshow callback updates visual classes without clearing seeded form state", async () => {
  const source = await readFile(new URL("../site.js", import.meta.url), "utf8");
  const callback = source.match(/const markLoaded = \(\) => \{[\s\S]*?\n  \};/)[0];
  const state = { guardDisabled: false, action: blockedAction, tokenLength: 31 };
  const mutations = [];
  new Script(callback + "\nmarkLoaded();").runInNewContext({ document: { body: { classList: {
    add: (value) => mutations.push(["add", value]), remove: (value) => mutations.push(["remove", value]),
  } } }, state }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  assert.deepEqual(mutations, [["add", "is-loaded"], ["remove", "is-leaving"]]);
  assert.deepEqual(state, { guardDisabled: false, action: blockedAction, tokenLength: 31 });
  assert.match(source, /window\.addEventListener\("pageshow", markLoaded\)/);
  assert.match(source, /DOMContentLoaded", initRecaptchaForms, \{ once: true \}/);
});

test("C04 lifecycle classifier cannot count enabled controls, retained endpoints or sentinels as restored clearance", () => {
  const expected = { generation: "B", version: "b" };
  const locked = { generation: "B", fingerprint: "b", guardDisabled: true, buttonEffectiveDisabled: true,
    action: null, method: null, tokenEmpty: true, tokenReady: null };
  assert.equal(restorationDisposition(locked, expected).status, "PASS-BOUNDED");
  for (const mutation of [{ generation: "A" }, { fingerprint: "a" }, { guardDisabled: false },
    { buttonEffectiveDisabled: false }, { action: blockedAction }, { method: "post" },
    { tokenEmpty: false }, { tokenReady: "c04-inert-sentinel" }]) {
    assert.equal(restorationDisposition({ ...locked, ...mutation }, expected).status, "HOLD");
  }
});

test("C04 actual fixture HTTP policy rejects all transport/control/file paths", async () => {
  const html = (await readFile(new URL("../institutional-alignment.html", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const args = { host: "127.0.0.1:1234", expectedHost: "127.0.0.1:1234", current: actualFixture(html, "A"), resources: new Map() };
  const get = actualResponse({ ...args, method: "GET", rawUrl: "/institutional-alignment.html" });
  assert.equal(get.status, 200);
  assert.equal(get.headers["Content-Security-Policy"], localCsp);
  for (const method of ["POST", "PUT", "DELETE"]) assert.equal(actualResponse({ ...args, method, rawUrl: blockedAction }).status, 405);
  assert.equal(actualResponse({ ...args, method: "GET", rawUrl: blockedAction }).status, 404);
  assert.equal(actualResponse({ ...args, method: "GET", rawUrl: "/activate" }).status, 404);
  assert.equal(actualResponse({ ...args, method: "GET", rawUrl: "/../site.js" }).status, 400);
  assert.equal(actualResponse({ ...args, host: "example.invalid", method: "GET", rawUrl: "/site.js" }).status, 421);
});

test("C04 actual loopback server exposes unchanged client bytes and operator-only generation changes", async () => {
  const server = await startActualClientFixture();
  try {
    const response = await fetch(server.origin + "/site.js?v=20261004-production-candidate-a80fda7", { redirect: "error" });
    assert.equal(digest(await response.text()), publicHashes["site.js"]);
    assert.equal(response.headers.get("cache-control"), "no-cache");
    const htmlResponse = await fetch(server.origin + "/institutional-alignment.html", { redirect: "error" });
    assert.equal(htmlResponse.headers.get("cache-control"), "no-store, no-cache, must-revalidate, max-age=0");
    assert.equal(server.activate("B").generation, "B");
    assert.ok(server.requests.every((request) => request.method === "GET"));
  } finally { await server.close(); }
});
