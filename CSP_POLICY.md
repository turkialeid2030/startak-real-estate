# CSP_POLICY

SECURITY_HEADER_POLICY_DEFINED = TRUE
CSP_UNSAFE_EVAL = FALSE
SECURITY_HEADERS_DEPLOYED = FALSE (no live edge exists yet to deploy to)

Recommended header set:
```
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```
`style-src 'unsafe-inline'` is required because the application uses inline `style={{...}}` React props extensively (not `unsafe-inline` for scripts). No `unsafe-eval` anywhere -- confirmed zero `eval`/`new Function` in production source.

HSTS: to be added only at the actual HTTPS edge once a host is authorized -- not claimed here.

**Local compatibility test performed this session**: candidate CSP injected via `<meta>` tag against the real production build; exercised locale switch, Building↔Land navigation, and Saved Deals panel open -- **0 CSP violations**, app remained fully interactive. `CSP_APPLICATION_BREAKAGE = 0`. This is a local simulation only, not equivalent to live-edge header enforcement.
