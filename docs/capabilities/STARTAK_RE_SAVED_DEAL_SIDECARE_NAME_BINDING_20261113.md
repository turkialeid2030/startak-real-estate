# STARTAK Real Estate — research-sidecar Saved Deal property-name guard
Date: 2026-11-13. Status: development branch, non-authorizing.

## Verified original gap
`src/market/saved-deal-study-sidecar.js` stored or restored a research sidecar by Saved Deal ID and broad asset mode, while verifying the actual deal-name/market-subject-name association only when an *appraisal link was present*. The UI's `linkedDealNameConflict` likewise required a pre-existing appraisal link. Consequently, a checkbox plus a Saved Deal ID could save a different named market study to the same-mode deal. Restoring did not recheck a renamed canonical deal or tampered sidecar subject.

This is a **local identity-association integrity** gap; there is no evidence of actual historical tenant data leakage.

## Engineering change
- Require a nonblank, normalized exact **property name match** between the canonical Saved Deal and research market subject on ALL sidecar saves, regardless of professional appraisal link; return `SIDECAR_SAVED_DEAL_SUBJECT_NAME_MISMATCH` on a mismatch.
- At restore, recheck the saved study name against the **current** canonical Saved Deal name, including any rename after the sidecar was written. Preserve the independent mode and schema checks.
- Normalize compatible Unicode and whitespace (NFKC, trims, whitespace collapse and Arabic-aware lowercasing); do not fuzzy-match similarly named properties or infer title/parcel equivalence.
- UI flags a different named Saved Deal even with no linked appraisal. Saving is disabled with bilingual explanation, while **loading remains allowed** so the backend can accept a sidecar whose own stored subject matches the deal. A live mismatch cannot be overridden solely by checking "same property".
- Unit characterization tests reject unrelated, blank and tampered research subjects; accept conservatively equivalent spellings; reject renamed deal restore. Real owner browser scenario checks a different named property fails until corrected, then saves only unapproved research input fields.

## Explicit limitations and remaining acceptance
- Matching names and user attestations do **not** verify a deed, parcel number, title holder, source record, signed lease or appraisal. Genuine aliases need externally supported case binding before the UI can allow a different name.
- No mutation of canonical Saved Deals, audit authority, `main`, or production. Legacy sidecars with nonmatching names become intentionally non-restorable pending identity correction.
- Real 17+4 property parity, Q01–Q12 signed packets, original legal source licenses, server identity/tenant isolation, licensed valuer review and release approval remain open.
- Engineering qualified only if exact-head sidecar unit tests, full owner-browser study and canonical release regressions all pass; commercial GO stays `HOLD_NOT_AUTHORIZED`.
