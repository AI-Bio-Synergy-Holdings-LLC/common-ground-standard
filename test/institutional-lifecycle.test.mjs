import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
import test from "node:test";
import { lifecycleFixture, clientSource } from "./helpers/institutional-lifecycle-vm.mjs";

const activate = (options) => {
  const fixture = lifecycleFixture(options);
  assert.equal(fixture.controller.activate(), true);
  fixture.guard.disabled = false;
  fixture.button.disabled = false;
  return fixture;
};
const assertHeld = (f) => {
  assert.equal(f.form.dataset.intakeLifecycle, "held");
  assert.ok(f.guard.disabled && f.button.disabled && f.controller.signal.aborted);
  assert.equal(f.button.type, "button");
  assert.equal(f.attrs.size, 0);
  assert.equal(f.form.dataset.recaptchaTokenReady, undefined);
  assert.equal(f.form.dataset.testGuardReady, undefined);
  assert.ok([...f.fields.values()].every((field) => field.value === ""));
  assert.ok(!f.recovery.hidden && !f.reload.disabled && /clears unsent entries/.test(f.status.textContent));
};

test("C04 controller starts locked and raw recovery control cannot submit", async () => {
  const f = lifecycleFixture();
  assert.ok(f.guard.disabled && f.button.disabled && f.recovery.hidden);
  const html = await readFile(new URL("../institutional-alignment.html", import.meta.url), "utf8");
  assert.match(html, /<div data-intake-recovery hidden>/);
  assert.match(html, /type="button" data-intake-reload disabled/);
  assert.match(html, /role="status" aria-live="polite" data-intake-lifecycle-status/);
  assert.match(html, /site\.js\?v=20261013-c04-lifecycle-1/);
});

test("C04 departure clears transport, hidden authority state and pending work synchronously", () => {
  const f = activate();
  let ran = false;
  const ticket = f.controller.ticket();
  f.controller.schedule(() => { ran = true; }, 450);
  const queued = [...f.timers.values()][0];
  f.windowEvents.get("pagehide")({ persisted: true });
  assertHeld(f);
  assert.equal(f.timers.size, 0);
  queued();
  assert.equal(ran, false);
  assert.equal(f.controller.accepts(ticket), false);
  assert.equal(f.controller.activate(), false, "same document cannot re-enable after invalidation");
});

test("C04 restored, same-generation and hidden-tab documents remain held without automatic reload", () => {
  for (const event of ["pageshow", "visibilitychange"]) {
    const f = activate();
    if (event === "pageshow") f.windowEvents.get(event)({ persisted: true });
    else { f.scope.document.visibilityState = "hidden"; f.documentEvents.get(event)(); }
    assertHeld(f);
    assert.equal(f.reloadCount(), 0);
    f.reload.click();
    assert.equal(f.reloadCount(), 1);
    assertHeld(f);
  }
  const initial = activate();
  initial.windowEvents.get("pageshow")({ persisted: false });
  assert.equal(initial.controller.accepts(), true);
});

