# CSP_POLICY

SECURITY_HEADER_POLICY_DEFINED = TRUE
ARTIFACT_HEADER_CONFIGURATION_PRESENT = TRUE
LIVE_EDGE_HEADER_ENFORCEMENT_VERIFIED = FALSE
CSP_UNSAFE_EVAL = FALSE

The repository currently ships `public/_headers` with the following policy for static hosts that support that convention:

```text
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://o4512003775004672.ingest.de.sentry.io; font-src 'self' data:; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

`style-src 'unsafe-inline'` remains required because the application uses React inline `style={{...}}` properties. It does **not** permit inline scripts. `script-src` remains `'self'` and no `unsafe-eval` is configured.

## Evidence boundary

The existence and successful packaging of `_headers` establishes that the security-header configuration is present in the deployment artifact. It does not prove that a live CDN/edge is honoring those headers.

A live deployment may only be marked header-verified after capturing the actual HTTP response headers from the exact deployed URL/build and comparing them with the intended policy. HSTS effectiveness also depends on HTTPS edge behavior and therefore cannot be self-certified by this repository.

The previous statement `SECURITY_HEADERS_DEPLOYED = FALSE (no live edge exists yet)` was historical and is no longer used as a current fact. The current distinction is **artifact configured** versus **live-edge enforcement independently verified**.
