# E2G Release Authority Decision Intake

## Purpose

This operational package prepares the real human-release-authority inputs required by the existing E2G gate. It does **not** create a new engineering authority gate and it does not authorize or execute release, merge, deployment, activation, go-live, rollback, external professional issuance, or transactions.

The existing E2G policy requires a production release-authority registry whose SHA-256 is pinned independently out of band, plus separate cryptographically signed human decisions for:

- `RELEASE_APPROVAL`
- `MERGE_APPROVAL`
- `DEPLOYMENT_APPROVAL`

The policy also prohibits the same actor from authorizing both merge and deployment and prohibits automatic release, merge, deployment and rule activation.

## Registry intake

`prepareReleaseAuthorityRegistryIntake()` accepts public authority material only and:

- delegates canonical registry normalization to the existing E2G implementation;
- verifies each public key is an RSA public key and rejects RSA keys below 2048 bits when modulus metadata is available;
- requires coverage of all three required decision types;
- rejects any authority subject that can authorize both merge and deployment;
- requires at least two distinct authority subjects;
- rejects fields that appear to contain private keys, secrets, passwords, tokens or credentials;
- emits the deterministic registry SHA-256 as `outOfBandPinValue`.

A successful intake returns `READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING`. This means only that the proposed public registry is structurally ready for independent trust-root pinning. Trust is not established by this package.

## Decision signing request

`prepareReleaseDecisionSigningRequest()` accepts:

- the existing E2G policy;
- an integrity-valid E2F packet in final status `EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY` with all required production-validation flags true;
- the proposed release-authority registry;
- the independently supplied expected registry SHA-256;
- one **unsigned** release decision record.

The package verifies the pinned registry hash, authority type, active period, and exact binding to the E2F release candidate: validation packet, commit, artifact, environment and environment configuration. It then emits the same deterministic canonical payload consumed by the existing E2G `RSA-SHA256` signature verifier.

A successful request returns `READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE` together with:

- canonical UTF-8 signing payload;
- Base64 representation of those exact bytes;
- payload SHA-256;
- authority public-key SHA-256;
- required signature algorithm.

The private key is never accepted and no signature is created. A signing request is not an approval.

## CLI

```text
node tools/e2g-release-authority-decision-intake.js registry \
  --registry release-authority-registry.json \
  --out registry-intake.json

node tools/e2g-release-authority-decision-intake.js decision \
  --policy governance/e2g-human-release-authority-deployment-decision-policy-2026-09-08.json \
  --upstream e2f-production-validation.json \
  --registry release-authority-registry.json \
  --expected-registry-sha <OUT_OF_BAND_PINNED_SHA256> \
  --decision unsigned-release-decision.json \
  --out signing-request.json
```

Inputs must be bounded regular JSON files; symlinks are rejected. Output files are written with mode `0600`.

## Operational sequence

1. Nominate real human authorities and obtain only their RSA public keys and governance evidence references.
2. Run registry intake and independently pin the resulting registry SHA-256 outside the application/repository trust path.
3. After a real E2F production-validation packet exists, prepare an unsigned decision for the exact candidate.
4. Generate the signing request and send only the canonical signing bytes/payload to the relevant human authority.
5. The human authority signs externally with its independently controlled private key and returns the Base64 signature plus the governed decision artifact/reference.
6. Feed the signed record into the existing E2G decision packet builder. Only three valid, appropriately separated human decisions can reach `HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION`.
7. Execution still remains separate and must be attested through E2H.

## Evidence limitation

The runtime regression suite uses synthetic public RSA keys and a synthetic integrity-valid E2F fixture solely to test intake mechanics. It does not establish a real E2F production validation, real authority identity, real out-of-band trust-root pin, human approval, or production authorization.

## Safety boundary

All package authority flags remain false. This package cannot merge a PR, call Cloudflare, mutate the canonical registry, deploy software, activate AI, perform rollback, declare E2H/E2I acceptance, authorize go-live, or authorize any real-estate transaction.
