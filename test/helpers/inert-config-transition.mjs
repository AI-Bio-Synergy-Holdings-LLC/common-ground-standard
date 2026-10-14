import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fingerprint, evaluateConfig, modeFlags } from "./deployment-safety.mjs";

export const noStore = "no-store, no-cache, must-revalidate, max-age=0";
export const fixtureCsp = "default-src 'none'; script-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; worker-src 'none'";
export const fixturePath = "/institutional-alignment.html";
const configPath = "/institutional-rc1-config.js";
const viewSource = `"use strict";
document.getElementById("generation").textContent = window.__CGS_C04_FIXTURE__.generation;
window.addEventListener("pageshow", (event) => { window.__CGS_C04_HISTORY_RESTORED__ = event.persisted; });
`;
const configSourceFor = (generation) => `window.__CGS_INSTITUTIONAL_RC1__ = Object.freeze(null);\nwindow.__CGS_C04_FIXTURE__ = Object.freeze(${JSON.stringify({ generation,
  flags: Object.fromEntries(modeFlags.map((flag) => [flag, false])) })});\n`;

// A and B differ only in a conspicuously test-only marker. They both keep the
// real intake global null; neither represents verification or live mode.
export function inertFixture(generation) {
  assert.ok(["A", "B"].includes(generation), "only inert generations A and B exist");
  const config = configSourceFor(generation);
  const version = fingerprint(config);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>C-04 inert configuration fixture</title>
<script defer src="institutional-rc1-config.js?v=${version}"></script>
<script defer src="fixture-view.js"></script></head>
<body><a href="#content">Skip to fixture</a><main id="content" tabindex="-1">
<h1>C-04 inert configuration fixture</h1><p>Not institutional intake. No submission or activation.</p>
<p>Current fixture: <output id="generation">Script not loaded</output></p>
<p>Both generations keep the intake configuration null and all five fixture flags false.</p>
<a href="away.html">Navigate away</a></main></body></html>\n`;
  const fixture = Object.freeze({ generation, config, html, version });
  assertInertFixture(fixture);
  return fixture;
}

export function assertInertFixture(fixture) {
  assert.ok(["A", "B"].includes(fixture.generation));
  assert.equal(fixture.config, configSourceFor(fixture.generation), "only the exact inert config template is permitted");
  assert.equal(evaluateConfig(fixture.config), null, "intake configuration must remain null");
  assert.equal(fixture.version, fingerprint(fixture.config));
  assert.match(fixture.html, new RegExp(`institutional-rc1-config\\.js\\?v=${fixture.version}`));
  assert.equal((fixture.html.match(/<script\b/g) || []).length, 2);
  assert.doesNotMatch(fixture.html, /<(?:form|input|button|iframe|img|link)\b|\bon\w+=/i);
  const scriptSources = [...fixture.html.matchAll(/<script defer src="([^"]+)"><\/script>/g)].map((match) => match[1]);
  assert.deepEqual(scriptSources, [`institutional-rc1-config.js?v=${fixture.version}`, "fixture-view.js"]);
  assert.deepEqual([...fixture.html.matchAll(/<a href="([^"]+)"/g)].map((match) => match[1]), ["#content", "away.html"]);
  assert.doesNotMatch(fixture.config + fixture.html + viewSource,
    /https?:|formspree|recaptcha|grecaptcha|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|\.submit\(/i);
  for (const flag of modeFlags) assert.ok(fixture.config.includes(`"${flag}":false`));
  assert.match(fixture.html, /Not institutional intake/);
  return true;
}

export function historyDisposition(observation, expected) {
  if (!observation || observation.generation !== expected.generation ||
      observation.fingerprint !== expected.version || observation.config !== null || observation.forms !== 0 ||
      !observation.flags || Object.keys(observation.flags).length !== modeFlags.length ||
      !modeFlags.every((flag) => observation.flags[flag] === false)) {
    return { status: "HOLD", fresh: false, reason: "history restoration did not show the changed current fixture" };
  }
  return { status: "PASS-BOUNDED", fresh: true, reason: "changed current inert fixture observed; not real intake/CDN proof" };
}

export function fixtureResponse({ method, rawUrl, host, expectedHost, current, fault = null }) {
  const headers = {
    "Cache-Control": noStore, "Content-Security-Policy": fixtureCsp,
    "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer", "Content-Type": "text/plain; charset=utf-8",
  };
  const reject = (status) => ({ status, headers, body: "Fixture request rejected\n" });
  if (host !== expectedHost) return reject(421);
  if (!["GET", "HEAD"].includes(method)) return reject(405);
  // Do not normalize traversal, accept absolute request targets or expose files.
  if (!/^\/[A-Za-z0-9._-]+(?:\?v=[a-f0-9]{16})?$/.test(rawUrl)) return reject(400);
  const url = new URL(rawUrl, `http://${expectedHost}`);
  let body;
  let contentType = "text/html; charset=utf-8";
  if (url.pathname === fixturePath && !url.search) {
    body = fault === "stale-html" ? inertFixture("A").html : current.html;
  } else if (url.pathname === configPath && (!url.search || /^\?v=[a-f0-9]{16}$/.test(url.search))) {
    body = fault === "stale-config" ? inertFixture("A").config : current.config;
    contentType = "text/javascript; charset=utf-8";
  } else if (url.pathname === "/fixture-view.js" && !url.search) {
    body = viewSource;
    contentType = "text/javascript; charset=utf-8";
  } else if (url.pathname === "/away.html" && !url.search) {
    body = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C-04 away fixture</title></head><body><h1>Fixture navigation checkpoint</h1><p>Use ordinary browser Back.</p></body></html>\n';
  } else if (url.pathname === "/favicon.ico" && !url.search) {
    return { status: 204, headers, body: "" };
  } else return reject(404);
  return { status: 200, headers: { ...headers, "Content-Type": contentType }, body: method === "HEAD" ? "" : body };
}

export async function startInertFixtureServer() {
  let current = inertFixture("A");
  let fault = null;
  let origin;
  const requests = [];
  const server = createServer((request, response) => {
    const result = fixtureResponse({ method: request.method, rawUrl: request.url,
      host: request.headers.host, expectedHost: new URL(origin).host, current, fault });
    requests.push({ method: request.method, path: request.url, generation: current.generation, fault, status: result.status });
    response.writeHead(result.status, result.headers);
    response.end(result.body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, requests,
    snapshot: () => current,
    // Operator-side memory only: the HTTP surface has no activation/control API.
    activate(generation, negativeControl = null) {
      assert.ok([null, "stale-html", "stale-config"].includes(negativeControl));
      assert.ok(negativeControl === null || generation === "B");
      current = inertFixture(generation);
      fault = negativeControl;
      return current;
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
