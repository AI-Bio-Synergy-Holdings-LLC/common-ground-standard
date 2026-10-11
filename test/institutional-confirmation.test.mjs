import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";
import { initInstitutionalThankYou, isInstitutionalRc1Record } from "../institutional-confirmation.mjs";

const html = await readFile(new URL("../institutional-thank-you.html", import.meta.url), "utf8");
const moduleSource = await readFile(new URL("../institutional-confirmation.mjs", import.meta.url), "utf8");
// Remove only export declaration prefixes so the unchanged browser entry point can
// run in a fresh offline context. No URL, initialization or renderer logic is rewritten.
const browserSource = moduleSource.replace(/^export (?=const )/gm, "");
const browserScript = new Script(browserSource, { filename: "institutional-confirmation.mjs" });
const browserRunOptions = { timeout: 1000, codeGeneration: { strings: false, wasm: false } };
// Count reads and assert afterward: VM global getter exceptions can be masked.
// These are fabricated offline values, never provider or activation credentials.
const trackAmbientReads = `
  const ambientReads = [];
  const initialLocation = location;
  const recordRead = (name, value) => () => { ambientReads.push(name); return value; };
  Object.defineProperty(globalThis, "location", { get: recordRead("location", initialLocation) });
  Object.defineProperty(globalThis, "__CGS_INSTITUTIONAL_RC1__", {
    get: recordRead("activation", { enabled: true, mode: "production-live" }),
  });
  for (const [name, value] of [
    ["location", initialLocation], ["URL", initialLocation.href], ["documentURI", initialLocation.href],
  ]) {
    Object.defineProperty(document, name, { get: recordRead("document." + name, value) });
  }
`;
const assertNoAmbientReads = `
  if (ambientReads.length) throw new Error("URL or activation state read detected: " + ambientReads.join(", "));
`;
const validRecords = [
  "CGS-INSTITUTIONAL-RC1-2026-10-08",
  "CGS-INSTITUTIONAL-RC1-20261008-7CB67E4-RECEIPT",
  "CGS-INSTITUTIONAL-RC1-" + "A".repeat(106),
];
const invalidRecords = [
  "", "CGS-INSTITUTIONAL-RC1-", "CGS-INSTITUTIONAL-RC1--RECEIPT",
  "CGS-INSTITUTIONAL-RC1-RECEIPT-", "CGS-INSTITUTIONAL-RC1-lowercase",
  "CGS-INSTITUTIONAL-RC1-20261008\n", "CGS-INSTITUTIONAL-RC1-20261008/RECEIPT",
  "CGS-INSTITUTIONAL-RC1-<img src=x onerror=alert(1)>",
  "CGS-INSTITUTIONAL-RC1-" + "A".repeat(107), null, 123,
];

const fixture = () => {
  const fields = new Map();
  for (const name of ["label", "title", "summary", "status", "transmission", "live", "notice-title", "notice-copy"]) {
    const selector = `[data-institutional-result-${name}]`;
    const match = html.match(new RegExp(`<([a-z0-9]+)[^>]*data-institutional-result-${name}(?:\\s[^>]*)?>([^<]*)<\\/\\1>`));
    const text = match?.[2];
    assert.ok(text, `missing template hook: ${name}`);
    fields.set(selector, { textContent: text.replace(/\s+/g, " ").trim() });
  }
  const document = {
    title: html.match(/<title>(.*?)<\/title>/)[1],
    querySelector: (selector) => fields.get(selector) || null,
  };
  return { document, text: (name) => fields.get(`[data-institutional-result-${name}]`).textContent };
};

const browserContext = (document, location) => {
  const context = { document, location, URL, URLSearchParams };
  context.window = context;
  context.self = context;
  document.location = location;
  return context;
};

const seedPriorClientClaim = (result) => {
  result.document.title = "Unverified prior client title";
  for (const name of ["label", "title", "summary", "status", "transmission", "live", "notice-title", "notice-copy"]) {
    result.document.querySelector(`[data-institutional-result-${name}]`).textContent = "Unverified prior client claim";
  }
};

