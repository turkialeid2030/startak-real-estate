# C29 — Governed Shadow Simulation, Historical Replay & UAT Harness

## Purpose
C29 creates a side-effect-free pre-production simulation evidence layer above the exact qualified C28 integration head. It deliberately separates synthetic engineering completion from actual historical performance and human UAT evidence.

The simulated candidate integration head is bound using the repository-native 40-hex Git commit SHA. Evidence, input, scenario, observation and campaign integrity values remain SHA-256 and are validated independently.

## Scenario classes
- `SYNTHETIC_END_TO_END`
- `HISTORICAL_REPLAY`
- `SOURCE_DEGRADATION`
- `POLICY_SHOCK`
- `MONTE_CARLO`
- `AI_HOSTILE_INPUT`
- `SIDE_EFFECT_DRY_RUN`
- `UAT_PROFESSIONAL_REVIEW`

Historical replay and UAT are external-evidence scenarios and cannot be mislabeled as synthetic. The other scenarios are explicitly simulation-only and must be labeled synthetic.

## Evidence semantics
Synthetic observations require an explicit governed output SHA-256 and observation time. They cannot carry an actual-evidence reference or claim production performance.

Historical replay and UAT can either remain `NOT_EVALUATED` with an explicit reason and no fabricated evidence fields, or capture actual evidence with a reference, SHA-256, evidence kind and timestamp. Capturing an artifact does not itself establish model accuracy, approve UAT or authorize production.

## Side-effect prohibition
Every scenario and observation binds transaction execution, bid submission, payment initiation, filing submission, terms acceptance, production deployment and autonomous action to false. Any attempt to set a real side effect to true is rejected.

## Campaign status
- `TECHNICALLY_COMPLETE_EXTERNAL_EVIDENCE_OPEN`: all technical simulations completed while real historical/UAT evidence remains absent;
- `TECHNICALLY_COMPLETE`: technical simulations completed and actual historical/UAT artifacts were captured, without implying approval;
- `HOLD_EVIDENCE`: required technical scenario/observation missing or not evaluated;
- `HOLD_INTEGRITY`: tamper, duplicate or candidate-head integrity failure;
- `HOLD_CONTEXT`: case/property/binding/mislabeling conflict;
- `HOLD_TEMPORAL`: future observation.

## No invented thresholds
C29 does not invent accuracy, latency, error-rate, valuation-tolerance or UAT thresholds. Monte Carlo consumes only the SHA-bound governed input supplied from upstream and does not invent probability distributions.

## Authority posture
`COMMERCIAL_GO_LIVE = HOLD`; transaction, approval, Public AI, production deployment and canonical-baseline activation authority remain false.