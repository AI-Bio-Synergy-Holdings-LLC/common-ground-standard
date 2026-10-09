import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { initInstitutionalThankYou, isInstitutionalRc1Record } from "../institutional-confirmation.mjs";

const html = await readFile(new URL("../institutional-thank-you.html", import.meta.url), "utf8");
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

const render = (search) => {
  const result = fixture();
  initInstitutionalThankYou(result.document, { search });
  return result;
};

test("the shared record contract accepts legacy and extended markers with a 128-character bound", () => {
  for (const record of validRecords) assert.equal(isInstitutionalRc1Record(record), true, record);
  for (const record of invalidRecords) assert.equal(isInstitutionalRc1Record(record), false, String(record));
});

test("the accepted extended staging marker renders a transmitted synthetic receipt", () => {
  const marker = "CGS-INSTITUTIONAL-RC1-20261008-7CB67E4-RECEIPT";
  const result = render(new URLSearchParams({ mode: "integration-success", record: marker }).toString());
  assert.equal(result.text("title"), "Routing response accepted.");
  assert.equal(result.text("transmission"), "One synthetic test record");
  assert.match(result.text("notice-copy"), new RegExp(marker));
  assert.match(result.text("summary"), /reported Formspree acceptance/);
  assert.match(result.text("summary"), /does not confirm inbox delivery or final classification/);
  assert.match(result.text("live"), /Disabled/);
  assert.equal(result.document.title, "Institutional Routing Test Accepted | Common Ground Standard");
});

test("every accepted marker renders a synthetic result without the local-only fallback", () => {
  for (const record of validRecords) {
    const result = render(new URLSearchParams({ mode: "integration-success", record }).toString());
    assert.equal(result.text("transmission"), "One synthetic test record", record);
    assert.doesNotMatch(result.text("summary"), /No institutional form-field data|local form validation/);
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

test("the explicit local-only result remains distinct from an accepted synthetic receipt", () => {
  const result = render("mode=test");
  assert.equal(result.text("title"), "Validation complete.");
  assert.equal(result.text("transmission"), "None — local-only test mode");
  assert.match(result.text("summary"), /local test flow reported/);
  assert.doesNotMatch(result.text("summary"), /Formspree acceptance/);
});

test("the existing live result still retains its bounded assessment disclosure", () => {
  const result = render("mode=live");
  assert.equal(result.text("title"), "Your review note was received.");
  assert.equal(result.text("transmission"), "Submitted privately through Formspree");
  assert.match(result.text("notice-title"), /does not create an institutional role/);
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
  assert.doesNotThrow(() => initInstitutionalThankYou({ querySelector: () => null }, { search: "mode=test" }));
});

test("long receipt markers have wrapping scoped to the confirmation notice", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.notice-section \[data-institutional-result-notice-copy\]\s*\{\s*overflow-wrap: anywhere;/);
});
