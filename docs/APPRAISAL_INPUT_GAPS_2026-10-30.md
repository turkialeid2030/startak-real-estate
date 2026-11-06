# Appraisal input gaps and property interests

## Problem and behavior

The manual appraisal workbench could check NOI, capitalization arithmetic and circular rent reasoning, but did not expose separate gross built and indoor net leasable areas, improvement ownership, cost totals, or per-input source review. A transcribed numeric value could therefore look equally complete whether its basis was unknown, assumed, conflicting or manually reviewed.

This change extends the existing appraisal audit and UI. It does not create another valuation model. It starts from PR #766 head `fa92a89c0cc093fb46321af6b24b2f5ae5c05b18` and is a separate stacked change.

## Implemented

- Land, gross built and indoor net leasable areas are entered separately. No building area or land coverage is inferred. Gross built area can exceed land area for multi-floor buildings. A larger indoor net area than gross built area blocks; external leased yards belong outside this indoor definition.
- Explicit ownership/leased-fee/leasehold/usufruct and property-owner/tenant/mixed improvements declarations. A time-limited interest asks for the remaining term. These declarations never establish legal rights.
- An input/source checklist distinguishes missing, invalid, conflicting, assumed, source-review-required and user-reviewed-but-not-independently-verified records. Relevant scope includes areas, rights, improvement ownership, lease term, NOI, owner expenses, cap rate and cost components. A cap rate cannot conceal missing NOI; a reviewed cost total cannot conceal a missing land component.
- Positive improvement cost is not accepted as an additive owner-value substantiation while ownership is unknown, tenant-owned or mixed. Rights-specific review is required. This is an audit blocker, not an automatic estimate of the tenant interest or the reversion.
- Cost land plus depreciated improvements is independently checked against the transcribed total. The income value is kept separate; no averaging, addition or automatic final reconciliation is introduced.
- New blockers propagate through existing restrictive session linkage. Tampering with a link to relabel a blocking audit as review-only cannot remove these blockers.
- New facts/source status/reference changes participate in version differences and invalidate the current link via the existing state-change effect. Document change and explicit reset clear the new fields. Arabic/English labels retain raw amounts, enum values and source references.

The input checklist is a scoped completeness check of the entered appraisal fields. It is not a full title, contract, planning, engineering, legal, market-data or professional-validation review. A manually reviewed source remains unverified; even a complete checklist cannot authorize a market value or certified export.

## Existing capabilities reused

| Requirement | Existing path retained |
| --- | --- |
| Independent rent vs rent derived from capital value | `src/market/appraisal-assurance.js` |
| NOI, vacancy, owner expenses and capitalization arithmetic | Existing audit and `src/valuation-intelligence/income-capitalization.js` |
| Explicit expense-treatment scenarios | Existing direct-capitalization engine, including unverified tenant-borne treatment |
| Cost and depreciation calculations | `src/valuation-intelligence/cost-approach.js` |
| Comparable evidence and adjustment review | `src/market/professional-comparable-review.js` and current market workspace |
| Method differences and no automatic professional authorization | Existing reconciliation and valuation-decision gates |
| Document digest and explicit same-property declaration | Existing local intake and `appraisal-study-binding.js` |
| Linked HOLD export restriction | Existing research sidecar and personal report export guards |

## Validation

- `tests/valuation/appraisal-input-gaps.test.js`: 21 synthetic unit scenarios, including unknown areas, explicit assumed evidence, rights, missing method components, cost arithmetic, source conflicts and forged session links.
- `tests/defects/assurance_workflow_locale_d04.js`: real React/jsdom interaction, including the added fields, conflict correction, ownership and source choices, Arabic/English preservation. Passed locally with 767 checks.
- `tests/e2e/run_appraisal_assurance_ci.mjs`: extended real-Chromium acceptance for separate areas, tenant improvements, source review, language changes and reset. It remains part of the existing Location Market Study Verify workflow. Browser execution must be confirmed by the candidate's CI; no local Chromium is present in the current environment.
- Eight private exploratory acceptance cases were executed against the actual audit and existing valuation engines. No private property name, source document, parcel identity, digest or customer-linked inputs are committed to this repository.
- A production build passed locally. Full release and browser CI are separate evidence and must be checked on the final candidate SHA.

## Remaining boundaries

No actual title or lease has been verified, no Saudi market comparison has been recalibrated from an unrelated-city report, and no third-party report is adopted as a verified transaction. No new document upload, server storage, commercial/professional approval, production deployment, financial-investment authorization or automatic final-value export is introduced. `NOT_AUTHORIZED` and the existing release posture remain unchanged.
