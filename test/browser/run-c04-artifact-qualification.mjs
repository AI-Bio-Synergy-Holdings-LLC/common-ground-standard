import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contract, digest, faults, startLab } from "../helpers/c04-artifact-qualification.mjs";

// Manual opt-in, installed library only, new unauthenticated Chrome process.
// Every case is routed to loopback ONLY: this is not native cache/BFCache proof.
const args = process.argv.slice(2);
assert.equal(args.length, 4, "usage: node test/browser/run-c04-artifact-qualification.mjs --playwright-module ABSOLUTE_INDEX_MJS --output ABSOLUTE_EXTERNAL_DIRECTORY");
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
const results = [];
let browser;
let browserVersion;
let controllerHash;
const snapshot = (page) => page.evaluate(() => window.__C04_LAB__.snapshot());
const guarded = (state) => {
  assert.equal(state.guardDisabled, true);
  assert.equal(state.buttonDisabled, true);
  assert.equal(state.buttonType, "button");
  assert.equal(state.action, null);
  assert.equal(state.method, null);
  assert.ok(state.values.every((value) => value === ""));
};
const held = (state) => { guarded(state); assert.equal(state.state, "held"); assert.equal(state.aborted, true); assert.equal(state.reloadVisible, true); };
const finiteWait = async (predicate, message) => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(message);
};
const negatives = faults.filter((fault) => !["none", "hold-html", "hold-config", "hold-body"].includes(fault));
const matrix = ["clean-A", "clean-B", ...negatives, "generation-return", "timeout-html", "timeout-config", "timeout-body",
  "simulated-visibility-boundary", "cancel-late-body", "config-mutation", "simulated-pagehide-boundary", "timer-success", "javascript-disabled", "module-blocked"];
assert.equal(matrix.length, contract.casesPerViewport);
const report = () => ({ scope: "Local component qualification of exact public freshness/lifecycle controller; not full page, hosted/cache or transmitting-route proof",
  qualification: results.length === matrix.length * 2 && results.every((result) => result.pass) ? "PASS-BOUNDED" : "HOLD",
  fullC04: contract.fullC04, risks: contract.risks, executedAt, finishedAt: new Date().toISOString(),
  sourceRevision, sourceDirty, publicClientHash: results[0]?.publicClientHash, controllerHash, nodeVersion: process.version,
  browserVersion, allCasesRoutedToLoopback: true, results });

