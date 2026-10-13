import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { qualifyInertTransition } from "./inert-config-transition.mjs";

// Manual opt-in runner. No browser/package download or authenticated attachment.
// Supply an already-installed official Playwright library and an external output
// directory. npm run check never executes this browser runner.
const argumentsList = process.argv.slice(2);
assert.equal(argumentsList.length, 4,
  "usage: node test/browser/run-inert-config-transition.mjs --playwright-module ABSOLUTE_INDEX_MJS --output ABSOLUTE_EXTERNAL_DIRECTORY");
assert.equal(argumentsList[0], "--playwright-module");
assert.equal(argumentsList[2], "--output");
const [modulePath, outputPath] = [argumentsList[1], argumentsList[3]];
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
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-automation"],
    ignoreDefaultArgs: ["--disable-back-forward-cache"] });
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ serviceWorkers: "block", viewport });
    const screenshotDirectory = path.join(runDirectory, String(viewport.width));
    await mkdir(screenshotDirectory);
    try {
      const page = await context.newPage();
      reports.push({ viewport, ...await qualifyInertTransition(page, { screenshotDirectory }) });
    } finally { await context.close(); }
  }
  const report = { pass: reports.every((result) => result.pass), executedAt, sourceRevision, sourceDirty,
    scope: "Source/test-only local fixtures; no hosted site/provider requests", reports };
  await writeFile(path.join(runDirectory, "results.json"), JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ pass: report.pass, sourceRevision, sourceDirty, runDirectory,
    results: reports.map((result) => ({ viewport: result.viewport, browser: result.browser.product,
      reload: result.reloadQualification, history: result.historyQualification.status,
      externalOrTransmittingRequests: result.externalOrTransmittingRequests })) }, null, 2) + "\n");
  // A history HOLD is not a green qualification. CI unit tests remain separate.
  if (!report.pass) process.exitCode = 2;
} catch (error) {
  await writeFile(path.join(runDirectory, "failure.json"), JSON.stringify({ pass: false, executedAt,
    sourceRevision, sourceDirty, reports, message: error.message, evidence: error.qualificationEvidence }, null, 2) + "\n");
  throw error;
} finally { if (browser) await browser.close(); }
