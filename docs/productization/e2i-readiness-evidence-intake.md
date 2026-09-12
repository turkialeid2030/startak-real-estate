# E2I Readiness Evidence Intake

## Purpose

This package operationalizes the final E2I evidence intake without weakening the E2I architectural stop. It prepares public readiness-verifier trust-root material and one unsigned readiness-evidence signing payload at a time. It does not create evidence, accept a legal/professional conclusion, authorize go-live, activate standards/rules, or authorize transactions.

E2I remains limited to `UNLICENSED_DECISION_SUPPORT` and requires six real externally signed evidence classes:

1. `CANONICAL_SOURCE_HASH_COMPARISON`
2. `SAUDI_LEGAL_OPERATING_MODE_REVIEW`
3. `PDPL_DATA_GOVERNANCE_REVIEW`
4. `PROFESSIONAL_STANDARDS_SCOPE_REVIEW`
5. `PRODUCTION_EXECUTION_CHAIN_CONFIRMATION`
6. `OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION`

The existing E2I contract requires all six to be VERIFIED, requires at least two verifier subjects across the final evidence set, and states that no further internal engineering gate may substitute for missing external evidence.

## Operational registry intake

`prepareReadinessVerifierRegistryOperationalIntake()` builds on the existing readiness-verifier registry intake and additionally validates that every configured public key is suitable for the E2I `RSA-SHA256` signature contract.

It:

- preserves the existing six-type coverage and minimum two-subject checks;
- rejects private keys, secrets, credentials, tokens and passwords;
- parses each public key and requires RSA;
- rejects RSA keys below 2048 bits when modulus metadata is available;
- emits the deterministic registry SHA-256 for independent out-of-band pinning.

Success status: `READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING`.

This status is structural/operational readiness only. It does not establish verifier identity or trust.

## Readiness evidence signing request

`prepareReadinessEvidenceSigningRequest()` requires:

- the existing E2I policy;
- an integrity-valid E2H packet with status `EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE`;
- all required upstream E2H authorization/execution/smoke/rollback flags true;
- an operationally valid readiness-verifier registry;
- the exact independently supplied pinned registry SHA-256;
- one unsigned readiness-evidence record.

The request validates verifier type authorization, active period, evidence timing after E2H closeout, and exact binding to:

- E2H closeout packet hash;
- release-candidate ID;
- source commit SHA;
- artifact SHA-256;
- production environment reference;
- production environment-config SHA-256.

It then emits the same canonical UTF-8 payload consumed by the existing E2I RSA-SHA256 signature verifier, together with Base64 bytes and the payload SHA-256.

Success status: `READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE`.

The private key is never accepted and no signature is created. A signing request is not accepted evidence and cannot make `goLiveReady=true`.

## External evidence matrix

The operational evidence request matrix remains the source for the requested external reviewer roles, review questions and minimum deliverables:

`governance/e2i-external-evidence-request-matrix-2026-09-11.json`

The six evidence records must correspond to real external or production artifacts. Synthetic fixtures and internal regression tests cannot satisfy these requests.

## CLI

```text
node tools/e2i-readiness-evidence-intake.js registry \
  --registry readiness-verifier-registry.json \
  --out registry-intake.json

node tools/e2i-readiness-evidence-intake.js evidence \
  --policy governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json \
  --upstream e2h-production-closeout.json \
  --registry readiness-verifier-registry.json \
  --expected-registry-sha <OUT_OF_BAND_PINNED_SHA256> \
  --evidence unsigned-readiness-evidence.json \
  --out signing-request.json
```

Inputs are bounded regular JSON files and symlinks are rejected. Output files are written mode `0600`.

## Required operational sequence

1. Appoint real independent readiness verifiers for the six evidence classes.
2. Obtain only their RSA public keys and governance evidence references.
3. Run registry intake and pin the resulting SHA-256 independently outside the application/repository trust path.
4. Complete the real E2G and E2H chain first.
5. Obtain the six real external/production evidence artifacts described by the request matrix.
6. For each evidence artifact, prepare the exact unsigned E2I record and generate the signing request.
7. The relevant verifier signs the canonical bytes externally with its independently controlled private key.
8. Supply all signed evidence records to the existing E2I packet builder.
9. Only the existing E2I aggregator can reach `GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT` after verifying all six evidence classes and verifier-subject diversity.

## Evidence limitation

Runtime tests use synthetic RSA public keys and a synthetic integrity-valid E2H closeout fixture solely to verify intake mechanics. They do not establish real legal review, PDPL review, professional standards review, canonical-source comparison, production execution-chain confirmation, claims-restriction confirmation, verifier identity, trust-root pinning or go-live readiness.

## Safety boundary

All authority and execution flags in this intake remain false. No GitHub merge, Cloudflare deployment, workflow dispatch, canonical-registry mutation, AI activation, rollback, external professional issuance, E2I acceptance, go-live authorization or transaction action is performed.
