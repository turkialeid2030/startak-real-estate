# C6 — Browser E2E & Controlled Human Review

## Purpose

C6 adds a controlled human-review layer above the qualified C4/C5 analytical decision stack. It records a reviewer recommendation as immutable governance metadata and proves the user flow in a real Chromium browser.

C6 does **not** create approval, transaction authority, commercial go-live, public-AI authority, or a final/licensed/certified valuation.

## Dependency

Qualified dependency base:

`c5-governed-decision-ui-export-integration` @ `c4dbc6e65b7f0a615dd3ddb54958f242b5ac2eed`

## Human-review record

Schema: `C6_GOVERNED_HUMAN_REVIEW_V1`

The review records:

- reviewer ID
- one controlled recommendation
- rationale
- reviewed-at timestamp
- exact C4 decision-snapshot SHA-256
- exact material saved-deal-state SHA-256
- deterministic review SHA-256

Allowed recommendations are limited to:

- `CONTINUE_DUE_DILIGENCE`
- `REQUEST_MODIFICATION`
- `HOLD_FOR_EVIDENCE`
- `DO_NOT_ADVANCE`

Approval-like actions such as `APPROVE`, `BUY`, `SELL`, `INVEST`, transaction execution, or authority escalation are not valid C6 recommendations.

## Single-review rule

C6 is fail-closed against ambiguous dual review authority:

- if a C6 review already exists, it cannot be replaced in place;
- if the upstream C4 decision snapshot already contains a human review, a second C6 review is blocked;
- a new review therefore requires a C4 decision snapshot that is ready for human review and has no prior reviewer recommendation.

A later change of recommendation requires a new governed decision/review cycle rather than silent mutation of the historical record.

## Material-state binding

The C5 material saved-deal-state hash excludes presentation-only metadata (`name`, `savedAt`) and governance overlays (`governedDealDecision`, `governedHumanReview`).

This allows the C6 review itself to be added without changing the material state it is intended to attest to. Any economic or valuation-case change produces a different material-state hash and prevents the old C4/C6 governance metadata from being carried forward.

## Persistence boundary

The loaded valuation-case object remains a session-scoped capability token for the exact saved record. C6 persistence:

1. resolves that loaded governed context;
2. re-evaluates current C5 operational freshness;
3. builds the immutable C6 review;
4. binds it to the C4 snapshot hash and saved-deal material-state hash;
5. validates the complete updated record through the canonical Saved Deal structural validator;
6. writes the reviewed saved record through the existing storage provider;
7. refreshes only the session provenance context.

The operation does not alter the saved-deals index or manufacture a new approval state.

## Current-time fail-closed gates

Review recording and reviewed export are blocked if the C4/C5 context is not currently operationally valid, including:

- stale reconciliation evidence;
- future-dated snapshot/reconciliation timestamps;
- invalid/tampered C4 snapshot;
- project/property/case scope mismatch;
- missing valuation-case binding;
- authority escalation;
- invalid or mismatched C6 review hash/bindings.

Historical records may remain loadable for audit, but current review/export authority is re-evaluated at operation time.

## Reviewed export

Schema: `C6_GOVERNED_REVIEW_EXPORT_V1`

The C6 reviewed export:

- retains classification `NON_AUTHORIZING_ANALYTICAL_OUTPUT`;
- includes the immutable C6 review;
- nests a verified C5 governed export;
- cross-binds decision-snapshot and saved-deal-state hashes across C5/C6;
- has its own deterministic export SHA-256;
- carries explicit non-authorizing disclosures.

The verifier independently checks the nested C5 export and the C6 outer hash/bindings.

## Browser E2E proof

The Chromium E2E test uses the real browser-local storage provider and real React UI to prove:

- loading a governed saved deal;
- C6 `READY_FOR_HUMAN_REVIEW` state;
- reviewed export disabled before review;
- reviewer ID/recommendation/rationale entry;
- persistent C6 review creation;
- reload and preservation of the immutable review;
- reviewed governed JSON download;
- non-authorizing authority flags in the downloaded envelope;
- stale governed context producing HOLD with review/export controls disabled.

## Authority boundary

The following remain mandatory:

```text
COMMERCIAL_GO_LIVE = HOLD
TRANSACTION_AUTHORITY = FALSE
PUBLIC_AI = FALSE
CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE
APPROVAL_AUTHORIZED = FALSE
FINAL_VALUATION_CONCLUSION_ESTABLISHED = FALSE
CERTIFIED_VALUATION_ESTABLISHED = FALSE
```

A reviewer recommendation is evidence of a human analytical recommendation only. It is not an approval and does not authorize a transaction.

## Qualification gate

C6 may be described as technically qualified only when the exact PR head passes:

- C6 controlled-review regression;
- C5 governed UI/export regression;
- C4 governed decision/report regression;
- Chromium E2E workflow;
- canonical `npm run release:verify`;
- every other PR-triggered check on that exact head.

Qualification does not authorize merge, deployment, canonical-baseline activation, commercial go-live, transaction execution, or public AI. The PR remains Draft/open/unmerged until separately authorized.
