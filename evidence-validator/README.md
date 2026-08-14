# Common Ground public-evidence validator

This directory defines the closed `common-ground-public-evidence/v0.1`
contract and a dependency-free Node.js validator for public-review evidence
packages. Validation is offline, deterministic, read-only, and non-executing.
Package files are read only as bytes; they are never imported, evaluated, or
launched.

## Package layout

Each package is one directory containing:

- canonical `manifest.json` using the contract in
  `schema/common-ground-public-evidence.v0.1.schema.json`;
- every evidence file declared by the manifest, and no undeclared file; and
- optional canonical `receipt.json`, which is excluded from the evidence-file
  inventory and can be verified against the exact package bytes.

The manifest must be UTF-8 canonical JSON: object keys sorted
lexicographically, no insignificant whitespace, safe-integer numbers only,
and exactly one trailing LF. Arrays whose ordering affects the receipt are
also required to be sorted by their documented identifier or path. Duplicate
JSON keys, unsafe or case-colliding paths, symlinks, missing or undeclared
files, and byte-count or SHA-256 mismatches are rejected.

`assetRegistryId` is either `null` or an authorized registry identifier in
the form `IP-<digits>`. Repository names, development names, project titles,
and product names are not accepted as asset identity.

## Claim-status boundary

The manifest records exactly one primary status and its matching authority
shape:

| Primary status | Required authority kind | Authority reference |
| --- | --- | --- |
| `DRAFT_ASSERTION` | `SELF_DECLARATION` | `null` |
| `REVIEW_RECORD` | `REVIEW_AUTHORITY` | public HTTPS URI |
| `ALIGNMENT_RECORD` | `ALIGNMENT_AUTHORITY` | public HTTPS URI |
| `ENDORSEMENT_RECORD` | `ENDORSEMENT_AUTHORITY` | public HTTPS URI |
| `CERTIFICATION_RECORD` | `CERTIFICATION_AUTHORITY` | public HTTPS URI |

`grantsStatus` must always be `false`. An authority reference is only a
declared public pointer; this validator does not authenticate it or infer that
the referenced authority acted. Mismatched status/authority pairs and
authority-free non-draft claims are rejected.

Every manifest must use `STRUCTURAL_VALIDITY_ONLY` and the exact v0.1 claim
boundary. A successful result establishes only structural completeness and
byte-level consistency. It does **not** establish truth, evidence sufficiency,
independence, review, alignment, endorsement, certification, compliance,
partnership, pilot status, public benefit, or authority.

## Commands

Node.js 24 or later is required. No package installation or network access is
needed.

```text
node evidence-validator/bin/cgs-evidence.mjs validate <package-directory>
node evidence-validator/bin/cgs-evidence.mjs receipt <package-directory>
node evidence-validator/bin/cgs-evidence.mjs verify <package-directory> <receipt-file>
```

`validate` emits a deterministic summary. `receipt` emits canonical receipt
JSON to standard output without changing the package. `verify` recalculates
the manifest digest, every file digest, and the package digest before
accepting a canonical receipt.

Run the complete offline suite with:

```text
npm test
npm run check
npm run validate:example
```

The synthetic example under `examples/golden` is checksum-only and confers no
substantive status. Issues #4, #6, and #7 remain public-review questions; this
validator does not resolve or close them.
