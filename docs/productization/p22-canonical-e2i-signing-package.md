# P22 — Canonical Source E2I Signing Package

## Purpose

P22 connects the strict canonical-source comparison contract from P21 to the repository's existing E2I production-readiness trust model without creating a parallel external-evidence system.

The existing E2I gate accepts independently signed readiness evidence and validates the verifier against an out-of-band pinned registry. P22 prepares the exact unsigned payload for the `CANONICAL_SOURCE_HASH_COMPARISON` evidence type after a P21 canonical comparison has already reached `VERIFIED`.

## Implemented

### Exact E2I evidence payload

`src/qualification/canonical-source-readiness-evidence-package.js`:

- accepts only P21 evidence with `status=VERIFIED`, `evaluated=true`, `verified=true`;
- requires both expected and computed hashes to equal the pinned canonical SHA-256;
- fixes the E2I evidence type to `CANONICAL_SOURCE_HASH_COMPARISON`;
- fixes the result to `VERIFIED`;
- fixes the signature algorithm to `RSA-SHA256`;
- binds the payload to the upstream closeout hash, release-candidate ID, exact source commit, release artifact hash, environment reference and environment-config hash;
- hashes the caller's external source reference before placing it in the signing payload;
- emits deterministic signing bytes in Base64 plus a SHA-256 of those bytes.

### Existing E2I trust model remains authoritative

P22 does not sign evidence and does not accept a verifier. The output remains:

`READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURE`

The package explicitly records:

- `signatureRequired=true`
- `externalReadinessVerifierRequired=true`
- `readinessVerifierRegistryTrustRootRequired=true`
- `e2iAcceptancePending=true`
- `externalEvidenceBlockerClosed=false`

### Compatibility regression

The regression suite creates a temporary RSA keypair, signs the exact P22 bytes, then passes the signed record into the repository's existing `verifyReadinessEvidenceSignature` function. This proves that P22's serialization is compatible with E2I's current verifier contract. Tampering with a signed field invalidates the signature.

## External evidence boundary

P22 does not close the canonical-source blocker. The actual closure sequence remains external:

1. actual canonical source supplied to a strict P21 run;
2. hash comparison reaches `VERIFIED`;
3. P22 prepares the exact E2I signing payload;
4. an authorized independent readiness verifier signs the payload;
5. the existing E2I gate validates the signature, verifier permissions and the out-of-band pinned registry trust root.

No private signing key belongs in this repository or in P22.

P22 does not authorize release, merge, deployment, go-live or transactions and does not establish legal, PDPL, professional or production-security approval.
