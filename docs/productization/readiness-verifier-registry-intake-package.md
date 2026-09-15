# Production Readiness Verifier Registry Intake Package

## Purpose

This operator prepares the **proposed production-readiness verifier registry** required by the existing E2I architectural-stop contract for real external evidence.

It is not a new readiness gate and it does not replace E2I. It validates registry structure, public-key hashes, evidence-type coverage and minimum verifier-subject diversity, then emits the deterministic registry SHA-256 that must be pinned independently outside the application/repository trust path.

## Why this exists

E2I requires all of the following before it can trust signed production-readiness evidence:

- a production-readiness verifier registry;
- the registry hash pinned out of band;
- RSA-SHA256 evidence signatures;
- verifier authorization for each evidence type;
- at least two distinct verifier subjects across the complete evidence set;
- all six required E2I evidence classes.

The existing E2I gate already verifies those conditions at final acceptance time. This intake utility only makes preparation of the registry deterministic and reviewable before real external evidence is signed.

## Required evidence-type coverage

The proposed registry must collectively cover:

1. `CANONICAL_SOURCE_HASH_COMPARISON`
2. `SAUDI_LEGAL_OPERATING_MODE_REVIEW`
3. `PDPL_DATA_GOVERNANCE_REVIEW`
4. `PROFESSIONAL_STANDARDS_SCOPE_REVIEW`
5. `PRODUCTION_EXECUTION_CHAIN_CONFIRMATION`
6. `OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION`

At least two distinct `verifierSubjectRef` values are required so the eventual complete E2I evidence set cannot be attributable to only one verifier subject.

## Registry record requirements

Each verifier record must contain the fields already required by `normalizeReadinessVerifierRegistry`:

- `verifierId`
- `verifierSubjectRef`
- `allowedEvidenceTypes`
- `publicKeyPem`
- `publicKeySha256`
- `governanceEvidenceRef`
- `activeFrom`
- optional `activeUntil`

The registry also requires:

- `registryId`
- `governanceArtifactSha256`
- a non-empty `verifiers` array

Only **public** verifier material belongs in this registry. Private keys, secrets, tokens, passwords and credentials are rejected by the intake package.

## Output states

- `HOLD_INVALID_READINESS_VERIFIER_REGISTRY` — malformed registry, invalid public-key hash, missing required registry structure, or forbidden secret material.
- `HOLD_READINESS_VERIFIER_COVERAGE` — one or more E2I evidence classes have no authorized verifier.
- `HOLD_READINESS_VERIFIER_SUBJECT_DIVERSITY` — the proposed registry does not provide at least two distinct verifier subjects.
- `READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING` — structural validation, coverage and diversity are satisfied; the emitted hash is ready to be independently pinned.

`READY_FOR_OUT_OF_BAND_TRUST_ROOT_PINNING` does **not** mean the registry is trusted. The out-of-band trust-root act remains external and must not be inferred from this result.

## CLI

```bash
node tools/readiness-verifier-registry-intake-package.js \
  --registry /secure/input/readiness-verifier-registry.json \
  --out /secure/output/readiness-verifier-registry-intake-result.json
```

The CLI:

- accepts a bounded regular JSON file only;
- rejects symlink input;
- never accepts or uses a private signing key;
- performs no network, merge, deployment or production action;
- writes requested output using mode `0600`;
- exits non-zero when the registry is on HOLD.

## Out-of-band pinning boundary

The successful result exposes:

- `registryId`
- `registryHashSha256`
- `outOfBandPinValue`
- normalized public registry material
- evidence-type coverage
- distinct verifier subjects

The `outOfBandPinValue` is the deterministic SHA-256 to be independently approved/pinned by the applicable governance authority outside the self-asserted registry artifact. The repository does not perform that external trust act.

## Relationship to the previous acquisition package

The preceding external production-readiness evidence acquisition package prepares the five non-canonical unsigned E2I signing payloads. The existing canonical-source operator prepares the canonical evidence signing payload separately.

This registry-intake package prepares the **public verifier trust-registry artifact** those future signatures will reference. It does not sign either evidence or the registry and does not accept any evidence into E2I.

## Authority boundary

All authority remains false:

- release authorization;
- merge authorization;
- deployment authorization;
- go-live authorization;
- transaction authorization;
- verifier trust establishment;
- out-of-band trust-root pinning;
- external-evidence acceptance;
- legal approval;
- professional authority.

The correct next real-world step after a successful intake is independent governance review and out-of-band pinning of the emitted registry hash, followed by actual external verifier signatures over the exact evidence payloads and final E2I evaluation.
