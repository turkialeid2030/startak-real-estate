# P25 — Canonical Re-baseline Governance Decision

## Purpose

P25 continues P24 after the repository owner approved proceeding with a governed replacement of the unavailable historical canonical file baseline.

It does **not** activate a new baseline. It records the decision boundary that must be satisfied before a separate reviewed activation change may even be proposed.

## Governance sequence

1. P24 must produce `READY_FOR_HUMAN_REBASELINE_GOVERNANCE`.
2. The owner/preparer must explicitly approve the proposal.
3. A different independent reviewer named in the P24 proposal must separately approve it.
4. Only then may P25 return `READY_FOR_EXPLICIT_BASELINE_ACTIVATION_CHANGE`.
5. A separate reviewed code change is still mandatory to activate any successor baseline.
6. Post-change Release Verify and E2I policy/evidence review remain mandatory.

## Current owner direction

The owner has approved the **direction to proceed with governed re-baselining** after confirming the historical canonical original is unavailable. This approval does not substitute for independent review and does not change the baseline by itself.

## Fail-closed properties

P25 keeps all of the following false even after both governance decisions approve:

- `canonicalBaselineChanged`
- `legacyCanonicalEvidenceClosed`
- `existingE2iCanonicalEvidenceSatisfied`
- `releaseAuthorized`
- `mergeAuthorized`
- `deploymentAuthorized`
- `goLiveAuthorized`
- `transactionAuthorized`

`automaticBaselineSwitchAllowed` is always false.

## Evidence model

Owner and independent-review decisions each require an actor reference, result, source reference, decision-artifact SHA-256, timestamp and rationale reference. P25 hashes normalized decision records and the combined governance decision deterministically.

This is an engineering/governance contract only. It does not authenticate the human actors cryptographically and does not claim that an independent review has happened unless a corresponding evidence record is supplied.
