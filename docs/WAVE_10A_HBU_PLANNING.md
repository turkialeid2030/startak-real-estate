# Wave 10A — Highest & Best Use and Saudi Planning Evidence

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

## Purpose

Wave 10A establishes a professional Highest & Best Use workflow and a temporally governed Saudi planning-evidence layer. It does not create a legal opinion, certify planning compliance, calculate a valuation conclusion, or authorize a transaction.

## Planning evidence

The planning evidence model covers:

- zoning classification;
- permitted use;
- FAR;
- BCR;
- height limit;
- setbacks;
- parking requirements;
- permit status;
- development restrictions;
- development conditions.

Every record carries case/property binding, authority class, source authority/reference, source effective date, validity interval, verification provenance, capture timestamp and deterministic SHA-256.

Planning evidence is assessed against the valuation date. Expired/future evidence, missing mandatory evidence, unverified/disallowed authority evidence, duplicate IDs, integrity failures and conflicting single-value constraints fail closed.

`READY_FOR_HBU_LEGAL_REVIEW` means only that configured evidence coverage, temporal-validity, authority/verification and cardinality checks passed. It is not a legal opinion or planning-compliance conclusion.

## HBU sequential gates

Each use scenario is evaluated in the required order:

1. legally permissible;
2. physically possible;
3. financially feasible;
4. maximally productive.

A downstream gate cannot be evaluated before the preceding gate passes. Planning evidence must be ready before legal-permissibility review, and the Property Evidence Packet must be ready before physical-possibility review.

The first three gates create a candidate for professional max-productivity comparison. They do not establish HBU by themselves.

## Maximally productive decision

The final HBU decision is an explicit professional judgment over feasible candidates. The system records:

- selected scenario;
- comparison basis;
- optional comparative metrics supplied by the professional workflow;
- rationale;
- evidence references;
- decision maker and timestamp;
- decision evidence reference;
- scenario and decision integrity hashes.

The system does not automatically rank or select uses. A larger numeric metric does not automatically become the HBU conclusion.

## Safety boundaries

- `automaticUseSelection=false`
- `automaticMaxProductivityRanking=false`
- `legalOpinionEstablished=false`
- `planningComplianceEstablished=false`
- `valuationConclusionProduced=false`
- `certifiedValuationEstablished=false`
- `transactionAuthorized=false`

## Qualification marker

`WAVE_10A_HBU_PLANNING=PASS`

## Next controlled sub-wave

Wave 10B: ESG evidence and materiality governance. ESG factors may be recorded and professionally considered, but no automatic value adjustment is permitted without supported market evidence and explicit professional adoption.
