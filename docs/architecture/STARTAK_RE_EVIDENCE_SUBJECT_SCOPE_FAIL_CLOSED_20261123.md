# STARTAK Real Estate — fail-closed subject-scope classification and invalid date handling

**Date:** 23 November 2026. **Stack:** new Draft PR after #820, not `main`. **Decision:** engineering patch, commercial and professional release **HOLD_NOT_AUTHORIZED**.

## Source-confirmed defects

1. `qualifiedResearchIntake` marked `subjectScope='DISTRICT_RESEARCH_CONTEXT_ONLY'` using JavaScript truthiness (`subject.city&&subject.district`). Two nonempty-but-whitespace, numeric or unsafe character values could incorrectly give a reviewer the impression that the research was bounded to a real district. Neither this flag nor valid city/district alone establishes a verified property identity, but the status itself still needs honest semantics.
2. `parseAsOf` called `.toISOString()` on any `Date`, so an invalid Date produced an uncontrolled `RangeError` instead of the documented `QUALIFICATION_AS_OF_INVALID` error. This could crash a UI using a malformed persisted date.

## Corrective scope

- A research district is present for display only when both subject location values are bounded, valid, nonblank strings without unsafe controls. Otherwise set `PROPERTY_IDENTITY_UNBOUND`.
- Reject Invalid Date through the existing deterministic qualification error without opening a valuation/report gate.
- Synthetic tests cover whitespace-only, numeric, overly long and control-character locations; valid subject locations; invalid Date and invalid Gregorian dates.
- No source fetched, licensed, authenticated or promoted. `certifiedMarketValueSar` and `certifiedMarketRentSar` remain null; `decision='HOLD_EXTERNAL_VERIFICATION_REQUIRED'`, production data connector disabled.

## Independent blockers unchanged

Master #622, 57 historic function contracts, private 17+4 original case actual engine/UI/save/export, independent Saudi executed property/deed/rental source rights, real tenant/IdP/vault and Q01–Q12 independent evidence remain open. Require exact-head CI and separate responsible-person sign-off before any merge or production authorization.
