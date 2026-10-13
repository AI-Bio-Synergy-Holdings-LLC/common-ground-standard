# C04 Actual-Client Lifecycle Assessment and Fail-Closed Design

Date: October 13, 2026
Status: Assessment and design only. Lifecycle freshness is HOLD; no public-client remediation or release clearance.

## Decision and authorization boundary

The owner authorized actual-client lifecycle assessment and fail-closed design,
limited to source and non-transmitting local tests. This extends the
[inert transition plan](C04_INERT_CONFIGURATION_TRANSITION_PLAN.md); it does not
replace its historical results or authorize a public implementation change.

The actual unchanged institutional client can return through local native browser
history with an old configuration marker and previously enabled local-test
controls. A separately labeled inert DOM seed also survives restoration. Prepare
a separately authorized public-client lifecycle remediation before attempting to
qualify a configuration transition. C-04 and R-016/R-017 remain OPEN.

Public HTML, `site.js`, CSS, Render builder, Blueprint, dependencies, runtime pin,
public governance mirrors and the governance repository remain unchanged. Keep
both production deployment freezes, staging auto-deploy/previews Off, all provider
modes false and forms `mrpezwok`/`mljgrzbq` disabled. No merge, deployment,
Google/token test, receipt/submission, form enablement or activation is authorized.
This is not full-route release clearance or authorization for the later CGS refresh.

## Source baseline and findings

Canonical public source is site
`3e60394319a38ef28a2188f3f0b7d469c07bc0ee`; governance is
`33ba276e107c0c80cde4a42e5e62b038f28aaf99`. The helper refuses to run if these
LF-normalized public resource hashes change:

| Public resource | SHA-256 |
| --- | --- |
| `site.js` | `f8bafbea4019714604ed060b295809ba061108521955755008da897843bee01a` |
| `institutional-alignment.html` | `52d3095df3ee56b179ed375da1153c30bba07dfc9fec90588c3828a3936645fd` |
| `styles.css` | `04e8ad9f65dbe6ee9c345bc39497c186cb3c511816e738164617fce4e4bb39ef` |

The sole `pageshow` handler calls `markLoaded`, which changes visual body classes.
It does not lock the form, clear transport/token state or refresh configuration.
`initRecaptchaForms` runs once at initialization; its bound-form check prevents
rebinding, and its mode/configuration variables are captured in that binding.
There is no institutional `pagehide` invalidation or lifecycle epoch check.

Source inspection also identifies a late-result risk to address in design:
the CAPTCHA promise can populate the token and call `requestSubmit` after
asynchronous completion. There is no lifecycle/configuration generation check in
that callback. This is a source inference, not an executed token, submission or
demonstrated production-live failure. The production-origin gate was not bypassed.

## Non-transmitting test architecture

`test/helpers/actual-client-lifecycle.mjs` serves a fixed resource allowlist on an
ephemeral `127.0.0.1` port, with its exact Host and GET/HEAD only. No HTTP control
endpoint, arbitrary file serving, transport handler, data store or credentials are
present. The seeded action is an unhandled loopback path, not Formspree. A strict
local CSP uses `connect-src 'none'`, `form-action 'none'` and self-only scripts.
It is stricter than hosted CSP, not evidence that hosted controls are identical.

HTML differs only in its config script reference. Actual `site.js` and CSS are
unchanged; no framework substitute or mocked client replaces them. A/B configs
set the real intake global to null and all five fixture flags false. Their marker
and fingerprint change, not an intake mode. A is `a3d61de9c5d6f341`; B is
`2b677427511a4556`.

Institutional HTML/config retain the declared Blueprint no-store directives.
Other local resources use `no-cache` to revalidate. The Blueprint does not declare
no-store for those assets; this local choice is not a claim about hosted CDN
headers. Earlier exploratory runs applied no-store to every asset and did not
observe BFCache: Chrome reported `MainResourceHasCacheControlNoStore`,
`JsNetworkRequestReceivedCacheControlNoStoreResource` and
`BrowsingInstanceNotSwapped`. Those runs are retained, not presented as proof
that the actual client cannot restore. No hosted header or cache control changed.

`test/browser/actual-client-lifecycle.mjs` loads A, observes actual initialization,
then adds read-only lifecycle/submit-event observers. It navigates to a neutral
local checkpoint, changes only the in-memory server marker to B, and returns with
Chromium's native CDP history API. No interception, cache disabling, arbitrary
cache-busting or forced lifecycle event is used. Chrome launch arguments are
audited. The final history probe avoids unsupported Playwright BFCache navigation;
there is no subsequent Playwright Page interaction before context closure.

Eight fresh unauthenticated contexts cover desktop 1440x960 and mobile 390x844,
natural versus seeded state, and top-of-page versus form-scrolled departure.
Visible institution/contact fields stay empty. Seeds change only DOM transport
attributes and synthetic hidden metadata/token state. They do not set a live
global, execute a Google API, represent a real token or invoke submission.

## Local observations

| Check | Observed result |
| --- | --- |
| Initial actual client | Null config, five false fixture flags, local test handler installed; guard enabled only after installation, no action/method, empty token and visible fields |
| Native A-to-B history, all eight contexts | `pagehide` and `pageshow` persisted true; restored A fingerprint, zero new institutional HTML/config responses; lifecycle qualification HOLD |
| Natural restored form | Local-test controls remain enabled, action/method absent and token empty; not evidence of provider transmission |
| Seeded restored form | Unhandled loopback action, POST attribute, clearly synthetic token-ready/token and mode/version metadata retained; not production-live execution |
| Request/render boundary | Loopback GET only, zero external or mutating requests, zero observed submit events, Google API absent; no unexpected console errors, error overlay or document overflow |

