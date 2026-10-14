import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { inertFixture } from "./inert-config-transition.mjs";

export const publicBaseline = "0cc4ea8ecd6f06abaceaff3d2cd69c0b79c1cbff";
export const publicHashes = Object.freeze({
  "site.js": "31a0724a84cccede59c7851e12fcebb8bb5a2333494e29c9f4931710417232c8",
  "institutional-alignment.html": "8bdbcebd0d35809fe5518d7dc52ed59f785ec2c41d6f750d6f5c9847b8f5c72b",
  "styles.css": "04e8ad9f65dbe6ee9c345bc39497c186cb3c511816e738164617fce4e4bb39ef",
});
export const sentinel = "C04-INERT-NOT-A-GOOGLE-TOKEN";
export const blockedAction = "/c04-blocked-transport";
export const noStore = "no-store, no-cache, must-revalidate, max-age=0";
// Blueprint explicitly marks only institutional HTML/config no-store. Other
// local assets revalidate; this is a fixture policy, not a hosted-CDN claim.
export const localAssetCache = "no-cache";
export const localCsp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; worker-src 'none'";
export const digest = (source) => createHash("sha256").update(source).digest("hex");

export function actualFixture(html, generation) {
  assert.equal(digest(html), publicHashes["institutional-alignment.html"], "candidate public HTML must match its recorded hash");
  const config = inertFixture(generation);
  const reference = /institutional-rc1-config\.js(?:\?[^"']*)?/g;
  assert.equal((html.match(reference) || []).length, 1);
  const fixtureHtml = html.replace(reference, `institutional-rc1-config.js?v=${config.version}`);
  const form = fixtureHtml.match(/<form\b[\s\S]*?>/)[0];
  assert.match(form, /id="institutional-review-form"/);
  assert.match(form, /data-intake-mode="test"/);
  assert.doesNotMatch(form, /\b(?:action|method)\s*=/);
  assert.match(fixtureHtml, /<fieldset[^>]*data-test-form-guard[^>]*\bdisabled\b/);
  const scripts = [...fixtureHtml.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(scripts, [`institutional-rc1-config.js?v=${config.version}`, "site.js?v=20261013-c04-lifecycle-1"]);
  return Object.freeze({ generation, version: config.version, config: config.config, html: fixtureHtml });
}

export function restorationDisposition(state, expected) {
  const reasons = [];
  if (state.generation !== expected.generation || state.fingerprint !== expected.version) reasons.push("stale_configuration_generation");
  if (!state.guardDisabled || !state.buttonEffectiveDisabled) reasons.push("restored_controls_not_locked");
  if (state.action !== null || state.method !== null) reasons.push("restored_action_or_method_retained");
  if (!state.tokenEmpty || state.tokenReady !== null) reasons.push("restored_token_state_not_cleared");
  return { status: reasons.length ? "HOLD" : "PASS-BOUNDED", reasons };
}

// Read-only observer shared by init-script and CDP history observation. Only
// synthetic hidden state is inspected; visible institution/contact data is not.
export function observeActualClient() {
  const form = document.getElementById("institutional-review-form");
  const button = form?.querySelector("[data-fs-submit-btn]");
  const token = form?.elements.namedItem("g-recaptcha-response");
  const script = [...document.scripts].find((item) => /institutional-rc1-config\.js/.test(item.src));
  return {
    url: location.href, title: document.title, ready: document.readyState,
    generation: window.__CGS_C04_FIXTURE__?.generation,
    flags: window.__CGS_C04_FIXTURE__?.flags,
    fingerprint: script ? new URL(script.src).searchParams.get("v") : null,
    configNull: window.__CGS_INSTITUTIONAL_RC1__ === null,
    guardDisabled: form?.querySelector("[data-test-form-guard]").disabled,
    buttonDisabled: button?.disabled, buttonEffectiveDisabled: button?.matches(":disabled"),
    buttonType: button?.type, action: form?.getAttribute("action"), method: form?.getAttribute("method"),
    mode: form?.dataset.intakeMode, bound: form?.dataset.recaptchaBound, guardReady: form?.dataset.testGuardReady,
    tokenEmpty: token?.value === "", tokenLength: token?.value.length,
    tokenSentinel: token?.value === "C04-INERT-NOT-A-GOOGLE-TOKEN", tokenReady: form?.dataset.recaptchaTokenReady ?? null,
    intakeMetadata: form?.elements.namedItem("intake_mode")?.value,
    versionMetadata: form?.elements.namedItem("public_version")?.value,
    visibleFieldsEmpty: [...form?.querySelectorAll("[data-fs-field]") || []].every((field) =>
      field.type === "checkbox" ? !field.checked : field.value === ""),
    externalScripts: [...document.scripts].filter((item) => item.src && new URL(item.src).origin !== location.origin).length,
    googleApiAbsent: typeof window.grecaptcha === "undefined",
    overlay: !!document.querySelector("vite-error-overlay,nextjs-portal"),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    meaningful: document.querySelector("main")?.textContent.length > 500,
    loadedClass: document.body.classList.contains("is-loaded"),
    submitEvents: window.__C04_SUBMIT_EVENTS__ || 0,
    lifecycle: form?.dataset.intakeLifecycle,
    lifecycleStatus: form?.querySelector("[data-intake-lifecycle-status]")?.textContent,
    reloadAvailable: form?.querySelector("[data-intake-recovery]")?.hidden === false && !form?.querySelector("[data-intake-reload]")?.disabled,
  };
}

export function actualResponse({ method, rawUrl, host, expectedHost, current, resources }) {
  const headers = { "Cache-Control": /^\/institutional-(?:alignment\.html|rc1-config\.js)(?:\?|$)/.test(rawUrl) ? noStore : localAssetCache, "Content-Security-Policy": localCsp,
    "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
  const reject = (status) => ({ status, headers, body: "Local assessment request rejected\n" });
  if (host !== expectedHost) return reject(421);
  if (!["GET", "HEAD"].includes(method)) return reject(405);
  if (!/^\/[A-Za-z0-9/._-]+(?:\?v=[A-Za-z0-9_-]+)?$/.test(rawUrl) || rawUrl.includes("../")) return reject(400);
  const url = new URL(rawUrl, `http://${expectedHost}`);
  if (url.pathname === "/favicon.ico" && !url.search) return { status: 204, headers, body: "" };
  let resource;
  if (url.pathname === "/institutional-alignment.html" && !url.search) resource = { body: current.html, type: "text/html; charset=utf-8" };
  else if (url.pathname === "/institutional-rc1-config.js" &&
    (!url.search || [inertFixture("A").version, inertFixture("B").version].some((version) => url.search === `?v=${version}`))) {
    resource = { body: current.config, type: "text/javascript; charset=utf-8" };
  } else resource = resources.get(rawUrl);
  if (!resource) return reject(404);
  return { status: 200, headers: { ...headers, "Content-Type": resource.type }, body: method === "HEAD" ? "" : resource.body };
}

export async function startActualClientFixture({ scriptBlocked = false, configFault = null } = {}) {
  assert.ok([null, "missing", "malformed"].includes(configFault));
  const sources = {};
  for (const file of Object.keys(publicHashes)) {
    const source = (await readFile(new URL(`../../${file}`, import.meta.url), "utf8")).replaceAll("\r\n", "\n");
    assert.equal(digest(source), publicHashes[file], `${file} differs from approved baseline`);
    sources[file] = source;
  }
  assert.doesNotMatch(sources["styles.css"], /@import|url\(/i, "new CSS resources need a separately reviewed allowlist");
  const resources = new Map([
    ["/site.js?v=20261013-c04-lifecycle-1", { body: sources["site.js"], type: "text/javascript; charset=utf-8" }],
    ["/styles.css?v=20261004-institutional-rc1", { body: sources["styles.css"], type: "text/css; charset=utf-8" }],
    ["/c04-away.html", { body: "<!doctype html><html lang=\"en\"><head><title>C04 local away checkpoint</title></head><body><h1>Local history checkpoint</h1></body></html>", type: "text/html; charset=utf-8" }],
  ]);
  for (const [file, type] of [["favicon.svg", "image/svg+xml"], ["assets/common-ground-institutional-review-graphic-v2-archival.png", "image/png"]]) {
    resources.set(`/${file}`, { body: await readFile(new URL(`../../${file}`, import.meta.url)), type });
  }
  let current = actualFixture(sources["institutional-alignment.html"], "A");
  let origin;
  const requests = [];
  const server = createServer((request, response) => {
    const served = configFault ? { ...current, config: configFault === "missing" ? "// C04 missing configuration fixture.\n" :
      current.config.replace("Object.freeze(null)", 'Object.freeze("C04-INERT-MALFORMED-CONFIG")') } : current;
    const result = actualResponse({ method: request.method, rawUrl: request.url, host: request.headers.host,
      expectedHost: new URL(origin).host, current: served, resources });
    if (scriptBlocked) result.headers["Content-Security-Policy"] = localCsp.replace("script-src 'self'", "script-src 'none'");
    requests.push({ method: request.method, path: request.url, generation: current.generation, status: result.status });
    response.writeHead(result.status, result.headers);
    response.end(result.body);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, requests, sources, snapshot: () => current,
    activate(generation) { current = actualFixture(sources["institutional-alignment.html"], generation); return current; },
    async close() { server.closeAllConnections(); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); },
  };
}
