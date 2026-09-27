# Startak Real Estate — Formal Remediation Register

**Source review:** `تقرير_فحص_ستارتاك_العقارية.docx` dated 2026-09-27  
**Register date:** 2026-09-27  
**Current baseline at register creation:** `main` = `620a6dd2afd18d529120765a32a062469e3f81d2`  
**Commercial posture:** `HOLD`  
**Transaction authority:** not authorized  
**Professional valuation authority:** not authorized by this register

## Classification vocabulary

- `PASS`: independently tested scope passed.
- `DEFECT`: behavior contradicts the intended or disclosed model contract.
- `COVERAGE_GAP`: model does not yet represent the required economic/operational dimension.
- `EVIDENCE_GAP`: arithmetic may be valid but source evidence is insufficient for an investment conclusion.
- `REGULATORY_EVIDENCE_REQUIRED`: legal/tax treatment must be supported by current official evidence and applicable facts.
- `CLOSED`: remediation merged and exact-head verification passed for the stated scope.
- `CONFIRMED_OPEN`: reproduced or confirmed in current source but not yet remediated.
- `EXTERNAL_GATE`: requires human/professional/operational evidence outside code.

## Findings register

| ID | Finding | Classification | Severity | Status | Evidence / current conclusion | Acceptance criterion |
|---|---|---|---|---|---|---|
| F-001 | “Maximum justified purchase price” implied broader decision sufficiency than its formula actually solved | DEFECT | P0 | CLOSED — PR #442 | Numeric formula is yield/payback based; `PRICE_BASIS_V1` now discloses excluded NPV/IRR/value/DSCR gates and decision-critical labels are narrowed | Metric cannot be interpreted as satisfying all hard gates; regression locks metadata and AR/EN labels |
| F-002 | Financing percentage is applied to total acquisition cost while UI wording can be read as price/value based | DEFECT / semantic governance | P0 | CONFIRMED_OPEN | Current building Wave-B sizing uses `costBase: totalPurchaseCost`; this is economically an acquisition-cost basis, not automatically LTP or independent LTV | Separate and label LTP/LTC/LTV; show requested, constrained and actual debt with denominator and binding constraint |
| F-003 | Invalid material exit-cap input can leave prior valid decision outputs visible | DEFECT | P0 | CONFIRMED_OPEN — black-box evidence; code cause not yet pinned | Report reproduced zero exit cap after a valid value with stale prior outputs remaining visible | Any material invalid input makes affected outputs `INVALID/INCOMPLETE`, visually quarantines or clears them, and prevents save/export/decision as current results |
| F-004 | Riyadh rent-regulation wording can permit an unsupported rent-growth interpretation | REGULATORY_EVIDENCE_REQUIRED / DEFECT | P0 | CONFIRMED_OPEN | Report showed material NPV impact from growth assumptions; regulation must be applied by location, dates, lease history and documented exception | Dated regulatory applicability engine; official source/version; fail-closed growth when applicability is unresolved; legal sign-off before executable use |
| F-005 | Leverage enabled with zero effective debt still adds equity risk spread / financing gates | DEFECT | P0 | CONFIRMED_OPEN | Current Wave A/Wave B logic keys financing treatment to the toggle; Wave B adds `equityRiskSpread` even when requested LTV can be zero | Financing spread and debt-only gates apply only when effective debt is positive; zero-debt case is economically identical to unlevered case apart from transparent request metadata |
| F-006 | Lease expiry/renewal does not drive contractual cash-flow roll-forward in the tested path | COVERAGE_GAP | P1 | OPEN | Report changed lease term without changing cash flows | Dated rent roll with expiry, renewal probability, downtime, market reset, incentives, brokerage and tenant-improvement treatment |
| F-007 | Replacement-cost-plus-land indicator can be interpreted as current market/appraised value | DEFECT / COVERAGE_GAP | P1 | OPEN | Building age did not alter the displayed replacement-based value in the reviewed path | Rename as replacement-cost indicator before obsolescence or implement documented physical/functional/economic obsolescence and valuation methodology |
| F-008 | Service income materially affects value but collectability/cost recovery is not evidenced | EVIDENCE_GAP | P1 | EXTERNAL_GATE | Removing service income in the report changed investment economics materially | Contractual entitlement, billing basis, collection history and matching recoverable costs evidenced per deal; unresolved amount remains conditional |
| F-009 | Entry/exit transfer-fee fields can be mistaken for complete Saudi RETT economics | REGULATORY_EVIDENCE_REQUIRED | P1 | OPEN | Generic rate fields exist, but statutory taxpayer, exemptions, taxable base, timing and contractual economic burden are not fully mapped | Current ZATCA/official evidence + deal facts; separate statutory liability from contractual economics and other selling/closing costs |
| F-010 | Terminal value is a large share of present inflows; sensitivity/provenance needs stronger governance | EVIDENCE_GAP / model risk | P1 | OPEN | Report estimated roughly two-thirds of reference inflow PV from terminal sale; current engines use forward NOI / exit cap | Mandatory exit-cap sensitivity, forward-NOI provenance, terminal-value concentration disclosure and selling-cost decomposition |
| F-011 | Some warnings/cell references/placeholders are not decision-readable in Arabic | DEFECT / UX governance | P2 | OPEN | Report observed unclear untranslated/placeholder-like evidence and error labels | No opaque placeholder in decision path; Arabic explanation, numeric value, evidence/cell reference and stable error code shown together |
| F-012 | Versioned locked assumptions can override imported/deal-specific economics without sufficient user-level governance | COVERAGE_GAP / assumption governance | P1 | OPEN | Report observed version-two expenses imposed on imported case | Canonical baseline + explicit deal override + source/date/reason/approver + delta preview + model-version audit trail |
| F-013 | Monthly debt service and DSCR arithmetic required independent validation | PASS | P0 validation | CLOSED — PR #441 | Independent reference vectors passed for annuity debt, zero rate, interest-only grace, capitalized grace, annual debt service, minimum DSCR and DSCR-constrained sizing | Keep regression vectors; any financing-engine change must pass exact-head verification |
| F-014 | Generic/Murabaha/Ijarah financing outputs may be mistaken for executed-contract economics | EVIDENCE_GAP | P1 | PARTIALLY CLOSED | PR #441 explicitly classifies them as rate-based proxies and `exactContractModel=false`; lender-specific fees/day-count/covenants remain outside scope | Executed term sheet required for contract-exact modeling; day-count/fees/repricing/covenants modeled only when evidenced |
| F-015 | Market rent, occupancy, cap rates, land price and construction cost are not independently evidenced for the reference assets | EVIDENCE_GAP | P0 investment use | EXTERNAL_GATE | Report explicitly treats these as reference inputs, not verified market facts | Every decision-material input has source, date, unit, geographic/property relevance, reviewer and confidence/expiry metadata |
| F-016 | Development path does not visibly demonstrate complete development-cost coverage | COVERAGE_GAP | P1 | OPEN | Insurance, contingency, fit-out/TI, finance fees, working capital, tax timing/recovery and permitting/lease-up delays are not fully evidenced in the reviewed path | Cost taxonomy and timing reconciliation to QS/development budget; no “complete project cost” claim until required categories are present or explicitly not applicable |
| F-017 | Basement/area geometry accepted by arithmetic may depend on rights/plans not evidenced in the model | EVIDENCE_GAP | P1 | EXTERNAL_GATE | Mathematical area checks do not prove title/building-right feasibility | Title, survey, approved plans, boundaries/easements and engineering review linked to area assumptions |
| F-018 | Security, tenant isolation, server controls, load resilience and disaster recovery were outside the report’s direct evidence | EVIDENCE_GAP | P0 commercial launch | EXTERNAL_GATE | Black-box report did not establish these controls | Independent security/architecture/runtime evidence, recovery test and release artifact/SHA traceability before commercial launch |
| F-019 | Commercial viability of Startak itself is not established by property-level investment returns | EVIDENCE_GAP | P1 commercial | EXTERNAL_GATE | Customer volume, pricing, CAC, support/professional-review cost, hosting, churn and contribution margin were not supplied | Separate product P&L, unit economics, break-even, pilot willingness-to-pay and support operating model |
| F-020 | External financial-model validation required source-backed vectors and evidence-sufficiency controls | PASS / partial scope | P0 validation | CLOSED for tested scope — P11/P11B | Mursalat source vectors and dated-cash-flow sufficiency for IRR claims were independently tested without altering production formulas | Continue source-backed corpus across more asset types; never infer XIRR from aggregate totals without dated cash flows |