const render = (search, origin = "https://common-ground-standard-institutional.onrender.com") => {
  const result = fixture();
  const location = new URL(`institutional-thank-you.html?${search}`, origin);
  result.document.URL = location.href;
  result.document.documentURI = location.href;
  seedPriorClientClaim(result);
  browserScript.runInNewContext(browserContext(result.document, location), browserRunOptions);
  return result;
};

const assertNeutralResult = (result, context = "") => {
  const baseline = fixture();
  assert.equal(result.document.title, baseline.document.title, context);
  for (const name of ["label", "title", "summary", "status", "transmission", "live", "notice-title", "notice-copy"]) {
    assert.equal(result.text(name), baseline.text(name), `${context}: ${name}`);
  }
};

test("the shared record contract accepts legacy and extended markers with a 128-character bound", () => {
  for (const record of validRecords) assert.equal(isInstitutionalRc1Record(record), true, record);
  for (const record of invalidRecords) assert.equal(isInstitutionalRc1Record(record), false, String(record));
});

test("a historical extended marker does not authenticate a synthetic receipt", () => {
  const marker = "CGS-INSTITUTIONAL-RC1-20261008-7CB67E4-RECEIPT";
  const result = render(new URLSearchParams({ mode: "integration-success", record: marker }).toString());
  assertNeutralResult(result, marker);
  assert.doesNotMatch(result.text("notice-copy"), new RegExp(marker));
});

test("syntactically valid and fabricated markers remain unverified", () => {
  for (const record of [...validRecords, "CGS-INSTITUTIONAL-RC1-FABRICATED"]) {
    const result = render(new URLSearchParams({ mode: "integration-success", record }).toString());
    assertNeutralResult(result, record);
  }
});

test("malformed receipt markers stay unverified instead of claiming no transmission", () => {
  for (const record of invalidRecords.filter((record) => typeof record === "string")) {
    const result = render(new URLSearchParams({ mode: "integration-success", record }).toString());
    assert.equal(result.text("title"), "Result not verified.", record);
    assert.equal(result.text("transmission"), "Not established by this page", record);
    assert.doesNotMatch(result.text("notice-copy"), /<img/);
  }
});

test("missing, unknown and duplicate result parameters stay unverified", () => {
  const record = validRecords[1];
  for (const search of [
    "", "mode=integration-success", `record=${record}`, `mode=unknown&record=${record}`,
    `mode=integration-success&mode=live&record=${record}`,
    `mode=integration-success&record=${record}&record=${validRecords[0]}`,
    `mode=test&record=${record}`,
  ]) {
    const result = render(search);
    assert.equal(result.text("title"), "Result not verified.", search);
    assert.equal(result.text("transmission"), "Not established by this page", search);
  }
});

test("a local-test URL cannot establish validation or non-transmission", () => {
  const result = render("mode=test");
  assertNeutralResult(result);
});

for (const origin of [
  "https://common-ground-standard.org",
  "https://common-ground-standard-institutional.onrender.com",
]) {
  test(`all URL-only result claims remain neutral on ${origin}`, () => {
    for (const search of [
      "", "mode=test", "mode=test&success=true&transmission=none&intake=disabled",
      "mode=test&mode=test", "mode=test&record=", "mode=integration-success",
      `mode=integration-success&record=${validRecords[1]}`,
      "mode=integration-success&record=CGS-INSTITUTIONAL-RC1-FABRICATED",
      `mode=integration-success&record=${validRecords[2]}`,
      `mode=integration-success&record=${validRecords[0]}&record=${validRecords[1]}`,
      `mode=integration-success&mode=test&record=${validRecords[1]}`,
      "mode=integration-success&record=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E",
      "%6dode=integration-success&record=CGS-INSTITUTIONAL-RC1-FABRICATED",
      "mode=unknown&success=true&receipt=123&transmission=none",
      "mode=live",
      `mode=live&record=${validRecords[1]}`,
      "mode=live&record=invalid",
      `mode=live&record=${validRecords[0]}&record=${validRecords[1]}`,
      "mode=live&mode=live",
      "mode=live&success=true&authorized=true&receipt=123&intake=active",
    ]) {
      const result = render(search, origin);
      assertNeutralResult(result, search);
    }
  });
}

