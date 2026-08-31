# STARTAK Valuation Intelligence v1

## Purpose

Valuation Intelligence v1 introduces a provider-neutral, project-name-independent framework for producing and reconciling valuation indications from explicit evidence.

It is intentionally separated from the existing investment underwriting and recommendation engines.

## Core boundary

The platform must preserve these distinctions:

- appraisal / market value indication
- fair value indication
- market rent indication
- investment value
- seller asking price
- purchase price
- all-in acquisition cost
- exit value
- investment decision

A valuation indication is not automatically an investment recommendation or a verified fact.

## Generic methods in v1

The framework currently includes generic indication engines for:

1. Market comparable approach
2. Direct income capitalization
3. Depreciated replacement cost approach
4. Residual land/development approach
5. Controlled method reconciliation

DCF and operating-business valuation are registered as method paths but require qualified asset-specific adapters before execution.

## Evidence doctrine

Every valuation input should be traceable to an evidence grade and input status. v1 provides the following evidence ladder:

- A — verified official evidence
- B — verified transaction
- C — contractual evidence
- D — actual operating evidence
- E — market observation
- F — third-party appraisal
- G — expert assumption
- H — client-supplied / unverified

Confidence is a property of individual facts and inputs, not of an entire document by default.

## Fail-closed controls

v1 deliberately rejects or holds several unsafe shortcuts:

- no hidden asking-to-executed comparable discount
- no automatic comparable weighting unless equal weighting is explicitly selected
- no direct-capitalization zero OPEX unless tenant-borne treatment is explicit
- no silent method averaging
- no reconciliation across different bases of value
- no reconciliation across different currencies
- no reconciliation across conflicting valuation dates
- no final reconciled value when method dispersion exceeds the configured threshold
- no generic lease-capitalization substitution for an operating-business asset such as a hotel

## Universal project routing

Method planning is driven by the universal project profile:

- asset class
- lifecycle stage
- investment strategy
- income model

Project names and named calibration cases do not participate in routing logic.

The same architecture supports land, residential, office, retail, industrial/logistics, hospitality, healthcare, education, mixed-use, parking, data centers, special-purpose assets, and custom real-estate asset classes. Support for intake/planning does not imply that every asset class already has a qualified executable valuation adapter.

## Calibration evidence

Real-world appraisal materials may inform architecture, terminology, quality controls, and future calibration. Private appraisal documents and their property-specific values are not stored as repository fixtures. Automated regression fixtures must remain synthetic or explicitly approved for publication.

## Current limitations

v1 is an architectural and computational foundation. It is not represented as a certified appraisal service and does not itself establish compliance with IVS, local appraisal regulation, or professional-sign-off requirements.

The following remain separate future work:

- qualified operating-business / hospitality adapter
- industrial/logistics specification adapter
- retail/mall adapter
- full DCF adapter
- automated evidence-quality and assumption-burden scoring
- empirical uncertainty calibration and backtesting
- human review / maker-checker-approver workflow
- integration of qualified valuation outputs into investment underwriting and decision logic

## Production safety

Valuation Intelligence v1 does not modify the legacy/current financial formulas, saved-deal calculations, recommendation criteria, or existing production study-type execution paths. Integration into investment decisions requires a separate qualified gate.
