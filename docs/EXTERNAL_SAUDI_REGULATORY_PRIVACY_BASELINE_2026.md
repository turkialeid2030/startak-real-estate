# External Readiness B — Saudi Regulatory & PDPL Source Baseline — 2026-09-08

## Purpose

Record a dated official-source baseline for Saudi professional valuation regulation and Saudi Personal Data Protection Law controls that materially affect STARTAK Real Estate.

This phase reduces two external blockers but **does not close them**:

- `SAUDI_PROFESSIONAL_LICENSING_AND_LEGAL_REVIEW`
- `PDPL_AND_DATA_GOVERNANCE_EXTERNAL_REVIEW`

The purpose is to provide a controlled source-to-control map for external counsel, privacy review and professional review. It is not legal advice and does not establish PDPL compliance or professional licensing.

## PDPL baseline

Official SDAIA/NDMO sources confirm that the Personal Data Protection Law came into force on 14 September 2023, with the original one-year corrective period targeting compliance by 14 September 2024. The implementing regulation comes into force from the date of the Law's enforcement.

The source baseline captures requirements relevant to the platform architecture, including:

- right-to-be-informed information at collection, including purpose/legal basis and retention information
- processor/subprocessor guarantees and contractual requirements
- documented impact-assessment triggers for specified higher-risk processing
- notification to the Competent Authority within no more than 72 hours for qualifying personal-data breaches
- DPO appointment conditions
- written records of processing activities maintained during processing and up to five years after the activity ends
- cross-border transfer safeguards and transfer-risk assessment requirements

These requirements are represented as **control implications requiring implementation and evidence**. The source baseline does not assert that the current application, cloud services, contracts or operational procedures already comply.

## TAQEEM professional-regulatory baseline

Current TAQEEM official sources confirm the availability of:

- Implementing Regulation of the Accredited Valuers Law
- Code of Conduct and Ethics of the Valuation Profession
- Rules Regulating Real Estate Valuation Services for Financing Entities
- current real-estate valuation-sector professional obligations
- the professional-practice library entry for the approved minimum-report-requirements template

The current real-estate sector page also states obligations relating to licensed practice, report signing, Arabic reporting, complete valuation work files and adherence to professional/technical rules.

For financing-purpose work, TAQEEM's official rules identify financing entities as commercial banks and finance companies supervised by the Saudi Central Bank and identify Qaym as the unified platform supervised by TAQEEM. This does not authorize STARTAK to perform regulated financing valuations or integrate with Qaym without separate legal, professional and operational authorization.

## Platform control implications

The baseline preserves and strengthens the following architectural boundaries:

- credential/licence validation remains an external gate
- no AI/system identity may sign as an accredited valuer
- conflict, independence, competence and confidentiality evidence remain mandatory professional controls
- complete work-file/evidence-chain retention is required for professional valuation workflows
- report-language/signature and external issuance require authorized professional review
- financing purpose remains a separate routed context, including Qaym/SAMA review
- privacy notices, lawful basis, data inventory, processor register, DPIA triggers, breach workflow, ROPA and cross-border transfer controls require production evidence

## Blocker disposition

`SAUDI_PROFESSIONAL_LICENSING_AND_LEGAL_REVIEW`:

`PARTIALLY_RESOLVED_OFFICIAL_REGULATORY_SOURCES_VERIFIED`

`PDPL_AND_DATA_GOVERNANCE_EXTERNAL_REVIEW`:

`PARTIALLY_RESOLVED_PDPL_SOURCE_AND_CONTROL_BASELINE_VERIFIED`

Both remain **open**.

## External work still required

Saudi counsel/professional reviewers must determine provision-level applicability to STARTAK's exact operating model, user roles, outputs, licensing model and commercial launch. A privacy officer or qualified counsel must validate the real data inventory, Controller/Processor roles, notices, lawful bases, retention, rights workflows, DPIA applicability, security/breach processes, cloud subprocessors and any transfers outside the Kingdom.

The TAQEEM approved minimum-report template also still requires section-level retrieval and mapping before a formal Taqeem report-conformance claim can be considered.

## Authority boundary

This phase explicitly preserves:

- `legalApplicabilityReviewComplete=false`
- `pdplComplianceEstablished=false`
- `saudiProfessionalLicensingEstablished=false`
- `productionControlImplementationVerified=false`
- `externalLegalOpinionEstablished=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`

No source record or control implication from this phase may by itself authorize regulated valuation, external report issuance, release, merge, deployment or a transaction.
