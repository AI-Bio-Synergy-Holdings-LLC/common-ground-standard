# C04 Client Lifecycle Remediation

Date: October 13, 2026
Status: Source candidate with bounded local tests. Full C-04 qualification remains HOLD.

## Scope and implemented controls

The owner authorized bounded public-client lifecycle remediation and
non-transmitting local tests from
`0cc4ea8ecd6f06abaceaff3d2cd69c0b79c1cbff`. The
[preceding assessment](C04_ACTUAL_CLIENT_LIFECYCLE_ASSESSMENT.md) is a historical
record of that earlier implementation and evidence, not current release clearance.

`site.js` now creates an institutional-only lifecycle controller before enabling
the form. It synchronously locks on page departure, persisted history return and
hidden-tab transitions. Locking disables the fieldset and submit button, removes
action/method, clears hidden transport and authority metadata, removes token-ready
and test-ready state, aborts pending requests and invalidates the lifecycle epoch.
Scheduled local redirects, token cleanup and integration retry delays cannot
replay after invalidation. Visible drafts are not logged or stored.

A restored document stays held, even if its configuration fingerprint still
matches. Recovery is an explicit **Reload current intake page** button outside
the disabled fieldset. Its accessible status warns that reloading clears unsent
entries. There is no automatic reload, rebind or resubmission. A new document must
initialize against its current configuration before permitted controls return.
The institutional page references a new client cache identity. CSS and unrelated
page functionality are unchanged.

Missing or unsupported configuration and incomplete initialization stay locked.
The submit capture guard checks the active epoch, configuration identity and
script references; duplicate pending attempts and unowned token-ready flags
cannot authorize a handoff. Production destination/origin and existing build
authorization checks remain in force.

For a future separately permitted transmitting mode, callbacks check lifecycle
state before and after asynchronous work. Before execution and handoff, static
public HTML/configuration are read with same-origin GET, no-store, credentials
omitted, redirects rejected and a five-second timeout. These reads contain no
form fields or integration-selector query. The current HTML must reference the
loaded config and client identities; config response bytes must match the
fingerprint and its JSON must match the initialized configuration. Missing,
changed, malformed or unavailable resources hold the document. Response text is
size-checked; fetched JavaScript is never evaluated. Hashes identify artifacts,
not governance authorization or provider enablement.

The local null-config route does not execute that transmitting branch. This gate
did not load Google, issue a real token, submit a record or change provider modes.

## Local verification

The existing isolated browser runner serves actual candidate HTML/client/CSS
through a fixed loopback GET/HEAD allowlist, with null intake configuration, five
false fixture flags and connect/form CSP restrictions. Sixteen fresh Chrome
contexts cover desktop 1440x960, mobile 390x844, A-to-B and B-to-A rollback,
natural and inert hidden-state seeds, and top/form-scrolled departure.

| Check | Bounded local result |
| --- | --- |
| Native persisted departure and history return | Form held and hidden transport state cleared before caching and on return |
| Old fingerprint while held | Preserved as stale history evidence; never treated as current authority |
| Explicit keyboard recovery | Enter activates only reload; new HTML/config/client bytes are fetched and the current null-config local handler initializes |
| Normal, JavaScript-disabled and CSP-blocked client | Desktop/mobile rendering and structural non-transmission pass; blocked-script console errors are explicitly expected, not suppressed |
| Missing or malformed runtime configuration | Actual client remains held with no transport and an available reload control |
| Offline asynchronous/static-read regressions | Timeouts, changed references, off-origin/missing/duplicate/tampered config, departure, retry cancellation and late synthetic result suppression pass |
| Request and rendering boundary | Loopback GET only; no form submission, external/mutating request, unexpected console failure, overlay or document overflow |

There are 97 dependency-free regressions, including twelve new lifecycle cases.
Existing adversarial coverage is retained. The actual-client fixture records new
explicit candidate resource hashes; earlier hashes/results remain in the
historical assessment and its exact-head evidence. The original inert-fixture
freshness classifier continues to reject stale, missing and unchanged identity.
Local restoration safety PASS does not turn old fingerprint freshness into PASS.

Offline tests execute the exact public controller and a late-result callback with
static-response stubs and inert sentinels. They do not invoke a provider API,
generate a token or simulate provider receipt. Native history evidence is separate
from these stubs. No routing or cache disabling is used in the native probe;
Chromium CDP remains the control path after restoration because
[Playwright Page history does not support BFCache](https://playwright.dev/docs/next/api/class-page#page-go-back).
No-store alone is not a restoration guarantee, as described by
[Chrome's BFCache documentation](https://developer.chrome.com/docs/web-platform/bfcache-ccns).

The opt-in manual runner uses installed Playwright/Chrome, adds no dependency and
never attaches to an authenticated profile:

```text
node test/browser/run-actual-client-lifecycle.mjs --playwright-module ABSOLUTE_PATH_TO_INSTALLED_PLAYWRIGHT_INDEX_MJS --output ABSOLUTE_DIRECTORY_OUTSIDE_THIS_REPOSITORY
```

Full regression/build checks run in a fresh isolated source copy, not against the
checkout's existing `dist-render`. Screenshots, JSON evidence and retained failed
setup probes remain outside the repository. Exact clean-head custody hashes,
candidate CI and bounded review are recorded in the PR handoff; dirty-tree or
earlier-head results do not transfer. Local Node 24.19.0 is separate from CI's
unchanged 24.21.0 pin. Browser tooling is connected but its Browser skill was not
listed; the established isolated Playwright library runner provides the native
local tests without downloads.

## Remaining qualification and authorization boundaries

Code already loaded in an older document cannot acquire this controller from a
new deployment. Previously cached old clients remain an explicit compatibility
limit. Provider disabled state and deployment freezes are independent safeguards;
a local test cannot dispose that limit or close R-016.

Hosted CDN/header behavior, real verification-to-live transitions, actual
transmitting-mode callbacks, other browsers, independent recipient-mailbox/score
evidence and R-017 disposition remain unqualified. Static identity checks cannot
eliminate a server/provider state change after a check; authoritative provider and
governance controls still apply. No legal or security assurance is inferred from
unit tests or green CI.

Keep production Auto-Deploy Off, Blueprint Auto Sync No/paused, staging
auto-deploy/previews Off, all provider modes false and forms
`mrpezwok`/`mljgrzbq` disabled. R-016/R-017 remain OPEN. Builder, Blueprint,
workflows, dependencies, runtime pin, public governance mirrors, Charter and the
governance repository are unchanged. No merge, deployment, token/receipt test,
form enablement, activation or full-site refresh is authorized.

Next decision is exact-head source/security review and, if separately approved,
governance reconciliation of this bounded evidence. Hosted qualification and
promotion require their own exact-candidate authorization; no production clearance
follows from this source-only result.
