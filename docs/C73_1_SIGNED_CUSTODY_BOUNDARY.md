# C73.1 — Signed local server-observation custody integrity, not a secure vault

## Proven boundary

C72 #643 verified *browser-computed* SHA-256 and persisted untrusted metadata; C74 #645 tested this route and finance/browser synthetic paths. Neither establishes independent evidence custody. C73 issue #644 remains OPEN.

C73.1 adds **server-only**, non-UI, non-production cryptographic evidence event contracts, limited to:
- SHA-256 computed over actual synthetic byte buffers within 5 MiB, PDF/PNG/JPEG header and MIME screening (NOT full file structure validation or antivirus).
- Signed event HMAC-SHA-256 using an externally supplied 256+ bit server key (no key stored in source or ledger).
- Exact tenant, case, project, property, valuation date, document, evidence reference, artifact version, file hash, media type, byte size and nonce integrity.
- Monotonic BYTES_OBSERVED / BYTES_RECHECKED / REVOKED events, with previous-event MAC, revision and independent expected-head check.
- Strict rejection of modification, tenant substitution, actor/evidence substitution, fake rights or valuer flags, backwards time, stale, future and revoked evidence.
- **Even a successfully verified custody chain is UNVERIFIED as to source, rights, professional license and official valuation.** No upstream C61/C62/C69/C71 report authorization has changed.

## Trust assumptions and known unimplemented items

**Critical:** \`expectedHeadTag\` and \`expectedRevision\` MUST be retrieved independently from a trusted server-only high-water store; a client repeating the ledger's own head is not evidence of anti-replay. The in-memory sample/test passes trusted reference values explicitly as a harness and **does not implement a trusted high-water store**. The HMAC only attests events when the secret remains protected; it does NOT prove actual independent document provenance or authorized signer status.

No authenticated tenant API, OIDC session layer, durable append-only storage, server-side encrypted vault, object-level RLS, key rotation/KMS, independent malware/structural PDF scan, legal rights/license/revocation registry, credentialed reviewer signature, PDPL impact assessment, external certification, authorized commercial ingestion or production load/penetration test is implemented by C73.1.

This pure contract must not be bundled in browser React, and no preview environment may receive genuine confidential documents. If the eventual server adoption cannot obtain a genuine trusted identity, secret, stored high-water mark, and independent source validation, fail closed.

## Acceptance and QA

The test \`node tests/architecture/run_c73_signed_document_custody.js\` uses synthetic bytes and **ephemeral random HMAC test keys only**. It covers:
- Matching byte fingerprint vs mutation/re-upload; PDF/PNG/JPEG, MIME signature spoofing and date rejection.
- HMAC key and keyRef mismatch, field/timestamp forgery, cross-tenant/case/evidence replay and strict unexpected trust flags.
- Event continuity and monotonic time, recheck differences, revocation, replay/truncation vs independently supplied trusted head/revision.
- Explicit false values for official valuation, source rights, independent reviewer, malware scan and production vault authorization.

GitHub draft PR exact-head tests and independent Release Verify are required before acceptance. The issue #644 remains open until actual secure services and independent legal/professional human signoff are delivered. Distinguish C73.1 engineering integrity PASS from full C73 production-trusted provenance (HOLD).
