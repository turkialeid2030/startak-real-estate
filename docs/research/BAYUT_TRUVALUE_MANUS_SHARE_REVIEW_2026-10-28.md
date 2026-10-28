# Bayut TruValue and user-shared Manus reference — STARTAK research addendum
Research observation: 2026-10-28. Research-only; not deployed or certified.

## Bayut TruValue
Source: https://www.bayut.sa/property-market-analysis/tru-value/

According to Bayut's own FAQ, its estimate blends (1) AI-estimated asking price from Saudi listings, adjusted for a typical negotiation margin, and (2) a separate model relying on recorded sale deeds. Data-dependent weights place more emphasis on recorded sales where relevant local recorded comparable samples exist. **Exact weight equations, out-of-sample MAPE/MAE, calibration and datasets are not disclosed**; STARTAK does not claim to reproduce the proprietary model.
TruValue is advertised as available for apartment, villa, floor and residential land sale estimates in Riyadh, Dammam, Jeddah, Makkah, Madinah, and Al Khobar. Rental UI is labelled "coming soon". It asks for property type, city, district/sub-district, plan number, area and bedrooms, and reports an estimate, a confidence-based value interval, asking and sold comparables, and trends. Bayut says it is **not** an official licensed valuation.

Implementation: New source `BAYUT_TRUVALUE` in the national research catalog with `EXTERNAL_AVM_ESTIMATE` or text-only `RESEARCH_NOTE`. Optional CSV fields: `rangeLowSar,rangeHighSar,confidenceLabel,modelAsOf`, with pair validation, point-within-interval validation, explicit `providerStatedConfidence`, supported four asset classes, Arabic numeral fidelity, and no claim of independently validated accuracy. Source stays `marketValuationEligible:false` and cannot become a recorded deed. No live Bayut API connection or provider reports obtained.

## Manus shared link
User URL: https://manus.im/share/QnCMa3VxXUKQoW2SNmj98H

The link was not readable in the web tool (cache miss) and did not appear in indexed results for its unique token. The connected browser was not available in this session, and local DNS resolution failed. Therefore the **topic, title, body, numbers, claims and recommendations of that Manus session are NOT VERIFIED**. It is registered as `MANUS_SHARE`, `USER_SHARED_UNREADABLE_LINK` and allows only text-free numeric `RESEARCH_NOTE`; no results or claims were imported. A readable Manus export is required to review its substance.

## Release control
These are manual research references. The supplied public URL is not evidence of third-party API authorization, actual registered sale values, professional endorsement, or market accuracy. PR #764 remains draft and non-production, with HOLD for commercial and professionally accredited reports.
