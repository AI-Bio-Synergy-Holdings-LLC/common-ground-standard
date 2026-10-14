# C-04 finite qualification package and legacy-client containment design

Status: source/test-only proposal. Full C-04 **HOLD**; R-016 and R-017 **OPEN**.
No merge, deployment, provider change, token/receipt/deletion test, enablement,
activation, outreach, or whole-site refresh is authorized by this package.

## Anchors and proof boundaries

- Canonical site baseline: `8af3a67fe18fd2769129fe353ae4bc1d03050d75`.
- Canonical governance baseline: `1696298389aa052cecd064e8b42ad5148686a9fd`;
  Charter v0.6 Sections 1–15 remain operative. This package does not amend it.
- Public client SHA-256 (LF-normalized):
  `f025d109ffeab27f68bdba45578e9cdb930eb6c6a9e1154ba00cb386b3176471`.
- Provider controls remain required: both production freezes; staging automatic
  deployment/previews off; all five mode flags false; production `mrpezwok` and
  staging `mljgrzbq` disabled. Source-only tests do not freshly attest provider UI.

The existing 97 dependency-free regressions, including 12 lifecycle cases,
remain unchanged. Existing manual actual-client tests assess the full public
page with null configurations. The Oct-14 hosted retry demonstrated bounded
current/null-config behavior, not a configuration transition. Lost custody of
older predeployment tabs remains missing evidence, not a reproducible failure.

The new component lab extracts the **exact pinned public lifecycle controller**.
It exercises `verify()` using real loopback HTTP/browser fetch, SHA-256,
abort signals, body reads and the unmodified five-second timeout. It does not
load the rest of `site.js`, its public mode parsers, CAPTCHA callbacks or the
Formspree transport. Component readiness is not intake readiness: the fieldset
and submission button remain disabled, the form has no action/method, hidden
metadata stays empty, and CSP forbids form action. Inert A/B configurations use
`OFFLINE-NOT-AN-INTAKE-MODE` with every mode flag false, no endpoint/key/code.

## Finite local acceptance contract

Exactly 26 cases per viewport (1440×960 and 390×844), 52 total. Each case has a
12-second hard context-close deadline; browser operations are bounded to seven
seconds. Real timeout cases observe the unmodified five-second lock, then a
750-ms post-cancellation window beyond the 600-ms inert callback deadline.
Failure/ambiguity stops the matrix, preserves partial evidence and yields HOLD.
No interactive stdin, open-ended polling, retries or automatic scope expansion.

| Case family | Count per viewport | Required evidence |
| --- | ---: | --- |
| Unchanged A and B | 2 | Two static GETs; current fingerprints/identity; no query selector, cookies (despite a synthetic local cookie jar), authorization or body; guards remain disabled |
| Changed/faulty artifacts | 14 | A→B and B→A, client change, foreign/duplicate/missing refs, stale/malformed/tampered config, oversized HTML/config, weak cache header, redirect, HTTP error each hold |
| Timeout HTML, config, config body | 3 | Actual timeout aborts; held state survives release of delayed local response |
| Simulated visibility boundary | 1 | Explicitly synthetic hidden/visible states/events (untrusted); real pending body aborted; controller does not revive/replay |
| Explicit cancel with late body | 1 | Held state, empty fields, zero inert callbacks after release; keyboard reload obtains new guarded lab |
| In-memory identity mutation | 1 | Immediate hold without artifact GET |
| Simulated pagehide boundary | 1 | Explicitly synthetic/untrusted pagehide locks and cancels a real inert timer; not native navigation or persisted-return proof |
| Inert timer positive control | 1 | Exactly one inert callback while valid; never a CAPTCHA/provider callback |
| JavaScript disabled / runtime blocked | 2 | Raw controls remain disabled; test button cannot run artifacts |

All browser cases are loopback-routed as a defensive network boundary. They are
**not native cache, BFCache, CDN, hosted background/suspend or whole-route proof**.
The allowlist rejects foreign hosts, unknown targets/queries and all methods
other than GET/HEAD. Fault control exists only in the Node closure, not an HTTP
administrative endpoint. Request/error records, failed cases and screenshots
must be retained outside the repository; never include real institutional data.
Only expected network errors for deliberately faulted/blocked resources are
classified; unexplained console errors fail qualification.

