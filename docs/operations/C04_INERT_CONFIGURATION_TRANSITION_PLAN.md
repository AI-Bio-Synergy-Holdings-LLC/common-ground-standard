# C04 Inert Configuration Transition Qualification Plan

Date: October 13, 2026
Status: Source and test preparation only. Local reload evidence is bounded; native history freshness is HOLD. No hosted execution or release clearance.

## Scope and authority

The owner authorized C-04 source/test-only preparation after governance
`33ba276e107c0c80cde4a42e5e62b038f28aaf99`. This branch starts at canonical site
`3e60394319a38ef28a2188f3f0b7d469c07bc0ee`. It adds test fixtures, a local browser
harness, regression coverage and this plan. Public HTML, client/transport code, the
Render builder, Blueprint, runtime pin, public mirrors and dependencies are unchanged.
Tests and this operations directory are excluded from the existing public build.

Keep production Auto-Deploy Off, Blueprint Auto Sync No/paused, staging auto-deploy
and previews Off, all provider modes false, and forms `mrpezwok`/`mljgrzbq` disabled.
R-016/R-017 remain OPEN under the approved Charter. This task changes no provider
setting and makes no Google or hosted-site request. Any read-only freeze/form
observations made before source publication are dated in the PR handoff, not
inferred from fixture tests. The preceding merge checks are in the
[governance execution receipt](https://github.com/AI-Bio-Synergy-Holdings-LLC/Pivot-Common-Ground-Partnership/pull/18#issuecomment-6156992680).
No merge, deployment, token/receipt test, enablement, activation or full-site refresh
is authorized by this plan.

## Test architecture

`test/helpers/inert-config-transition.mjs` creates exactly two inert generations,
A and B. They both set the real intake global to null and all five test-only flags
to false. Only their explicit fixture marker changes, producing distinct config
bytes and fingerprinted script URLs through the existing fingerprint helper.
These are not verification/live build modes or real institutional pages.

The ephemeral server binds only `127.0.0.1`. It serves fixed in-memory resources,
requires its exact Host, rejects unknown/traversal/absolute targets and accepts
only GET/HEAD. It exposes no HTTP activation/control API, repository files,
submission endpoint or data store. Operator-side generation changes affect memory
only. Pages contain no form or input and no Google/provider loader. Every response
uses no-store/no-cache, no-index, nosniff and a fixture CSP with connect-src and
form-action none. The raw artifact also cannot submit when JavaScript is disabled.

`test/browser/inert-config-transition.mjs` retains one fresh unauthenticated tab
through A load, ordinary B reload, repeat B reload, A rollback and controlled stale
HTML/config negative cases. It verifies bytes, hashes, script references, the null
global, false flags and meaningful rendering. Passive Playwright and Chromium CDP
request/response observations reject external or non-GET/HEAD requests. No routing,
cache disabling, cache-busting parameter, secret or real form data is used.

The final history probe navigates away from A, changes the server to B, and uses
Chromium's public history and read-only DOM diagnostics. It is separate because
[Playwright does not support BFCache navigation](https://playwright.dev/docs/next/api/class-page#page-go-back).
The harness audits cache-related Chrome arguments, removes Playwright's BFCache
disabling default in the manual runner, and performs no later Page interaction
after the history probe. Stale restoration is HOLD, never repaired into PASS by a
reload or by disabling BFCache.

## Local observations and limitations

Desktop 1440x960 and mobile 390x844 on Chrome 155.0.8059.40 observed:

| Check | Local result |
| --- | --- |
| A to B retained-tab reload and repeat reload | PASS bounded; distinct current hashes/fingerprints and two uncached HTML/config observations per phase |
| B to A rollback reload | PASS bounded; exact original A bytes/fingerprint restored |
| Deliberately stale HTML and config responses | Both detected; controlled negative cases, not application failures |
| History after server A to B change | HOLD on both viewports; BFCache restored A, `persisted` true, zero new HTML/config responses |
| Rendering and request boundary | Meaningful title/content, no overlay/overflow or unexpected page warnings/errors; no forms; 22 observed requests per viewport, all loopback GET; no external/transmitting request |

Config A fingerprint is `a3d61de9c5d6f341`; B is `2b677427511a4556`.
The history finding demonstrates a fixture counterexample to treating no-store
alone as history freshness. Chrome's
[no-store BFCache behavior](https://developer.chrome.com/docs/web-platform/bfcache-ccns)
supports this distinction. The real institutional client was not exercised here;
this is not a demonstrated production defect or permission to change that client.

Preparation retained an initial Playwright history/load timeout rather than
counting it as fresh evidence. CLI dynamic-import/require restrictions, a Windows
adapter import correction and command-line audit setup were resolved before the
final harness run; they are harness/setup limitations, not hosted application
failures. The evidence stays outside Git in the task's `output/playwright/`
directory. Final full-SHA execution, custody hashes, CI and review belong in the PR
handoff after the candidate exists; earlier or dirty-tree runs do not transfer.

## Reproduction and exit rules

Dependency-free unit/structural checks run in existing exact-head Node CI through
`npm run check` and `npm run validate:example`. The manual browser harness is not
automatically executed by CI and no Playwright dependency/download is added.

With a previously installed official Playwright library and Chrome, run:

```text
node test/browser/run-inert-config-transition.mjs --playwright-module ABSOLUTE_PATH_TO_INSTALLED_PLAYWRIGHT_INDEX_MJS --output ABSOLUTE_DIRECTORY_OUTSIDE_THIS_REPOSITORY
```

The runner records source SHA/dirty state, separate desktop/mobile results and
screenshots in a unique external run directory, closes server/browser contexts,
and exits nonzero on a history HOLD. It never attaches to an authenticated profile.
Local Node versions and browser/driver versions must be recorded alongside CI's
exact 24.21.0 pin; local success is not a substitute for exact-candidate CI.

Source-preparation exit requires green exact-head CI, bounded diff review,
unchanged public build/holds/policy, resolving documentation links, and an honest
handoff preserving the native-history HOLD. Those checks do not close C-04 or
R-016. Before any hosted gate, separately review/dispose the history finding and
approve an exact artifact and test design; do not deploy these fixture files by
merging the test branch or changing the public builder.

A future hosted proposal must name the full candidate/artifact SHA, service and
paths, two inert generations, operator change mechanism, applied headers,
GET/HEAD-only boundaries, passive native observations, stop/cleanup controls,
evidence custody and required pre/post freeze/form checks. No token, form, live
mode, provider credential or transmission may be introduced into that proposal.
Hosting/settings actions require separate authorization. Even a hosted inert-fixture
PASS would not establish actual verification-to-live or receipt clearance.

## Remaining operational decisions

C-05 remains held for a bounded plan to verify independent recipient-mailbox
delivery and determine whether trustworthy score evidence is available. A
processed notification is not mailbox delivery. Do not repeat historical receipts
automatically or invent a missing score; unavailable required proof remains HOLD
unless an explicitly approved Charter change addresses it.

C-06 needs a separately authorized private owner-led R-017 residual-misuse
assessment and accountable decision. No secret inspection/publication or automatic
risk closure belongs to this test branch. Production checks/activation and the
later full-CGS refresh remain separate C-07/C-08 decisions.
