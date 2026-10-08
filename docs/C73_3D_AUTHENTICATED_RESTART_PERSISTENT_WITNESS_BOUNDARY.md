# C73.3D — Authenticated, restart-persistent local custody witness (engineering)

## Security bug addressed
C73.3C's isolated-process witness signed checkpoints but its test fixture allowed unauthenticated reads/writes and lost latest revision on process restart. An attacker able to call the witness could mint valid signatures over attacker-selected checkpoints, so prior local anti-rollback results were **not evidence of a secure, production-independent witness**.

C73.3D hardens the **synthetic test/staging witness implementation** with:
- Distinct application Ed25519 identity key, separate witness Ed25519 signing key; witness client public key pinned by the witness service and witness public key pinned by the custody gate
- Signed method, exact path/query, SHA-256 request body, issuedAt and cryptographically random 192-bit nonce, verifying signature/freshness before any checkpoint read or advance
- Atomic durable-use nonce journal to reject repeated requests **including after restart**, strict response/header/body bounds and timeout for the client
- 0700 private local witness folder, persisted 0600 Ed25519 signing key, append-only-by-service `O_EXCL` per-revision signed receipts, consecutive revision validation and signature verification on every read
- A separate child process with a physically separate test directory; PostgreSQL 16 and local AES-256-GCM custody operate through the pinned signed transport
- Strict compare-and-swap checkpoint advancement; stale revisions cannot overwrite a later witness checkpoint
- Real restart of witness **process** and successful recovery of its last signed checkpoint and original verification key
- Negative tests for unauthenticated updates, forged app key, changed signed path, nonce replay before/after restart, stale signature and a valid old C73-signed PostgreSQL rollback

## Evidence
`tests/e2e/run_c73_3d_authenticated_witness_postgres.js` operates with synthetic keys and fake documents. A fresh GitHub Actions PostgreSQL 16 integration job must pass all cases plus the inherited real HTTP/RSA-JWT/PG/AES and complete canonical Release Verify on the same exact PR SHA. Results cannot be claimed before GitHub jobs complete.

## Non-negotiable production HOLD
**The witness is still an ordinary private local filesystem, NOT WORM/retention-lock object storage, independent legal custody or a separate cloud trust boundary.** A privileged filesystem administrator or backup rollback could alter the key and all checkpoint files. The test uses HTTP loopback, NOT production mutually authenticated TLS, IAM policies, managed HSM/KMS, separated independent owner accounts, trusted timestamping, distributed atomic reconciliation or production DR failover. Persistent nonce files have no rotation/retention service. Signing key rotations, authenticated recovery, incident response, append-only external audit, and testing against malicious administrators remain prerequisites.

Additionally, real Saudi region KMS-encrypted cloud object storage, certified malware/structural scanning, actual licensed source access and redistribution rights, licensed professional valuer, Saudi holdout market evaluation, actual human UAT, Saudi PDPL legal signoff, penetration/load/DR approval and authorized named Go/No-Go remain **external unresolved dependencies** under issues #644, #648, #622, #634.

No production activation, official appraisal, transactions, actual customer data, main merge or readiness promotion from this stage. Draft PR stacked after #651.
