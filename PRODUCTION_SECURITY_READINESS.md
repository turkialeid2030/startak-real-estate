# Production Security Readiness

Status: **NOT PRODUCTION-VERIFIED**

This repository now contains an application-level tenant-boundary contract that fails closed on missing identity and cross-tenant access. That is useful defense-in-depth, but it is **not** a substitute for database-enforced row-level security, production identity, session management, or live deployment verification.

## Verified in repository

- Application-side tenant match check for scoped reads/writes.
- Cross-tenant access denied by deterministic contract.
- New records can be tenant-bound from the authenticated identity context.
- Missing identity fails closed.
- Architecture tests cover same-tenant, cross-tenant, missing-identity, and cross-tenant write cases.
- Existing release verification remains the merge gate.

## Still required before production security can be claimed

1. Real production identity provider / OIDC configuration with MFA policy as required by the operating organization.
2. Server-side session/token verification and revocation strategy.
3. PostgreSQL/PostGIS tenant-aware schema.
4. Database-enforced RLS policies with `FORCE ROW LEVEL SECURITY` where applicable.
5. Migration tests executed against a real PostgreSQL environment.
6. IDOR tests through the actual API/data-access boundary, not only pure functions.
7. Least-privilege service roles and secret management.
8. Immutable/auditable security events for denied access and material changes.
9. Backup/restore, recovery objectives, monitoring, and incident-response verification.
10. Independent production security review before any production gate is marked PASS.

## Claim boundary

Repository tests can establish that a local application security contract behaves as designed. They cannot establish that a future database, identity provider, host, network, or deployment is secure until those components exist and are tested in the target environment.
