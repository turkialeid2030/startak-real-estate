# External Validation SOW — Production Security, Performance & Resilience

Issue: #207
Parent tracker: #202
Qualified E2I head: `f910a086039b0cbde93faa063b468bfd0c28a3f9`

## Objective

Obtain real independent production-oriented validation of the exact release candidate and environment across three separate classes:

1. Security
2. Performance
3. Resilience

Internal architecture tests, static review, synthetic fixtures and CI success are not sufficient.

## Common binding requirements

Every external result must identify the exact:

- source commit;
- release-candidate ID;
- release artifact SHA-256;
- target environment;
- environment configuration SHA-256 or equivalent immutable configuration reference;
- test date/time;
- tester / firm identity.

A result performed against a materially different artifact or environment cannot be reused without documented equivalence and reviewer acceptance.

# A. Independent Security Assessment / Penetration Test

## Minimum scope

- public and authenticated web surfaces;
- APIs;
- authentication and session management;
- authorization / IDOR / privilege escalation;
- tenant isolation;
- storage and signed-access controls;
- file uploads / content handling where applicable;
- secrets and configuration exposure;
- injection classes;
- SSRF / unsafe outbound access where applicable;
- XSS / CSRF / clickjacking / browser security controls;
- rate limiting / abuse controls;
- sensitive-data exposure;
- exports / generated artifacts;
- audit logging and tamper considerations;
- dependency and infrastructure exposure relevant to the deployed architecture.

The firm should identify methodology and relevant standards/guidance used.

## Required security evidence

- firm and tester identities;
- independence statement;
- scope and exclusions;
- methodology and tools;
- exact tested artifact/environment;
- findings with severity and reproduction evidence;
- remediation requirements;
- retest results;
- final status;
- controlled report reference and SHA-256.

## Minimum release threshold

- Critical = 0 unresolved
- High = 0 unresolved

Medium/Low findings must have documented disposition and accepted risk owner where not remediated before launch.

# B. Performance Validation

## Required workload model

Agree and document before testing:

- expected user/concurrency profile;
- representative workflows;
- payload/data sizes;
- request mix;
- test duration;
- warm/cold behavior assumptions;
- infrastructure sizing;
- external dependency assumptions.

## Minimum metrics

Where technically applicable:

- throughput;
- error rate;
- p50 latency;
- p95 latency;
- p99 latency;
- CPU/memory/resource saturation;
- database/storage pressure;
- queue/backlog behavior;
- degradation point;
- recovery after load reduction.

The result must be explicitly assessed against agreed SLO/acceptance thresholds. If no SLO exists, the reviewer must flag this rather than inventing one silently.

## Required disposition

- PASS
- FAIL
- INCONCLUSIVE

# C. Resilience Validation

## Minimum scenarios

As applicable to the deployed architecture:

- upstream/dependency outage;
- network latency/degradation;
- datastore timeout/failure;
- partial service failure;
- retry/backoff behavior;
- duplicate/replayed requests where material;
- fail-closed behavior for authorization/security dependencies;
- backup/restore validation;
- rollback procedure;
- deployment failure recovery;
- recovery of stateful components;
- loss of non-critical analytics/AI dependency without corrupting deterministic core results.

## Recovery evidence

Where defined, record:

- RTO target and measured result;
- RPO target and measured result;
- restore time;
- data-loss observation;
- rollback time;
- post-recovery smoke results.

## Acceptance rule

#207 closes only when all three classes have independent accepted evidence for the exact production candidate and there are no unresolved Critical/High security findings or material failed/inconclusive performance/resilience blockers.

Security PASS does not imply performance or resilience PASS, and vice versa.