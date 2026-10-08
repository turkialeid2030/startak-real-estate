# C73.3C — External signed high-water witness and rollback-detection gate

## Exact scope
Builds upon C73.3B (Draft PR #650) without merging or deploying to `main`. Adds `src/security/c73-external-witness-gate.js` — a **server-only Ed25519 public-key-pinned witness gate** around authenticated C73.3B custody, with no professional approval escalation.

A witnessed document operation must satisfy ALL of:
1. Existing Postgres signed-head and append-only event continuity, tenant-specific FORCE RLS and encrypted staged-byte integrity from C73.3B.
2. A **separately fetched signed witness checkpoint**, not one recycled from the PostgreSQL row, with precise `tenantId`, `documentId`, `revision`, `headTag`, `version` and UTC `issuedAt`.
3. Valid Ed25519 signature by a configured trusted public key and strict canonical receipt schema, date/freshness bounds, fixed-time SHA-256 head equality and exact monotonic revision.
4. For modifications, witness CAS receipt is advanced after signed Postgres commit. Every client operation is denied when the witness is absent, stale, mismatched, mis-signed or unavailable. No automatic rollback claim if remote witness commit failed **after** local database commit.

## Executed synthetic tests
`tests/fixtures/c73_3c_isolated_witness.js` runs in a separate child process, with its own ephemeral Ed25519 private key and separate IN-MEMORY head store; the app receives only its public key and speaks loopback HTTP. `tests/e2e/run_c73_3c_signed_witness_postgres.js` uses a real PostgreSQL 16 runtime and actual AES-GCM staged files, a scanner fixture and entirely synthetic tenant A/B identities.

Adversarial cases include:
- Same document id for different tenants; signed first checkpoint, signed new revision, witnessed revocation.
- **Privileged DBA intentionally rewinds BOTH the Postgres signed head and its event table** to a valid earlier record. The original HMAC + audit-table checks still accept the locally self-consistent old record, while the independently signed witness must reject it.
- Corrupted witness signature, wrong pinned public key, stale receipt, offline witness, and missing checkpoint after post-commit witness failure. All fail closed.
- Restoring correct DB state and matching external witness permits synthetic reads again; revoked or stale events never regain approval.
- C73.3A/3B signed JWT HTTP plus Postgres+vault integration and independent Release Verify are also rerun against the exact stacked PR head.

## Security boundary / blocked production
**This is a synthetic out-of-process witness simulation, NOT an independent durable WORM service.** The child process uses an in-memory map: it loses its high-water mark on restart. It runs without mTLS, service-to-service auth, trusted monotonic timestamp, independent cloud account or immutability protection. The private key is ephemeral and non-certifying.

**C73.3C cannot authorize real documents or production** without a physically and administratively independent durable WORM/checkpoint provider, mTLS and server-to-server authorization, HSM/KMS key custody and rotation/revocation, secure checkpoint recovery and out-of-band incident audit, correlated failures/replay testing and emergency break-glass governance.

In addition, source origin and legal redistribution rights, Saudi data residency, approved malware/structural scanning, PDPL/DPIA approval, licensed appraiser validation, verified Saudi market holdout accuracy, independent penetration/load/DR tests and human signoff remain unresolved in #644, #648, #622 and #634.

**Decision:** successful CI = `PASS_SYNTHETIC_ENGINEERING_ONLY`, never READY, customer-file acceptance, official appraisal, transaction, merge or production deployment.
