import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { assertFreshConfig, modeFlags } from "../helpers/deployment-safety.mjs";
import { startInertFixtureServer, fixturePath, noStore, fixtureCsp, historyDisposition } from "../helpers/inert-config-transition.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Public Playwright Page API, Chromium CDP observations only. No page routing,
// cache disabling, query cache-busters, provider access or real site transport.
// An unexpected assertion rejects the run; it cannot issue a release PASS.
export async function qualifyInertTransition(page, { screenshotDirectory } = {}) {
  const fixture = await startInertFixtureServer();
  const context = page.context();
  let phase = "setup";
  const requests = [];
  const responses = [];
  const nativeResponses = [];
  const nativeRequests = [];
  const cacheEvents = [];
  const historyReasons = [];
  const errors = [];
  const pending = [];
  const states = [];
  const negativeControls = [];
  let cdp;
  let version;
  let cacheRelatedLaunchArguments;
  const requestListener = (request) => requests.push({ phase, url: request.url(), method: request.method() });
  const errorListener = (error) => errors.push(String(error));
  const consoleListener = (message) => {
    if (["warning", "error"].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`);
  };
  const responseListener = (response) => {
    const responsePhase = phase;
    if (![fixturePath, "/institutional-rc1-config.js"].includes(new URL(response.url()).pathname)) return;
    pending.push((async () => {
      responses.push({ phase: responsePhase, url: response.url(), status: response.status(),
        headers: await response.allHeaders(), body: (await response.body()).toString("utf8") });
    })());
  };
  const drain = async () => { for (let index = 0; index < pending.length; index++) await pending[index]; };
  const assertRequestBoundary = () => {
    assert.equal(requests.filter((request) => new URL(request.url).origin !== fixture.origin ||
      !["GET", "HEAD"].includes(request.method)).length, 0, "unexpected external or transmitting request");
    assert.equal(nativeRequests.filter((request) => new URL(request.url).origin !== fixture.origin ||
      !["GET", "HEAD"].includes(request.method)).length, 0, "unexpected native external or transmitting request");
    assert.equal(errors.length, 0, `browser errors: ${errors.join("; ")}`);
  };
  const observe = async (label, expected, { requireNetwork = true } = {}) => {
    await drain();
    assert.equal(page.url(), fixture.origin + fixturePath);
    assert.equal(await page.title(), "C-04 inert configuration fixture");
    const state = await page.evaluate(() => ({
      generation: document.getElementById("generation")?.textContent,
      marker: window.__CGS_C04_FIXTURE__, config: window.__CGS_INSTITUTIONAL_RC1__,
      scriptUrl: document.scripts[0]?.src,
      forms: document.forms.length,
      externalScripts: [...document.scripts].filter((script) => new URL(script.src).origin !== location.origin).length,
      overlay: !!document.querySelector("vite-error-overlay,nextjs-portal"),
      content: document.querySelector("main")?.textContent,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      historyRestored: window.__CGS_C04_HISTORY_RESTORED__ === true,
      navigationType: performance.getEntriesByType("navigation")[0]?.type,
    }));
    assert.equal(state.generation, expected.generation);
    assert.equal(state.marker.generation, expected.generation);
    assert.equal(state.config, null);
    assert.deepEqual(Object.keys(state.marker.flags).sort(), [...modeFlags].sort());
    assert.ok(Object.values(state.marker.flags).every((flag) => flag === false));
    assert.equal(state.forms, 0);
    assert.equal(state.externalScripts, 0);
    assert.equal(state.overlay, false);
    assert.equal(state.overflow, false);
    assert.match(state.content, /Not institutional intake/);
    assert.equal(state.scriptUrl, `${fixture.origin}/institutional-rc1-config.js?v=${expected.version}`);
    const pair = responses.filter((response) => response.phase === label);
    if (requireNetwork || pair.length) {
      assert.equal(pair.length, 2, "expected one current HTML and one config response");
      const html = pair.find((response) => new URL(response.url).pathname === fixturePath);
      const config = pair.find((response) => new URL(response.url).pathname === "/institutional-rc1-config.js");
      assertFreshConfig(html.body, config.body, expected);
      for (const response of pair) {
        assert.equal(response.status, 200);
        assert.equal(response.headers["cache-control"], noStore);
        assert.equal(response.headers["content-security-policy"], fixtureCsp);
        assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
        assert.equal(response.headers["x-content-type-options"], "nosniff");
      }
      const native = nativeResponses.filter((response) => response.phase === label);
      assert.equal(native.length, 2, "native response observations missing");
      assert.ok(native.every((response) => !response.fromDiskCache && !response.fromServiceWorker && !response.fromPrefetchCache));
    }
    assertRequestBoundary();
    const result = { phase: label, ...state, fingerprint: expected.version,
      htmlSha256: sha256(expected.html), configSha256: sha256(expected.config),
      responseCount: pair.length, nativeFreshResponses: pair.length === 2 };
    states.push(result);
    return result;
  };
  try {
    assert.equal(page.url(), "about:blank", "use a fresh unauthenticated about:blank page");
    assert.equal(context.pages().length, 1, "do not attach to a user browser session");
    cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    version = await cdp.send("Browser.getVersion");
    const commandLine = await cdp.send("Browser.getBrowserCommandLine");
    cacheRelatedLaunchArguments = commandLine.arguments.filter((argument) => /cache|back.forward/i.test(argument));
    assert.equal(cacheRelatedLaunchArguments.length, 0, "cache-related launch overrides invalidate this native fixture probe");
    cdp.on("Network.requestWillBeSent", (event) => nativeRequests.push({ phase,
      url: event.request.url, method: event.request.method }));
    cdp.on("Network.responseReceived", (event) => {
      if (![fixturePath, "/institutional-rc1-config.js"].includes(new URL(event.response.url).pathname)) return;
      const response = event.response;
      nativeResponses.push({ phase, url: response.url, status: response.status,
        fromDiskCache: response.fromDiskCache === true, fromServiceWorker: response.fromServiceWorker === true,
        fromPrefetchCache: response.fromPrefetchCache === true });
    });
    cdp.on("Network.requestServedFromCache", (event) => cacheEvents.push({ phase, requestId: event.requestId }));
    cdp.on("Page.backForwardCacheNotUsed", (event) => historyReasons.push({ phase, reasons: event.notRestoredExplanations }));
    page.on("request", requestListener);
    page.on("response", responseListener);
    page.on("pageerror", errorListener);
    page.on("console", consoleListener);

    phase = "initial-A";
    await page.goto(fixture.origin + fixturePath, { waitUntil: "load" });
    await observe(phase, fixture.snapshot());
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "c04-inert-A.png") });

    fixture.activate("B");
    phase = "retained-tab-reload-B";
    await page.reload({ waitUntil: "load" });
    await observe(phase, fixture.snapshot());
    if (screenshotDirectory) await page.screenshot({ path: path.join(screenshotDirectory, "c04-inert-B.png") });
    phase = "repeat-reload-B";
    await page.reload({ waitUntil: "load" });
    await observe(phase, fixture.snapshot());

    fixture.activate("A");
    phase = "rollback-repeat-reload-A";
    await page.reload({ waitUntil: "load" });
    await observe(phase, fixture.snapshot());

    for (const fault of ["stale-html", "stale-config"]) {
      fixture.activate("B", fault);
      phase = `negative-control-${fault}`;
      await page.reload({ waitUntil: "load" });
      await drain();
      const pair = responses.filter((response) => response.phase === phase);
      assert.equal(pair.length, 2);
      const html = pair.find((response) => new URL(response.url).pathname === fixturePath);
      const config = pair.find((response) => new URL(response.url).pathname === "/institutional-rc1-config.js");
      assert.throws(() => assertFreshConfig(html.body, config.body, fixture.snapshot()),
        fault === "stale-html" ? /HTML must reference the current artifact/ : /response bytes must match the requested fingerprint/);
      assertRequestBoundary();
      negativeControls.push({ fault, staleResponseDetected: true });
    }
    fixture.activate("A");
    phase = "final-inert-recovery-A";
    await page.reload({ waitUntil: "load" });
    await observe(phase, fixture.snapshot());
    assert.notEqual(states[0].fingerprint, states[1].fingerprint);
    assert.equal(states[0].fingerprint, states.at(-1).fingerprint);

    // Playwright documents that page.goBack() does not support BFCache. Keep
    // the final native-history probe separate and use Chromium's public CDP
    // history/read-only DOM APIs. Do not use this desynchronized Page again.
    phase = "navigate-away";
    await page.getByRole("link", { name: "Navigate away", exact: true }).click();
    await page.waitForURL(fixture.origin + "/away.html");
    assert.equal(await page.title(), "C-04 away fixture");
    const expectedHistory = fixture.activate("B");
    phase = "native-history-back-after-change-B";
    const history = await cdp.send("Page.getNavigationHistory");
    const previous = history.entries[history.currentIndex - 1];
    assert.equal(previous.url, fixture.origin + fixturePath);
    await cdp.send("Page.navigateToHistoryEntry", { entryId: previous.id });
    let historyObservation;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = await cdp.send("Runtime.evaluate", { returnByValue: true, expression: `(() => ({
        url: location.href, ready: document.readyState, generation: window.__CGS_C04_FIXTURE__?.generation,
        flags: window.__CGS_C04_FIXTURE__?.flags, config: window.__CGS_INSTITUTIONAL_RC1__,
        fingerprint: new URL(document.scripts[0]?.src || location.href).searchParams.get('v'),
        forms: document.forms.length, historyRestored: window.__CGS_C04_HISTORY_RESTORED__ === true
      }))()` });
      historyObservation = result.result.value;
      if (historyObservation?.url === fixture.origin + fixturePath && historyObservation.ready === "complete" &&
          historyObservation.generation) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(historyObservation?.url, fixture.origin + fixturePath, "native history observation unavailable");
    assert.equal(historyObservation.config, null);
    assert.equal(historyObservation.forms, 0);
    assert.deepEqual(Object.keys(historyObservation.flags).sort(), [...modeFlags].sort());
    assert.ok(Object.values(historyObservation.flags).every((flag) => flag === false));
    // A stale BFCache restoration is a real HOLD, never converted to a PASS by
    // reloading or disabling BFCache. Capture it before closing the context.
    const historyResult = { ...historyDisposition(historyObservation, expectedHistory), observation: historyObservation,
      expectedGeneration: expectedHistory.generation, expectedFingerprint: expectedHistory.version,
      nativeResponseCount: nativeResponses.filter((response) => response.phase === phase).length };
    if (screenshotDirectory) {
      const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(screenshotDirectory, "c04-native-history.png"), Buffer.from(screenshot.data, "base64"));
    }
    assertRequestBoundary();
    assert.ok(fixture.requests.every((request) => ["GET", "HEAD"].includes(request.method) && [200, 204].includes(request.status)));
    return { pass: historyResult.fresh, reloadQualification: "PASS-BOUNDED", historyQualification: historyResult,
      scope: "Local Chromium inert-fixture cache qualification only",
      browser: version, cacheRelatedLaunchArguments, origin: fixture.origin, states, negativeControls, nativeResponses, cacheEvents, historyReasons,
      totalBrowserRequests: requests.length, nativeRequests, serverRequests: fixture.requests,
      externalOrTransmittingRequests: 0, errors,
      limitation: "Not hosted CDN, actual institutional client, verification-to-live, token/receipt, recipient-mailbox, score, R-017 disposition or production clearance. No routing/cache disabling; Playwright does not support BFCache navigation, so the final CDP history probe is separately reported and no subsequent Page interaction is used." };
  } catch (error) {
    error.qualificationEvidence = { pass: false, phase, message: error.message, browser: version,
      cacheRelatedLaunchArguments, origin: fixture.origin, states, negativeControls, nativeResponses,
      cacheEvents, historyReasons, requests, nativeRequests, serverRequests: fixture.requests, errors };
    throw error;
  } finally {
    page.off("request", requestListener);
    page.off("response", responseListener);
    page.off("pageerror", errorListener);
    page.off("console", consoleListener);
    try { if (cdp) await cdp.detach(); }
    finally { await fixture.close(); }
  }
}
