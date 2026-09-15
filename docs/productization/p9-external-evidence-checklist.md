# P9 External Qualification Evidence Checklist

P9 is an evidence-composition gate, not a production certification mechanism. The following controls remain external qualification requirements and must be evidenced by the responsible human/technical authority before release governance can approve production use.

| Control | P9 code status | External evidence required |
|---|---|---|
| Production identity provider | NOT VALIDATED BY P9 | deployed IdP configuration; issuer/audience/JWKS verification; session/revocation/MFA evidence |
| Production persistence | NOT VALIDATED BY P9 | live database connectivity; approved configuration; migration/deployment evidence |
| PostgreSQL RLS / tenant isolation | NOT VALIDATED BY P9 | deployed RLS policies; cross-tenant and IDOR/BOLA runtime tests |
| Durable security/audit trail | NOT VALIDATED BY P9 | append-only or equivalent durable audit persistence; retention/access controls |
| Backup / restore | NOT VALIDATED BY P9 | backup evidence plus successful restore exercise |
| Disaster recovery | NOT VALIDATED BY P9 | approved RTO/RPO plus DR exercise evidence |
| Performance / resilience | NOT VALIDATED BY P9 | independently reviewed load, SLO, failure-mode and resilience evidence for target environment |
| Monitoring / alerting | NOT VALIDATED BY P9 | production telemetry, alert routing, escalation and ownership evidence |
| Secrets lifecycle | NOT VALIDATED BY P9 | approved production secret store, access controls and rotation evidence |
| Penetration testing | NOT VALIDATED BY P9 | independent scoped pentest plus remediation/acceptance of findings |
| PDPL / legal review | NOT ESTABLISHED BY P9 | applicable legal/privacy review and formal approval by authorized humans |
| Taqeem / IVS / RICS / professional scope | NOT ESTABLISHED BY P9 | applicable professional and regulatory review/credentials/approval |
| Reviewer credentials / independence | NOT EXTERNALLY VERIFIED BY P9 | independent verification of reviewer credentials, organization and conflicts |
| Human release authority | REQUIRED | explicit approval through the existing release-governance process |
| Merge authority | NOT AUTHORIZED | explicit existing-governance approval |
| Deployment / go-live authority | NOT AUTHORIZED | explicit existing-governance and operational approval |
| Transaction authority | NOT AUTHORIZED | remains outside software qualification and requires human authority |

A P9 READY result means only `READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW`.
