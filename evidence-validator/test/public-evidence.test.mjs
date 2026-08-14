import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CLAIM_BOUNDARY,
  PublicEvidenceValidationError,
  canonicalizeJson,
  createEvidenceReceipt,
  inspectEvidencePackage,
  parseStrictJson,
  verifyEvidenceReceipt,
} from "../lib/public-evidence.mjs";

const temporaryDirectories = [];

test.after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })));
});

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function makePackage({ content = "synthetic evidence\n", mutate } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "cgs-evidence-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "evidence"));
  const evidence = Buffer.from(content, "utf8");
  await writeFile(path.join(root, "evidence", "summary.txt"), evidence);
  const manifest = {
    affectedPartyGovernance: {
      description: "No affected-party governance authority is established by this synthetic record.",
      sourceIds: [],
      status: "NOT_ESTABLISHED",
    },
    assetRegistryId: null,
    claim: {
      assertedBy: "Synthetic example author",
      authority: { kind: "SELF_DECLARATION", reference: null },
      grantsStatus: false,
      primaryStatus: "DRAFT_ASSERTION",
    },
    claimBoundary: CLAIM_BOUNDARY,
    files: [
      {
        bytes: evidence.length,
        mediaType: "text/plain",
        path: "evidence/summary.txt",
        sha256: sha256(evidence),
        sourceIds: ["SRC-001"],
      },
    ],
    limitations: [
      "This synthetic package is checksum-only and does not establish evidence sufficiency.",
    ],
    recordId: "CGR-TEST-001",
    reviewScope: {
      excluded: ["Substantive review or status determination"],
      included: ["Manifest structure and byte-level integrity"],
      purpose: "Exercise the offline validator with synthetic public-review evidence.",
    },
    schemaVersion: "common-ground-public-evidence/v0.1",
    sources: [
      {
        id: "SRC-001",
        retrievedOn: "2026-08-14",
        title: "Common Ground Standard public repository",
        uri: "https://github.com/AI-Bio-Synergy-Holdings-LLC/common-ground-standard",
      },
    ],
    title: "Synthetic public-evidence package",
    validatorEffect: "STRUCTURAL_VALIDITY_ONLY",
  };
  if (mutate) await mutate({ manifest, root });
  await writeFile(path.join(root, "manifest.json"), `${canonicalizeJson(manifest)}\n`, "utf8");
  return { manifest, root };
}