test("C04 held submit guard stops propagation and configuration mutation invalidates current authority", () => {
  for (const mutation of [undefined, null, { mode: "CHANGED-INERT-STATE" }]) {
    const f = activate();
    f.scope.window.__CGS_INSTITUTIONAL_RC1__ = mutation;
    let prevented = false;
    let stopped = false;
    f.formEvents.get("submit")({ preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.ok(prevented && stopped);
    assertHeld(f);
  }
});

test("C04 missing or ambiguous initialization cannot enable the institution", () => {
  for (const missing of ["[data-test-form-guard]", "[data-fs-submit-btn]", "[data-intake-lifecycle-status]", "[data-intake-reload]", "[data-intake-recovery]"]) {
    assert.equal(lifecycleFixture({ missing }).controller.activate(), false);
  }
  for (const scripts of [[], [{ src: "https://foreign.invalid/institutional-rc1-config.js?v=a" }],
    [{ src: "https://example.invalid/institutional-rc1-config.js?v=a&v=b" }]]) {
    assert.equal(lifecycleFixture({ scripts }).controller.activate(), false);
  }
});

test("C04 fresh artifact check reads only public same-origin GET resources with bounded identity and no payload", async () => {
  const f = activate();
  assert.equal(await f.controller.verify(f.controller.ticket()), true);
  assert.equal(f.reads.length, 2);
  assert.ok(f.reads.every(({ url, options }) => url.startsWith("https://example.invalid/") &&
    !url.includes("integration=") && options.method === "GET" && options.cache === "no-store" &&
    options.credentials === "omit" && options.redirect === "error" && !options.body && options.signal === f.controller.signal));
  assert.equal(f.timers.size, 0);
});

test("C04 stale, missing, malformed, off-origin, unbounded and unavailable discovery all hold", async () => {
  const faults = ["new-fingerprint", "new-client", "foreign", "duplicate", "missing", "malformed", "tampered", "no-store-missing", "redirect", "oversized", "offline"];
  for (const fault of faults) {
    const f = activate();
    f.scope.window.fetch = async (url) => {
      if (fault === "offline") throw new Error("Offline fixture");
      let text = url === f.configUrl ? f.configSource : f.html;
      if (fault === "new-fingerprint") text = text.replace(f.configUrl, f.configUrl.replace(/v=.*/, "v=0000000000000000"));
      if (fault === "new-client") text = text.replace("lifecycle-1", "lifecycle-2");
      if (fault === "foreign") text = text.replace(f.configUrl, f.configUrl.replace("example.invalid", "foreign.invalid"));
      if (fault === "duplicate") text += f.html;
      if (fault === "missing") text = "";
      if (fault === "malformed") text = "window.__CGS_INSTITUTIONAL_RC1__ = arbitrary();";
      if (fault === "tampered" && url === f.configUrl) text = text.replace("OFFLINE", "CHANGED");
      if (fault === "oversized") text = "x".repeat(262145);
      const response = f.response(url, text);
      if (fault === "no-store-missing") response.headers.get = () => "public, max-age=3600";
      if (fault === "redirect") response.redirected = true;
      return response;
    };
    assert.equal(await f.controller.verify(f.controller.ticket()), false, fault);
    assertHeld(f);
  }
});

test("C04 timed-out or invalidated asynchronous discovery never revives a held document", async () => {
  for (const fault of ["timeout", "departure"]) {
    const f = activate();
    let resolve;
    f.scope.window.fetch = (url) => new Promise((done) => { resolve = () => done(f.response(url, f.html)); });
    const pending = f.controller.verify(f.controller.ticket());
    if (fault === "timeout") [...f.timers.values()][0]();
    else f.windowEvents.get("pagehide")({ persisted: true });
    assertHeld(f);
    resolve();
    assert.equal(await pending, false);
    assertHeld(f);
  }
});

test("C04 pending integration retry delays reject on invalidation without replay", async () => {
  const f = activate();
  const delayed = f.controller.delay(650);
  f.windowEvents.get("pagehide")({ persisted: true });
  await assert.rejects(delayed, /Intake held/);
  assert.equal(f.timers.size, 0);
  assertHeld(f);
});

test("C04 late synthetic result callback cannot set token state or request submission after invalidation", async () => {
  const f = activate();
  const ticket = f.controller.ticket();
  let requests = 0;
  const tokenInput = { value: "" };
  const callback = clientSource.match(/\.then\(async \(token\) => \{([^]*?)\n                \}\)/)[1];
  const fn = new Script(`(async (token) => {${callback}\n})`).runInNewContext({
    lifecycle: f.controller, ticket, tokenInput, tokenTicket: null,
    form: { dataset: {}, requestSubmit() { requests += 1; } }, handOffBusyState() { throw new Error("Late handoff"); },
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  f.windowEvents.get("pagehide")({ persisted: true });
  await fn("C04-INERT-NOT-A-GOOGLE-TOKEN");
  assert.equal(tokenInput.value, "");
  assert.equal(requests, 0);
  assertHeld(f);
});

test("C04 async guards cover integration retries and native handoff ownership without changing provider destinations", () => {
  assert.match(clientSource, /const submitIntegrationRecord = async[\s\S]*await lifecycle\.verify\(ticket\)[\s\S]*grecaptcha\.execute[\s\S]*await lifecycle\.verify\(ticket\)[\s\S]*window\.fetch\(institutionalRc1\.formEndpoint/);
  assert.match(clientSource, /signal: lifecycle\?\.signal/);
  assert.match(clientSource, /tokenTicket !== ticket \|\| !isProductionLive/);
  assert.match(clientSource, /form\.action !== institutionalProduction\.formEndpoint/);
  assert.match(clientSource, /lifecycle && submitButton\?\.disabled/);
  assert.doesNotMatch(clientSource, /localStorage|sessionStorage|sendBeacon|addEventListener\("unload"/);
});
