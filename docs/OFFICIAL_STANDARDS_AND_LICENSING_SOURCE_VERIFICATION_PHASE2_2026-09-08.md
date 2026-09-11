# STARTAK Real Estate — Official Standards & Licensing Source Verification — Phase 2

Date: 2026-09-08

## Purpose

This phase continues the external-source qualification track after the internally qualified IVS/RICS/Taqeem source package and Saudi regulatory source phase 1.

It verifies additional primary-source families for measurement, cost management, comparative appraisal references and Saudi professional licensing/qualification context.

This is still an **evidence-only** increment. It does not activate standards, establish professional licensing, issue a legal opinion, certify valuation authority, authorize external report issuance, merge or deployment.

Operating mode remains `UNLICENSED_DECISION_SUPPORT`.

## Taqeem-hosted IVS 2025 canonical text

A direct Taqeem-hosted attachment at `portal.library/131` identifies the document as `معايير التقييم الدولية` and identifies the standards as effective 31 January 2025.

This resolves the earlier ambiguity about identifying the actual Taqeem-hosted 2025-effective IVS text. The visible digital-library catalog label still says `معايير التقييم الدولية 2022`, so the catalog metadata discrepancy remains a source-quality defect, but it no longer prevents identification of the direct 2025-effective hosted text.

No IVS rule is activated solely because this canonical text has been identified.

## IPMS

The International Property Measurement Standards Coalition identifies `IPMS All Buildings` as the current global open-source measurement standard for consistent building measurement.

RICS independently hosts `International Property Measurement Standards: All Buildings` and identifies its publication date as 12 January 2023.

STARTAK must use IPMS only when the assignment requires that measurement convention. It must not silently override Saudi title, cadastral, planning, municipal or assignment-specific measurement definitions.

## ICMS

The International Cost Management Standard Coalition identifies `ICMS 3` as the current framework for classifying, measuring, recording, analysing and presenting construction life-cycle costs and carbon emissions.

RICS corroborates ICMS 3 and identifies the downloadable third-edition publication date as 1 June 2022.

ICMS is a cost/carbon classification and reporting framework. It is not a valuation conclusion and must not replace local project cost evidence, quantity-surveying judgment, tender evidence, contract data or professional cost review.

## Appraisal Institute

The Appraisal Institute's current Standards of Professional Practice allow the Standards of Valuation Practice (SVP) plus the Certification Standard, or applicable national/international standards plus the Certification Standard.

The current SVP page identifies an effective date of 12 November 2021.

These materials remain comparative/professional references for STARTAK. They are not Saudi mandatory standards by default and must never be globally activated merely because they are authoritative in another professional jurisdiction or membership context.

## Saudi professional licensing and qualification

Taqeem's current service guide for issuing a professional valuation license identifies prerequisites including active basic membership, registration in the professional register, supporting documents/forms and payment of the license fee.

Taqeem also updated its fellowship policy in August 2026, including practical-experience requirements, documentation/approval mechanisms and branch-specific discussion requirements. Members obtaining relevant membership on or after 29 June 2026 are subject to the updated policy according to the official announcement.

Therefore any future STARTAK credential-validation layer must be version- and effective-date-aware. Static pre-2026 credential assumptions are not acceptable.

## Taqeem rules library

The current official Taqeem rules library lists, among other materials:

- Executive Regulation of the Accredited Valuers Law
- Professional Conduct and Ethics Rules
- Rules governing real-estate valuation services for financing entities
- Professional certificate rules

These documents must be extracted and tested at rule level before any production standards or professional-compliance claim is activated.

## Governance consequence

The following remain false:

- `officialSourceVerificationBlockerClosed`
- `standardsActivationAuthorized`
- `professionalLicensingEstablished`
- `formalStandardsConformanceEstablished`
- `certifiedValuationAuthorityEstablished`
- `externalIssuanceAuthorized`
- `mergeAuthorized`
- `deploymentAuthorized`
- `transactionAuthorized`

## Remaining external qualification work

1. Rule-level extraction and professional/legal applicability review for the current Taqeem executive/professional rules relevant to STARTAK workflows.
2. Actual credential verification for valuers/reviewers, including membership class, valuation branch, license status, fellowship status and effective dates.
3. Assignment-specific routing for IPMS, ICMS and comparative Appraisal Institute references.
4. PDPL control mapping and external/legal review.
5. Transaction-specific RETT rules/exemptions and purpose-specific CMA/SAMA/SOCPA routing.
6. Independent production security and penetration-test validation.
7. Independent production performance/resilience validation.
8. External canonical-source hash comparison using an independently supplied canonical original.
9. Human release-authority approval before any merge/deployment decision.
