# C59 — Componentized Physical, Functional and External Cost Obsolescence

## Reassessment of existing code
Wave 11A already supports five professional depreciation categories (physical curable/incurable, functional curable/incurable and external obsolescence), an explicitly reviewed land value, quantified replacement/reproduction costs and immutable SHA-256 inputs. The missing element was **cause and component attribution**, not the taxonomy itself. The new C59 stage reuses the existing canonical model exactly; no arithmetic fixture or older field semantics are modified.

## New bounded acceptance gate
`src/cost/depreciation-attribution-gate.js` binds the governed Wave 11A cost packet and its canonical calculator result to independent loss-cause allocations.
- Every existing canonical aggregate depreciation record must reconcile within one cent to separately quantified, reviewed allocations by cost-component ID.
- A physical/functional loss must disclose why the defect is curable or incurable; external obsolescence must cite a market-impact assessment.
- A duplicated cause cannot be deducted under different types or twice against the same component.
- The combined physical + functional + external reduction of an individual component cannot exceed its new replacement cost; land value remains separately evidenced and is never depreciated.
- All five loss categories must be explicitly considered. Omitted types require reviewed not-applicable evidence; absence is not silently treated as zero.
- Optional effective-age / economic-life review is **diagnostic only** and cannot create another automatic depreciation deduction.
- The output is reconciled to the old Wave 11A value indication with an immutable SHA-256 and preserves the existing financial outcome if the cause allocations match.

## Boundary
The result can at most become `READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW`. Supplier cost quotes, engineers' inspections, loss-cause attribution and market obsolescence remain self-declared until independently authenticated. Neither unit-test PASS nor a plausible age-life ratio is an accredited appraisal, professional signoff or production authority.

## Acceptance before complete closure
1. Professional engineer/valuer to review physical age and remaining life, fit-out and MEP condition, curability and economic/market losses with independent documents.
2. Each asset's UI, save/reload, audit and Arabic report must preserve linked deficiencies, relative cause and allocation; check C57 and G13.
3. No automatic transfer of land value/physical impairment between asset types; hotel and industrial specialism remains under C61.
4. Cross-method reconciliation to income/market indications and signed reviewer acceptance before any valuation conclusion.
5. Source provider rights and exact-head release/security tests must pass.
