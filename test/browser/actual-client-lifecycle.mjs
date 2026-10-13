import assert from "node:assert/strict";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { modeFlags } from "../helpers/deployment-safety.mjs";
import { startActualClientFixture, observeActualClient, restorationDisposition, publicHashes,
  publicBaseline, noStore, localAssetCache, localCsp, sentinel, blockedAction, digest } from "../helpers/actual-client-lifecycle.mjs";

// Actual unchanged site.js + HTML. Null config throughout. The seeded case
// changes only inert DOM attributes/hidden sentinels, NOT runtime modes or APIs.
export async function assessActualClientLifecycle(page, { seeded = false, formScrolled = false, screenshotDirectory } = {}) {
  const server = await startActualClientFixture();
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
    assert.equal(initial.generation, "A");
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
    const expected = server.activate("B");
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
          (restored.state.generation === "B" && historyReasons.length))) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(restored?.state.url, previous.url, "restored observation unavailable");
    const persisted = restored.events.some((event) => event.type === "pageshow" && event.persisted);
    assert.ok(persisted || (restored.state.generation === "B" && historyReasons.length),
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
    return { assessmentComplete: true, lifecycleQualification: disposition.status, reasons: disposition.reasons,
      seeded, formScrolled, browser, publicBaseline, publicHashes, initial, beforeDeparture, restored,
      persisted, historyReasons,
      expectedGeneration: expected.generation, expectedFingerprint: expected.version,
      nativeHistoryResponses: nativeResponses.filter((response) => response.phase === phase).length,
      nativeHistoryHtmlConfigResponses: nativeResponses.filter((response) => response.phase === phase &&
        ["/institutional-alignment.html", "/institutional-rc1-config.js"].includes(new URL(response.url).pathname)).length,
      requests, serverRequests: server.requests, nativeResponses, byteChecks, errors,
      externalOrTransmittingRequests: 0,
      limitations: "Actual unchanged client executed in local null-config mode only. Seeded DOM is not live-mode execution, a Google token or provider behavior. No submission or current production defect/activation conclusion. HTML/config use declared Blueprint no-store policy; other local assets use no-cache, not a hosted-CDN claim. Local CSP is stricter than hosted CSP; no request interception/cache disabling. Final CDP BFCache probe is separate from unsupported Playwright history navigation." };
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
