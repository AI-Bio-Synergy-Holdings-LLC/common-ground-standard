import assert from "node:assert/strict";
import path from "node:path";
import { startActualClientFixture, observeActualClient, localCsp } from "../helpers/actual-client-lifecycle.mjs";

// Direct loopback checks, not intercepted requests or native history proof.
export async function smokeInstitutionalLifecycle(page, { mode, screenshotDirectory }) {
  assert.ok(["normal", "javascript-disabled", "script-blocked", "config-missing", "config-malformed"].includes(mode));
  const server = await startActualClientFixture({ scriptBlocked: mode === "script-blocked",
    configFault: mode === "config-missing" ? "missing" : mode === "config-malformed" ? "malformed" : null });
  const requests = [];
  const errors = [];
  const request = (item) => requests.push({ url: item.url(), method: item.method() });
  const error = (item) => errors.push(String(item));
  const console = (item) => { if (["error", "warning"].includes(item.type())) errors.push(item.text()); };
  page.on("request", request);
  page.on("pageerror", error);
  page.on("console", console);
  try {
    assert.equal(page.url(), "about:blank");
    const response = await page.goto(server.origin + "/institutional-alignment.html", { waitUntil: "load" });
    const headers = await response.allHeaders();
    assert.equal(headers["x-robots-tag"], "noindex, nofollow");
    assert.equal(headers["content-security-policy"], mode === "script-blocked" ? localCsp.replace("script-src 'self'", "script-src 'none'") : localCsp);
    const state = await page.evaluate(observeActualClient);
    assert.equal(state.title, "Institutional Alignment Pathway | Common Ground Standard");
    assert.ok(state.meaningful && !state.overflow && !state.overlay && state.visibleFieldsEmpty && state.googleApiAbsent);
    assert.equal(state.action, null);
    assert.equal(state.method, null);
    assert.equal(state.externalScripts, 0);
    assert.equal(state.tokenEmpty, true);
    if (mode === "normal") {
      assert.equal(state.lifecycle, "ready");
      assert.equal(state.guardDisabled, false);
      assert.equal(state.reloadAvailable, false);
      if (page.viewportSize().width < 681) {
        const menu = page.getByRole("button", { name: "Menu", exact: true });
        await menu.click();
        assert.equal(await menu.getAttribute("aria-expanded"), "true");
        await menu.press("Escape");
        assert.equal(await menu.getAttribute("aria-expanded"), "false");
      }
    } else {
      assert.ok(state.guardDisabled && state.buttonEffectiveDisabled);
      assert.equal(state.buttonType, "button");
      if (mode.startsWith("config-")) {
        assert.equal(state.lifecycle, "held");
        assert.equal(state.reloadAvailable, true);
      } else {
        assert.equal(state.bound, undefined);
        assert.equal(state.reloadAvailable, false);
      }
    }
    if (mode === "script-blocked") {
      assert.equal(errors.length, 2, "only the two expected CSP-blocked scripts may report errors");
      assert.ok(errors.every((message) => /script-src 'none'/.test(message) && /institutional-rc1-config\.js|site\.js/.test(message)));
    } else assert.equal(errors.length, 0, errors.join("; "));
    assert.ok(requests.every((item) => new URL(item.url).origin === server.origin && ["GET", "HEAD"].includes(item.method)));
    await page.locator("#institutional-review-form").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDirectory, "intake-smoke.png") });
    return { pass: true, mode, state, headers, requests, expectedCspErrors: mode === "script-blocked" ? errors : [],
      externalOrTransmittingRequests: 0, serverRequests: server.requests,
      limitation: "Actual candidate local null-config/raw HTML only; no provider, token, receipt or native cache conclusion." };
  } finally {
    page.off("request", request); page.off("pageerror", error); page.off("console", console);
    await server.close();
  }
}
