# STARTAK Real Estate — Saved Deal index/record consistency gate

**Date:** 2026-11-13. **Scope:** local personal-research sidecar persistence; **release decision:** HOLD_NOT_AUTHORIZED.

## Evidence of the gap
The Saved Deal selector reads `deals-index`, but `readCanonicalDeal` only checked whether the selected ID occurred *at least once* before reading `deal:<id>`. The canonical record may have been partially renamed, or the index may contain duplicate instances of an ID. A study whose declared property name matches the canonical record could then be stored/reloaded under a selector that displays another property name. The previous #799 gate bound the sidecar subject to the canonical record name, but did **not** ensure the indexed selection reflected that same record.

## Fail-closed boundary
- The index must be an array of no more than 5,000 items.
- An ID used by sidecar read/write must appear in exactly one indexed entry. Missing ID continues to fail; repeated ID yields `SAVED_DEAL_INDEX_DUPLICATE_ID`.
- The indexed entry's property name and the canonical record's property name must both be nonblank and match after conservative Unicode NFKC, whitespace normalization and Arabic-aware case normalization; failure yields `SAVED_DEAL_INDEX_RECORD_NAME_MISMATCH`.
- The owner selector itself rejects duplicate valid IDs instead of presenting two indistinguishable options.
- The owner save and restore interface displays a localized remediation message for stale/duplicate-index conflicts; raw internal error codes remain diagnostic rather than decision-relevant content.
- The earlier, independent `SIDECAR_SAVED_DEAL_SUBJECT_NAME_MISMATCH`, appraisal-link review and asset-mode controls still apply, as do the input-only/unapproved envelope constraints.

## Synthetic acceptance criteria
- Rejected: stale index name while canonical record name matches the study; duplicate indexed IDs on write, restore and owner selector; stale index after a previously valid sidecar save.
- Accepted: a unique ID with consistent property names after benign normalization.
- Real Chromium user journey: mutate local synthetic index after saving, confirm restore blocked for stale name and duplicate ID, restore original index and confirm positive restoration. No canonical Saved Deal record writes from the research feature.
- Exact GitHub commit must pass sidecar characterization, saved-deal architecture test, real owner/browser study, D04 locale and canonical Release Verify.

## Limits
Index/name agreement is **not** proof of physical/legal title, unit-level identity, parcel or plan number, legitimate source license, tenant/organization access, third-party consent, licensed appraisal, or market value. Indexed records can be stale due to ordinary app errors and require deliberate correction, not guessing. This solution has no multi-device transaction, server-side database consistency guarantee or external signature. Real 17+4 gold-property parity, Q01–Q12 independent evidence, production IAM and authorization to publish remain open. No change to main, merge or deployment.
