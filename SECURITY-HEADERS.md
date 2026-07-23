# Security header deployment

The repository includes a Render Blueprint in `render.yaml` and a `_headers` manifest for other compatible static hosts.

The current GitHub Pages origin does not apply custom response headers from repository files. Deploy the Render Blueprint, verify its generated service URL, and then move the custom-domain DNS to Render. Treat these controls as active only after the production response headers have been verified.

The minimum production set is:

- Content-Security-Policy
- Permissions-Policy
- Referrer-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
