# CSP_POLICY

SECURITY_HEADER_POLICY_DEFINED = TRUE
ARTIFACT_HEADER_CONFIGURATION_PRESENT = TRUE
DOCUMENTED_ARTIFACT_POLICY_MATCHES_PUBLIC_HEADERS = TRUE
LIVE_EDGE_HEADER_ENFORCEMENT_VERIFIED = FALSE
CSP_UNSAFE_EVAL = FALSE

The repository currently ships `public/_headers` with the following policy for static hosts that support that convention:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com https://o4512003775004672.ingest.de.sentry.io; frame-src https://challenges.cloudflare.com; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## Allowed third-party security/telemetry endpoints

- `https://challenges.cloudflare.com` is limited to the Cloudflare challenge integration and is present in `script-src`, `connect-src`, and `frame-src`.
- `https://o4512003775004672.ingest.de.sentry.io` is limited to telemetry ingestion and is present only in `connect-src`.
- No wildcard script, frame, or connect origin is permitted by the shipped artifact policy.

`style-src 'unsafe-inline'` remains required because the application uses React inline `style={{...}}` properties. It does **not** permit inline scripts. `script-src` does not contain `unsafe-inline` or `unsafe-eval`.

## Evidence boundary

The existence and successful packaging of `_headers` establishes that the security-header configuration is present in the deployment artifact. The C46 internal review also checks that this document remains synchronized with the shipped `_headers` policy.

Neither repository documentation nor CI proves that a live CDN/edge is honoring these headers. A live deployment may only be marked header-verified after capturing the actual HTTP response headers from the exact deployed URL/build and comparing them with the intended policy. HSTS effectiveness also depends on HTTPS edge behavior and therefore cannot be self-certified by this repository.

`LIVE_EDGE_HEADER_ENFORCEMENT_VERIFIED` must remain `FALSE` until that external runtime evidence exists.
