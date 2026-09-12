# P16 — Controlled Backup / Restore Qualification

P16 adds a staging-only backup/restore qualification runner above the completed P15 application-security evidence boundary. The runner is dry-run by default and does not embed database credentials or shell commands.

## Scope

Execution requires:

- completed P15 staging API-security evidence;
- a source database reference/name;
- a distinct isolated restore-target database reference/name;
- exact commit SHA;
- caller-supplied RTO/RPO objectives and source policy reference;
- target-bound human authorization for both backup and restore;
- an accountable operator and an independent reviewer;
- host-injected backup, restore and verification adapters.

The runner never constructs a database connection string and never invokes `pg_dump`, `pg_restore`, cloud snapshot APIs, or infrastructure tooling directly. Those operational capabilities remain host-owned adapters.

## Verification

A successful adapter sequence must provide allowlisted metadata showing:

- immutable backup artifact ID and SHA-256;
- backup interval and source snapshot time;
- restored artifact hash equal to the backup artifact hash;
- source/restored record counts equal;
- source/restored fingerprints equal;
- no unreconciled data corruption;
- observed restore duration and observed data-loss interval within caller-supplied objectives.

P16 then produces the existing `BACKUP_RESTORE` resilience evidence record so it can feed the repository's performance/resilience qualification model.

## Evidence semantics

The highest status is:

`BACKUP_RESTORE_EVIDENCE_COMPLETE_NOT_PRODUCTION_CERTIFIED`

Failure to meet RTO/RPO becomes `HOLD_RECOVERY_OBJECTIVE`. Backup, restore and verification failures are separate fail-closed statuses, and adapter exception messages are not propagated to evidence outputs.

## Boundary

P16 is not proof that any real backup or restore occurred unless the host adapters are executed against an explicitly approved staging target and their external artifacts are independently retained/reviewed. CI uses test doubles only. Production is rejected. Disaster recovery, failover, monitoring/SLOs, penetration testing, legal/PDPL/professional approvals and human release/deployment/go-live authority remain external.
