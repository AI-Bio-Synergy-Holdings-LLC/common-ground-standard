# Controlled Restart Charter: Common Ground Standard

Date: 2026-08-14

Repository: `AI-Bio-Synergy-Holdings-LLC/common-ground-standard`

Baseline default head: `20187a91f196832ca73d8b84f46b430b86368186`

Operational project ID: `common-ground-standard`

Asset registry ID: unassigned

## Decision

The COSMOS-CQA first bounded delivery, signed Control Plane review, and
protected central closeout satisfy the prerequisite for one further
repository admission. Central closeout PR #27 merged normally at
`2026-08-14T05:12:04Z` as
`dd86afd08cea3f532445a2eba14510458f0e968a`. The owner then explicitly
authorized the next strongest action, and the established implementation
order places Common Ground Standard next.

This protected charter admits exactly one repository to controlled
engineering. Common Ground Standard remains `PENDING_KICKOFF` until this
charter reaches `main` through the normal protected merge path. That merge
changes only this repository to `ACTIVE_CONTROLLED` and raises the engineering
active count from four to five.

After protected merge, the only engineering-active repositories are:

1. `AI-Bio-Synergy-Holdings-LLC/portfolio-control-plane`
2. `AI-Bio-Synergy-Holdings-LLC/lumical-studio`
3. `AI-Bio-Synergy-Holdings-LLC/QS-DMSS`
4. `AI-Bio-Synergy-Holdings-LLC/COSMOS-CQA`
5. `AI-Bio-Synergy-Holdings-LLC/common-ground-standard`

Every other organization repository remains `PENDING_KICKOFF`. The canonical
Synergy website monorepo remains outside the 42-repository organization
census and is not admitted by this record.

## Asset-identity boundary

The repository slug, project title, standard title, domain name, and
operational project ID are technical or public-project identifiers. They are
not registered asset names or asset-ownership mappings. `assetRegistryId`
remains null and the asset-mapping state remains `UNASSIGNED`.

Any future asset reference must use a separately authorized registry ID. This
charter does not create, infer, publish, or map one.

## First bounded delivery

Once this charter is merged, Common Ground Standard may have one protected
feature pull request active at a time. The first delivery is limited to a
dependency-free, offline evidence-package and claim-status boundary validator
for public-review records.

The delivery may address the structural portions of issues #4, #6, and #7,
but those issues must remain open. Public review must continue to decide
evidence sufficiency, governance legitimacy, alignment criteria, endorsement,
and any future certification model.

Authorized work is limited to:

- a closed, versioned `common-ground-public-evidence/v0.1` manifest contract;
- deterministic canonical JSON serialization and SHA-256 receipts for the
  manifest and its declared public evidence files;
- explicit, machine-readable separation among draft assertion, review,
  alignment, endorsement, and certification states, without granting or
  inferring any of them;
- required limitations, source references, evidence inventory, review-scope,
  and affected-party-governance declarations;
- local, non-executing validation that rejects duplicate keys, non-canonical
  data, unsafe paths, undeclared or missing files, size or digest mismatch,
  status conflation, omitted limitations, and unsupported authority claims;
- dependency-free Node.js library and command-line surfaces using only
  standard-library capabilities already available in CI;
- golden fixtures, negative-path tests, deterministic replay tests, source
  documentation, and checksum-only public examples; and
- explicit output language stating that structural validity and byte-level
  integrity do not establish truth, evidence sufficiency, alignment,
  endorsement, certification, compliance, partnership, pilot status, public
  benefit, or independent review.

The validator may confirm that a public-review package is structurally
complete and internally consistent. It may not decide whether evidence is
credible, sufficient, independent, representative, legally effective, or
scientifically valid.

This charter pull request contains governance records only. It does not alter
the standard, public website, forms, runtime behavior, dependencies, releases,
deployment configuration, public claims, or issue disposition.

## Retained prohibitions

The following remain prohibited:

