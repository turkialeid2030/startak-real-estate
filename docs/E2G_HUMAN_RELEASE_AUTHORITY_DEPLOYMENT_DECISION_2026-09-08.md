# STARTAK Real Estate — E2G Human Release Authority & Deployment Decision Gate

Date: 2026-09-08

## Objective

E2G is the human authorization boundary after E2F has completed external conformance-authenticity, production security, production performance and production resilience validation for one exact release candidate.

E2G does not infer authorization from CI success. It requires explicit cryptographically verifiable human decisions for three separate actions:

1. release approval;
2. merge approval;
3. deployment approval.

Each decision is bound to the same release candidate, source commit, release artifact, target environment, target environment configuration and E2F validation-packet hash.

## Upstream prerequisite

E2G accepts only an integrity-valid E2F packet with status:

`EXTERNAL_CONFORMANCE_AND_PRODUCTION_VALIDATION_COMPLETE_PENDING_RELEASE_AUTHORITY`

The following E2F flags must also all be true:

- `externalConformanceEvidenceAuthenticityValidated`
- `productionSecurityValidated`
- `productionPerformanceValidated`
- `productionResilienceValidated`
- `productionValidationComplete`

Otherwise E2G fails closed with:

`HOLD_E2F_VALIDATION_PACKET`

## Human release-authority trust root

E2G uses a dedicated release-authority registry, separate from ordinary caller-provided identity labels.

The registry contains:

- authority identifier;
- human/governed subject reference;
- allowed decision types;
- public key and SHA-256 fingerprint;
- governance/appointment evidence reference;
- active period.

The full registry has a deterministic SHA-256 and must match an expected hash pinned out of band.

A mismatch produces:

`HOLD_RELEASE_AUTHORITY_ROOT`

## Signed human decisions

Supported decision types:

- `RELEASE_APPROVAL`
- `MERGE_APPROVAL`
- `DEPLOYMENT_APPROVAL`

Allowed results:

- `APPROVE`
- `REJECT`
- `HOLD`

Each signed decision is bound to:

- decision identifier and decision type;
- exact E2F validation-packet SHA-256;
- release-candidate identifier;
- source commit SHA;
- release artifact SHA-256;
- environment reference;
- environment-configuration SHA-256;
- authority identifier;
- decision evidence/source reference;
- decision artifact SHA-256;
- decision timestamp;
- rationale reference;
- optional expiry;
- decision result.

The initial supported signature algorithm is `RSA-SHA256`.

## Separation of decisions

Merge approval requires release approval.

Deployment approval requires merge approval.

The same human/governed subject may not authorize both merge and deployment under the current policy. A single actor may not authorize all three decisions.

These are minimum engineering separation-of-duty controls and do not replace any additional organizational governance requirement.

## States

- `HOLD_E2F_VALIDATION_PACKET`
- `HOLD_RELEASE_AUTHORITY_ROOT`
- `HOLD_DECISION_INTEGRITY`
- `HOLD_HUMAN_DECISION_REJECTED`
- `HOLD_HUMAN_DECISION`
- `WAITING_FOR_RELEASE_APPROVAL`
- `WAITING_FOR_MERGE_APPROVAL`
- `WAITING_FOR_DEPLOYMENT_APPROVAL`
- `HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION`

## Authorization vs execution

At `HUMAN_RELEASE_DECISIONS_COMPLETE_PENDING_EXECUTION`, the exact bound packet may record:

- `releaseAuthorized = true`
- `mergeAuthorized = true`
- `deploymentAuthorized = true`

This means only that the three required human authorization decisions have been validated for that exact software release candidate.

It does **not** mean that merge or deployment has happened:

- `mergeExecuted = false`
- `deploymentExecuted = false`

Execution requires a separate post-decision attestation/closeout stage.

## Professional and transaction boundary

Even with valid release/merge/deployment approvals, E2G does not establish:

- formal professional standards conformance;
- automatic standards/rule activation;
- Saudi professional licensing;
- certified valuation authority;
- external professional-report issuance authority;
- transaction authority.

Those remain separate governance/professional/legal matters.

Operating mode remains `UNLICENSED_DECISION_SUPPORT`.

## Production boundary

The repository deliberately ships with:

- `productionHumanReleaseAuthorityRegistryConfigured = false`
- `productionHumanReleaseDecisionsPresent = false`
- `automaticReleaseAllowed = false`
- `automaticMergeAllowed = false`
- `automaticDeploymentAllowed = false`

The architecture test uses ephemeral RSA keys and synthetic decisions solely to verify signature, binding, sequencing and fail-closed behavior. Test fixtures are not production approvals.

## Next controlled stage

After E2G engineering qualification, the next stage is:

`E2H_EXECUTION_ATTESTATION_AND_POST_DEPLOYMENT_CLOSEOUT`

E2H must verify actual merge/deployment execution against the exact approved commit/artifact/environment, record post-deployment smoke/rollback evidence and must not infer professional valuation authority or transaction authority from successful software deployment.