## Release gates

1. **Financial semantics gate:** zero open P0 defects capable of changing or misrepresenting an investment decision.
2. **Independent model-validation gate:** NPV/IRR/XIRR, debt service, DSCR, terminal value, financing basis, taxes/transaction costs and scenario behavior independently validated for the supported scope.
3. **Evidence gate:** 100% of decision-material deal inputs have source/date/owner/reviewer and unresolved evidence is fail-closed or explicitly conditional.
4. **Regulatory/professional gate:** applicable Saudi real-estate, tax, privacy and professional-valuation requirements reviewed by authorized specialists for the actual operating model.
5. **Technical assurance gate:** source-to-deployment SHA traceability, security, recovery, data isolation and production controls evidenced.
6. **Pilot gate:** controlled real-deal pilot reviewed by independent financial/property professionals with discrepancies recorded and resolved.
7. **Authority gate:** Commercial Go-Live and transaction/professional authority require explicit authorized approval; engineering PASS does not grant authority.

## Non-negotiable governance rules

- Arithmetic correctness is not market-data correctness.
- A warning does not cure a misleading primary metric.
- Missing evidence is not silently replaced by a default assumption for an executable decision.
- A model author does not independently approve their own material remediation for production authority.
- Test-only or semantic-control merges do not trigger production deployment solely to restore SHA parity.
- Existing production/commercial authority locks remain unchanged until the relevant gates are explicitly satisfied.
