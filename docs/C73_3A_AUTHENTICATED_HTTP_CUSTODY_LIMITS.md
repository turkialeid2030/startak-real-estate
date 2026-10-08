# C73.3A — Real HTTP + cryptographically signed JWT + PostgreSQL custody (synthetic-only)

This change is stacked on **C73.2 PR #647**, not on `main`. It connects the existing C73.2 PostgreSQL custody service to a bounded, bearer-only Node HTTP interface, using Startak's existing RS256 JWT/JWKS/issuer/audience verifier.

## Executable boundaries
- API endpoints: `POST /v1/custody` (bytes as strict base64 in bounded JSON), `GET /v1/custody/:documentId`, `POST /v1/custody/:documentId/recheck`, `POST /v1/custody/:documentId/revoke`.
- A server-configured JWKS and issuer/audience, never token-selected, validates the JWT signature, expiry and tenancy. Only an internal post-verification identity envelope is forwarded to the Postgres service.
- Server-enforced roles: reader vs editor. Requests must not select a tenant or actor role. PostgreSQL transaction-local tenant context and FORCE RLS remain enforced.
- Strict routes, JSON-only mutation requests, bounded 7 MiB HTTP body and 5 MiB decoded bytes, explicit scope and concurrency revisions, refusal of unrecognized authority fields. Never return the original file bytes in responses.
- `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, CSP default deny; no cookie authentication or CORS permission. This is **not** a public browser endpoint.
- End-to-end test is **real native loopback HTTP** and **real isolated PostgreSQL 16** with ephemeral RSA test issuer/JWKS and synthetic PDF bytes. Negative paths include expired/wrong signature/issuer/audience, forged tenant, viewer write, malformed base64/MIME, stale revision, mutation, revocation and object absence.
- All tests are synthetic. The test RSA private key is generated dynamically and never committed or placed in a downloadable artifact.

## Explicitly not implemented or verified
- No production identity provider, HTTPS reverse proxy/WAF, TLS/DNS/JWKS operations and revocation, MFA, real credential/session proof, DDoS protection, rate limiting, object-level retention, authoritative legal authentication, independent human professional valuation, Saudi market calibration, paid or public operation.
- This API **does not store original documents**: only their hash/signature and scoped event metadata. A KMS-encrypted Saudi-resident object vault and independently managed immutable custody witness are outstanding.
- No malware scanner or deep PDF/PNG/JPEG structural validation. MIME prefix checks do not establish safe or genuine documents. Never send confidential files to this isolated test.
- No automatic authorization of official reports, real estate rights, licensed valuers, financial transaction, or production release.
- A real production deployment additionally needs IAM/JWKS key lifecycle and compromised-key policies, key vault, source and legal rights, PDPL privacy/legal/retention approval, object scanning/quarantine, independent pen testing, incident response, load and disaster recovery drills, operational SLO/RPO/RTO, external human UAT and signed Go/No-Go.
- **C73 #644, C73.3 #648, #622 and #634 stay OPEN / HOLD**.

## Security caveat
The service uses a trusted server-injected `verifyRequest` callback. The HTTP gateway verifies each bearer JWT and constructs an internal-only identity envelope. This demonstrates correct control wiring in isolated CI; it is **not proof** of external IdP integrity or safe production exposure.

## Acceptance
A dedicated workflow checks real Postgres16, signed test JWT over actual Node HTTP requests, negative authorization paths, C73.2 31 real database checks, C73.1 21 custody checks, and a separate exact-head canonical Release Verify. It fails closed if any job fails, and the whole system remains HOLD for real documents.
