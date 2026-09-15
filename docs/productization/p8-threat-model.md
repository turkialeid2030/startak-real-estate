# P8 Threat Model

Primary threats addressed in this slice:

1. caller impersonation by injecting actor, tenant, roles, or identity context;
2. caller self-promotion of production/release/merge/deployment/transaction authority;
3. cross-tenant workspace inspection caused by a persisted tenant mismatch;
4. secret/configuration disclosure through an operational status endpoint;
5. non-ADMIN access to operational inspection;
6. mutation capability accidentally exposed through the operations service;
7. treating code capability or provider self-claims as proof of production readiness.

Controls are fail-closed authentication, canonical verified identity, ADMIN RBAC, authenticated workspace-scope comparison, allowlisted output, immutable false authority flags, read-only API surface, and explicit external-evidence holds.

Residual risks requiring external evidence include deployed IdP behavior, database/RLS configuration, operational infrastructure, secrets lifecycle, backup/restore, DR, monitoring, incident response, penetration testing, and applicable legal/professional controls.
