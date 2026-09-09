# P17 — Controlled Staging DR Failover Qualification

P17 adds a staging-only, dry-run-by-default database disaster-recovery drill boundary on top of the qualified P16 backup/restore evidence.

## Scope

The module orchestrates host-injected operational adapters for:

1. DR preflight
2. primary-to-standby failover
3. application/data verification on the standby
4. standby-to-primary failback
5. post-failback verification
6. deterministic resilience-evidence creation

It does not contain cloud/database credentials and does not implement provider-specific failover commands.

## Preconditions

Execution requires:

- completed P16 backup/restore evidence for the same staging primary database and exact commit
- a distinct standby database reference and name
- caller-supplied RTO/RPO objectives
- an explicit target-bound authorization allowing both failover and failback
- an accountable operator and a separate reviewer

Production is rejected by this runner.

## Qualification checks

The allowlisted evidence contract checks:

- primary health before the drill
- standby reachability
- replication health and observed lag metadata
- expected standby activation after failover
- read/write path health after failover
- record-count equality
- deterministic data-fingerprint equality
- duplicate-side-effect and unreconciled-corruption signals
- expected primary re-activation after failback
- repeated read/write/data-integrity checks after failback
- observed failover recovery time against caller-supplied RTO
- observed data loss against caller-supplied RPO

A passing drill creates the existing `DATABASE_UNAVAILABLE` resilience evidence record from `performance-resilience-qualification.js`.

## Evidence semantics

The highest automated result is:

`DR_FAILOVER_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED`

This is staging engineering evidence only. It does not prove production topology, provider failover automation, DNS/load-balancer behavior, production RTO/RPO, backup retention, monitoring, incident response, penetration testing, PDPL/legal/professional approval, or production resilience.

## Authority boundary

Always false:

- `releaseAuthorized`
- `mergeAuthorized`
- `deploymentAuthorized`
- `goLiveAuthorized`
- `transactionAuthorized`
- `productionPersistenceValidated`
- `productionSecurityValidated`
- `productionResilienceValidated`

A real DR drill must not be executed unless an accountable human selects and approves the exact staging primary/standby targets and change-control reference.
