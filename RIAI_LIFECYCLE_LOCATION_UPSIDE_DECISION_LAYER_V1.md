# Residential Income Acquisition Intelligence — Lifecycle, Location, Upside & Decision Layer v1

## Status

Implementation contract for the Residential Income Acquisition Intelligence (RIAI) extension following Exit Strategy Comparison v1.

This layer is analytical, evidence-gated, non-binding, and does not provide a certified valuation, regulated investment recommendation, legal opinion, financing approval, or transaction authorization.

## 1. Asset Lifecycle Intelligence

Lifecycle records are supplied through the existing evidence-aware `additionalOperatingInputs` graph using:

`lifecycle.component.<componentId>.<attribute>`

Required attributes:

- `category`
- `conditionScore` (0–100)
- `remainingUsefulLifeYears`
- `replacementCost`
- `replacementYearOffset`
- `downtimeDays`
- `criticality`

Outputs include weighted condition score, known replacement CAPEX due within 3 and 5 years, critical components due within 3 years, expected downtime, and an annualized lifecycle reserve planning proxy.

The reserve is not an engineering estimate. Component records must be supported by evidence-aware values adopted for underwriting.

## 2. Current Location Intelligence

The engine does not infer location quality from the neighborhood name alone. The current-location index requires adopted evidence-linked scores for:

| Dimension | Weight |
| --- | ---: |
| Accessibility | 20% |
| Services | 15% |
| Employment access | 15% |
| Market demand | 20% |
| Exit liquidity | 10% |
| Environmental resilience | 10% |
| Competitive supply risk | 10% |

Competitive supply risk is inverted before aggregation so a higher raw risk score reduces the normalized location quality.

## 3. Forward Attraction Intelligence

Catalysts are supplied as:

`forward.catalyst.<catalystId>.<attribute>`

Required attributes are `stage`, `direction`, `impactScore`, `probability`, and `distanceKm`.

Stage values and maximum probability admitted by the analytical policy are:

| Stage | Probability cap |
| --- | ---: |
| RUMORED | 0% |
| ANNOUNCED | 25% |
| APPROVED | 50% |
| FUNDED | 65% |
| CONTRACTED | 80% |
| UNDER_CONSTRUCTION | 90% |
| OPERATIONAL | 100% |

The effective signal applies the lower of stated probability and the stage cap, then applies a distance factor. Announcements alone therefore cannot be treated as realized value.

Forward-attraction outputs are contextual signals only. They do **not** automatically change rent growth, vacancy, terminal value, exit cap rate, NPV, or IRR.

## 4. Upside and Subdivision Intelligence

Catalysts are supplied as:

`upside.catalyst.<catalystId>.<attribute>`

Supported types include subdivision, reconfiguration, change of use, additional GFA, parking monetization, rooftop/ancillary uses, lease restructuring, amenity upgrades, energy retrofit, and other explicitly modeled catalysts.

Required attributes:

- `type`
- `regulatoryStatus`
- `capex`
- `executionPeriodYears`
- `annualNoiLossDuringExecution`
- `incrementalAnnualNoi`
- `probability`

Regulatory status is explicitly separated from economics:

| Regulatory status | Probability cap |
| --- | ---: |
| NOT_REVIEWED | 0% |
| POTENTIALLY_FEASIBLE | 50% |
| VERIFIED_FEASIBLE | 100% |
| RESTRICTED | 20% |
| PROHIBITED | 0% |

`POTENTIALLY_FEASIBLE` remains **Regulatory Verification Required** and is not treated as a legal approval.

## 5. Scenario Attribution / Double-Counting Control

The scenario integration layer audits but does not rewrite Exit Strategy Comparison cash flows.

It flags:

- lifecycle replacement CAPEX within the scenario hold period that may exceed the scenario's modeled strategy CAPEX;
- eligible upside catalysts when a scenario already contains modeled strategy CAPEX or stabilized-NOI uplift;
- material forward-attraction signals that must remain contextual unless explicitly adopted into a scenario.

`automaticFinancializationApplied` is always false in v1.

This is the primary anti-double-counting control between lifecycle, location, upside, and terminal-value assumptions.

## 6. Deterministic Acquisition Analytical Score

The acquisition score is deliberately deterministic and explainable. `aiModelUsed=false`.

Weights:

| Component | Weight |
| --- | ---: |
| Operating stability | 20% |
| Lease durability | 15% |
| Lifecycle condition | 15% |
| Current location | 15% |
| Forward attraction | 10% |
| Price discipline | 15% |
| Upside readiness | 10% |

The score includes coverage, evidence confidence, component-level contributions, and red flags. It does not output a buy/sell recommendation.

The deterministic score is the governed substrate for any later AI narrative layer; an AI narrative must not overwrite factual inputs, model outputs, legal/regulatory status, or human approvals.

## 7. Investment Committee Pack Boundary

The pack separates:

1. **Facts** — sourced operating and property facts.
2. **Assumptions** — adopted assumptions and contextual signals.
3. **Model Outputs** — stabilized NOI, acquisition basis, non-binding reverse-underwriting limit, scenario ranking, deterministic score.
4. **Judgment Required** — blockers, evidence gaps, regulatory verification, attribution review, and red flags.

The generated pack has:

- `decisionRequested=null`
- `recommendation=null`
- `approved=false`
- `legalOpinion=null`
- `regulatedAdvice=false`
- `transactionAuthorized=false`

Human committee authority remains outside the analytical engine.

## 8. Persistence and Evidence

The extension uses the existing evidence-aware `additionalOperatingInputs` contract, so records remain within the current operating-case JSON import/export, saved-deal, and backup persistence path without introducing a parallel ungoverned data store.

Every adopted input must preserve source reference, verification status, effective date, adoption decision reference, and lineage references under the existing RIAI evidence-aware contract.

## 9. Version Boundary

v1 intentionally does not:

- scrape or infer future projects without evidence;
- infer legal feasibility from location or project announcements;
- auto-adjust financial scenarios from contextual signals;
- treat a potential subdivision/change of use as an approval;
- generate regulated investment advice;
- authorize execution of a transaction.
