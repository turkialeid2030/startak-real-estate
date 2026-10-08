# C73.5 — Dual offline-root quorum over external readiness issuer registry (synthetic)

## Why C73.5 exists
C73.4 verified signatures against `trustPolicy` supplied by the caller. An actor controlling that policy could invent eight fake reviewer identities and generate a cryptographically valid packet without any real external approval (though C73.4 still correctly forbids production). That makes the successful cryptographic status insufficient even as a basis for evidence intake unless the source of issuer public keys is independently authenticated.

**C73.5 cryptographically binds the full list of eight reviewers to an offline registry signed by exactly 2 distinct Ed25519 keys out of 3 separately pinned root keys.** The configured roots are expected to originate from externally controlled, out-of-band registration; this code cannot provision or independently certify those root custodians.

## Module and receipt rules
`src/security/c73-quorum-root-issuer-registry.js`:
- Requires `pinnedRootKeys`: 3 distinct and public Ed25519 keys supplied by a protected server configuration separate from the incoming manifest and evidence pack.
- Requires a **two-person quorum**: exactly 2 verifiable distinct root signatures; cannot duplicate/relabel a root or share the same public key among root identities.
- Signature covers the entire serialized registry payload (all eight gate/issuer/role/Ed25519 key mappings, target Git SHA, environment, epoch, issue/expiry dates and revocation list), with a domain-separated signature prefix.
- Rejects unknown/missing/duplicate gate role or issuer; issuer key reuse and reuse of an offline root key as an issuer key.
- Rejects future/expired registries and those valid for more than 30 days; the **minimum acceptable epoch** must be provided by a separately protected external monotonically maintained setting. A correctly dual-signed older manifest is rejected by this floor.
- Rejects inclusion of a revoked issuer (a revoked role must be replaced and independently reviewed in a freshly quorum-signed registry).
- Calls the unchanged C73.4 original-byte SHA-256 + Ed25519 evidence verifier with the root-vetted eight issuer keys.
- Requires all eight P0 original evidence documents tied to the exact SHA and environment; even on synthetic success, returns `GOVERNED_P0_PACKET_CRYPTO_VERIFIED_HUMAN_GO_NO_GO_REQUIRED`, **never** production, transaction or official valuation authority.

## Tests
`tests/architecture/run_c73_5_quorum_root_trust_registry.js` creates only disposable Ed25519 root and reviewer keys, fake evidence and a synthetic epoch. Positive contract exercise does not represent real data or actual external endorsements. Adversarial cases include signatory impersonation, mutable registry, shared root/reviewer key, key rotation without quorum, orphaned/stale claim, root revocation and signer denial, maliciously reset epoch, wrong commit/environment, unsigned manifest, raw evidence substitution, and attempted replay on a new release.

## Remaining independent gates (non-code)
- Genuine root custodians' identities, responsibilities, private-key custody, legal delegation, out-of-band enrollment and root rotation/revocation: **not provided**.
- The external monotonic epoch floor must be durable, access-controlled, independent of the caller and restorable without rollback. Passing a fabricated floor or fake roots via local code defeats the registry trust guarantee.
- Source truth and license, PDPL legal basis, real Saudi-region KMS/HSM and immutable WORM store, certified malware scan, independently licensed property valuer, real Saudi market validation, live pen/load/DR and authorized signed GO/NO-GO: **not provided**.
- These are hard P0-A through P0-H blockers in #648; never infer approval from test fixtures or signed synthetic data.

**Decision: signed-root policy verification candidate qualified when CI passes; actual production/official appraisal/transaction = HOLD; PR Draft, no main merge or deploy.**
