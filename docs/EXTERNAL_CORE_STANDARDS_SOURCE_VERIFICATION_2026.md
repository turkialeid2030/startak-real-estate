# External Readiness — Core Standards Source Verification — 2026-09-08

## Purpose

Reduce the final engineering release candidate blocker `OFFICIAL_STANDARDS_SOURCE_VERIFICATION` by recording a dated official-source baseline for the core valuation and Saudi regulatory references that materially affect STARTAK Real Estate.

This is **source verification**, not legal applicability approval, professional adoption approval, standards activation, or a claim of formal conformance.

## Verified core sources

### International Valuation Standards (IVS)
Official IVSC source: `https://ivsc.org/new-edition-of-the-international-valuation-standards-ivs-published/`

Verified source facts:
- latest edition published 31 January 2024
- effective 31 January 2025 for valuations performed on or after that date
- early adoption permitted from publication
- IVS compliance requires the applicable General Standards, appendices and Asset Standards

TAQEEM official Arabic source: `https://www.taqeem.gov.sa/web/content/portal.library/131/attachment_ar?download=false`

TAQEEM's official digital library provides the current Arabic IVS source and the document identifies 31 January 2025 as the effective date. This verifies official Saudi source availability; it does not by itself determine the complete legal/professional applicability route for every assignment.

### RICS Valuation — Global Standards (Red Book) 2025
Official RICS source: `https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/red-book/red-book-global`

Verified source facts:
- current edition is the 2025 Red Book Global Standards
- effective 31 January 2025
- aligned to IVS effective 31 January 2025
- national legal requirements take precedence where they conflict with RICS requirements

TAQEEM's official digital library also lists an Arabic source for the RICS Global Valuation Standards 2025. Library availability is not treated as proof that every RICS requirement is mandatory for every Saudi assignment.

### RICS ESG and sustainability in commercial property valuation — 4th edition
Official RICS source: `https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/esg-and-sustainability-in-commercial-property-valuation`

Verified source facts:
- published 28 January 2026
- effective 30 April 2026
- distinguishes property valuation from strategic ESG risk advice

The engineering rule remains unchanged: ESG evidence does not automatically create a value adjustment.

### RICS Comparable evidence in real estate valuation
Official current-edition source: `https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/valuation-standards/comparable-evidence-in-real-estate-valuation`

Verified source facts:
- the 1st edition remains the current edition as of 8 September 2026
- it was reissued in April 2023 as a professional standard, with regulatory requirements unchanged
- RICS explicitly says members and regulated firms should continue to use the 1st edition until the final 2nd edition is published

Consultation source for the proposed 2nd edition: `https://consultations.rics.org/comparableevidence2ndedition/consultationHome`

Verified status:
- consultation opened 8 July 2026
- consultation closes 18 September 2026
- the 2nd edition is still a **draft consultation** on the verification date

Therefore the draft remains non-enforcing and cannot affect production under the existing Standards Registry lifecycle.

### Saudi Authority for Accredited Valuers — Accredited Valuers Law
Official TAQEEM rules source: `https://www.taqeem.gov.sa/rules`

Official law document: `https://taqeem.gov.sa/web/content/portal.rules/8/attachment_ar?download=false`

Verified source facts:
- TAQEEM's official rules portal lists the Accredited Valuers Law
- the official document identifies Royal Decree M/43 dated 7/9/1433H and amendments

Provision-level legal applicability and current implementing-regulation mapping remain a separate legal/professional review task.

### REGA — Regulations of Real Estate Consultation & Analysis Services
Official REGA source: `https://rega.gov.sa/en/laws-and-decisions/regulations-and-by-laws/regulations/regulations-of-real-estate-consultation-analysis-services/`

Verified source facts:
- REGA marks the regulation **Active**
- Article 4 requires an accredited valuer license where services involve real estate valuation
- the regulation requires consultation information to be accurate and not misleading or inconsistent with official/licensed data

This supports the existing product boundary between decision-support analytics and regulated professional valuation. Detailed platform legal scope remains subject to Saudi legal review.

## Blocker disposition

`OFFICIAL_STANDARDS_SOURCE_VERIFICATION` is now:

`PARTIALLY_RESOLVED_CORE_VALUATION_SOURCES_VERIFIED`

It remains **open** because the release candidate still requires provision-level verification and applicability mapping for TAQEEM implementing rules, current final TAQEEM real-estate guidance, and purpose-specific ZATCA / PDPL / CMA / SAMA / SOCPA-IFRS sources when those routers apply.

## Production boundary

This verification batch deliberately preserves:

- `officialStandardsSourceVerificationComplete=false`
- `productionStandardsActivationAuthorized=false`
- `formalStandardsConformanceEstablished=false`
- `professionalReviewRequired=true`
- `legalApplicabilityReviewRequired=true`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`

No standard record should be promoted to `ACTIVE` solely because its official web source has been verified.
