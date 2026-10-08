# C56 — Saudi Historical Cohort and Real Accuracy Evidence Qualification

## Objective
C56 does not invent historical Saudi property sales or benchmark accuracy. It composes `src/replay/historical-replay-readiness.js` (C51 external signed replay evidence) and `src/validation/external-valuation-validation.js` (external comparison policy), adding explicit calibration/holdout time cutoffs, metadata completeness, model prediction chronology, duplicate property/truth detection, per-city/asset-class slice counts and median/mean/P90 error measurements.

## Strict admission gates
- A predeclared protocol with registration timestamp, end-of-calibration cutoff, metric policy, minimum holdout and segment samples, and source hash.
- A C51 historical evidence record structurally ready for C30 ingestion and all cases associated with it; **C51 readiness is not evidence authenticity**.
- Each observation must belong to Saudi Arabia and contain asset type, city, property identity, actual/independent comparator value, dates, model prediction issuance timestamp before outcome, independent reviewer, comparator provenance SHA and evidence references.
- Reject missing/contradictory dates, historical information leakage, calibration cases after cutoff, holdout cases on/before cutoff, duplicate truth, declared synthetic cases, missing holdout or calibration data.
- Reuse the existing explicit `evaluateExternalValuationValidation` policy for median absolute percentage error, signed bias and date mismatch. Do not invent thresholds.
- Segment every holdout by city and asset type and report inadequate slice counts instead of hiding them.

## Evidence state
No genuine independent Saudi transaction dataset was supplied or imported in this PR. The tests use **synthetic numerical fixtures**; C51 externally asserted `synthetic:false` flags in unit-test data must never be treated as authentic verified transaction evidence. A complete structural record outputs `READY_FOR_EXTERNAL_REVIEW`, **not** verified accuracy, accreditation, production or commercial authorization. Authenticity, source licences and independent review remain external requirements and must be independently validated at C30.

## Outstanding before G01 closure
1. Licensed/commercially permitted Saudi completed-transaction data with genuine chain-of-custody and hashed source documents.
2. Predeclared representative sample across city, subtype, pricing/time cohorts and observed condition, excluding cherry-picked cases.
3. Real model outputs captured at their historical decision points, with no future leakage; frozen model SHA and reviewed methods.
4. Verified analyst review of deviations, selection bias, calibration vs sealed holdout and cohort error metrics. Statistical confidence intervals only when sample supports them.
5. Real signed C30 external gate ingestion and case-by-case review. Until then: G01 = HOLD.
