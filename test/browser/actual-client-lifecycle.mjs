import assert from "node:assert/strict";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { modeFlags } from "../helpers/deployment-safety.mjs";
import { startActualClientFixture, observeActualClient, restorationDisposition, publicHashes,
  publicBaseline, noStore, localAssetCache, localCsp, sentinel, blockedAction, digest } from "../helpers/actual-client-lifecycle.mjs";

// Actual candidate site.js + HTML. Null config throughout. The seeded case
// changes only inert DOM attributes/hidden sentinels, NOT runtime modes or APIs.
export async function assessActualClientLifecycle(page, { seeded = false, formScrolled = false,
  qualifyRemediation = false, startGeneration = "A", screenshotDirectory } = {}) {
  const server = await startActualClientFixture();
  assert.ok(["A", "B"].includes(startGeneration));
  server.activate(startGeneration);
  const targetGeneration = startGeneration === "A" ? "B" : "A";
  const requests = [];
  const nativeResponses = [];
  const errors = [];
  const pending = [];
  const byteChecks = [];
  const historyReasons = [];
  let phase = "setup";
  let cdp;
  let browser;
  const responseListener = (response) => {
    const observedPhase = phase;
    if (phase === "actual-client-explicit-reload") return;
    const pathname = new URL(response.url()).pathname;
    if (!["/site.js", "/institutional-alignment.html", "/institutional-rc1-config.js"].includes(pathname)) return;
    const expected = server.snapshot();
    pending.push((async () => {
      const bytes = (await response.body()).toString("utf8");
      const headers = await response.allHeaders();
      assert.equal(response.status(), 200);
      assert.equal(headers["cache-control"], pathname === "/site.js" ? localAssetCache : noStore);
      assert.equal(headers["content-security-policy"], localCsp);
      const expectedHash = pathname === "/site.js" ? publicHashes["site.js"] : digest(pathname === "/institutional-alignment.html" ? expected.html : expected.config);
      assert.equal(digest(bytes), expectedHash);
      byteChecks.push({ phase: observedPhase, path: pathname, sha256: expectedHash });
    })().catch((error) => { errors.push(error.message); }));
  };
  const pageError = (error) => errors.push(String(error));
  const consoleError = (message) => { if (["warning", "error"].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); };
  const boundary = () => {
    assert.ok(requests.every((request) => new URL(request.url).origin === server.origin && ["GET", "HEAD"].includes(request.method)), "external/transmitting request invalidates assessment");
    assert.ok(server.requests.every((request) => ["GET", "HEAD"].includes(request.method) && [200, 204].includes(request.status)), "unapproved local request invalidates assessment");
    assert.equal(errors.length, 0, errors.join("; "));
  };
  try {
    assert.equal(page.url(), "about:blank");
    assert.equal(page.context().pages().length, 1);
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    cdp.on("Page.backForwardCacheNotUsed", (event) => historyReasons.push({ phase,
      reasons: event.notRestoredExplanations, tree: event.notRestoredExplanationsTree }));
    browser = await cdp.send("Browser.getVersion");
    const commandLine = await cdp.send("Browser.getBrowserCommandLine");
    assert.equal(commandLine.arguments.filter((argument) => /cache|back.forward/i.test(argument)).length, 0);
    cdp.on("Network.requestWillBeSent", (event) => requests.push({ phase, url: event.request.url, method: event.request.method }));
    cdp.on("Network.responseReceived", (event) => nativeResponses.push({ phase, url: event.response.url,
      requestId: event.requestId, headers: event.response.headers,
      status: event.response.status, fromDiskCache: event.response.fromDiskCache === true,
      fromServiceWorker: event.response.fromServiceWorker === true, fromPrefetchCache: event.response.fromPrefetchCache === true }));
    page.on("response", responseListener);
    page.on("pageerror", pageError);
    page.on("console", consoleError);
    phase = "actual-client-A-load";
    await page.goto(server.origin + "/institutional-alignment.html", { waitUntil: "load" });
    if (formScrolled) await page.locator("#institutional-review-form").scrollIntoViewIfNeeded();
    await Promise.all(pending);
    assert.deepEqual(byteChecks.filter((check) => check.phase === phase).map((check) => check.path).sort(),
      ["/institutional-alignment.html", "/institutional-rc1-config.js", "/site.js"].sort(), "actual initial resource byte observations missing");
    const initial = await page.evaluate(observeActualClient);
    assert.equal(initial.title, "Institutional Alignment Pathway | Common Ground Standard");
    assert.equal(initial.generation, startGeneration);
    assert.equal(initial.configNull, true);
    assert.deepEqual(Object.keys(initial.flags).sort(), [...modeFlags].sort());
    assert.ok(Object.values(initial.flags).every((flag) => flag === false));
    assert.equal(initial.action, null);
    assert.equal(initial.method, null);
    assert.equal(initial.mode, "test");
    assert.equal(initial.bound, "true");
    assert.equal(initial.guardReady, "true");
    assert.equal(initial.guardDisabled, false);
    assert.equal(initial.tokenEmpty, true);
    assert.ok(initial.meaningful && !initial.overlay && !initial.overflow && initial.visibleFieldsEmpty && initial.googleApiAbsent);
    boundary();
    // Observe only after the unchanged client has initialized. No injected
    // new-document script changes its load lifecycle. A fresh history load will
    // not contain this observer, and is distinguished by native cache reasons.
    await page.evaluate(`(() => {
      const observer = (${observeActualClient.toString()});
      window.__C04_LIFECYCLE_EVENTS__ = [];
      window.__C04_SUBMIT_EVENTS__ = 0;
      window.addEventListener("submit", () => { window.__C04_SUBMIT_EVENTS__ += 1; }, true);
      for (const type of ["pagehide", "pageshow"]) window.addEventListener(type, (event) => {
        queueMicrotask(() => window.__C04_LIFECYCLE_EVENTS__.push({ type, persisted: event.persisted, state: observer() }));
      });
    })();`);
    if (seeded) await page.evaluate(({ sentinelValue, actionPath }) => {
      const form = document.getElementById("institutional-review-form");
      form.setAttribute("action", actionPath);
      form.setAttribute("method", "post");
      form.dataset.intakeMode = "c04-inert-restored-seed";
      form.dataset.recaptchaTokenReady = "c04-inert-sentinel";
      form.elements.namedItem("intake_mode").value = "C04-INERT-NOT-LIVE";
      form.elements.namedItem("public_version").value = "C04-INERT-STATE-SEED-A";
      form.elements.namedItem("g-recaptcha-response").value = sentinelValue;
    }, { sentinelValue: sentinel, actionPath: blockedAction });
    const beforeDeparture = await page.evaluate(observeActualClient);
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "actual-client-before.png") });
    phase = "actual-client-away";
    await page.goto(server.origin + "/c04-away.html", { waitUntil: "load" });
    const expected = server.activate(targetGeneration);
    phase = "actual-client-native-history-return";
    const history = await cdp.send("Page.getNavigationHistory");
    const previous = history.entries[history.currentIndex - 1];
    assert.equal(previous.url, server.origin + "/institutional-alignment.html");
    await cdp.send("Page.navigateToHistoryEntry", { entryId: previous.id });
    const expression = `(() => ({ state: (${observeActualClient.toString()})(), events: window.__C04_LIFECYCLE_EVENTS__ || [] }))()`;
    let restored;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
      restored = result.result.value;
      if (restored?.state.url === previous.url && restored.state.ready === "complete" &&
        (restored.events.some((event) => event.type === "pageshow" && event.persisted) ||
          (restored.state.generation === targetGeneration && historyReasons.length))) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(restored?.state.url, previous.url, "restored observation unavailable");
    const persisted = restored.events.some((event) => event.type === "pageshow" && event.persisted);
    assert.ok(persisted || (restored.state.generation === targetGeneration && historyReasons.length),
      "neither restored nor fresh history lifecycle observed; assessment incomplete");
    await Promise.all(pending);
    assert.equal(restored.state.configNull, true);
    assert.ok(Object.values(restored.state.flags).every((flag) => flag === false));
    assert.equal(restored.state.visibleFieldsEmpty, true);
    assert.equal(restored.state.externalScripts, 0);
    assert.equal(restored.state.googleApiAbsent, true);
    assert.equal(restored.state.submitEvents, 0);
    boundary();
    if (screenshotDirectory) {
      const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(screenshotDirectory, "actual-client-restored.png"), Buffer.from(screenshot.data, "base64"));
    }
    const disposition = persisted ? restorationDisposition(restored.state, expected) :
      { status: "HOLD", reasons: ["native_bfcache_not_observed"] };
    const historyHtmlConfigResponses = nativeResponses.filter((response) => response.phase === phase &&
      ["/institutional-alignment.html", "/institutional-rc1-config.js"].includes(new URL(response.url).pathname)).length;
    let recovered;
    if (qualifyRemediation && persisted) {
      const assertHeld = (state) => {
        assert.ok(state.guardDisabled && state.buttonEffectiveDisabled && state.tokenEmpty);
        assert.equal(state.tokenReady, null);
        assert.equal(state.action, null);
        assert.equal(state.method, null);
        assert.equal(state.lifecycle, "held");
        assert.equal(state.mode, "lifecycle-held");
        assert.equal(state.intakeMetadata, "");
        assert.equal(state.versionMetadata, "");
        assert.ok(state.reloadAvailable && /Reloading clears unsent entries/.test(state.lifecycleStatus));
      };
      assertHeld(restored.state);
      const departure = restored.events.find((event) => event.type === "pagehide");
      assert.ok(departure?.persisted, "departure lock was not observed natively");
      assertHeld(departure.state);
      assert.equal(restored.state.generation, startGeneration);
      assert.equal(historyHtmlConfigResponses, 0);
      // Keyboard recovery is explicit, never automatic resubmission. Keep using
      // native CDP after BFCache; Playwright Page history/reload is unsupported.
      phase = "actual-client-explicit-reload";
      await cdp.send("Runtime.evaluate", { expression: "document.querySelector('[data-intake-reload]').focus()" });
      if (screenshotDirectory) {
        const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
        await writeFile(path.join(screenshotDirectory, "actual-client-held-recovery.png"), Buffer.from(screenshot.data, "base64"));
      }
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await cdp.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      const reloadDeadline = Date.now() + 5000;
      while (Date.now() < reloadDeadline) {
        const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
        recovered = result.result.value?.state;
        if (recovered?.ready === "complete" && recovered.generation === targetGeneration && recovered.lifecycle === "ready") break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(recovered?.generation, targetGeneration);
      assert.equal(recovered.fingerprint, expected.version);
      assert.equal(recovered.lifecycle, "ready");
      assert.equal(recovered.mode, "test");
      assert.equal(recovered.action, null);
      assert.equal(recovered.method, null);
      assert.ok(recovered.tokenEmpty && recovered.visibleFieldsEmpty && recovered.googleApiAbsent &&
        !recovered.guardDisabled && !recovered.reloadAvailable && !recovered.overflow && !recovered.overlay);
      assert.ok(Object.values(recovered.flags).every((flag) => flag === false));
      const fresh = nativeResponses.filter((response) => response.phase === phase &&
        ["/institutional-alignment.html", "/institutional-rc1-config.js", "/site.js"].includes(new URL(response.url).pathname));
      assert.equal(fresh.length, 3, "current HTML/config/client must be fetched after explicit recovery");
      for (const response of fresh) {
        assert.equal(response.status, 200);
        assert.ok(!response.fromDiskCache && !response.fromServiceWorker && !response.fromPrefetchCache);
        const pathname = new URL(response.url).pathname;
        const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]));
        assert.equal(headers["cache-control"], pathname === "/site.js" ? localAssetCache : noStore);
        assert.equal(headers["content-security-policy"], localCsp);
        const body = await cdp.send("Network.getResponseBody", { requestId: response.requestId });
        const bytes = body.base64Encoded ? Buffer.from(body.body, "base64").toString("utf8") : body.body;
        const expectedHash = pathname === "/site.js" ? publicHashes["site.js"] : digest(pathname === "/institutional-alignment.html" ? expected.html : expected.config);
        assert.equal(digest(bytes), expectedHash);
        byteChecks.push({ phase, path: pathname, sha256: expectedHash });
      }
      boundary();
      if (screenshotDirectory) {
        const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
        await writeFile(path.join(screenshotDirectory, "actual-client-recovered.png"), Buffer.from(screenshot.data, "base64"));
      }
    }
    return { assessmentComplete: true, lifecycleQualification: recovered ? "PASS-BOUNDED" : disposition.status,
      historyFreshnessWhileHeld: disposition, restorationLock: recovered ? "PASS-BOUNDED" : "NOT-QUALIFIED",
      recovery: recovered, fullC04Status: "HOLD", startGeneration, targetGeneration, reasons: recovered ? [] : disposition.reasons,
      seeded, formScrolled, browser, publicBaseline, publicHashes, initial, beforeDeparture, restored,
      persisted, historyReasons,
      expectedGeneration: expected.generation, expectedFingerprint: expected.version,
      nativeHistoryResponses: nativeResponses.filter((response) => response.phase === "actual-client-native-history-return").length,
      nativeHistoryHtmlConfigResponses: historyHtmlConfigResponses,
      requests, serverRequests: server.requests, nativeResponses, byteChecks, errors,
      externalOrTransmittingRequests: 0,
      limitations: "Actual candidate client executed in local null-config mode only. Seeds are not live-mode execution, tokens or provider behavior. Local lock + explicit keyboard reload are bounded evidence, not full C04/hosted/old-client/activation clearance. HTML/config use declared Blueprint no-store policy; local other assets revalidate, not a CDN claim. Strict local CSP; no interception or cache disabling. CDP is used exclusively after BFCache because Playwright Page history is unsupported." };
  } catch (error) {
    error.assessmentEvidence = { assessmentComplete: false, phase, message: error.message, seeded,
      browser, requests, serverRequests: server.requests, errors, historyReasons, formScrolled };
    throw error;
  } finally {
    page.off("response", responseListener);
    page.off("pageerror", pageError);
    page.off("console", consoleError);
    try { if (cdp) await cdp.detach(); } finally { await server.close(); }
  }
}
