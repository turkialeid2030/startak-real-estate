# STARTAK Real Estate — User-entered Zakat Layer (Wave B2)

STATUS: ENGINEERING_IMPLEMENTED_ON_FEATURE_BRANCH
VALID_AS_OF: 2026-09-06
SUPERSEDED_BY: none

## Deliberate design boundary

STARTAK Real Estate **does not calculate statutory Zakat**. This is an intentional design boundary, not an omitted formula. A statutory Zakat base is an entity-level quantity and cannot be derived reliably from a single-property underwriting model.

Wave B2 implements only an optional, separate post-NOI layer. The Zakat case is stored as envelope metadata (`zakatCase`), not as an engine economic input. It contains one annual SAR amount allocated to the asset and one mandatory source classification: accountant, Zakat adviser, or internal estimate.

The canonical engine remains pre-Zakat. Zakat is never included in NOI. If no amount is supplied, the platform shows only pre-Zakat cash flow, assumes no zero, and manufactures no after-Zakat result. There is no percentage-to-amount or amount-to-percentage conversion. Every derived output is explicitly labelled **User-entered Zakat, not calculated by the platform**.

The annual entered amount is deducted only from operating-period cash flows. Acquisition/construction-period flows are unchanged. For land development, deduction starts after construction. The terminal-value formula remains unchanged; the terminal operating-year cash flow carries the entered annual amount, but the exit valuation itself is not recomputed from Zakat.

## ZATCA source register supporting the design boundary

Official sources reviewed for the engineering boundary:

- ZATCA — Implementing Regulation for Zakat Collection (1445H), Minister of Finance Decision No. 1007 dated 19/8/1445H. Official regulation page: https://zatca.gov.sa/ar/RulesRegulations/Taxes/Pages/ZakatRegulations.aspx
- Official Arabic regulation PDF: https://www.zatca.gov.sa/ar/RulesRegulations/Taxes/Documents/ZakatRegulation_1445.pdf
- ZATCA announcement dated 22 March 2024: https://zatca.gov.sa/ar/MediaCenter/News/Pages/news-1218.aspx
- ZATCA General Zakat Guideline: https://zatca.gov.sa/ar/HelpCenter/guidelines/Documents/Zakat_General_1445H.pdf

### Verification status of B-1 citations

Verified against currently published ZATCA material during this implementation pass:

- Article 15: the stated Zakat percentage is applied to the **Zakat base**, not NOI.
- Articles 48 and 49: official deduction rules address non-current assets/properties held for use rather than resale.
- Article 73: official real-estate/construction treatment; the current text records an amendment under Minister of Finance Decision No. 1248 dated 11/10/1446H (3 April 2025).
- Decision No. 1007 dated 19/8/1445H: verified on ZATCA's official regulation page and announcement.
- Decision No. 1248 dated 11/10/1446H: verified from the amendment note attached to Article 73 in the current official regulation text.

Not independently re-verified article-by-article in this implementation pass and therefore **not relied upon by code or UI**: Articles 19, 20, 21, 23, 25 and 52. Status: `SPECIALIST_VERIFICATION_REQUIRED` before citation in a formal accounting/legal deliverable.

## Professional-review boundary

This document and software layer are engineering controls, not a Zakat opinion. Asset classification, deductibility, entity Zakat base, allocation of an entity-level Zakat charge to an asset, and the appropriateness of the entered amount require review by a qualified Saudi accountant/Zakat adviser where professional reliance is intended.
