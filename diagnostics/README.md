# Institutional staging reCAPTCHA diagnostic

This is a temporary diagnostic route for
`https://common-ground-standard-institutional.onrender.com/institutional-alignment.html`.
It has no form, input fields, submission endpoint, FormData, fetch, storage, or logging. Its CSP
blocks form submissions and permits connections only to Google's reCAPTCHA path. The client loads
Google only when the operator runs the diagnostic. Browser signals are processed by Google.

## Build controls

Set `CGS_INSTITUTIONAL_DIAGNOSTIC_ENABLED=true` and keep every other institutional mode switch
`false`. Supply the exact staging origin in `CGS_INSTITUTIONAL_RC1_ALLOWED_ORIGIN` and a verified
Google **public site key** in `CGS_INSTITUTIONAL_RC1_RECAPTCHA_SITE_KEY`.

Never copy the Formspree custom reCAPTCHA field into the public site-key variable. Formspree stores
the **secret key**, which must stay in Formspree. Compare the key roles and pairing in the private
administration screens; publish only equality results and the hostname restrictions.

The build replaces the staging institutional route with this diagnostic. It adds diagnostic assets
only in diagnostic mode, fingerprints the configuration, rejects any other hostname, and rejects
simultaneous transmitting modes. Default and production artifacts exclude the diagnostic assets.

## Evidence and decision boundary

One run reports `script-load`, `api-ready`, `execute`, and either `token-issued` or a redacted error.
Each stage has a 15-second limit. Only token length is displayed; the token is discarded, never
sent for server verification, and never written into an intake form. A reload is required for
another run. This result cannot establish receipt delivery or backend acceptance.

The initial `api.js` load can expose a ready queue before the full library installs `execute`.
The diagnostic reports method-availability booleans, waits for the ready callback, then reacquires
the current API object before checking or invoking `execute`. These readiness steps never issue a
token themselves. Missing readiness, missing execution after readiness, and bounded timeouts are
separate failures; a failed run never retries automatically.

Before running, verify the public site-key ID, score/v3 type, exact staging hostname in the Google
domain list, enabled domain verification, the dedicated Formspree project's exact hostname
restriction, and its secret-key pairing. Keep both institutional Formspree forms disabled.

When this diagnostic gate passes, request separate authorization for one synthetic receipt and
deletion test. Production activation still requires a later decision against the reviewed commit.

Reference: [Google reCAPTCHA v3](https://developers.google.com/recaptcha/docs/v3),
[Google asynchronous loading](https://developers.google.com/recaptcha/docs/loading),
[Google domain validation](https://developers.google.com/recaptcha/docs/domain_validation),
[Formspree reCAPTCHA integration](https://formspree.io/blog/recaptcha-3/).
