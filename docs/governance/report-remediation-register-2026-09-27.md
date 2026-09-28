# Startak Real Estate — Formal Remediation Register

**Source review:** `تقرير_فحص_ستارتاك_العقارية.docx` dated 2026-09-27  
**Register created:** 2026-09-27  
**Last synchronization:** 2026-09-28 after P22  
**Current engineering baseline at synchronization:** `main` = `bfb019500e533bcc1043bcb5b2fed92a8342944b`  
**Latest exact-head qualification before P22 merge:** `465 / 465` regression PASS; Release Verify PASS; Comprehensive Verify PASS; Deep Platform Verify PASS; Supply Chain Audit PASS; Zakat Layer Verify PASS; `trusted-main-production-governance` PASS  
**Production deployment status:** not changed by this register; repository `main` must not be equated with verified public production without separate deployment evidence  
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
- `PARTIALLY_CLOSED`: a defined software/model defect was remediated, but a separate evidence, coverage, regulatory or professional gate remains.
- `CONFIRMED_OPEN`: reproduced or confirmed in current source but not yet remediated.
- `EXTERNAL_GATE`: requires human/professional/operational evidence outside code.

## Findings register

| ID | Finding | Classification | Severity | Current status | Evidence / current conclusion | Remaining acceptance criterion |
|---|---|---|---|---|---|---|
| F-001 | “Maximum justified purchase price” implied broader decision sufficiency than its formula actually solved | DEFECT | P0 | **CLOSED — PR #442 / P12** | Numeric formula remains yield/payback based; `PRICE_BASIS_V1` now states excluded NPV/IRR/value/DSCR gates and customer-facing labels were narrowed | Keep regression contract; any future true “maximum acceptable price” solver must explicitly solve its declared hard gates |
| F-002 | Financing percentage was applied to total acquisition cost while UI wording could be read as price/value based | DEFECT / semantic governance | P0 | **CLOSED — PR #447 / P16** | Existing-building financing now discloses `TOTAL_ACQUISITION_COST` as denominator, requested ratio, requested debt limit, constrained actual debt, actual debt-to-cost and debt-to-base-price ratios; binding acquisition-cost constraint is presented as LTC rather than generic LTV | Lender-specific value-based LTV may be added only when an evidenced valuation denominator and term sheet support it |
| F-003 | Invalid material exit-cap input could leave prior valid decision outputs visible | DEFECT | P0 | **CLOSED — PR #446 / P15** | Invalid nonblank exit-cap drafts are propagated into canonical state and fail closed; stale last-valid economics cannot masquerade as current valid results; persistence uses canonical validation | Preserve fail-closed behavior for any future material assumption fields and exports |
| F-004 | Riyadh rent-regulation wording could permit an unsupported rent-growth interpretation | REGULATORY_EVIDENCE_REQUIRED / DEFECT | P0 | **PARTIALLY CLOSED — PR #445 / P14** | Misleading “new contracts unaffected” semantics were removed and dated official regulatory metadata was added; the platform explicitly states that full runtime applicability automation is incomplete | Deal-specific applicability still requires location/date/lease-history/exception facts and authorized Saudi legal review before executable rent-growth treatment |
| F-005 | Leverage enabled with zero effective debt still added equity risk spread / financing-only gates | DEFECT | P0 | **CLOSED — PR #444 / P13** | Explicit zero debt now behaves economically as unlevered: no debt service, no DSCR gate, no financing-only equity spread, and levered cash flows/returns equal the unlevered case | Keep zero-debt neutrality regression for both building and land paths |
| F-006 | Lease expiry/renewal does not drive contractual cash-flow roll-forward in the tested path | COVERAGE_GAP | P1 | **OPEN** | The source review changed lease term without a corresponding contractual cash-flow roll-forward | Dated rent roll with expiry, renewal probability, downtime, market reset, incentives, brokerage, tenant improvements and credit loss treatment |
| F-007 | Replacement-cost-plus-land indicator can be interpreted as current market/appraised value | DEFECT / COVERAGE_GAP | P1 | **OPEN** | The reviewed path did not establish a complete depreciation/obsolescence market-valuation methodology | Rename as replacement-cost indicator before obsolescence or implement documented physical/functional/economic obsolescence and licensed valuation methodology |
| F-008 | Service income materially affects value but collectability/cost recovery is not evidenced | EVIDENCE_GAP | P1 | **EXTERNAL_GATE** | Removing assumed service income materially changed reference economics | Contractual entitlement, billing basis, collection history and matching recoverable costs must be evidenced per deal; unresolved amount remains conditional |
| F-009 | Entry/exit transfer-fee fields could be mistaken for complete Saudi RETT economics | REGULATORY_EVIDENCE_REQUIRED / semantic governance | P1 | **PARTIALLY CLOSED — PR #449 / P18 + PR #454 / P22; Issue #402 closed** | Current official RETT evidence metadata distinguishes statutory responsibility from economic incidence. Existing Building now separates acquisition `transferFeeRate` from explicit seller-borne `exitTransferFeeRate`; fresh V2 has no hidden exit-cost default and holds exit-dependent analytics when exit cost is missing. Legacy fallback is disclosed | Deal-specific statutory taxpayer, exemptions, taxable base, contractual burden and legal/tax applicability remain external professional gates; no software field constitutes a tax opinion |
| F-010 | Terminal value is a large share of present inflows; exit-cap and forward-NOI governance required independent validation | EVIDENCE_GAP / model risk | P1 | **PARTIALLY CLOSED — PR #448 / P17** | Independent tests confirm terminal value capitalizes forward Year-(N+1) stabilized NOI, final cash flow includes Year-N NOI plus net terminal proceeds once, exit-cap sensitivity is monotonic, and configured exit cost is deducted once | Asset-specific forward-NOI evidence, terminal-value concentration disclosure, market exit-cap evidence and wider ±bps sensitivity remain required for investment use |
| F-011 | Some warnings/cell references/placeholders are not decision-readable in Arabic | DEFECT / UX governance | P2 | **OPEN** | Source review observed unclear placeholder/evidence labels | No opaque placeholder in a decision path; Arabic explanation, value, evidence/cell reference and stable error code shown together |
| F-012 | Versioned locked assumptions can override imported/deal-specific economics without sufficient user-level governance | COVERAGE_GAP / assumption governance | P1 | **OPEN** | Source review observed V2 expenses governed centrally rather than fully deal-overridable | Canonical baseline + explicit deal override + source/date/reason/approver + delta preview + model-version audit trail |
| F-013 | Monthly debt service and DSCR arithmetic required independent validation | PASS | P0 validation | **CLOSED — PR #441 / P11C** | Independent reference vectors passed for annuity debt, zero-rate debt, interest-only grace, capitalized grace, annual debt service, minimum DSCR and DSCR-constrained sizing | Any financing-engine change must retain exact-head independent reference vectors |
| F-014 | Generic/Murabaha/Ijarah financing outputs may be mistaken for executed-contract economics | EVIDENCE_GAP | P1 | **PARTIALLY CLOSED — PR #441 / P11C** | Generic/Murabaha/Ijarah paths are explicitly labeled rate-based proxies with `exactContractModel=false` | Executed term sheet remains required for contract-exact day-count, fees, covenants, repricing, security, prepayment and legal structure |
| F-015 | Market rent, occupancy, cap rates, land price and construction cost are not independently evidenced for the reference assets | EVIDENCE_GAP | P0 investment use | **EXTERNAL_GATE** | Reference values remain assumptions unless source/date/relevance is attached | Every decision-material market input requires source, date, unit, geographic/property relevance, reviewer, confidence and expiry metadata |
| F-016 | Development path does not visibly demonstrate complete development-cost coverage | COVERAGE_GAP | P1 | **OPEN** | Insurance, contingency, fit-out/TI, finance fees, working capital, tax timing/recovery and permitting/lease-up delays are not all demonstrated as complete in the reviewed path | Cost taxonomy and timing reconciliation to QS/development budget; no “complete project cost” claim until required categories are present or explicitly not applicable |
| F-017 | Basement/area geometry accepted by arithmetic may depend on rights/plans not evidenced in the model | EVIDENCE_GAP | P1 | **EXTERNAL_GATE** | Mathematical geometry does not prove title/building-right feasibility | Title, survey, approved plans, boundaries/easements and engineering review linked to area assumptions |
| F-018 | Security, tenant isolation, server controls, load resilience and disaster recovery were outside the report’s direct evidence | EVIDENCE_GAP | P0 commercial launch | **EXTERNAL_GATE / INTERNAL ENGINEERING EVIDENCE EXISTS** | Repository Release/Comprehensive/Deep/Supply-Chain gates have passed recent exact heads, but this is not equivalent to independent penetration testing, production DR evidence or external assurance | Independent security/architecture/runtime evidence, recovery exercise, data-isolation evidence and deployed-artifact/SHA traceability before commercial launch |
| F-019 | Commercial viability of Startak itself is not established by property-level investment returns | EVIDENCE_GAP | P1 commercial | **EXTERNAL_GATE** | Customer volume, pricing, CAC, support/professional-review cost, hosting, churn and contribution margin remain outside the property model | Separate product P&L, unit economics, break-even, pilot willingness-to-pay and support operating model |
| F-020 | External financial-model validation required source-backed vectors and evidence-sufficiency controls | PASS / partial scope | P0 validation | **CLOSED for tested scope — P11/P11B, PR #437/#440** | Mursalat source vectors and dated-cash-flow sufficiency controls for IRR claims were independently tested without modifying production formulas merely to match source claims | Continue source-backed corpus across asset types; never infer XIRR from aggregate totals without dated cash flows |
| F-021 | Canonical IRR solver could classify conventional unique IRRs above the default +1000% bracket as out of range | DEFECT | P1 numerical robustness | **CLOSED — PR #450 / P19** | Conventional one-sign-change cases now adaptively expand the positive bracket under a governed ceiling; explicit caller-supplied bounds remain authoritative | Preserve ordinary, extreme, explicit-bound and multiple-root regression vectors |
| F-022 | Land-development “LTC” could be misread as all-in completion debt/cost after capitalized construction interest | DEFECT / semantic governance | P1 | **CLOSED — PR #451 / P20** | Model now separates `principalLtc` from `effectiveCompletionDebtToCost` and states that capitalized interest is excluded from the principal LTC cap | Executed lender all-in LTC covenant must not be inferred without term-sheet evidence |
| F-023 | `coverageRatio` could be misread as site/footprint coverage or zoning/FAR compliance | DEFECT / semantic governance | P1 | **CLOSED — PR #453 / P21** | Metric is now explicitly defined as `TOTAL_BUILT_AREA_INCLUDING_BASEMENTS / LAND_AREA`; machine-readable metadata states `isSiteCoverageRatio=false` and `isZoningComplianceMetric=false`; AR/EN labels corrected | Planning site coverage/FAR requires a separate official zoning-rights model and current evidence |
| F-024 | Existing Building reused acquisition transfer cost as seller exit transaction cost | DEFECT / regulatory-economic semantics | P1 | **CLOSED — PR #454 / P22; Issue #402 completed** | Dedicated explicit V2 seller-borne exit transaction cost is now independent from acquisition transfer cost; missing V2 exit cost fails closed; UI, persistence, result contract, browser journeys and provenance were updated | Legal/tax incidence remains an external gate and must not be inferred from the economic assumption |

