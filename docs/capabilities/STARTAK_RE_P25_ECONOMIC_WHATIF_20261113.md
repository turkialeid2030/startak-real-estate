# STARTAK Real Estate — P25 Financial What-If, isolated analytical path
**13 November 2026** — Real Estate repository ONLY.

## Scope
Historical P25 provenance validation was already recovered, but the current production-facing `calculateInvestmentCase` intentionally **rejects** requested `assumptionRegistry` economic overrides and returns a baseline-only HOLD. This remains unchanged.

This change implements a **separate, expressly analytical sensitivity function**:
`evaluateP25FinancialWhatIf({studyType, inputs, leverageEnabled, assumptionModelVersion:'V2', assumptionRegistry, asOf})`.

It compares the canonical V2 existing-building pipeline twice, using the same real engine (initial rent, NOI, exit, lease rollover, financing and discount) with:
1. existing V2 baseline assumptions, and
2. numeric P25 changes from a structurally complete source/approver/date/expiry evidence registry.

The second calculation uses an **unexported private in-process token** to reach an explicit research context. Normal `calculateInvestmentCase` public/serialized requests **still reject overrides** and cannot obtain that token. Standard V2 numerical assumptions are unchanged, and raw user override fields still cannot silently replace V2 defaults.

## Result and authority boundary
- Returns only bounded financial indicators (NOI, NPV, IRR, associated financing metrics and cashflow arrays) for baseline, scenario and calculated deltas.
- Does **not** return `verdict`, `decisionStatus`, a financial approval, a certified value or a purchase/sale authority.
- **Always** sets `independentApprovalVerified:false`, `professionalValuationAuthorized:false`, `financialDecisionAuthorized:false`, `transactionAuthorized:false` and `productionOverrideActivated:false`, even if the submitted registry says `APPROVED`.
- Rejects unknown/malformed, untyped, expired, future approval, duplicate, and out-of-range records. These do not return financial simulations.
- `status:'ANALYTICAL_HOLD_FOR_INDEPENDENT_APPROVAL'` is NOT `GO`. A registry's structurally complete source/approval strings are **caller statements**, not independently authenticated signatures, committee minutes, tenant rights or legal consents.
- No new UI, provider, external API, real client data, reporting authority, or production deployment.

## Qualification
Dedicated synthetic unlevered and levered reference cases `RE-GOLD-002-U/L` are re-run with a higher management fee (baseline 3.5%, scenario 8%) to verify the expected lower NOI/NPV/IRR and nonzero cashflow deltas. Original canonical V2 and P27 financial tests must remain unchanged, including fail-closed normal registry overrides. The test also rejects fake internal tokens, source evidence gaps, duplicates and invalid economics.

**Still OPEN:** auditable server-authenticated reviewer workflow and approved assumption registry, signed external source/authentication, production use of economically modified inputs, owner UI with save/reload and financial what-if reconciliation, independently validated 17 owner properties, true completed-sale/lease source rights, Q01–Q12 security/legal/professional signoff.

`P25_CALCULATION_WHAT_IF=READY_FOR_EXACT_SHA_CI`; `P25_AUTHORIZED_PRODUCTION_OVERRIDE=FALSE`; `MAIN_UNCHANGED`; `COMMERCIAL_GO_LIVE=HOLD_NOT_AUTHORIZED`.
