# Institutional route: source-only deployment hold

This source qualification is not production clearance. R-016 and R-017 remain
open. The provider Auto-Deploy Off and Blueprint Auto Sync No / paused controls
remain independent holds; do not sync the Blueprint or deploy this branch.
Both institutional Formspree forms must remain disabled and every actual
institutional build-mode flag must remain false until separately authorized.

## Source controls

- `render.yaml` explicitly disables automatic deploys and Blueprint preview
  environments. Service `previews.generation` stays omitted, disabling service
  PR previews. A manual deployment or Blueprint sync is still an external
  action requiring its own authorization; source edits cannot enforce those
  provider controls by themselves.
- `.node-version`, `package.json` and the offline-validator workflow select the
  same exact Node version, 24.22.1 (the October 21 security release). The workflow
  checks out the PR head SHA, not a generated merge ref. A provider `NODE_VERSION` environment variable has
  higher precedence than the file and must be checked before a later authorized
  build. No provider environment changes are included here.
- Both `/institutional-alignment.html` and `/institutional-rc1-config.js` declare
  `no-store, no-cache, must-revalidate, max-age=0`. The HTML contains a SHA-256
  fingerprint of the generated configuration. The HTML rule closes a source
  gap: an otherwise fresh config URL cannot help a client reloading stale HTML
  that still references an old URL. Existing loaded documents do not change
  automatically; a later hosted gate must verify reload/navigation behavior.

## Offline evidence and limits

`npm run check` includes source-policy assertions, negative controls and
isolated builds of inert, verification, changed-verification, live-config-only
and rollback artifacts. Placeholder keys and authorization IDs have no provider
authority. The live fixture is evaluated only as configuration in a bounded VM;
it does not execute live transport code or issue a reCAPTCHA token.

The cache model keys by the complete URL and obeys the declared header. Its
negative controls expose stale HTML, stale config, missing and duplicate
fingerprints. It cannot prove Render's native CDN or a browser's cache behavior.
Sealed browser fixtures may exercise reloads of inert/verification/rollback
pages without external traffic. Playwright interception disables native HTTP
caching, so such observations are not hosted cache proof either.

The previously observed hosted `HIT` / `Age` remains unexplained, not a confirmed
cache-control failure and not resolved by these source tests. A separately
authorized non-transmitting hosted gate must observe the new exact artifact,
effective Node selection, response headers and previously loaded client reloads.
Any failed or ambiguous check stops advancement. Receipt/token testing, merges,
deployments, form enablement and production activation are outside this source
qualification; subsequent authorization must identify the reviewed exact SHA.

## Reference contracts

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render Node version precedence](https://render.com/docs/node-version)
- [Render static-site headers](https://render.com/docs/static-site-headers)
- [setup-node version-file input](https://github.com/actions/setup-node)
