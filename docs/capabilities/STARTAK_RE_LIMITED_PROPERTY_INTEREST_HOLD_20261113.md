# STARTAK RE — Restricted Property Interest Is Not Full Ownership
**Date:** 2026-11-13. **Repository:** `turkialeid2030/startak-real-estate`.
**Scope:** Non-authorizing owner research only.

## Defect
The existing owner market gate treated `USUFRUCT`, `LONG_LEASE` and `OTHER` as equivalent to `FULL_OWNERSHIP` for purposes of displaying user-entered generic capital and annual market rent indications. However, a whole-asset sale/rent comparison cannot automatically value a time-limited or restricted interest, which may depend on unverified duration, reversion, ground rent, obligations and contractual restrictions.

## Engineering correction
- Preserve the ability to select and archive the user's *declared*, nonverified property interest.
- Fail closed with `SPECIAL_INTEREST_VALUATION_REQUIRED` for all three restricted/other interests in the common owner market identity gate. Full ownership remains research-eligible only after the existing identity and evidence checks, **not professionally certified**.
- The owner simple view suppresses numeric capital and market-rent indications independently of any earlier comparable-subject mismatch.
- The advanced detailed view suppresses six generic market/income figures, linked quality and reconciliation sections, and blocks the result-bearing JSON export with a localized reason. Source rows are not deleted, so manual research and specialist inspection can continue.
- Reconfirming an old comparable binding can clear only the **evidence identity** mismatch; it cannot clear the separate rights-methodology requirement.
- Synthetic negative end-to-end browser cases should exercise `USUFRUCT`, `LONG_LEASE`, `OTHER`, reattestation, blocked export, and explicit reversion to `FULL_OWNERSHIP` with source rebinding, in Chromium/Firefox/WebKit.

## Explicitly not complete
- No term-dependent usufruct/leasehold DCF, current interest cashflow, statutory tenancy review, verified underlying ownership/contract, licensed appraisal, personal data source rights, private original 17+4 golden fixture, professional approval or transaction authority exists from this change.
- User-entered source descriptors and `FULL_OWNERSHIP` are **declarations** only. Professional rights/case validation and Saudi data and legal compliance remain separate.
- Saved input research sidecars can retain an unsupported interest label for later review; this is not approval. All other reporting surfaces require dedicated review for exact case, rights, source and version binding.
- `main` and public production remain unchanged; `COMMERCIAL_GO_LIVE=HOLD_NOT_AUTHORIZED`.

## Acceptance and disposition
`SOURCE_PRESENT -> SOURCE_TEST_PASS -> REAL_BROWSER_3X -> EXACT_SHA_RELEASE_VERIFY -> STAGING_REVIEW -> INDEPENDENT_PROOF -> RELEASE_AUTHORITY`.
Do not close #774/#622 or the source/auth/privacy/valuer/Q01–Q12 gates from this PR alone.