test("the confirmation renderer does not read URL or ambient activation state", () => {
  const result = fixture();
  const location = new URL("https://common-ground-standard.org/institutional-thank-you.html?mode=live&authorized=true");
  const context = browserContext(result.document, location);
  const guardedBrowserScript = new Script(`${trackAmbientReads}\n${browserSource}\n${assertNoAmbientReads}`);
  seedPriorClientClaim(result);
  assert.doesNotThrow(() => guardedBrowserScript.runInNewContext(context, browserRunOptions));
  assertNeutralResult(result);
});

test("the offline browser harness detects URL-trust and skipped-initialization regressions", () => {
  const location = new URL("https://common-ground-standard.org/institutional-thank-you.html?mode=live&authorized=true");
  const mutations = [
    new Script("void 0;"),
    new Script(`${browserSource}\nif (window.location.search.includes("mode=live")) document.querySelector("[data-institutional-result-live]").textContent = "Active from an untrusted URL";`),
  ];
  for (const mutation of mutations) {
    const result = fixture();
    seedPriorClientClaim(result);
    mutation.runInNewContext(browserContext(result.document, location), browserRunOptions);
    assert.throws(() => assertNeutralResult(result), { code: "ERR_ASSERTION" });
  }
  for (const read of [
    "location.search", "window.location.search", "self.location.search", "globalThis.location.search",
    "document.location.search", "document.URL", "document.documentURI", "window.__CGS_INSTITUTIONAL_RC1__",
  ]) {
    const ambientRead = new Script(`${trackAmbientReads}\n${browserSource}\nvoid ${read};\n${assertNoAmbientReads}`);
    assert.throws(
      () => ambientRead.runInNewContext(browserContext(fixture().document, location), browserRunOptions),
      /URL or activation state read detected/,
      read,
    );
  }
});

test("initialization restores neutral copy instead of retaining a prior client claim", () => {
  const result = fixture();
  result.document.title = "Institutional Routing Test Accepted";
  for (const name of ["title", "status", "transmission", "live"]) {
    result.document.querySelector(`[data-institutional-result-${name}]`).textContent = "Unverified prior client claim";
  }
  initInstitutionalThankYou(result.document);
  assertNeutralResult(result);
});

test("the confirmation route cannot assert receipt, non-transmission or activation from client presentation", async () => {
  const module = await readFile(new URL("../institutional-confirmation.mjs", import.meta.url), "utf8");
  for (const source of [module, html]) {
    assert.doesNotMatch(source, /Your review note was received|Received for bounded fit assessment|Submitted privately through Formspree|Active under published operating controls|Formspree response accepted|One synthetic test record|Validation complete\.|None — local-only test mode|Disabled — no live intake opened|This was not an institutional submission/);
  }
});

test("the corrected confirmation module has a new cache identity", () => {
  assert.match(html, /institutional-confirmation\.mjs\?v=20261010-all-results-neutral/);
  assert.doesNotMatch(html, /institutional-confirmation\.mjs\?v=20261008-(?:confirmation-contract|live-result-neutral)/);
});

test("static and JavaScript-disabled results are neutral and do not offer resubmission", () => {
  const result = fixture();
  assert.equal(result.text("title"), "Result not verified.");
  assert.equal(result.text("transmission"), "Not established by this page");
  assert.match(html, /<noscript>[\s\S]*JavaScript is unavailable/);
  assert.doesNotMatch(html, /No institutional form-field|without transmitting data|<form\b|recaptcha\/api\.js/);
  assert.match(html, /type="module" src="institutional-confirmation\.mjs\?v=/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("confirmation rendering has no submission, token, storage or HTML-injection mechanism", async () => {
  const module = await readFile(new URL("../institutional-confirmation.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(module, /fetch\(|FormData|sendBeacon|grecaptcha|localStorage|sessionStorage|innerHTML|requestSubmit/);
  assert.doesNotThrow(() => initInstitutionalThankYou({ querySelector: () => null }));
});

test("long receipt markers have wrapping scoped to the confirmation notice", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.notice-section \[data-institutional-result-notice-copy\]\s*\{\s*overflow-wrap: anywhere;/);
});
