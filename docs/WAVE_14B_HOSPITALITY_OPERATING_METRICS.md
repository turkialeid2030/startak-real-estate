# Wave 14B — Hospitality Historical Operating Metrics

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 14B adds deterministic historical operating analytics for hospitality assets already qualified by Wave 14A. Supported classes are full-service hotels, limited-service hotels, serviced apartments and resorts. Leisure attractions and heritage assets do not inherit room-night metrics from this wave.

## Evidence record

Each operating-period record is case/property bound and content-addressed. It stores period start/end, available and occupied room nights, rooms revenue, food-and-beverage revenue, other operating revenue, departmental expenses, undistributed operating expenses, management/franchise fees, FF&E reserve, source/document hash, evidence references and preparer/reviewer provenance.

Only `VERIFIED` or `PROFESSIONAL_REVIEWED` period records are admissible for a READY metrics packet. Periods may not overlap and may not extend beyond the valuation date. Occupied room nights cannot exceed available room nights, and positive rooms revenue cannot coexist with zero occupied room nights.

## Deterministic historical metrics

The internal convention `STARTAK_HOSPITALITY_OPERATING_ANALYTICS_V1` derives:
- occupancy rate;
- average daily rate (ADR);
- RevPAR;
- total operating revenue per available room night;
- gross operating profit before operator fees;
- gross operating profit margin before operator fees;
- gross operating profit per available room night;
- operating surplus before FF&E and fixed charges;
- operating surplus after FF&E reserve.

Metrics are produced per period and for the aggregate non-overlapping historical coverage window.

## Accounting and professional boundary

The metric convention is explicit and internal. Wave 14B does not claim official USALI compliance and does not infer external accounting-statement classification. Expense placement remains visible in the input record rather than hidden behind a generic GOP label.

Wave 14B does not:
- forecast future occupancy, ADR, RevPAR or revenue;
- produce NOI;
- write valuation inputs;
- select a valuation method;
- perform valuation arithmetic;
- establish an audit opinion;
- interpret management/franchise agreements;
- establish licensing or legal compliance;
- certify a valuation;
- authorize a transaction.

Development/vacant hospitality assets return a non-applicable state instead of fabricated zero historical metrics. Leisure/heritage asset classes return a separate non-applicable asset-class state.

Qualification marker: `WAVE_14B_HOSPITALITY_OPERATING_METRICS=PASS`.
