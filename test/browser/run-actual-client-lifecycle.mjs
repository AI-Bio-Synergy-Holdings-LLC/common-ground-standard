import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assessActualClientLifecycle } from "./actual-client-lifecycle.mjs";
import { smokeInstitutionalLifecycle } from "./institutional-lifecycle-smoke.mjs";

// Manual opt-in only. Uses an installed library and a fresh unauthenticated
// Chrome process; never downloads software or attaches to a user's profile.
const args = process.argv.slice(2);
assert.equal(args.length, 4,
  "usage: node test/browser/run-actual-client-lifecycle.mjs --playwright-module ABSOLUTE_INDEX_MJS --output ABSOLUTE_EXTERNAL_DIRECTORY");
assert.equal(args[0], "--playwright-module");
assert.equal(args[2], "--output");
const [modulePath, outputPath] = [args[1], args[3]];
assert.ok(path.isAbsolute(modulePath) && path.isAbsolute(outputPath));
const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const outsideSource = (target) => {
  const relative = path.relative(sourceRoot, target);
  assert.ok(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), "evidence must stay outside the repository");
};
outsideSource(path.resolve(outputPath));
await mkdir(outputPath, { recursive: true });
outsideSource(await realpath(outputPath));
const executedAt = new Date().toISOString();
const runDirectory = path.join(outputPath, executedAt.replace(/[:.]/g, "-"));
await mkdir(runDirectory);
const { chromium } = await import(pathToFileURL(modulePath).href);
const sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot, encoding: "utf8" }).trim();
const sourceDirty = !!execFileSync("git", ["status", "--porcelain"], { cwd: sourceRoot, encoding: "utf8" }).trim();
const reports = [];
const smoke = [];
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-automation"],
    ignoreDefaultArgs: ["--disable-back-forward-cache"] });
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    for (const startGeneration of ["A", "B"]) {
    for (const { seeded, formScrolled } of [{ seeded: false, formScrolled: false }, { seeded: true, formScrolled: false },
      { seeded: false, formScrolled: true }, { seeded: true, formScrolled: true }]) {
      const context = await browser.newContext({ serviceWorkers: "block", viewport });
      const screenshotDirectory = path.join(runDirectory, `${viewport.width}-${startGeneration}-${seeded ? "seeded" : "natural"}-${formScrolled ? "form" : "top"}`);
      await mkdir(screenshotDirectory);
      try {
        const page = await context.newPage();
        reports.push({ viewport, ...await assessActualClientLifecycle(page, { seeded, formScrolled, startGeneration,
          qualifyRemediation: true, screenshotDirectory }) });
      } finally { await context.close(); }
    }
    }
  }
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    for (const mode of ["normal", "javascript-disabled", "script-blocked", "config-missing", "config-malformed"]) {
      const context = await browser.newContext({ serviceWorkers: "block", viewport, javaScriptEnabled: mode !== "javascript-disabled" });
      const screenshotDirectory = path.join(runDirectory, `${viewport.width}-${mode}`);
      await mkdir(screenshotDirectory);
      try { smoke.push({ viewport, ...await smokeInstitutionalLifecycle(await context.newPage(), { mode, screenshotDirectory }) }); }
      finally { await context.close(); }
    }
  }
  const report = { assessmentComplete: reports.every((result) => result.assessmentComplete),
    lifecycleQualification: reports.every((result) => result.lifecycleQualification === "PASS-BOUNDED") ? "PASS-BOUNDED" : "HOLD",
    executedAt, sourceRevision, sourceDirty, nodeVersion: process.version,
    scope: "Authorized candidate local null-config lifecycle lock and keyboard reload; full C04 remains HOLD; no provider/hosted request or submission",
    reports, smoke };
  await writeFile(path.join(runDirectory, "results.json"), JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ assessmentComplete: report.assessmentComplete,
    lifecycleQualification: report.lifecycleQualification, sourceRevision, sourceDirty, runDirectory,
    smoke: smoke.map((result) => ({ viewport: result.viewport, mode: result.mode, pass: result.pass })),
    results: reports.map((result) => ({ viewport: result.viewport, startGeneration: result.startGeneration, seeded: result.seeded, formScrolled: result.formScrolled,
      persisted: result.persisted,
      browser: result.browser.product, lifecycleQualification: result.lifecycleQualification,
      reasons: result.reasons, nativeHistoryResponses: result.nativeHistoryResponses,
      externalOrTransmittingRequests: result.externalOrTransmittingRequests })) }, null, 2) + "\n");
  // Completed assessment with a HOLD is not successful lifecycle qualification.
  if (report.lifecycleQualification !== "PASS-BOUNDED") process.exitCode = 2;
} catch (error) {
  await writeFile(path.join(runDirectory, "failure.json"), JSON.stringify({ assessmentComplete: false, executedAt,
    sourceRevision, sourceDirty, reports, message: error.message, evidence: error.assessmentEvidence }, null, 2) + "\n");
  throw error;
} finally { if (browser) await browser.close(); }
