# External Evidence Request — Professional Valuation & Standards-Scope Review

Issue: #206
Parent tracker: #202
Qualified E2I head: `f910a086039b0cbde93faa063b468bfd0c28a3f9`
Current operating mode: `UNLICENSED_DECISION_SUPPORT`

## Objective

Obtain an independent professional review of STARTAK Real Estate's valuation-analysis scope, terminology, standards routing, professional boundaries and report/output behavior for the intended Saudi use cases.

This review must address the implemented platform, not merely confirm that standards documents exist.

## Reviewer profile

A professionally competent real-estate valuation reviewer with appropriate Saudi professional standing for the scope assessed. Relevant Taqeem accreditation / fellowship / licensing evidence and an independent verification source should be provided where the review relies on such standing.

## Materials to review

- qualified E2I release candidate and relevant source/commit reference;
- valuation and investment-analysis workflows;
- assignment / purpose / intended-use routing;
- basis-of-value handling;
- valuation-date handling;
- property-right identification;
- market evidence and comparable handling;
- HBU workflow;
- cost, income, DCF, land/development and reconciliation outputs where exposed;
- report/export templates and professional claims;
- standards registry / router outputs;
- official-source evidence for IVS, Taqeem, RICS and purpose-specific Saudi requirements;
- Issue #13 and the legal operating-mode review when available.

## Mandatory review questions

1. Is the separation between analytical indication and formal/certified valuation sufficiently clear in product behavior and outputs?
2. Are purpose, intended use, intended users, valuation date, basis of value and property rights identified before any professional-style valuation conclusion is generated?
3. Are IVS/Taqeem requirements routed by actual applicability rather than global default assumptions?
4. Where RICS or other international guidance is used, is Saudi legal/regulatory precedence preserved?
5. Are purpose-specific CMA, SAMA or SOCPA contexts appropriately separated from generic valuation analysis?
6. Are unsupported or unverified standards claims blocked?
7. Are DRAFT/FUTURE/UNDER_REVIEW standards prevented from silently affecting production conclusions?
8. Are valuation approaches and reconciliation methods professionally defensible for the scope exposed?
9. Does HBU analysis require the four tests and sufficient evidence where it materially affects value?
10. Are material assumptions, special assumptions, limitations, uncertainty and evidence gaps appropriately disclosed?
11. Are report labels and user-facing language sufficiently bounded to avoid implying accredited/certified valuation where none exists?
12. Which workflows require a licensed/accredited valuer sign-off before external reliance?
13. What changes are mandatory before any external professional valuation report could be issued in the future?

## Required disposition

One explicit result:

- `ACCEPT_CURRENT_UNLICENSED_SCOPE`
- `ACCEPT_WITH_CONDITIONS`
- `HOLD`
- `NOT_ACCEPTABLE`

Any statement that the platform is formally compliant with a professional standard must be separately justified and scoped; source evidence alone does not establish conformance.

## Evidence requirements

- reviewer identity and organization
- professional credential / license evidence
- credential verification source
- independence / conflict statement
- exact product version / release candidate reviewed
- standards and versions considered
- scope/applicability matrix
- findings and remediation requirements
- explicit disposition
- issue date
- report SHA-256 or controlled evidence reference

## Acceptance rule

#206 may close only when an independent professional review has been accepted and all material pre-launch conditions for the current unlicensed scope have been resolved.

Until then the following remain false:

- `formalStandardsConformanceEstablished`
- `certifiedValuationAuthorityEstablished`
- `externalProfessionalValuationIssuanceAuthorized`