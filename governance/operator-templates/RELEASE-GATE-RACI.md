# Release Gate RACI — Frozen RC

Applies only to `startak-real-estate-rc-2026-09-16-e876208c19ff`.

| Gate / Activity | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) | Mandatory control |
|---|---|---|---|---|---|
| #326 GitHub ruleset update | Repository Administrator | Repository Owner | Release Governance Owner | Release stakeholders | Preserve strict enforcement; add `trusted-main-production-governance`; no bypass |
| #327 production Environment verification | Repository Administrator | Repository Owner | Security / Release Governance | Release stakeholders | Required reviewers, branch restrictions, least-privilege production secret scope |
| #254 independent review | Independent Reviewer | Independent Review Authority | Release Governance Owner | Repository Owner | Reviewer must differ from owner/release operator; RSA-SHA256 external signature |
| E2E rule/implementation conformance | Independent Conformance Reviewer | Conformance Authority | Engineering | Release Governance Owner | Exact RC tuple; no fixture/self-verification |
| E2F external conformance authenticity | External Verifier | Verification Authority | Independent Reviewer | Release Governance Owner | Governed verifier registry + pinned hash + RSA-SHA256 |
| E2F production security validation | Security Verifier | Security Authority | Engineering | Release Governance Owner | Real production evidence; not synthetic |
| E2F performance validation | Performance Verifier | Performance Authority | Engineering | Release Governance Owner | Real production-representative evidence |
| E2F resilience validation | Resilience Verifier | Resilience Authority | Engineering | Release Governance Owner | Real failover/recovery/resilience evidence |
| E2G RELEASE_APPROVAL | Release Authority | Release Governance Accountable | Independent Reviewer | Repository Owner | Signed decision bound to frozen tuple |
| E2G MERGE_APPROVAL | Merge Authority | Repository Governance Accountable | Release Authority | Deployment Authority | Must be a human authority and must differ from Deployment authority |
| E2G DEPLOYMENT_APPROVAL | Deployment Authority | Production Governance Accountable | Security / Release Authority | Merge Authority | Must differ from Merge authority |
| Load protected secrets | Repository / Environment Administrator | Production Governance Accountable | Security | Release Governance Owner | Only after E2E/E2F/E2G package verification |
| Open final RC→main PR | Release Operator | Release Governance Accountable | Engineering / Independent Reviewer | Repository Owner | Head SHA must remain `e876208c19ffbddd0dacd2bf8fce24aba1e52b55` |
| Merge final PR | Merge Authority / authorized operator | Merge Authority | Release Authority | Deployment Authority | Both required status checks must pass on the exact same SHA |
| Production deployment | Deployment Operator | Deployment Authority | Security / Release Authority | Merge Authority | Merge success alone is insufficient; explicit deployment approval required |

## Separation-of-duties rules

1. `MERGE_APPROVAL` subject MUST NOT equal `DEPLOYMENT_APPROVAL` subject.
2. Independent reviewer MUST NOT be the owner/release operator whose work is being reviewed.
3. External validation evidence MUST NOT be self-issued by the implementation actor when the gate calls for independent evidence.
4. GitHub administrator action is administrative execution only; it does not substitute for release, merge, or deployment approval.
5. The repository owner may be Accountable for administrative controls, but must not collapse mandatory independent-review or merge/deploy separation controls.

## Fail-closed rule

Any missing named human, missing authority evidence, invalid registry pin, stale tuple, invalid signature, missing status check, environment-policy uncertainty, or identity ambiguity results in `HOLD`.

`TRANSACTION_AUTHORITY=false` remains until the complete governed release chain is independently satisfied.
