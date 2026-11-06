# Whole-property market value and rental research journey

The owner needs two distinct outputs as of one valuation date: a capital market indication and an annual market rental indication, both exclusive of tax. A whole-property lease is the explicit default. Sale, reletting and market-knowledge purposes remain distinct from investment feasibility and net sale proceeds.

## Implemented scope

- Four steps: property/purpose, physical scope and lease terms, evidence, indications/gaps.
- Land, warehouse, hotel, commercial building, mall, residential building/complex, mixed use and fuel station. Vehicles/movable equipment are explicitly outside real-property valuation.
- Location accepts an address, supported HTTPS map URL or latitude/longitude. Short map links are retained without resolution. Neither a URL nor parsed coordinates verify parcel identity.
- Separate land, built and indoor leasable areas. Mixed site-work/tank/canopy measurement totals cannot be accepted as indoor built area. Built area may exceed land area.
- Existing building as-is and a separate hypothetical cleared-land scenario. Clearance costs/reference are required for the latter, and clearance cost adjusts capital value, not one year of rent.
- Explicit right and an existing-lease reference for leased ownership. Limited interests and leased-fee direct capitalization remain held for the existing detailed rights/DCF workflow.
- Assumed lease term, rent-free months and expense allocation are recorded. Whole-property letting does not silently turn owner OPEX into zero. A multi-unit choice requires the detailed rent-roll workflow.
- Sale and rental comparison packets are independent. Comparison amount unit, dates, source references, explicit adjustment percentages, tax basis and comparability declarations are required. Equal weights must be explicitly selected. Three comparables are this research protocol, not a claim about universal professional requirements.
- The orchestrator calls existing `market-comparables`, `income-capitalization` and `cost-approach` engines. It does not introduce another financial model or a universal copy of one valuer's spreadsheet formula.
- Capital-derived rent is not accepted as independent market evidence. Missing/asking/future/tax-inclusive/duplicate-ID comparison entries do not silently become executed evidence.
- Closure/restriction prevents an unrestricted-use rent indication. As-is sale comparison additionally needs a reference explaining the restriction's treatment.
- Fuel-station tank/ownership/environment references, hotel licensing/capacity/room attributes, residential unit descriptions and warehouse clear-height evidence are conditional. Missing evidence is displayed and never becomes independently verified through a checkbox.
- Input-only JSON save/restore with a strict schema and SHA-256 integrity digest. No remote persistence, document upload or professional signature is implied. Edits/new cases cancel pending imports and invalidate results; language changes preserve inputs.
- Research HTML report includes both available indications, date, purpose, scope, rights, lease terms, source inputs and gaps. Linked appraisal HOLD or identity mismatch blocks both displayed amounts and report export, using the existing export guard. It does not authorize official or commercial appraisal issuance.
- Date entry in the new journey uses a localized text hint and calendar-valid ISO parsing, avoiding browser-native date hints. Existing application controls are not silently rewritten.

## Deliberately unclaimed

No professional valuation certification, proved market error rate, verified current licence/title/operational status, automatic map-link resolution, live transaction import, official report signature, remote case storage, production deployment, or completed integration with canonical Saved Deals.

The original comparison/cost report figures are suitable for source reproduction tests, with recorded contradictions. They are not independent transaction labels. A separate external validation sample is needed to measure market error by asset, city and lease model.

Do not commit private reports, deeds or real client golden-case fixtures to this public repository. Tests here use synthetic properties only. No file supplied as a proposed implementation directive is automatically authoritative over current engine semantics or repository history.

## Validation

- `tests/valuation/property-market-valuation-case.test.js`: numerical parity with the existing engines, independent outputs, tax/date/source/rights restrictions, closure, cleared-land cost, Arabic numbers, location handling, schema/digest and export restrictions.
- `tests/defects/property_market_workbench_ui.js`: React DOM journey, conditional sector fields, locale preservation, stale-result invalidation, archive race/rejection and linked-review restrictions. These are DOM tests, not browser visual proof.
- `tests/e2e/run_appraisal_assurance_ci.mjs`: retains prior audit coverage and adds native file restoration, whole-property choice, dual indications, fuel evidence gaps, English labels, report download, edit invalidation and four mobile steps. Requires Chromium in CI.

Release results and deployment state must be associated with the final candidate SHA, not copied from an earlier candidate. The new interface does not change the existing canonical saved-deal calculation.
