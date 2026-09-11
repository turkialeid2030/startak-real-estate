# P8 External Qualification Checklist

This checklist is evidence-tracking only. Marking an item in code or documentation does not authorize production use.

| Control | Current state | Required external evidence |
|---|---|---|
| Production IdP | NOT ESTABLISHED | configured IdP, issuer/audience/JWKS validation, session/revocation controls, deployment evidence |
| Tenant isolation / RLS | NOT ESTABLISHED | deployed database policy, migration evidence, runtime cross-tenant/IDOR test results |
| Durable audit persistence | NOT ESTABLISHED | append-only or equivalent audit store, retention/access policy, runtime evidence |
| Backup / restore | NOT ESTABLISHED | backup policy plus successful restore test evidence |
| Disaster recovery | NOT ESTABLISHED | RTO/RPO targets plus DR exercise evidence |
| Monitoring / alerting | NOT ESTABLISHED | production telemetry, alert routing, escalation evidence |
| Incident response | NOT ESTABLISHED | approved runbook, owners, exercise/tabletop evidence |
| Secrets management | NOT ESTABLISHED | production secret store/configuration and rotation evidence |
| Penetration test | NOT ESTABLISHED | scoped independent test and remediation/acceptance evidence |
| Legal / PDPL / professional review | NOT ESTABLISHED | applicable human/legal/professional approvals |
| Release authority | NOT AUTHORIZED | existing release-governance approval |
| Merge authority | NOT AUTHORIZED | existing release-governance approval |
| Deployment authority | NOT AUTHORIZED | existing release-governance approval |
| Transaction authority | NOT AUTHORIZED | remains outside this runtime and requires human authority |

Current operational runtime state: `HOLD_EXTERNAL_PRODUCTION_EVIDENCE`.