- closing issues #4, #6, or #7 as satisfied by structural validation alone;
- changing substantive v0.2 requirements, no-go conditions, benefit-sharing
  terms, ecological triggers, student or worker rights, data rights, or
  affected-party governance in the first delivery;
- granting, inferring, or advertising review, alignment, endorsement,
  certification, compliance, partnership, sponsorship, pilot, procurement,
  or independent-audit status;
- representing self-declared, checksum-valid, or structurally valid evidence
  as substantively sufficient or independently verified;
- activating public institutional intake, accepting sensitive submissions,
  or changing Formspree, reCAPTCHA, analytics, cookie, or contact behavior;
- adding a backend, database, account system, identity provider, partner-data
  lane, private review room, data room, confidential submission path, or live
  provider integration;
- adding runtime or development dependencies, external package execution,
  network submission, or code execution from evidence packages;
- publishing a release, changing Render or Cloudflare configuration, or
  changing production deployment authority;
- any Holdings connector, credential, mount, token, network path, private
  asset-data access, or transaction path;
- Control Plane repository execution, actuation, automated merge, deployment,
  transaction, diligence, or Gate 6 authority;
- representing an internal development or repository identifier as registered
  asset identity;
- changing branch protection, required checks, rulesets, auto-merge, security
  features, or repository visibility under this charter;
- admin bypass, force push, history rewrite, unprotected merge, branch
  deletion, or mutation of a protected dirty clone; and
- activating a sixth repository without a separate protected charter and
  explicit owner approval.

## Entry controls

The admission baseline captured at `2026-08-14T05:19:54.2887130Z` is:

- public repository with default branch `main` at signed, verified commit
  `20187a91f196832ca73d8b84f46b430b86368186`;
- exact-head status rollup `SUCCESS`;
- zero open pull requests and seven open public-review issues;
- strict required `policy / Organization baseline` and
  `metadata / PR metadata` checks pinned to GitHub Actions app `15368`;
- conversation resolution required, linear history required, force pushes and
  branch deletion disabled;
- zero open Dependabot, CodeQL, and secret-scanning alerts;
- Dependabot security updates, secret scanning, and push protection enabled;
- one disabled ancillary Copilot ruleset and zero active ancillary rulesets;
- repository auto-merge disabled, with no setting change authorized;
- exact-head policy run `30781351252` successful;
- latest scheduled CodeQL run `31519391840` successful on the exact head; and
- public domain response `200 OK` with CSP, HSTS, permissions policy,
  referrer policy, nosniff, and frame-denial headers verified at
  `2026-08-14T05:20:13Z`.

## Exit criteria for the first bounded delivery

The first delivery is complete only when:

1. the feature PR is exact-head and every required check succeeds;
2. manifest contract, canonicalization, receipt, validation, negative-path,
   replay, documentation, and applicable static-site checks pass;
3. high and critical dependency and CodeQL findings and secret-scanning alerts
   remain zero unless separately accepted in a protected risk record;
4. validation is dependency-free, offline, deterministic, non-executing, and
   rejects malformed, unsafe, non-canonical, undeclared, missing, duplicated,
   status-conflated, limitation-free, and tampered inputs;
5. output clearly distinguishes structural integrity from truth, sufficiency,
   independence, review, alignment, endorsement, certification, compliance,
   partnership, pilot status, and public-benefit proof;
6. issues #4, #6, and #7 remain open for public review;
7. no substantive standard, public-intake, backend, provider, authentication,
   private-review, Holdings, execution, release, actuation, transaction,
   deployment-authority, or Gate 6 path is introduced;
8. the exact protected main rollup and any applicable Render build are green
   after the normal protected merge;
9. the audit log contains no `protected_branch.policy_override` event for the
   charter or delivery merge;
10. the observe-only Control Plane records a signed delivery review; and
11. the central organization ledger records the result through a protected
    pull request.

## Operating limit

This admission raises the organization from exactly four to exactly five
engineering-active repositories. A sixth repository cannot enter engineering
until Common Ground Standard completes this bounded delivery, the Control
Plane and central ledger record the result, and the owner explicitly
authorizes another charter.
