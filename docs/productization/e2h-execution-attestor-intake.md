# E2H Execution Attestor Intake

## Purpose

This operational package prepares the public trust-root material and unsigned signing requests required by the existing E2H execution-attestation gate. It does not perform or attest merge, deployment, smoke validation, rollback-readiness validation, go-live, or any transaction.

The existing E2H policy requires independently verifiable RSA-SHA256 attestations for:

- `MERGE_EXECUTION_ATTESTATION`
- `DEPLOYMENT_EXECUTION_ATTESTATION`
- `POST_DEPLOYMENT_SMOKE_VALIDATION`
- `ROLLBACK_READINESS_VALIDATION`

The policy also requires the deployment attestor and post-deployment smoke attestor to be different actors.

## Registry intake

`prepareExecutionAttestorRegistryIntake()`:

- delegates canonical registry normalization to the existing E2H implementation;
- validates public RSA keys and rejects keys below 2048 bits when modulus metadata is available;
- requires coverage of all four attestation types;
- rejects any subject authorized for both deployment execution and post-deployment smoke;
- requires at least two distinct attestor subjects;
- rejects private keys, secrets, passwords, tokens and credentials;
- emits the deterministic registry SHA-256 for independent out-of-band pinning.

A successful registry intake returns `READY_FOR_E2H_EXECUTION_ATTESTOR_TRUST_ROOT_PINNING`. This does not establish the identity or trust of any attestor.

## Attestation signing request

`prepareExecutionAttestationSigningRequest()` requires an integrity-valid E2G packet in final status `HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION` with release, merge and deployment authorization flags true. It also requires the exact independently pinned execution-attestor registry SHA-256.

For one unsigned attestation it validates:

- attestor identity and allowed attestation type;
- attestor active period;
- observation occurring after E2G packet preparation;
- exact decision-packet hash;
- exact release-candidate ID, approved source commit, artifact hash, production environment and environment-config hash;
- type-specific fields already required by the existing E2H payload contract.

The output status `READY_FOR_EXTERNAL_EXECUTION_RSA_SHA256_SIGNATURE` means only that the deterministic payload is ready to be signed externally. The package emits the canonical UTF-8 payload, Base64 representation, payload SHA-256 and public-key SHA-256. It does not accept or use a private key and does not create a signature.

## CLI

```text
node tools/e2h-execution-attestor-intake.js registry \
  --registry execution-attestor-registry.json \
  --out registry-intake.json

node tools/e2h-execution-attestor-intake.js attestation \
  --policy governance/e2h-execution-attestation-post-deployment-closeout-policy-2026-09-08.json \
  --upstream e2g-human-release-decision-packet.json \
  --registry execution-attestor-registry.json \
  --expected-registry-sha <OUT_OF_BAND_PINNED_SHA256> \
  --attestation unsigned-execution-attestation.json \
  --out signing-request.json
```

Inputs are bounded regular JSON files; symlinks are rejected. Output files are mode `0600`.

## Execution ordering remains in E2H

This intake prepares one signing payload at a time. The existing E2H closeout gate remains responsible for validating the complete signed set and sequencing:

1. verified merge execution;
2. deployment bound to the verified merge commit;
3. smoke validation bound to the verified deployment and performed by a different actor from deployment;
4. rollback readiness bound to the same verified deployment.

Only the existing E2H gate can reach `EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE`, and even that status does not grant professional valuation authority, external issuance authority, go-live authority by itself, or transaction authority.

## Evidence limitation

Runtime tests use synthetic RSA public keys and a synthetic integrity-valid E2G fixture solely to exercise intake mechanics. They do not prove a real E2G human decision, merge, deployment, production smoke, rollback readiness, attestor identity or out-of-band trust-root pin.

## Safety boundary

All package authority/execution flags remain false. No GitHub merge API, Cloudflare API, production workflow dispatch, canonical-registry mutation, rollback, AI activation, E2H/E2I acceptance or transaction action is executed by this package.
