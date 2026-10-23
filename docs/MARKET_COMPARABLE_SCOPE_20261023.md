# Market comparable scope and unit isolation

A transaction's numeric SAR per square metre does **not** make it comparable to
every other transaction recorded in the same valuation case. The quality-only
gate now prevents implicit mixing of sale and rent observations, land vs
offices/industrial/other asset types, or unrelated cities in one homogeneous
comparable set. This matters because even identical numeric unit values may
refer to different rights, price bases and property economics.

- Each `evaluateComparableSetQuality` result is assessed against an explicit
  `targetAssetType`, `targetTransactionType`, `targetCity` where supplied.
- Callers who do not yet supply explicit targets are restricted to the
  first-comparable type, transaction kind and city as a **conservative
  consistency fallback**. This is NOT verified subject identity and does not
  grant use of unreviewed comparisons in a valuation conclusion.
- Explicit cross-city comparisons require `targetCity` and an
  `allowedComparableCities` array. That scope allowance is only a
  comparison-screening choice and **not** proof of geographic equivalence.
- `targetDistrict` provides a documented review warning on different
  districts rather than unconditionally excluding legitimate market
  adjustments across neighborhoods.
- Mismatches are retained in the audit evidence as
  `COMPARABLE_ASSET_TYPE_MISMATCH`,
  `COMPARABLE_TRANSACTION_TYPE_MISMATCH` or
  `COMPARABLE_CITY_OUTSIDE_SCOPE` and removed from the set's qualified
  count. A single mismatched record also holds overall quality even when
  another record is good, so a mixed set cannot be silently presented as
  ready to adjust.
- This gate does **not** normalize rent periods, appraised interests
  (freehold/leasehold), VAT, rights, transaction expenses or incentives;
  those require their own explicit normalization and professional selection.
- A caller-declared target scope or approved city list is not official data
  authentication or source permission. Results remain
  `professionalMarketUseAuthorized=false`,
  `certifiedValuationEstablished=false`,
  `officialSourceAuthenticationEstablished=false`.

No official Saudi integration, source rights, land/hotel-specific valuation
method, accredited report or production enterprise authorization is asserted.
N03, N06, N10 and professional external gaps stay OPEN pending independent
input validation and real operator evidence.
