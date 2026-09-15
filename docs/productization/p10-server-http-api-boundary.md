# Productization P10 — Server HTTP API Boundary

## Purpose

Expose the existing authenticated canonical-workspace service through a narrow Node HTTP boundary suitable for later server/staging composition without weakening the existing identity, tenant, RBAC, optimistic-concurrency, or authority invariants.

This increment does not deploy a backend and does not establish production qualification. It creates the HTTP interface that a real server runtime can host once the external IdP, database, secrets, network, observability, and operational controls exist.

## Implemented boundary

`src/server/canonical-workspace-http-api.js` provides:

- `GET /healthz` — liveness only; explicitly reports `productionQualified=false`.
- `GET /v1/workspaces/:workspaceId` — authenticated canonical workspace load.
- `PUT /v1/workspaces/:workspaceId` — authenticated canonical workspace save with explicit `expectedVersion` and `operationId`.
- `OPTIONS` — exact-origin CORS preflight when the origin is configured by the server.

The HTTP layer delegates authorization and persistence behavior to the existing authenticated canonical workspace service. It does not duplicate the OIDC/JWT verifier, RBAC policy, canonical workspace runtime, or persistence engine.

## Fail-closed request controls

- exact workspace route; workspace identifiers are bounded and restricted to an opaque safe character set
- query parameters rejected on workspace routes
- request bodies limited to a bounded size
- JSON media type required for writes
- malformed or non-object JSON rejected
- write body is allowlisted to `workspace`, `expectedVersion`, `operationId`, and optional `occurredAt`
- caller-supplied top-level actor, tenant, role, identity, authority, release, merge, deployment, or transaction routing metadata is therefore rejected
- route workspace ID must exactly equal `workspace.workspaceId`
- no DELETE endpoint exists
- unsupported methods fail closed

## Browser/network boundary

- CORS is disabled unless exact origins are supplied by trusted server configuration
- wildcard origins are not supported
- non-loopback HTTP origins are rejected from configuration; external browser origins must use HTTPS
- unexpected browser `Origin` values are rejected
- security response headers include `Cache-Control: no-store`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`

CORS is not treated as authentication or authorization. Bearer authentication remains mandatory for workspace operations.

## Error boundary

Known authentication, authorization, conflict, body-size, media-type, and routing errors are mapped to constrained HTTP status codes. Internal error messages, database details, token details, credentials, and stack traces are not returned to callers.

A generated request identifier is returned for correlation, but this module does not claim durable audit/log persistence.

## Authority boundary

Every HTTP response authority surface remains fail-closed:

- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `goLiveAuthorized=false`
- `transactionAuthorized=false`
- `productionAuthenticationValidated=false`
- `productionPersistenceValidated=false`

## Regression coverage

`tests/runtime/run_canonical_workspace_http_api_tests.js` exercises a real ephemeral Node HTTP server and covers:

- health endpoint non-qualification semantics
- missing bearer authentication
- authenticated load
- not-found mapping
- RBAC denial sanitization
- route/body workspace mismatch
- caller actor/tenant metadata injection rejection before service invocation
- unsupported media type
- malformed JSON
- optimistic-version conflict mapping
- internal-error redaction
- exact-origin CORS allow/deny behavior
- preflight behavior
- unsupported-method rejection
- oversized request-body rejection before service invocation

## External work still required

This increment does **not** establish:

- a deployed Node/backend service
- network edge/API gateway/WAF/rate limiting
- production IdP registration, issuer/audience/JWKS trust, revocation, session, or MFA evidence
- a real PostgreSQL pool or executed schema/RLS migrations
- runtime cross-tenant/IDOR/BOLA validation
- durable audit-log persistence
- secrets/KMS configuration
- TLS/DNS ownership evidence
- monitoring, alerting, incident response, SLOs, backup/restore, or DR
- penetration testing
- PDPL/legal/professional/Taqeem/IVS/RICS approvals
- human release, merge, deployment, go-live, or transaction authority

The next operational step after engineering qualification is to compose this boundary with an actual server runtime and real staging infrastructure, then capture external evidence through the existing production-readiness and release-governance modules.