Favicon responses can occur during restoration, so zero HTML/config responses
must not be restated as zero total network responses. The classifier checks
freshness and the proposed restoration lock requirement, not existing test-mode
usability. Initial enabled test controls are intentional; their persistence alone
does not establish a current live-intake defect.

The in-app Browser separately confirmed the local rendered page, empty test-mode
form and absent action/method. It is a visual/DOM check, not native cache evidence.
Chrome 155.0.8059.40 and installed Playwright 1.64.0-alpha-1790635538000 were used
for native evidence; local Node was 24.19.0. CI's 24.21.0 pin remains unchanged.
Other browsers, hosted CDN behavior, real modes, token callbacks and provider
receipt behavior remain unqualified.

## Proposed fail-closed lifecycle contract — not implemented

1. On departure, synchronously lock the institutional fieldset and submit path,
   remove action/method, clear token and token-ready state, invalidate the active
   lifecycle epoch and cancel/neutralize pending timers and asynchronous work.
   Do not rely on async work completing before a page enters the history cache.
2. On every history restoration, lock first, before interaction or asynchronous
   revalidation. A restored bound form is not proof of current authorization.
   Clear restored transport/token/authorization metadata even when a previous
   handler exists. Do not use `unload` or disabling BFCache as the safety mechanism.
3. Obtain and validate a fresh same-origin current configuration/artifact identity
   before installing any permitted mode. A cached script's original `v` reference
   cannot prove that it is current. A hash is artifact identity, not authorization.
   Design the current-generation discovery and stale-client compatibility path
   explicitly; a new client's fix cannot repair a previously cached old client.
4. Ensure one handler consults current lifecycle state rather than permanently
   capturing an obsolete mode/config. Check its epoch and configuration before
   and after each async result and immediately before any separately authorized
   handoff. Ignore late results; never automatically replay or resubmit.
5. Missing, malformed, stale, off-origin, unavailable or ambiguous configuration,
   failed initialization, and disabled/blocked script paths remain structurally
   non-transmitting and show an accessible truthful hold state. Keep a synchronous
   submit guard while locked. No automatic contact-field transmission is allowed.
6. Restore only the controls appropriate to a freshly validated permitted mode.
   Null/test mode may regain its local-only handler, never a provider endpoint.
   Charter approval, host restrictions, server/provider disabled state and
   enable-last authorization remain independent controls; client flags alone do
   not confer live-intake authority. Preserve user-visible drafts only through an
   explicitly reviewed privacy-safe design; never log their values during QA.

Current-generation discovery, compatibility with previously loaded clients and
in-flight callback invalidation are implementation decisions requiring separate
source-remediation authorization. This document does not select or implement a
new server API, live flag, provider integration or deployment mechanism.

## Required regression gate for a future remediation

| Case | Required bounded evidence |
| --- | --- |
| Native persisted A-to-B return and B-to-A rollback | Lock/clear before interaction; old reference cannot authorize; new current identity validated before permitted local-only re-enable |
| Same-generation return and repeated initialization | Fresh validation still required; exactly one current handler, no duplicate submit/pending work |
| Retained action/method, token-ready and metadata seed | Inert state removed on departure and restoration, including effective fieldset/button lock |
| Late callback from an invalidated epoch | Offline stub result ignored; no requestSubmit, token handoff or endpoint restoration; labeled simulated evidence, not Google issuance |
| Missing/stale/malformed/off-origin discovery or script failure | Locked, no transport; include JavaScript-disabled and blocked-module raw HTML paths |
| Configuration changes while tab stays open | Bounded freshness/expiry design; check again before handoff; no silent auto-submit |
| Desktop/mobile/keyboard, CSP and no-index | Truthful accessible status, usable recovery, no overflow or unexpected console/network activity |
| Previously loaded old client | Separate compatibility assessment; do not claim remediation changes code already held in a history snapshot |

Retain original adversarial coverage. Offline stubs and synthetic events cannot
substitute for native history evidence. A native non-restoration is an explicit
coverage HOLD, not a restoration PASS. No regression may issue a real token or
submission under this gate. Hosted, provider and actual mode-transition evidence
each need separate exact-candidate authority.

## Reproduction, custody and next decision

Run dependency-free unit/syntax checks with `npm run check` and
`npm run validate:example`. The manual browser runner is opt-in, not CI or a build
step; no package download or authenticated-profile attachment occurs:

```text
node test/browser/run-actual-client-lifecycle.mjs --playwright-module ABSOLUTE_PATH_TO_INSTALLED_PLAYWRIGHT_INDEX_MJS --output ABSOLUTE_DIRECTORY_OUTSIDE_THIS_REPOSITORY
```

The runner records source SHA/dirty state, browser/Node versions, resource hashes,
headers, passive request/lifecycle observations and screenshots in unique external
directories. A completed assessment with lifecycle HOLD exits nonzero; it is not a
green qualification. Servers and browser contexts close even on failure. Preserve
failed exploratory evidence rather than overwriting it.

Full-SHA clean-tree execution, evidence custody hashes, fresh exact-head CI and
bounded COMMENT review belong in the PR handoff after the candidate exists.
Dirty-tree evidence and earlier head CI do not transfer. Green source/test CI
cannot close C-04, R-016/R-017 or authorize promotion.

Next strongest gate: separately authorize bounded public-client lifecycle
remediation with non-transmitting local regressions against this contract. Keep
both freezes, all provider modes false and both forms disabled. Governance
reconciliation, merges, hosted qualification, token/receipt testing, enablement,
activation and the later full-site refresh remain separate decisions.
