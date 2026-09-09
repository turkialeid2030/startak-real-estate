# P18 — Controlled Staging Observability and Incident Qualification

P18 adds a staging-only, dry-run-by-default qualification boundary for monitoring freshness, required signal coverage, synthetic alert delivery, incident acknowledgement and runbook readiness.

## Preconditions

Execution requires:

- completed P17 DR failover evidence for the same staging environment and exact commit
- caller-supplied monitoring objectives
- explicit authorization to trigger a synthetic staging alert
- an accountable operator and a separate reviewer

Production is rejected by this runner.

## Host-injected adapters

Provider-specific monitoring and incident tooling remains external:

- `metricsExecutor`
- `alertExecutor`
- `incidentExecutor`

No monitoring credentials, webhook secrets, bearer tokens or provider API keys are embedded by the module.

## Qualification checks

The caller supplies:

- required monitoring signals
- maximum metric freshness
- maximum alert-delivery time
- maximum incident-acknowledgement time
- the source reference for those objectives

The runner verifies:

1. the metrics query is healthy
2. every caller-required signal is represented
3. metric freshness remains inside the supplied objective
4. the staging synthetic alert is delivered
5. alert delivery remains inside the supplied objective
6. an incident is opened and acknowledged
7. an incident runbook is available
8. on-call ownership and escalation-policy references exist
9. acknowledgement remains inside the supplied objective
10. the drill is resolved before the evidence assessment time

Operational artifact references are SHA-256 hashed before being placed into the result so raw internal URLs, IDs and routing references are not returned.

## Evidence semantics

The highest automated status is:

`OBSERVABILITY_INCIDENT_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED`

This does not certify production monitoring, production alert routing, 24x7 staffing, incident-management process maturity, SLO/SLA governance, external pentest, PDPL/legal/professional approval, or release/deployment authority.

## Authority boundary

Always false:

- `releaseAuthorized`
- `mergeAuthorized`
- `deploymentAuthorized`
- `goLiveAuthorized`
- `transactionAuthorized`
- `productionMonitoringValidated`
- `productionIncidentResponseValidated`
- `productionSecurityValidated`
- `productionResilienceValidated`

A real synthetic alert must not be triggered against any real environment without accountable human authorization and target selection.
