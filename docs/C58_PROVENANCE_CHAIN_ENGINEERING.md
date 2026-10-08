# C58 — Comparable Source Chain Integrity, bounded engineering stage

## Observed existing architecture
- Wave 9A provides immutable SHA-256 market comparable records with source references, verification metadata, property/date/area/price, executed/offer grades and provenance quality checking.
- Wave 9B holds professional comparable selection and value adjustment, not automatic certified reconciliation.
- C54 prevents structurally unqualified offers/mixed types from entering decision control. Its `sourceRef` field alone is **not** proof of source authenticity.
- C53 creates governed private-alpha external source acquisition functionality; its existence does not prove acquired transaction validity or rights.

## New C58 work
`src/market/comparable-provenance-chain.js` checks internal integrity of Wave 9A records and separately hashed capture receipts. It binds C54 comparable ID, sourceRef, transaction date and unit-value to the Wave 9A source record; requires matching property identity, city and asset type, executed status and verified source grade, valid source/valuation/as-of chronology, valid captured document digest, unique underlying transaction identity, source-rights review proof, right-to-use dates and permission for INTERNAL_VALUATION.

The risk is **not** solved by a self-declared SHA-256 receipt or source-rights flag. A hash shows byte identity only if someone actually obtains and independently verifies the original document. A rights reference alone does not constitute legal authorization. A level labeled VERIFIED in an internal record is not independent verification.

C58 returns at best `READY_FOR_INDEPENDENT_SOURCE_AUTHENTICATION`. The bounded `calculateSourceBoundMarketIndication` retains preliminary market arithmetic but adds an `INPUT_STATUS.CONFLICT` to guarantee `HOLD_EVIDENCE_CONFLICT` until an independent external evidence verifier exists. Neither path can authorize certified valuation, an investment decision or transactions.

## Exact-head acceptance
- Verify record/receipt hashes, valuation chronology, source-rights window and purpose, case/asset/city mismatch, executed-vs-offer, missing records, wrong prices, repeated comparable and repeated underlying transaction, signed independent reviewer **still missing**.
- Run C54 and Wave9A/9B regressions and whole-package release verification with pinned GitHub Actions SHAs; npm audit --audit-level=low.
- Test fixture metadata is synthetic and establishes only code handling, not real Saudi transaction trust.

## Unfinished before true gap closure
1. Rights-cleared source artifact bytes, known provider and signed permission validation by authorized legal counsel.
2. Source-attestation verifier using an independent trust registry (keys not caller supplied), proper cryptographic binding and time-limited revocation.
3. Production integration from real acquisition C53 -> verified Wave 9A -> C58 -> professional Wave 9B -> C54/C57 full UI-save-report decision flow; ensure any direct C54 path cannot bypass source authenticity requirement in commercially decision-ready workflow.
4. Independent reviewer and sampled real Saudi executed transactions, official property identity/subtype/spatial comparability and transaction circumstances; linked C56 genuine holdout.
5. Governed report discloses provenance/rights status and remains unable to export valuation conclusions while external authentication is missing.

**C58 is an engineering evidence preflight, not an assertion that any uploaded, captured or simulated transaction is authentic or licensed. Do not merge/deploy before external gate approval.**
