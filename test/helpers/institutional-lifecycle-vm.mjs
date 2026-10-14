import { readFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { Script } from "node:vm";

export const clientSource = await readFile(new URL("../../site.js", import.meta.url), "utf8");
const source = clientSource.slice(clientSource.indexOf("  const createInstitutionalLifecycle ="),
  clientSource.indexOf("  // End institutional lifecycle controller."));

// Dependency-free offline execution of the exact public controller. No provider
// API, HTTP call, real institution fields, receipt or token issuance is present.
export function lifecycleFixture({ config = { mode: "OFFLINE-NOT-AN-INTAKE-MODE" }, scripts, missing } = {}) {
  const origin = "https://example.invalid";
  const configSource = `window.__CGS_INSTITUTIONAL_RC1__ = Object.freeze(${JSON.stringify(config)});\n`;
  const fingerprint = createHash("sha256").update(configSource).digest("hex").slice(0, 16);
  const configUrl = `${origin}/institutional-rc1-config.js?v=${fingerprint}`;
  const clientUrl = `${origin}/site.js?v=20261013-c04-lifecycle-1`;
  const html = `<script src="${configUrl}"></script><script src="${clientUrl}"></script>`;
  const windowEvents = new Map();
  const documentEvents = new Map();
  const formEvents = new Map();
  const timers = new Map();
  const reads = [];
  let timerId = 0;
  let reloads = 0;
  class Input { constructor() { this.value = "C04-INERT-STATE"; } }
  const fields = new Map(["g-recaptcha-response", "intake_mode", "public_version", "intake_owner", "source_page", "subject"].map((name) => [name, new Input()]));
  const guard = { disabled: false };
  const button = { disabled: false, type: "submit", removeAttribute() {} };
  const status = { textContent: "" };
  const recovery = { hidden: true };
  const reload = { disabled: true, addEventListener(type, callback) { this[type] = callback; } };
  const notice = { textContent: "" };
  const attrs = new Map([["action", "/c04-blocked-transport"], ["method", "post"]]);
  const form = { dataset: { recaptchaTokenReady: "C04-INERT-STATE", testGuardReady: "true", recaptchaAction: "C04-INERT-STATE" },
    querySelector(selector) { if (selector === missing) return null; return ({ "[data-test-form-guard]": guard,
      "[data-fs-submit-btn]": button, "[data-intake-lifecycle-status]": status,
      "[data-intake-reload]": reload, "[data-intake-recovery]": recovery })[selector]; },
    parentElement: { querySelector() { return notice; } }, elements: { namedItem(name) { return fields.get(name); } },
    removeAttribute(name) { attrs.delete(name); }, addEventListener(type, callback) { formEvents.set(type, callback); } };
  const response = (url, text) => ({ ok: true, redirected: false, url,
    headers: { get() { return "no-store, no-cache, must-revalidate, max-age=0"; } }, async text() { return text; } });
  const scope = { form, URL, AbortController, HTMLInputElement: Input, TextEncoder, Uint8Array, JSON,
    window: { __CGS_INSTITUTIONAL_RC1__: config, crypto: webcrypto,
      location: { origin, href: origin + "/institutional-alignment.html?integration=C04-INERT-NOT-AUTHORIZATION", pathname: "/institutional-alignment.html", reload() { reloads += 1; } },
      setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
      addEventListener(type, callback) { windowEvents.set(type, callback); },
      async fetch(url, options) { reads.push({ url, options }); return response(url, url === configUrl ? configSource : html); } },
    document: { scripts: scripts || [{ src: configUrl }, { src: clientUrl }], visibilityState: "visible",
      addEventListener(type, callback) { documentEvents.set(type, callback); } } };
  const controller = new Script(source + "\ncreateInstitutionalLifecycle(form);").runInNewContext(scope,
    { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { controller, scope, form, guard, button, status, recovery, reload, notice, fields, attrs,
    reads, timers, windowEvents, documentEvents, formEvents, configUrl, configSource, html, response,
    reloadCount: () => reloads };
}
