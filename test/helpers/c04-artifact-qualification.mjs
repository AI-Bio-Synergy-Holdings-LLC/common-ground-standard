import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { modeFlags } from "./deployment-safety.mjs";

export const publicClientHash = "f025d109ffeab27f68bdba45578e9cdb930eb6c6a9e1154ba00cb386b3176471";
export const digest = (source) => createHash("sha256").update(source).digest("hex");
export const faults = Object.freeze(["none", "generation-change", "client-change", "foreign-reference",
  "duplicate-reference", "missing-reference", "stale-config", "malformed-config", "tampered-config",
  "oversized-html", "oversized-config", "cache-header", "redirect", "http-error", "hold-html", "hold-config", "hold-body"]);
export const contract = Object.freeze({ caseDeadlineMs: 12000, requestDeadlineMs: 7000,
  controllerTimeoutMs: 5000, casesPerViewport: 26, fullC04: "HOLD", risks: ["R-016 OPEN", "R-017 OPEN"] });

export function extractController(source) {
  assert.equal(digest(source), publicClientHash, "requalify the package after any public client change");
  const start = source.indexOf("  const createInstitutionalLifecycle =");
  const end = source.indexOf("  // End institutional lifecycle controller.", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

// Component qualification only: the exact controller is extracted, not copied
// or modified. No public mode parser, provider loader or transport is loaded.
export async function artifacts() {
  const source = (await readFile(new URL("../../site.js", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const controller = extractController(source);
  const config = (generation) => ({ mode: "OFFLINE-NOT-AN-INTAKE-MODE", generation,
    ...Object.fromEntries(modeFlags.map((flag) => [flag, false])) });
  const configs = Object.fromEntries(["A", "B"].map((generation) => [generation,
    `window.__CGS_INSTITUTIONAL_RC1__ = Object.freeze(${JSON.stringify(config(generation))});\n`]));
  const client = `(() => {\n${controller}
    const form = document.querySelector("form");
    const lifecycle = createInstitutionalLifecycle(form);
    let completed = null;
    let callbacks = 0;
    let events = [];
    let visibilityEvidence = [];
    document.addEventListener("visibilitychange", (event) => {
      events.push(document.visibilityState);
      visibilityEvidence.push({ state: document.visibilityState, trusted: event.isTrusted });
    });
    window.addEventListener("pagehide", (event) => events.push("pagehide:" + event.persisted));
    const snapshot = () => ({ completed, callbacks, events, visibilityEvidence, state: form.dataset.intakeLifecycle,
      aborted: lifecycle.signal.aborted, ticket: lifecycle.ticket(), generation: window.__CGS_INSTITUTIONAL_RC1__?.generation,
      guardDisabled: form.querySelector("fieldset").disabled, buttonDisabled: form.querySelector("[data-fs-submit-btn]").disabled,
      buttonType: form.querySelector("[data-fs-submit-btn]").type, action: form.getAttribute("action"), method: form.getAttribute("method"),
      values: [...form.elements].filter((item) => item.name).map((item) => item.value),
      visibility: document.visibilityState, reloadVisible: !form.querySelector("[data-intake-reload]").hidden });
    window.__C04_LAB__ = Object.freeze({ snapshot, run: async () => {
      completed = await lifecycle.verify(lifecycle.ticket());
      document.querySelector("[data-lab-result]").textContent = completed ? "Static artifact check passed; intake remains disabled." : "Artifact check held; intake remains disabled.";
      return completed;
    }, schedule: () => lifecycle.schedule(() => { callbacks += 1; }, 600),
      lock: lifecycle.lock });
    lifecycle.activate();
    document.querySelector("[data-lab-run]").addEventListener("click", () => window.__C04_LAB__.run());
    document.querySelector("[data-lab-lock]").addEventListener("click", lifecycle.lock);
  })();\n`;
  const clientVersion = digest(client).slice(0, 16);
  const configPath = (generation) => `/institutional-rc1-config.js?v=${digest(configs[generation]).slice(0, 16)}`;
  const html = (generation) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
    <title>C-04 local component qualification lab</title><link rel="stylesheet" href="/lab.css">
    <script defer src="${configPath(generation)}"></script><script defer src="/site.js?v=${clientVersion}"></script></head>
    <body><main><p>C-04 / SOURCE &amp; TEST ONLY</p><h1>Local artifact qualification</h1>
    <p>This is a component test lab, not institutional intake. It reads only local static artifacts. No provider, credentials, institutional fields or submission handler is present.</p>
    <section><h2>Permanent non-transmitting guard</h2><form>
    <fieldset disabled data-test-form-guard><legend>Intake remains disabled</legend>
    <button disabled type="button" data-fs-submit-btn>Submission unavailable</button></fieldset>
    ${["g-recaptcha-response", "intake_mode", "public_version", "intake_owner", "source_page", "subject"].map((name) => `<input type="hidden" name="${name}" value="">`).join("")}
    <p data-intake-lifecycle-status role="status">Local test controller only; form controls remain disabled.</p>
    <div data-intake-recovery hidden><button data-intake-reload type="button" hidden>Reload local lab</button></div></form></section>
    <section><h2>Static artifact check</h2><button data-lab-run type="button">Run local artifact check</button>
    <button data-lab-lock type="button">Hold local controller</button><p data-lab-result role="status">Not run.</p></section>
    <p>Full C-04 HOLD · R-016 / R-017 OPEN. A local pass is not deployment or intake authorization.</p></main></body></html>`;
  return { sourceHash: digest(source), controllerHash: digest(controller), client, clientVersion, configs, configPath, html };
}

const css = `:root{font-family:system-ui;color:#293a37;background:#eeeee7}*{box-sizing:border-box}body{margin:0}main{max-width:760px;margin:5vh auto;padding:24px}h1{font:2.6rem Georgia,serif;margin:20px 0}p{line-height:1.6}section{background:#fafaf5;padding:20px;margin:24px 0;border-radius:8px}fieldset{border:1px solid #a8b5ad;padding:16px}button{font:inherit;padding:12px 16px;margin:4px 4px 4px 0;max-width:100%;border:1px solid #647c71;background:#e3e9df;color:#203d31;border-radius:4px}button:focus-visible{outline:3px solid #2b5847;outline-offset:3px}button:disabled{opacity:.6}h2{font-size:1.15rem}[hidden]{display:none!important}@media(max-width:450px){h1{font-size:2rem}main{margin:0;padding:18px}section{padding:16px}}`;

export async function startLab({ generation = "A" } = {}) {
  assert.ok(["A", "B"].includes(generation));
  const artifact = await artifacts();
  let fault = "none";
  const requests = [];
  const pending = new Set();
  let origin;
  const server = createServer((request, response) => {
    const entry = { method: request.method, target: request.url, hasCookie: !!request.headers.cookie,
      hasAuthorization: !!request.headers.authorization, status: null, aborted: false };
    requests.push(entry);
    response.on("close", () => { entry.aborted = !response.writableFinished; });
    const send = (status, body, type = "text/plain", headers = {}) => {
      entry.status = status;
      if (response.destroyed) return;
      response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff", ...headers });
      response.end(request.method === "HEAD" ? undefined : body);
    };
    const validTarget = /^\/(?:institutional-alignment\.html(?:\?lab-selector=INERT)?|institutional-rc1-config\.js\?v=[a-f0-9]{16}|site\.js\?v=[a-f0-9]{16}|lab\.css|away\.html|favicon\.ico)$/.test(request.url || "");
    if (request.headers.host !== new URL(origin).host || !validTarget) return send(400, "Local allowlist rejection");
    if (!["GET", "HEAD"].includes(request.method)) return send(405, "No mutation route");
    const url = new URL(request.url, origin);
    if (url.pathname === "/favicon.ico") return send(204, "");
    const csp = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; frame-ancestors 'none'";
    if (url.pathname === "/away.html") return send(200, "<!doctype html><title>Local departure</title><p>Local-only departure fixture.</p>", "text/html", { "Content-Security-Policy": csp });
    if (url.pathname === "/lab.css") return send(200, css, "text/css");
    if (url.pathname === "/site.js") {
      if (url.searchParams.get("v") !== artifact.clientVersion) return send(404, "Unknown lab client");
      return send(200, artifact.client, "text/javascript");
    }
    const isHtml = url.pathname === "/institutional-alignment.html";
    let body = isHtml ? artifact.html(generation) : Object.values(artifact.configs).find((value) => digest(value).slice(0, 16) === url.searchParams.get("v"));
    if (!body) return send(404, "Unknown inert config");
    const type = isHtml ? "text/html" : "text/javascript";
    const headers = isHtml ? { "Content-Security-Policy": csp } : {};
    if (fault === "http-error") return send(503, "Controlled local failure");
    if (fault === "redirect") return send(302, "", type, { Location: "/away.html" });
    if (fault === "cache-header") headers["Cache-Control"] = "public, max-age=600";
    if (isHtml) {
      if (fault === "generation-change") body = artifact.html(generation === "A" ? "B" : "A");
      if (fault === "client-change") body = body.replace(artifact.clientVersion, "0000000000000000");
      if (fault === "foreign-reference") body = body.replace('src="/institutional-rc1', 'src="https://reserved.invalid/institutional-rc1');
      if (fault === "duplicate-reference") body += `<script src="${artifact.configPath(generation)}"></script>`;
      if (fault === "missing-reference") body = body.replace(/<script defer src="\/institutional-rc1[^]*?<\/script>/, "");
      if (fault === "oversized-html") body += " ".repeat(262145);
    } else {
      if (fault === "stale-config") body = artifact.configs[generation === "A" ? "B" : "A"];
      if (fault === "malformed-config") body = "window.__CGS_INSTITUTIONAL_RC1__ = Object.freeze({invalid});\n";
      if (fault === "tampered-config") body += "// deliberately different bytes\n";
      if (fault === "oversized-config") body += " ".repeat(16385);
    }
    const hold = (isHtml && fault === "hold-html") || (!isHtml && ["hold-config", "hold-body"].includes(fault));
    if (hold) {
      const partialBody = fault === "hold-body";
      let remainder = body;
      if (partialBody) {
        entry.status = 200;
        response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
        response.write(body.slice(0, 10));
        remainder = body.slice(10);
      }
      const release = () => {
        pending.delete(release);
        if (response.destroyed) return;
        if (partialBody) response.end(remainder);
        else send(200, remainder, type, headers);
      };
      pending.add(release);
      return;
    }
    send(200, body, type, headers);
  });
  server.requestTimeout = 7000;
  server.headersTimeout = 7000;
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, artifact, requests, pending, generation,
    setFault(value) { assert.ok(faults.includes(value), "unknown fault rejected"); fault = value; },
    release() { [...pending].forEach((release) => release()); },
    async close() { [...pending].forEach((release) => release()); server.closeAllConnections(); await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); } };
}
