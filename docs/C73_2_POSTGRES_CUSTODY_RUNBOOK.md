# C73.2 — Transactional PostgreSQL trusted custody high-water (engineering stage)

## Engineering implementation
C73.1 (#646) established server-only HMAC-SHA-256 event signatures but required an independently maintained latest tag and revision; it did NOT provide durable anti-replay storage. C73.2 introduces a **PostgreSQL transaction-bound head/event registry** (SQL migration `sql/c73_transactional_custody.sql` and `src/security/c73-postgres-custody-service.js`).

- Atomic initial observation: SHA-256 over **synthetic** PDF bytes, signed ledger and event row inserted together, fail-closed rollback on an event write denial.
- State changes: SELECT FOR UPDATE, authoritative *database* head and revision, compare-and-swap token, event signature validation, monotonic event order and transactional update of head and INSERT-only audit event.
- Tenant isolation on both tables with PostgreSQL ENABLE + FORCE RLS, strictly transaction-local app.tenant_id; runtime role must not be superuser/BYPASSRLS.
- A trusted, independently implemented server-side verifier is required via `verifyRequest` dependency; claimed `tenantId` and `actorId` on the request never set the transaction scope. Role `CUSTODY_EDITOR` may observe/recheck/revoke; `CUSTODY_READER` only reads.
- No PDF/image bytes, original filenames, or HMAC secrets are stored in the ledger tables.
- All read results explicitly remain **INTEGRITY_MATCHED_UNVERIFIED**, or **HOLD_REVOKED**, and do not authorize professional valuation, source rights or transactions.

## Execution
- Test environment only: `postgres:16` in GitHub Actions; synthetic login role c73_app.
- CI creates least-privilege runtime role, executes migration as test owner, and runs `tests/e2e/run_c73_postgres_custody_integration.js` with test-only `pg` dependency.
- Tests cover both tenants using the SAME documentId, forced RLS, missing context, role denial, duplicate event, genuine byte mutation, stale revision, concurrent appends (only one winner), event insert denial -> SQL rollback, and revocation that cannot be promoted.
- A separate source/regression gate runs canonical release, package and audit on the **exact PR SHA**.

## Explicit P0 blockers for real documents or production
1. **This is not a deployed server endpoint**. Real OIDC/JWT trust must replace the synthetic `verifyRequest` fixture; direct arbitrary SQL access by a customer to the runtime role is prohibited. PostgreSQL custom tenant setting alone is not a fully trusted identity boundary if raw SQL injection is possible.
2. **Not an immutable external witness:** administrators/DB owner can rewrite tables or restore an older backup. Production requires independently witnessed/WORM anchored checkpoints, incident alerting, verified DB restore recovery and managed immutable audit retention.
3. **No bytes/object vault:** KMS/HSM-managed, region-appropriate encrypted object storage, independent malware/structure validation, deletion/retention/legal hold and tenant-specific object ACLs are not implemented.
4. **No issuing authority authenticity** or documented redistribution rights, expert licence verification, independent professional valuer signing, regulator acceptance, PDPL privacy impact assessment or production security independent penetration test.
5. **Not an API/system integration qualification**: the in-repository Vite browser has not been connected to this new server-side repository. C72 remains a local browser unverified digest mechanism.
6. No commercial operational acceptance, real user UAT, Saudi live market validation, transaction or certified valuation. #622, #634 and #644 remain open.

## Decision
Passing C73.2 can qualify an isolated **SQL transactional custody proof**, not the whole C73 service or live platform. Do not merge to main, deploy, ingest customer files, create official reports, or enable transactions. Stacked branch progression: #643 → #645 → #646 → C73.2.
