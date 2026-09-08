# External Evidence Request — Saudi Legal Operating-Mode & Licensing Review

Issue: #204
Parent tracker: #202
Related product boundary: #13
Qualified E2I head: `f910a086039b0cbde93faa063b468bfd0c28a3f9`
Current product mode: `UNLICENSED_DECISION_SUPPORT`

## Objective

Obtain an independent Saudi legal/regulatory review of STARTAK Real Estate as actually implemented and intended to be commercialized.

This is not a source-law summary. The reviewer must assess product behavior, customer journey, output wording, commercial model, contracts/terms, report/export behavior and intended use cases against the relevant Saudi regulatory perimeter.

## Reviewer profile

Preferred reviewer:

- Saudi-qualified lawyer / law firm with demonstrable experience in real-estate regulation, digital products and regulated services; and
- ability to address REGA / Taqeem boundaries and identify when CMA, SAMA or other sector-specific regulation becomes relevant.

Reviewer identity, firm, authority basis and professional/license verification source must be recorded.

## Materials to review

At minimum:

- PR #201 and qualified head reference;
- live/staging product screens for all material workflows;
- representative reports and exports;
- API-facing output labels where applicable;
- user terms, privacy notice and disclaimers;
- intended pricing/revenue model;
- intended customer types and use cases;
- Issue #13 compliance guardrails;
- official-source evidence already recorded for REGA, Taqeem, CMA, SAMA and related Saudi authorities;
- any workflow involving property marketing, matching, negotiation, brokerage, formal valuation, advisory recommendation, legal interpretation or transaction facilitation.

## Mandatory legal questions

The written review must address:

1. Whether `UNLICENSED_DECISION_SUPPORT` is a legally supportable operating characterization for the intended launch model as actually implemented.
2. Which implemented or proposed workflows could fall within regulated real-estate brokerage, consultancy, analysis or other real-estate service categories.
3. Whether any REGA licensing trigger is present for the intended external commercial use.
4. Which activities require Taqeem-accredited / licensed valuer involvement.
5. Whether any current outputs or terminology risk being characterized as formal valuation, licensed consultancy, brokerage, regulated advice or another licensed service.
6. Whether customer-facing recommendation language is appropriately bounded.
7. Whether report/export use by third parties creates a different regulatory characterization than internal analytical use.
8. Whether any intended institutional use case triggers purpose-specific CMA or SAMA requirements.
9. Whether transaction facilitation, matching, negotiation, marketing, commissions or contract execution would cross a regulated boundary.
10. Whether the product's disclaimers are adequate as secondary controls while recognizing that disclaimers cannot cure an activity that itself requires licensing.
11. Required escalation points to a licensed lawyer, valuer, broker, adviser or other professional.
12. Any mandatory changes to product scope, terms, UI wording, reports, user eligibility, customer segmentation or commercialization model before launch.

## Required disposition

Reviewer must provide one explicit disposition:

- `ACCEPT_CURRENT_MODE`
- `ACCEPT_WITH_CONDITIONS`
- `HOLD`
- `NOT_ACCEPTABLE`

If conditional, every material condition must be separately listed and classed as:

- pre-launch mandatory;
- post-launch controlled remediation; or
- informational / future-scope constraint.

## Evidence requirements

- reviewer and firm identity
- professional/license verification reference
- conflict / independence statement
- review scope
- exact product version / commit reviewed
- dates of review
- legal sources relied on
- explicit disposition
- conditions / exclusions / unresolved questions
- controlled legal memorandum reference
- memorandum SHA-256 or controlled evidence artifact hash
- reviewer sign-off date

## Acceptance rule

#204 may close only when an independent Saudi legal review has been received and accepted, and all material pre-launch conditions have been remediated or otherwise resolved by competent authority.

A product disclaimer, internal legal analysis or CI test cannot close this workstream.