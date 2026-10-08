# C73.3B — AES-256-GCM local encrypted staging vault (NOT production certification)

## Completed implementation scope
- Node/server-only AES-256-GCM encrypted ciphertext file objects with 96-bit random nonce, authenticated additional data binding tenant/document/revision/MIME/SHA-256/key reference and 128-bit authentication tag.
- Independent 32-byte key **supplied to service at runtime**; it is not stored in source, object filename, ledger or archive. A wrong key, altered tag, altered hash or changed tenant/document fails closed.
- Trusted server-injected verifier checks a verified tenant identity and reader/editor role on put/read/erase; caller-provided tenant fields cannot change authority.
- Strict bounded buffers (5 MiB), PDF/PNG/JPEG header checks, cryptographic digest, mandatory scanner adapter with fail-closed error/timeout verdict. Test scanner fixture **always synthetic** and cannot establish anti-malware safety.
- Ephemeral private directory, 0600 ciphertext files with opaque cryptographic filenames, no overwrite, no symlink open, verified restart round trip, tamper quarantine via error, permission denial and explicit unlink.
- Returns only scoped metadata with `productionVaultReady=false`, `professionalReportAuthorized=false`, `sourceRightsVerified=false`, `malwareEngineCertified=false`, `independentImmutableWitness=false`.

## Boundaries — strictly not qualified
This uses local filesystem staging, **not** managed Saudi-region cloud object storage, KMS/HSM, object version retention, WORM immutable root, documented secure erasure, comprehensive malware/structural parser or approved scan engine. An `unlink()` does not securely delete ciphertext from backups or snapshots. A root or parent filesystem/symlink administrator can compromise the store.

A real **loopback HTTP** integration has been tested with synthetic RSA-signed bearer JWT, PostgreSQL 16 and encrypted local staging. This is NOT a deployed HTTPS service or approved production object store; it has no production identity provider, DLP, rate limiting, provider licence verification, PDPL legal approval, authorized valuer or official appraisal. Other issuer/source rights, real Saudi market backtests, load test, DR, external pen test and human UAT remain OPEN. Do NOT use customer data or main/deploy.

Test: `node tests/architecture/run_c73_3b_encrypted_vault.js`; genuine in-process crypto + private temporary disk + fake IdP/scanner. Exact HEAD separate release/package/security gate required.

## Current disposition
C73.3B is a **staging encryption engineering component** only. C73 #644, C73.3 #648, #622 and #634 remain OPEN/HOLD pending independent provider, legal, valuation and security signoff.

## Integration and runtime scanner timeout update
C73.3B also runs actual local HTTP + RSA-JWT + PostgreSQL 16 + AES-GCM staging, including reversible failed scan -> signed custody revocation, ciphertext removal upon revoke, and failure when the scanner never resolves. The scan timeout defaults to 15 seconds and is bounded between 10 ms and 60 seconds. These are engineering simulations with a fake scanner and fabricated identities and do not establish a certified scan engine, geographic residency or production approval.
