# Wave 14C — Leisure Historical Operating Metrics

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 14C adds deterministic historical operating analytics for `LEISURE_ATTRACTION` assets already qualified by Wave 14A. It deliberately does not reuse hotel room-night metrics for leisure attractions.

## Evidence record

Each leisure operating-period record is case/property bound and content-addressed. It records period dates, operating days, attendance, admissions revenue, food-and-beverage revenue, retail/merchandise revenue, other operating revenue, direct operating expenses, undistributed operating expenses, management fees, capital reserve, source/document hash, evidence references and preparer/reviewer provenance.

Only `VERIFIED` or `PROFESSIONAL_REVIEWED` records are admissible for a READY packet. Records may not overlap or extend beyond the valuation date. Operating days must be positive; attendance is a non-negative integer; positive visitor-linked revenue with zero attendance fails closed.

## Deterministic historical metrics

The internal convention `STARTAK_LEISURE_OPERATING_ANALYTICS_V1` derives, per period and in aggregate:
- attendance per operating day;
- admissions revenue per visitor;
- ancillary spend per visitor;
- total revenue per visitor;
- total operating revenue;
- operating surplus before management and reserve;
- operating surplus before reserve;
- operating surplus after capital reserve;
- operating-surplus-after-reserve margin;
- operating surplus after reserve per visitor.

## Professional boundary

Wave 14C does not forecast attendance or visitor spend, produce NOI, write valuation inputs, select a valuation method, perform valuation arithmetic, claim external industry-accounting-standard compliance, establish an audit opinion, certify a valuation or authorize a transaction.

Hospitality asset classes return a separate non-applicable asset-class state. Development/vacant leisure assets do not fabricate historical operating metrics. Historical records supplied against a non-active operating state require a separate explicit historical context rather than silent acceptance.

Qualification marker: `WAVE_14C_LEISURE_OPERATING_METRICS=PASS`.
