# STARTAK RE — Long record-ID deduplication correction
**Date:** 23 November 2026
**Scope:** Startak Real Estate only, cumulative after draft PR #818. No main merge or production deployment.

## Reproduced source-level defect
`inspectRecord` intentionally exposes at most 80 characters of `recordId` as `finding.referenceId`. However the subsequent within-provider and cross-provider transaction-duplicate checks used that shortened display string as their matching key. Two distinct valid source record IDs sharing the first 80 characters could therefore be counted as duplicates, distorting the review dossier without any actual shared transaction ID. This is an integrity/triage error, not proof that the affected deals are true executed sales.

## Fix and negative acceptance tests
- Keep the bounded 80-character preview unchanged for reviewer display.
- Derive the duplicate-matching key from the **complete validated source record ID** (maximum 130 characters), normalized consistently with existing logic.
- Within one provider, distinct full IDs with the same 80-character prefix are not duplicates.
- Across providers, distinct full IDs with the same 80-character prefix are not treated as the same reported transaction.
- Matching full long IDs still produce the correct same-provider count and cross-provider pair count.
- Regression proof is in `tests/defects/evidence_qualification_gate.js`; requires exact-HEAD CI.

## Authority and release boundary
Values remain in `HOLD_EXTERNAL_VERIFICATION_REQUIRED`: zero independently certified comparables, zero approved market values/rents, no qualified valuation, no report publication. No genuine transaction, data-licensing, title/parcel, date/rights, professional sign-off or live tenant UAT evidence is created by this patch. Preserve the 57 historic path parity, 17+4 case validation, Q01–Q12 reviews and issue #622 external controls as OPEN.

## Second verified defect: rejected records contaminated duplication totals
The matching loop previously processed any registered source and syntactically valid record ID, even if the qualification finding had already been **REJECTED** (e.g. untrusted URL or forged approval flag). It could also mix non-sale research with reported-sale transaction identifiers in the same-provider duplicate totals. That gave a misleading review count, even though no rejected record was authorized for valuation.

**Additional correction:** only `HOLD_REVIEW` findings in `REPORTED_SALE_CANDIDATE` enter transaction duplicate matching. Rejected rows remain visible through `totals.rejected` and individual `findings`; aggregate statistics, research notes and external AVM estimates are not counted as executed-sale duplicate candidates. Negative tests include hostile URL, forged professional authority, two rejected rows and an aggregate record with a coinciding identifier. This is a pre-valuation triage correction, not authentication of even the remaining accepted source records.
