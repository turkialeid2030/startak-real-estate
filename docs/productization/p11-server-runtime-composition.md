# P11 — Server Runtime Composition

## Purpose

P11 composes the already-qualified application boundaries into one server-side runtime object suitable for a controlled staging host integration:

`HTTP API -> Authenticated Workspace Service -> OIDC/JWT/JWKS -> Canonical Workspace Runtime -> Tenant-Scoped Persistence -> PostgreSQL-Compatible Provider`

This is composition code, not deployment evidence and not production qualification.

## Composition contract

`createCanonicalWorkspaceServerRuntime(...)` requires:

- explicit OIDC issuer, API audience, and pinned JWKS URI
- an explicit tenant routing mode: `TOKEN_CLAIM` or `PINNED_TENANT`
- an injected PostgreSQL pool (`pool.connect()` contract)
- optional injected `fetchImpl` for JWKS delivery
- explicit browser origins when CORS is needed
- PostgreSQL schema/table/tenant-setting identifiers

No database connection string, database password, bearer token, private JWK, or general secret object is accepted into the normalized composition configuration returned for inspection.

## Tenant routing

Tenant routing is deliberately explicit:

- `TOKEN_CLAIM`: tenant scope comes from the cryptographically verified token identity. `requiredTenantId` is rejected in this mode.
- `PINNED_TENANT`: the trusted server configuration must provide `requiredTenantId`, and the authenticated service requires the token tenant to match it.

There is no ambient request-header tenant routing mode.

## Dependency probe

`probeDependencies()` performs two narrow checks:

1. force-refresh the configured JWKS endpoint and require a structurally valid public JWKS document;
2. obtain a client from the injected PostgreSQL pool and execute `SELECT 1 AS readiness_check`.

A successful probe means only that those dependencies are reachable at that moment. It does **not** establish:

- production IdP registration or client configuration
- token revocation/session invalidation/MFA controls
- DNS/TLS/key lifecycle qualification
- PostgreSQL schema migration execution
- RLS effectiveness
- cross-tenant IDOR/BOLA resistance
- durable audit persistence
- encryption/KMS posture
- backup/restore or disaster recovery
- monitoring/alerting/SLOs
- penetration testing
- PDPL/legal/professional qualification
- release, merge, deployment, go-live, or transaction authority

## Authority boundary

All authority remains false:

- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `goLiveAuthorized=false`
- `transactionAuthorized=false`
- `productionAuthenticationValidated=false`
- `productionPersistenceValidated=false`
- `productionSecurityValidated=false`
- `productionPerformanceValidated=false`

The next operational step after engineering qualification is to host this composition in a controlled staging environment with a real PostgreSQL pool and real OIDC/JWKS configuration, execute the migrations and independent RLS/IDOR tests, and capture external evidence through the existing production-readiness governance path.