## Remediation waves completed since register creation

| Wave | Primary scope | Merge status |
|---|---|---|
| P11 / P11B | Source-backed vectors and IRR evidence sufficiency | CLOSED |
| P11C | Independent debt service / DSCR validation | CLOSED — PR #441 |
| P12 | Justified-price decision semantics | CLOSED — PR #442 |
| P13 | Zero-debt leverage neutrality | CLOSED — PR #444 |
| P14 | Riyadh rent-control wording/evidence semantics | SOFTWARE SEMANTICS CLOSED — PR #445; legal applicability gate remains |
| P15 | Invalid exit-cap fail-closed state | CLOSED — PR #446 |
| P16 | Acquisition-cost financing basis disclosure | CLOSED — PR #447 |
| P17 | Terminal value / exit-cap independent validation | TESTED SCOPE CLOSED — PR #448 |
| P18 | RETT statutory liability vs economic incidence | SOFTWARE SEMANTICS CLOSED — PR #449; legal applicability gate remains |
| P19 | Extreme conventional IRR solver bracketing | CLOSED — PR #450 |
| P20 | Principal LTC vs capitalized completion debt | CLOSED — PR #451 |
| P21 | Gross built-area ratio semantics | CLOSED — PR #453 |
| P22 | Acquisition vs exit transaction-cost separation | CLOSED — PR #454; Issue #402 completed |