try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  browserVersion = browser.version();
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    for (const name of matrix) {
      const lab = await startLab({ generation: ["clean-B", "generation-return"].includes(name) ? "B" : "A" });
      controllerHash = lab.artifact.controllerHash;
      const context = await browser.newContext({ viewport, serviceWorkers: "block", javaScriptEnabled: name !== "javascript-disabled" });
      const network = [];
      const consoleErrors = [];
      const pageErrors = [];
      const unexpected = [];
      const entry = { name, viewport, origin: lab.origin, publicClientHash: lab.artifact.sourceHash,
        pass: false, network, consoleErrors, pageErrors, requests: lab.requests };
      const deadline = setTimeout(() => { context.close().catch(() => {}); }, contract.caseDeadlineMs);
      try {
        await context.route("**/*", async (route) => {
          const request = route.request();
          network.push({ url: request.url(), method: request.method(), body: request.postData(),
            hasCookie: !!request.headers().cookie, hasAuthorization: !!request.headers().authorization });
          if (new URL(request.url()).origin !== lab.origin || request.method() !== "GET" || request.postData()) {
            unexpected.push(request.url());
            await route.abort("blockedbyclient");
          } else if (name === "module-blocked" && new URL(request.url()).pathname === "/site.js") await route.abort("blockedbyclient");
          else await route.continue();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(contract.requestDeadlineMs);
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        await page.goto(lab.origin + "/institutional-alignment.html?lab-selector=INERT", { waitUntil: "networkidle" });
        assert.equal(await page.title(), "C-04 local component qualification lab");
        assert.equal(await page.locator("h1").innerText(), "Local artifact qualification");
        assert.equal(await page.locator("[data-fs-submit-btn]").isDisabled(), true);
        // Playwright's interactive-control classifier excludes fieldset.
        // Verify its native property AND its actual disabled descendant.
        assert.equal(await page.locator("fieldset").evaluate((fieldset) => fieldset.disabled), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (["javascript-disabled", "module-blocked"].includes(name)) {
          assert.equal(await page.evaluate(() => typeof window.__C04_LAB__), "undefined");
          await page.getByRole("button", { name: "Run local artifact check" }).click();
          assert.equal(await page.locator("[data-lab-result]").innerText(), "Not run.");
        } else {
          const initial = await snapshot(page);
          guarded(initial);
          assert.equal(initial.state, "ready");
          const beforeReads = lab.requests.length;
          if (name.startsWith("clean-")) {
            // A nonempty, synthetic local cookie jar makes omit-credentials a
            // negative control, not just an observation of an empty profile.
            await context.addCookies([{ name: "C04_INERT_SESSION", value: "inert-not-user-data", url: lab.origin }]);
            assert.ok((await context.cookies()).some((cookie) => cookie.name === "C04_INERT_SESSION"));
            entry.syntheticCookieNegativeControl = true;
          }
          if (negatives.includes(name)) lab.setFault(name);
          if (name === "generation-return") lab.setFault("generation-change");
          if (name.startsWith("timeout-")) lab.setFault(name.replace("timeout-", "hold-"));
          if (["cancel-late-body", "simulated-visibility-boundary"].includes(name)) lab.setFault("hold-body");
          if (name === "config-mutation") await page.evaluate(() => {
            window.__CGS_INSTITUTIONAL_RC1__ = Object.freeze({ ...window.__CGS_INSTITUTIONAL_RC1__, generation: "B" });
          });
          if (name === "timer-success") {
            await page.evaluate(() => window.__C04_LAB__.schedule());
            await page.waitForFunction(() => window.__C04_LAB__.snapshot().callbacks === 1);
            assert.equal((await snapshot(page)).state, "ready");
          } else if (name === "simulated-pagehide-boundary") {
            entry.departureStimulus = await page.evaluate(() => {
              window.__C04_LAB__.schedule();
              const event = new PageTransitionEvent("pagehide", { persisted: false });
              window.dispatchEvent(event);
              return { trusted: event.isTrusted, persisted: event.persisted, nativeProof: false };
            });
            assert.equal(entry.departureStimulus.trusted, false);
            await page.waitForTimeout(750);
            entry.state = await snapshot(page);
            held(entry.state);
            assert.equal(entry.state.callbacks, 0);
          } else {
            await page.getByRole("button", { name: "Run local artifact check" }).focus();
            await page.keyboard.press("Enter");
            if (["cancel-late-body", "simulated-visibility-boundary"].includes(name)) {
              await finiteWait(() => lab.pending.size > 0, "config body was not held");
              await page.evaluate(() => window.__C04_LAB__.schedule());
              if (name === "simulated-visibility-boundary") {
                // This is explicitly NOT native background/resume evidence.
                // Headless Chrome kept both tabs visible in the preserved probe.
                entry.visibilityStimulus = "synthetic state/event; native background/resume remains unqualified";
                await page.evaluate(() => {
                  const original = Object.getOwnPropertyDescriptor(document, "visibilityState");
                  let state = "hidden";
                  try {
                    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
                    document.dispatchEvent(new Event("visibilitychange"));
                    state = "visible";
                    document.dispatchEvent(new Event("visibilitychange"));
                  } finally {
                    if (original) Object.defineProperty(document, "visibilityState", original);
                    else delete document.visibilityState;
                  }
                });
              } else await page.getByRole("button", { name: "Hold local controller" }).click();
              lab.release();
            }
            await page.waitForFunction(() => window.__C04_LAB__.snapshot().completed !== null);
            if (name.startsWith("timeout-") || ["cancel-late-body", "simulated-visibility-boundary"].includes(name)) {
              lab.release();
              await page.waitForTimeout(750); // finite observation after the real 600 ms callback deadline
            }
            const state = await snapshot(page);
            entry.state = state;
            guarded(state);
            assert.equal(state.completed, name.startsWith("clean-"));
            if (!name.startsWith("clean-")) held(state);
            if (["cancel-late-body", "simulated-visibility-boundary"].includes(name)) assert.equal(state.callbacks, 0);
            if (name === "simulated-visibility-boundary") {
              assert.ok(state.events.includes("hidden") && state.events.includes("visible"));
              assert.deepEqual(state.visibilityEvidence, [{ state: "hidden", trusted: false }, { state: "visible", trusted: false }]);
            }
            if (name.startsWith("clean-")) {
              const reads = lab.requests.slice(beforeReads);
              assert.deepEqual(reads.map((request) => request.target), ["/institutional-alignment.html", lab.artifact.configPath(lab.generation)]);
              assert.ok(reads.every((request) => request.method === "GET" && !request.hasCookie && !request.hasAuthorization));
            }
            if (name === "config-mutation") assert.equal(lab.requests.length, beforeReads);
            if (name === "cancel-late-body") {
              const filename = `${viewport.width}-held.png`;
              await page.screenshot({ path: path.join(runDirectory, filename), fullPage: true });
              entry.screenshot = filename;
              await page.getByRole("button", { name: "Reload local lab" }).focus();
              lab.setFault("none");
              await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.keyboard.press("Enter")]);
              const reloaded = await snapshot(page);
              guarded(reloaded);
              assert.equal(reloaded.state, "ready");
              assert.equal(reloaded.completed, null);
              assert.equal(reloaded.callbacks, 0);
              entry.explicitKeyboardReload = reloaded;
            }
          }
        }
        assert.equal(unexpected.length, 0, "unexpected requests must stop qualification");
        assert.equal(pageErrors.length, 0);
        assert.ok(network.every((request) => request.method === "GET" && !request.body && !request.hasCookie && !request.hasAuthorization));
        // Controlled 503/redirect and deliberately blocked script may emit only
        // browser network errors. They are retained, not suppressed or ignored.
        const networkFailureExpected = ["http-error", "redirect", "module-blocked"].includes(name) || name.startsWith("timeout-");
        assert.ok(consoleErrors.every((message) => networkFailureExpected && /^Failed to load resource:/.test(message)), "unexplained console error");
        entry.pass = true;
      } catch (error) {
        entry.error = error.message;
        throw error;
      } finally {
        clearTimeout(deadline);
        results.push(entry);
        await context.close();
        await lab.close();
        await writeFile(path.join(runDirectory, "results.json"), JSON.stringify(report(), null, 2) + "\n");
        process.stdout.write(`${viewport.width} ${name}: ${entry.pass ? "PASS-BOUNDED" : "HOLD"}\n`);
      }
    }
  }
  const final = report();
  assert.equal(final.qualification, "PASS-BOUNDED");
  await writeFile(path.join(runDirectory, "results.json"), JSON.stringify(final, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ qualification: final.qualification, fullC04: final.fullC04,
    sourceRevision, sourceDirty, cases: results.length, runDirectory, resultsHash: digest(JSON.stringify(final, null, 2) + "\n") }) + "\n");
} catch (error) {
  await writeFile(path.join(runDirectory, "failure.json"), JSON.stringify({ ...report(), error: error.message }, null, 2) + "\n");
  throw error;
} finally { if (browser) await browser.close(); }
