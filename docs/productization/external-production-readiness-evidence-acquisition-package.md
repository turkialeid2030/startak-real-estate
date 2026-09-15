# External Production Readiness Evidence Acquisition Package

## Purpose

This operational slice implements the evidence-acquisition handoff described after P79 without creating a P80 synthetic qualification gate.

It prepares the exact unsigned E2I signing payloads for the five non-canonical external production-readiness evidence classes that still require real external evidence. It does not manufacture evidence, sign evidence, authenticate a verifier, establish a trust root, accept evidence into E2I, authorize production, or mutate the canonical registry.

## Architectural boundary

E2I remains the final internal engineering readiness aggregator and architectural stop. No internal package, test, fixture, or generated JSON artifact may substitute for the real external evidence required by E2I.

The existing canonical-source path remains separate:

- `CANONICAL_SOURCE_HASH_COMPARISON` continues through `external-canonical-evidence-operator.js` and `canonical-source-readiness-evidence-package.js`.

This slice covers only:

- `SAUDI_LEGAL_OPERATING_MODE_REVIEW`
- `PDPL_DATA_GOVERNANCE_REVIEW`
- `PROFESSIONAL_STANDARDS_SCOPE_REVIEW`
- `PRODUCTION_EXECUTION_CHAIN_CONFIRMATION`
- `OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION`

## Added components

### `src/qualification/external-production-readiness-evidence-package.js`

Provides two deterministic operations:

1. `createExternalProductionReadinessEvidencePackage()` prepares one exact unsigned E2I evidence payload.
2. `createExternalProductionReadinessEvidenceAcquisitionBundle()` prepares zero to five unique non-canonical evidence payloads and reports which evidence classes are still missing.

For every prepared package:

- `sourceRef` is reduced to an opaque SHA-256 reference before it enters the output package;
- the payload is normalized through the existing E2I `createReadinessEvidenceSigningPayload()` contract;
- signing bytes are deterministic stable JSON bytes;
- `RSA-SHA256` remains the required signature algorithm;
- an external readiness verifier and pinned verifier-registry trust root remain required;
- private signing keys are not accepted;
- E2I acceptance remains pending;
- every release, merge, deployment, go-live, transaction, legal-approval, professional-authority and external-authenticity flag remains false.

Preparing all five payloads only changes the bundle state to `READY_FOR_EXTERNAL_READINESS_VERIFIER_SIGNATURES`. It does not mean that the evidence is authentic, signed, independently verified, current, accepted by E2I, or sufficient for production go-live.

### `tools/external-production-readiness-evidence-acquisition-package.js`

CLI operator:

```text
node tools/external-production-readiness-evidence-acquisition-package.js \
  --input /secure/path/evidence-input.json \
  --output /secure/path/signing-bundle.json
```

Operational controls:

- regular JSON input only;
- input size limit: 2 MiB;
- input symlinks rejected;
- output symlinks rejected;
- explicit rejection of private/secret signing-key material fields;
- output mode forced to `0600`;
- no signing operation;
- no network operation;
- no repository mutation;
- no deployment or go-live action.

## Required input linkage

Each evidence item must be tied to the exact production-readiness chain through:

- upstream E2H closeout packet SHA-256;
- release-candidate ID;
- source commit SHA;
- release artifact SHA-256;
- target environment reference;
- environment-configuration SHA-256;
- external verifier ID;
- evidence artifact SHA-256;
- verification timestamp and optional expiry;
- evidence scope;
- evidence result.

The generated payload must then be signed outside this package by an authorized readiness verifier whose public key and allowed evidence type are present in the independently pinned E2I readiness-verifier registry.

## Regression scope

The runtime regression verifies:

- one-package preparation;
- complete five-class bundle preparation;
- incomplete-bundle reporting;
- duplicate evidence-type rejection;
- canonical-source type rejection on this path;
- deterministic payload bytes/hashes;
- source-reference opacity;
- RSA-SHA256 compatibility with the existing E2I verifier;
- tamper rejection after signing;
- private/secret caller fields do not enter the generated package.

Synthetic RSA keys used by regression prove only signing-path compatibility. They are not external production evidence and do not establish a real verifier identity or approval.

## Current authority and baseline

This slice preserves the current checked-in authoritative canonical baseline:

- active mode: `LEGACY_FILE_SHA256`
- registry SHA-256: `20664dcc406d01de485f9abd8031cbe74d5d677c01bb355e44b70f2fd4f5a343`

No canonical-registry mutation is performed.

All release, merge, deployment, go-live and transaction authority remains false. The real next step is to obtain the external evidence artifacts and authorized signatures, pin the real readiness-verifier registry out of band, and submit the resulting signed records to the existing E2I verification workflow.
