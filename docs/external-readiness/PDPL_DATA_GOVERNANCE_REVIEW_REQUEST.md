# External Evidence Request — PDPL & Data-Governance Review

Issue: #205
Parent tracker: #202
Qualified E2I head: `f910a086039b0cbde93faa063b468bfd0c28a3f9`

## Objective

Obtain an independent production-oriented review of STARTAK Real Estate's actual personal-data processing and data-governance controls under the Saudi Personal Data Protection Law (PDPL) and applicable executive regulations / governance requirements.

Official-source verification is not sufficient. The review must examine real system/data flows and the configuration intended for production.

## Reviewer profile

Independent privacy / data-governance professional or firm with relevant Saudi PDPL experience. Where professional certification or authority is claimed, a verification source must be supplied.

## Required review inputs

- system architecture and data-flow diagrams;
- data inventory / classification register;
- user and tenant model;
- database/storage model;
- authentication and authorization model;
- logging/monitoring model;
- retention/deletion behavior;
- subprocessors and hosting providers;
- backup/recovery design;
- privacy notice / terms / consent flows where applicable;
- data-subject request procedures;
- incident/breach handling procedures;
- cross-border transfer architecture and locations;
- exact release candidate / commit / environment configuration reviewed.

## Minimum control matrix

The reviewer must assess at least:

1. Personal-data inventory and classification.
2. Controller / processor / joint-controller role characterization.
3. Purpose definition and purpose limitation.
4. Lawful basis and consent mechanics where applicable.
5. Data minimization.
6. Accuracy / correction processes.
7. Retention schedule and deletion implementation.
8. Data-subject rights intake, authentication, response and evidence.
9. Role-based access and least privilege.
10. Tenant isolation and authorization boundaries.
11. Encryption in transit and at rest where applicable.
12. Secrets / credentials handling.
13. Logging, auditability and personal-data exposure in logs.
14. Backup copies and deletion/retention interaction.
15. Processor/subprocessor contracts and governance.
16. Cross-border transfer conditions and safeguards where applicable.
17. Privacy notice / transparency requirements.
18. Security incident and personal-data breach workflow.
19. Change management affecting personal data.
20. Evidence that production configuration matches the reviewed design.

## Finding severity

Use a clear severity scheme such as:

- Critical
- High
- Medium
- Low
- Observation

For each finding provide control reference, evidence, impact, remediation and retest requirement.

## Required disposition

One explicit overall result:

- `PASS`
- `PASS_WITH_CONDITIONS`
- `FAIL`
- `INCONCLUSIVE`

## Evidence requirements

- reviewer / organization identity
- role and credential evidence where applicable
- independence statement
- exact release candidate/environment reviewed
- review dates
- data-flow / control-matrix controlled references
- findings register
- remediation register
- retest results for material findings
- final conclusion
- report SHA-256 or controlled evidence reference
- sign-off date

## Acceptance rule

#205 cannot close while there is an unresolved material PDPL/data-governance blocker.

Any unresolved cross-border transfer issue, unclear lawful basis for material processing, material tenant-isolation weakness, or unremediated Critical/High control failure keeps production readiness on HOLD.

`pdplComplianceEstablished` remains false until accepted independent evidence exists.