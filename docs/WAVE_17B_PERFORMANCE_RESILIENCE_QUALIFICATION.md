# Wave 17B — Performance & Resilience Qualification

## Objective
Add a deterministic qualification layer for performance and resilience evidence without pretending that this module itself executes load tests, chaos tests, failovers, restores, or production capacity studies.

## Performance evidence
Wave 17B requires caller-supplied SLOs for each required workload class. SLOs include maximum p95/p99 latency, minimum throughput, maximum error rate, minimum sample count, source/rationale, owner, effective date, review and a content hash.

Run evidence is explicitly bound to environment and exact commit SHA and records concurrency, duration, sample count, latency percentiles, throughput, error rate, source artifact hash, test timestamps, preparer/reviewer and evidence references.

The evaluator compares measured run evidence only against the supplied SLO. It never invents service-level thresholds.

## Resilience evidence
Resilience scenarios include dependency timeout, database unavailability, process restart, rate limiting, partial service outage, backup restore and degraded mode.

Each scenario requires caller-supplied maximum recovery time and data-loss objectives, observed recovery/data-loss values, duplicate-side-effect and corruption indicators, evidence artifact hash, timestamps and independent review.

## Qualification gate
The aggregate qualification requires:
- explicit environment (`CI_TEST`, `STAGING`, or `PRODUCTION`)
- exact commit binding
- complete required workload coverage
- complete required resilience-scenario coverage
- passing performance SLO evidence
- passing resilience-objective evidence
- evidence freshness
- content integrity
- independent review

A passing result is only `READY_FOR_INDEPENDENT_PERFORMANCE_VALIDATION`.

## Authority boundary
Wave 17B does not establish a production SLA, production capacity plan, production performance certification, production resilience certification, external availability commitment, merge authorization, deployment authorization, or transaction authority.

Production-labelled evidence remains evidence requiring independent validation. CI or staging evidence must not be reinterpreted as production evidence.

## Qualification
The dedicated workflow runs the Wave 17B regression plus canonical `npm run release:verify`. Engineering PASS permits progression to Wave 17C only. Keep Draft; no merge or deploy without explicit authorization.