Exploratory headless Chrome 155 tab-switch, minimize and freeze/resume probes
kept `visibilityState` visible without hidden/visible events. Their failed
background waits remain HOLD evidence outside the repository. The synthetic
case is explicitly labeled and records `isTrusted: false`; it is not a substitute
for independent native hosted background/resume qualification. No public
controller condition is changed to make these tests pass.

The component's native-departure exploratory observers also failed to retain a
trusted snapshot; that missing-custody probe remains HOLD, without a public
behavior conclusion. The final component case explicitly records a synthetic,
untrusted pagehide stimulus instead. Existing full-page/native-history tests
and their earlier bounded evidence remain unchanged; no new native navigation
or persisted-return proof is claimed by this package.

## Execution and evidence

`npm run check` runs the dependency-free package and all prior regressions.
`npm run validate:example` retains the checksum-only golden-package check.
Exact-head CI uses the existing workflow and pinned Node 24.21.0. The opt-in
browser runner requires an already installed Playwright library and Chrome:

```text
node test/browser/run-c04-artifact-qualification.mjs --playwright-module ABSOLUTE_INDEX_MJS --output ABSOLUTE_EXTERNAL_DIRECTORY
```

No dependency/browser installation, authenticated profile or hosted target is
needed. Output includes revision, dirty flag, public/controller hash, actual
Node/Chrome versions, case origins, requests, states, console errors and partial
failure evidence. A dirty exploratory run is not exact-head evidence; rerun
after commit without further source changes. Inspect desktop/mobile held-state
screenshots. `PASS-BOUNDED` never changes the top-level C-04 HOLD.

This package changes tests, documentation and test-script wiring only. Public
source, builder, Render policy, runtime pin, dependencies and governance mirrors
must remain unchanged. Confirm the diff, deployable-input equivalence and
isolated-build exclusion proof;
do not rebuild destructively over an existing checkout's `dist-render`.

## Legacy-client containment: decision required, not implemented

An already loaded old client cannot be retrofitted by updating HTML/config or
`site.js`. Waiting an arbitrary interval, a cache-bust URL, a fresh browser,
advisory reload or an empty provider inbox does not prove containment. Existing
old production clients may still know the legacy submission endpoint.

Two enforceable designs require a separately approved implementation:

1. **Retire the legacy endpoint permanently.** Keep `mrpezwok` disabled and never
   reuse it for activation. Under separate provisioning/source authority,
   introduce a new production endpoint for the qualified client; retain strict
   domain restrictions and provider-last activation. Old clients continue to
   target the disabled endpoint. This isolates legacy endpoint authority but is
   not authentication of every new client or proof against copying a public
   endpoint. The builder currently pins `mrpezwok`; changing it is new scope.
2. **Server-enforced acceptance boundary.** A separately reviewed first-party
   intake gateway could reject legacy paths/artifact generations and validate
   short-lived server-issued authority before forwarding. A client-supplied
   version label alone is spoofable. This changes the architecture and privacy
   surface. Do not assume Formspree supports per-client version enforcement;
   capability and bypass resistance need separate verification.

Recommend endpoint retirement as the smaller containment decision, subject to
steward approval and a revised exact-candidate plan. No endpoint is provisioned,
rotated, enabled or deleted here. Do not lift either freeze. Any alternative or
residual-risk disposition needs an explicit steward record consistent with the
charter, not an automatic waiver of Section 15, R-016 or R-017.

## Later separately authorized hosted qualification

After local evidence and exact-head CI/review, reconcile governance evidence
under separate authority. A later hosted gate must specify exact inert A/B
candidate commits and a finite approved matrix before deployment. Prospectively
retain and label actual A tabs **before** each approved staging deployment,
record their custody and B artifact hashes, then test old-tab verification,
background/resume, cancellation/late work and explicit reload. Keep all modes
false, forms disabled and both freezes throughout. Never reconstruct missing
custody with a new tab or silently substitute routed fixtures for hosted proof.

If a real-client null-config route cannot execute the required preflight, that
gap stays explicit; adding a hosted diagnostic hook is a separate source gate.
Callback/transport branches require a separately reviewed non-transmitting
test design or separate provider-test authority. This package supplies neither.

Full C-04 can close only after its required hosted/transition and legacy-client
evidence and explicit governance disposition are complete. C-05 operational
receipt controls, C-06 risk disposition and C-07 final exact-commit activation
authorization are separate, still incomplete gates. C-08 whole-CGS refresh and
public launch/video remain deferred until explicit institutional closeout.
