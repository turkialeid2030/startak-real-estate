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

## Related UI counting semantics
The former `reportedSaleCandidates`, `aggregates` and `externalAvms` totals also counted rejected imports solely from their evidence class labels. These numbers are shown in the reviewer panel as candidates/context and could imply rejected records were suitable for review. They now count only `HOLD_REVIEW` rows in their respective category; `importedRows` and `rejected` retain complete audit totals. Positive tests verify normal valid research categories remain counted, and adversarial tests verify rejected sale/aggregate/AVM records remain out of the reviewable counts.

**Engineered invariants:** `marketValuationEligible=false`, `certifiedMarketValueSar=null`, `certifiedMarketRentSar=null`, `professionalReportAuthorized=false` remain unchanged. All qualifying records are still preliminary HOLD research, not independently authenticated transactions or a professional valuation.

## Additional deep-audit fixes — full tuple encoding and dossier privacy
- Previously, cross-provider grouping concatenated untrusted city/district/transaction-ID strings with a literal pipe (`|`). A city like `A|B` with district `C` could share the same composite string as city `A` and district `B|C`, creating a false suspected duplicate across providers. Source and cross-provider keys now use unambiguous JSON-encoded value tuples, preserving full record IDs and all actual values.
- Previously, the `evidenceClass` of even rejected records was reflected unmodified into `findings` and `portableReviewDossier`, including arbitrary object/string values not in the recognized evidence-class enum. These are now replaced with `null` in exported findings unless an exact known string category is supplied. The record remains rejected with its reason code, without portable propagation of arbitrary user content.
- New synthetic regression cases prove different pipe-separated city/district tuples cannot falsely match, identical tuples still produce a review candidate, and imported private marker values in an invalid evidence class do not appear in the portable JSON review dossier.

All of these remain deterministic **pre-valuation review** controls. They neither authenticate any source record nor authorize market valuation. Real Saudi transaction/license/parcel evidence, independent professional acceptance, UAT and release decision remain externally OPEN.
