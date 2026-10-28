# STARTAK — Same-cohort model challenger experiment
Date: 2026-10-28. Scope: user-uploaded, bounded CSV research sandbox.
- Models: STARTAK, Bayut TruValue, GREM AI, Earth Value, Tathmin.
- Use exactly the same property ID, asset type, city, district, prediction as-of date, executed sale date and executed price label, with 30+ distinct properties for every included model. Reject any missing model cohort, repeated property/model/date pair, conflicting executed label, prediction after execution, or leakage of a training property into holdout.
- Reuse **existing** `appraisal-market-validation.js` deterministic MAE/MAPE/MdAPE calculation; report an indicative share within 10% and total trial cost divided by correct completed tasks if cost inputs supplied.
- **Critical caveat:** all uploaded sale price labels are unverified research assertions; the underlying holdout function is invoked in synthetic mathematical benchmark mode, not to certify them. Independent verification has **NOT** occurred, so external true accuracy, model ranking, certified valuation and GO are prohibited.
- Actual live model APIs, cross-model identical inputs, independent valuer review, professional signoff and separate holdout datasets are still required to validate accuracy.

## Independent-authentication boundary

The benchmark now reuses a **pure mathematical error primitive** exported by the existing historical holdout module. It no longer sends fabricated `independentlyVerified:true` or `reuseRightsVerified:true` flags into the professional evidence validator. The existing formal `validateIndependentHoldout` still applies its independent evidence gates unchanged. Any model benchmark built from an uploaded CSV remains mathematics-on-user-claims, not proven accuracy.