async function expectFailure(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof PublicEvidenceValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

test("strict JSON rejects duplicate keys", () => {
  assert.throws(
    () => parseStrictJson('{"recordId":"one","recordId":"two"}'),
    (error) => error instanceof PublicEvidenceValidationError && error.code === "DUPLICATE_KEY",
  );
});

test("canonical JSON is independent of object insertion order", () => {
  assert.equal(canonicalizeJson({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');
});

test("published schema is valid JSON and fixes the v0.1 boundary", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../schema/common-ground-public-evidence.v0.1.schema.json", import.meta.url), "utf8"),
  );
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, "common-ground-public-evidence/v0.1");
  assert.equal(schema.properties.claimBoundary.const, CLAIM_BOUNDARY);
});

test("golden package validates and receipt replay is deterministic", async () => {
  const { root } = await makePackage();
  const first = await createEvidenceReceipt(root);
  const second = await createEvidenceReceipt(root);
  assert.equal(first, second);
  const receipt = JSON.parse(first);
  assert.match(receipt.packageSha256, /^[a-f0-9]{64}$/u);
  await writeFile(path.join(root, "receipt.json"), first, "utf8");
  const verified = await verifyEvidenceReceipt(root, path.join(root, "receipt.json"));
  assert.equal(canonicalizeJson(verified), canonicalizeJson(receipt));
});

test("package content is never executed", async () => {
  const { root } = await makePackage({ content: "process.exit(99); throw new Error('executed');\n" });
  const result = await inspectEvidencePackage(root);
  assert.equal(result.receipt.files.length, 1);
});

test("non-canonical manifests are rejected", async () => {
  const { root } = await makePackage();
  const parsed = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  await writeFile(path.join(root, "manifest.json"), `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await expectFailure(inspectEvidencePackage(root), "NON_CANONICAL_MANIFEST");
});

test("duplicate manifest keys are rejected before validation", async () => {
  const { root } = await makePackage();
  const text = await readFile(path.join(root, "manifest.json"), "utf8");
  await writeFile(
    path.join(root, "manifest.json"),
    text.replace('"title":"Synthetic', '"title":"Duplicate","title":"Synthetic'),
    "utf8",
  );
  await expectFailure(inspectEvidencePackage(root), "DUPLICATE_KEY");
});

test("unsafe evidence paths are rejected", async () => {
  const { root } = await makePackage({ mutate: ({ manifest }) => (manifest.files[0].path = "../escape.txt") });
  await expectFailure(inspectEvidencePackage(root), "UNSAFE_PATH");
});

test("undeclared files are rejected", async () => {
  const { root } = await makePackage({
    mutate: async ({ root: packageRoot }) => writeFile(path.join(packageRoot, "extra.txt"), "extra\n"),
  });
  await expectFailure(inspectEvidencePackage(root), "UNDECLARED_FILE");
});

test("missing declared files are rejected", async () => {
  const { root } = await makePackage({
    mutate: async ({ root: packageRoot }) => rm(path.join(packageRoot, "evidence", "summary.txt")),
  });
  await expectFailure(inspectEvidencePackage(root), "MISSING_FILE");
});

test("declared byte-count mismatches are rejected", async () => {
  const { root } = await makePackage({ mutate: ({ manifest }) => (manifest.files[0].bytes += 1) });
  await expectFailure(inspectEvidencePackage(root), "SIZE_MISMATCH");
});

test("declared digest mismatches are rejected", async () => {
  const { root } = await makePackage({ mutate: ({ manifest }) => (manifest.files[0].sha256 = "0".repeat(64)) });
  await expectFailure(inspectEvidencePackage(root), "DIGEST_MISMATCH");
});

test("status and authority conflation is rejected", async () => {
  const { root } = await makePackage({
    mutate: ({ manifest }) => {
      manifest.claim.primaryStatus = "CERTIFICATION_RECORD";
    },
  });
  await expectFailure(inspectEvidencePackage(root), "STATUS_CONFLATION");
});

test("each non-draft status remains a declared record with matching public authority shape", async () => {
  const cases = [
    ["REVIEW_RECORD", "REVIEW_AUTHORITY"],
    ["ALIGNMENT_RECORD", "ALIGNMENT_AUTHORITY"],
    ["ENDORSEMENT_RECORD", "ENDORSEMENT_AUTHORITY"],
    ["CERTIFICATION_RECORD", "CERTIFICATION_AUTHORITY"],
  ];
  for (const [status, kind] of cases) {
    const { root } = await makePackage({
      mutate: ({ manifest }) => {
        manifest.claim.primaryStatus = status;
        manifest.claim.authority = {
          kind,
          reference: `https://common-ground-standard.org/authority/${status.toLowerCase()}`,
        };
      },
    });
    const { manifest } = await inspectEvidencePackage(root);
    assert.equal(manifest.claim.grantsStatus, false);
    assert.equal(manifest.claim.primaryStatus, status);
  }
});

test("non-draft status requires a public authority reference", async () => {
  const { root } = await makePackage({
    mutate: ({ manifest }) => {
      manifest.claim.primaryStatus = "REVIEW_RECORD";
      manifest.claim.authority.kind = "REVIEW_AUTHORITY";
    },
  });
  await expectFailure(inspectEvidencePackage(root), "UNSUPPORTED_AUTHORITY");
});

test("status grants are rejected", async () => {
  const { root } = await makePackage({ mutate: ({ manifest }) => (manifest.claim.grantsStatus = true) });
  await expectFailure(inspectEvidencePackage(root), "STATUS_GRANT");
});

test("omitted limitations are rejected", async () => {
  const { root } = await makePackage({ mutate: ({ manifest }) => (manifest.limitations = []) });
  await expectFailure(inspectEvidencePackage(root), "ARRAY_LENGTH");
});

test("development names cannot substitute for asset registry IDs", async () => {
  const { root } = await makePackage({
    mutate: ({ manifest }) => (manifest.assetRegistryId = "internal-development-name"),
  });
  await expectFailure(inspectEvidencePackage(root), "STRING_PATTERN");
});

test("case-insensitive path collisions are rejected", async () => {
  const { root } = await makePackage({
    mutate: ({ manifest }) => {
      const lower = manifest.files[0];
      manifest.files = [{ ...lower, path: "evidence/SUMMARY.txt" }, lower];
    },
  });
  await expectFailure(inspectEvidencePackage(root), "PATH_COLLISION");
});

test("platform device paths are rejected", async () => {
  const { root } = await makePackage({ mutate: ({ manifest }) => (manifest.files[0].path = "evidence/CON.txt") });
  await expectFailure(inspectEvidencePackage(root), "UNSAFE_PATH");
});

test("tampered canonical receipts are rejected", async () => {
  const { root } = await makePackage();
  const receipt = JSON.parse(await createEvidenceReceipt(root));
  receipt.packageSha256 = "0".repeat(64);
  const receiptPath = path.join(root, "receipt.json");
  await writeFile(receiptPath, `${canonicalizeJson(receipt)}\n`, "utf8");
  await expectFailure(verifyEvidenceReceipt(root, receiptPath), "RECEIPT_MISMATCH");
});
