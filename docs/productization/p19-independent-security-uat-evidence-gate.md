# P19 — Independent Security / UAT Evidence Gate

## Purpose

P19 adds a deterministic evidence gate above the qualified P18 observability/incident boundary. It does not execute penetration testing or user-acceptance testing itself. It validates supplied external evidence against the exact staging service and commit and keeps release authority fail-closed.

## Required parent evidence

The gate requires P18 status:

`OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED`

The P18 environment, service reference and exact commit SHA must match the P19 target.

## Independent penetration-test evidence

The supplied record must include:

- `status=PASS`
- exact staging environment, service reference and commit SHA
- external report reference and SHA-256 artifact hash
- testing organization, preparer and reviewer identities
- independent-assessor attestation
- separate preparer and reviewer
- explicit coverage of authentication, tenant isolation, API authorization and server runtime
- total and open finding counts by `CRITICAL/HIGH/MEDIUM/LOW/INFO`
- timestamps for start, completion and review
- retest completion when any Critical/High finding existed and was remediated

The gate blocks whenever any Critical or High finding remains open. Medium/Low/Info findings do not independently block P19, but remain visible as aggregate counts for later human risk acceptance and release governance.

## UAT evidence

The supplied record must include:

- `status=PASS`
- exact staging environment, service reference and commit SHA
- acceptance artifact reference and SHA-256 hash
- business owner and a separate reviewer
- complete coverage of critical workflows
- tenant-boundary acceptance
- authorization-workflow acceptance
- non-zero required scenario count
- all required scenarios passing and zero failed scenarios
- start, completion and review timestamps

## Freshness and scope

P19 applies a caller-supplied maximum evidence age in days. Evidence reviewed in the future or older than the configured age is rejected. Pentest and UAT records must both match the exact target environment, service and commit.

## Data minimization

Raw external report references, acceptance references, assessor names and reviewer identities are not returned. They are reduced to SHA-256 references. Unknown input fields such as passwords, tokens or provider metadata are not propagated.

## Successful state

The maximum successful state is:

`INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED`

This means only that the supplied records passed deterministic schema, scope, freshness, finding, coverage and review-separation checks.

## Explicit non-claims

P19 does not:

- validate authenticity of the external pentest/UAT artifacts
- verify assessor professional credentials or contractual independence
- perform a pentest, vulnerability scan, exploit attempt or UAT session
- certify production security
- prove production monitoring, DR, backup retention or secrets management
- establish Saudi legal, PDPL, professional-valuation or licensing compliance
- authorize release, merge, deployment, go-live or transactions

All authority fields remain `false`. Final external-evidence authenticity, risk acceptance and release authority remain with the existing governance process.
