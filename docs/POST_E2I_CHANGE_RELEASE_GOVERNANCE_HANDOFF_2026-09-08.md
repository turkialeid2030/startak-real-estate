# Post-E2I Change → Existing Release Governance Handoff — 2026-09-08

## Purpose

This adapter connects an explicitly selected, engineering-qualified change package to the repository's **existing** release/go-live governance machinery. It does not create a new release-authority framework.

Upstream state required:

`QUALIFIED_FOR_RELEASE_REVIEW_ONLY`

Maximum handoff state:

`READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW`

## Required handoff controls

1. The engineering change qualification package must be scoped to the same `projectId` and `caseId`.
2. Proposal promotion must be explicit through `selectedProposalRefs`; no qualified proposal is promoted implicitly.
3. Every selected proposal must exist in `qualifiedForReleaseReviewProposalRefs`.
4. The release candidate must be explicit and bound by:
   - candidate ID;
   - candidate reference;
   - exact 40-character commit SHA;
   - exact artifact SHA-256;
   - operating mode.
5. Every selected proposal's implementation evidence must bind to the same candidate commit and artifact.
6. Operating mode must remain `UNLICENSED_DECISION_SUPPORT`.
7. A canonical-original comparison that is `SKIPPED`, `NOT_PROVIDED`, or `INCONCLUSIVE` is never promoted to a successful comparison.
8. A declared `MATCH` requires identical expected/observed SHA-256 values and an evidence reference.
9. A declared `MISMATCH` holds the handoff.

## Existing downstream governance

The handoff points to the already-existing controls rather than duplicating them:

- `independent-release-qualification`
- `institutional-go-live-gate`
- `human-go-live-decision`
- `controlled-production-activation`
- `production-deployment-evidence`

Those downstream layers retain their own evidence, human-authority and activation requirements.

## Immutable calculation-sensitive classification

The prior engineering-change gate exported a frozen `Set`. Freezing a JavaScript `Set` does not prevent `add`, `delete`, or `clear`, so the classification could be mutated by a caller.

This increment replaces the exported value with a frozen array and keeps a private lookup `Set`. Consumers may inspect the classification policy but cannot mutate it through the exported object.

## Authority boundary

The handoff always keeps the following false:

- `formalStandardsConformanceEstablished`
- `saudiProfessionalLicensingEstablished`
- `pdplComplianceEstablished`
- `certifiedValuationAuthorityEstablished`
- `professionalReportExternalIssuanceAuthorized`
- `canonicalOriginalComparisonAuthenticityVerified`
- `externalEvidenceAuthenticityVerified`
- `releaseAuthorized`
- `mergeAuthorized`
- `deploymentAuthorized`
- `transactionAuthorized`

`externalEvidenceRequired=true` and `downstreamReleaseGovernanceRequired=true` remain explicit even when the handoff envelope is structurally ready.

## Non-goals

This increment does not:

- merge or deploy code;
- activate a standard or rule;
- authenticate external evidence;
- establish Saudi legal/professional licensing or PDPL compliance;
- convert a skipped canonical-original comparison into a PASS;
- issue a certified valuation;
- execute a transaction.

## Qualification

The exact PR head must pass the canonical `Release Verify` workflow and `tests/architecture/run_change_release_governance_handoff.js` before this increment is described as engineering-qualified.
