# Financial Integrity P0 — 2026-09-25

## Purpose

This wave converts the financial model from loosely coupled calculations into governed, auditable primitives. It does **not** activate professional valuation authority, transaction authority, lender approval, tax/legal advice, or commercial Go-Live.

## P0 controls introduced

1. **Evidence-backed Assumption Registry**
   - Every critical assumption must carry a source type, source reference, source date, owner, and freshness window where applicable.
   - Critical assumptions that are unsupported or stale force `HOLD`.
   - Overrides require an explicit reason and remain visible in the audit result.

2. **Canonical Formula Registry**
   - Separates operating, valuation, development, financing, returns, and risk semantics.
   - Explicitly records that `Market Cap Rate != Yield on Cost`.
   - Explicitly records that a DSCR covenant is lender/deal specific; no universal 1.25x Saudi threshold is embedded.

3. **Normalized NOI Waterfall**
   - `GPI = Potential Base Rent + Other Potential Income`
   - `EGI = GPI - Vacancy - Collection Loss - Concessions + Other Operating Income + Service Charge Recoveries`
   - `NOI = EGI - Recoverable OPEX - Non-Recoverable OPEX - Other OPEX`
   - Debt service, depreciation, investor financing and income tax remain outside property NOI.
   - Service-charge recoveries are paired with recoverable operating expenses so reimbursement is not silently treated as profit.

4. **Date-aware return functions**
   - Adds deterministic `XNPV` and `XIRR` primitives for irregular dated real-estate cash flows.
   - Existing periodic NPV/IRR functions remain unchanged for compatibility.

5. **Fail-closed model-risk warnings**
   - Zero economic vacancy/credit loss requires evidence.
   - Zero OPEX requires evidence.
   - Service-charge recovery without matched recoverable OPEX is surfaced as a model-risk warning.

## Regression coverage

`tests/defects/financial_integrity_p0.js` is automatically discovered by the existing `tools/release-verify.js` defect-test scan. It covers:

- NOI reconciliation from GPI through EGI to NOI.
- Direct-capitalization arithmetic.
- Service-charge recovery/OPEX matching.
- Market Cap Rate versus Yield on Cost separation.
- DSCR, LTV, LTC, Debt Yield and break-even occupancy primitives.
- XNPV/XIRR for dated cash flows.
- Critical assumption fail-closed behavior for unsupported and stale evidence.
- Visibility of zero-vacancy and zero-OPEX warnings.

## Decision boundaries

P0 is an engineering integrity layer. The following remain false unless separately established by the governed workflow:

- `finalValuationConclusionEstablished`
- `certifiedValuationEstablished`
- `lenderApprovalEstablished`
- `creditDecisionMade`
- `transactionAuthorized`
- `commercialGoLiveAuthorized`

## Next implementation sequence

1. Wire Assumption Registry into the canonical deal input packet and Saved Deals metadata.
2. Reconcile rent roll -> normalized NOI -> DCF/direct-cap outputs.
3. Add explicit Entry Cap / Exit Cap provenance and variance control.
4. Add Tax Module boundaries for RETT/VAT treatment without contaminating NOI semantics.
5. Promote uploaded independent valuation cases into a governed Golden Validation Corpus with tolerance bands and variance explanations rather than blind value matching.
6. Add combined downside and Monte Carlo only after deterministic financial semantics remain stable under regression.
