#!/usr/bin/env node

import process from "node:process";
import {
  PublicEvidenceValidationError,
  canonicalizeJson,
  createEvidenceReceipt,
  validationSummary,
  verifyEvidenceReceipt,
} from "../lib/public-evidence.mjs";

const usage = `Usage:
  node evidence-validator/bin/cgs-evidence.mjs validate <package-directory>
  node evidence-validator/bin/cgs-evidence.mjs receipt <package-directory>
  node evidence-validator/bin/cgs-evidence.mjs verify <package-directory> <receipt-file>

Commands are offline, deterministic, dependency-free, and never execute package content.
validate emits a structural-validity summary; receipt emits canonical receipt JSON; verify
checks a canonical receipt against the exact manifest and declared file bytes.`;

async function main() {
  const [command, packageDirectory, receiptPath, ...extra] = process.argv.slice(2);
  if (command === "--help" || command === "-h") {
    process.stdout.write(`${usage}\n`);
    return;
  }
  if (extra.length > 0 || !packageDirectory) {
    throw new Error(usage);
  }

  if (command === "receipt") {
    if (receiptPath) throw new Error(usage);
    process.stdout.write(await createEvidenceReceipt(packageDirectory));
    return;
  }

  if (command === "validate") {
    if (receiptPath) throw new Error(usage);
    const receipt = JSON.parse(await createEvidenceReceipt(packageDirectory));
    process.stdout.write(`${canonicalizeJson(validationSummary(receipt))}\n`);
    return;
  }

  if (command === "verify") {
    if (!receiptPath) throw new Error(usage);
    const receipt = await verifyEvidenceReceipt(packageDirectory, receiptPath);
    process.stdout.write(`${canonicalizeJson(validationSummary(receipt))}\n`);
    return;
  }

  throw new Error(usage);
}

main().catch((error) => {
  const failure =
    error instanceof PublicEvidenceValidationError
      ? { code: error.code, location: error.location, message: error.message, valid: false }
      : { code: "CLI_USAGE", message: error.message, valid: false };
  process.stderr.write(`${canonicalizeJson(failure)}\n`);
  process.exitCode = 1;
});