## Current priority after P22

The highest remaining decision-risk items are no longer the P13–P22 defects above. The next remediation tranche should prioritize:

1. **F-006 contractual lease roll-forward / renewal economics** — material model coverage gap capable of changing property cash flows.
2. **F-007 replacement-cost indicator semantics / obsolescence** — prevent replacement cost from being interpreted as market/appraised value.
3. **F-012 assumption override governance** — deal-specific overrides, source/provenance and delta approval.
4. **F-016 development cost taxonomy/timing completeness** — prevent incomplete project-cost claims.
5. **External P0 gates F-015/F-018** — real market evidence and independent production/security assurance before commercial use.

These priorities do not authorize production deployment or Commercial Go-Live.

## Release gates

1. **Financial semantics gate:** zero open P0 defects capable of changing or misrepresenting an investment decision within the declared supported model scope.
2. **Independent model-validation gate:** NPV/IRR/XIRR, debt service, DSCR, terminal value, financing basis, transaction costs and scenario behavior independently validated for the supported scope.
3. **Evidence gate:** 100% of decision-material deal inputs have source/date/owner/reviewer and unresolved evidence is fail-closed or explicitly conditional.
4. **Regulatory/professional gate:** applicable Saudi real-estate, tax, privacy and professional-valuation requirements reviewed by authorized specialists for the actual operating model.
5. **Technical assurance gate:** source-to-deployment SHA traceability, security, recovery, data isolation and production controls evidenced.
6. **Pilot gate:** controlled real-deal pilot reviewed by independent financial/property professionals with discrepancies recorded and resolved.
7. **Authority gate:** Commercial Go-Live and transaction/professional authority require explicit authorized approval; engineering PASS does not grant authority.

## Non-negotiable governance rules

- Arithmetic correctness is not market-data correctness.
- Repository `main` is not automatically the verified public deployment.
- A warning does not cure a misleading primary metric.
- Missing evidence is not silently replaced by a default assumption for an executable decision.
- Statutory tax/legal responsibility is not inferred from an economic cash-flow assumption.
- A model author does not independently approve their own material remediation for professional or transaction authority.
- Test-only or semantic-control merges do not trigger production deployment solely to restore SHA parity.
- Existing production/commercial authority locks remain unchanged until the relevant gates are explicitly satisfied.
