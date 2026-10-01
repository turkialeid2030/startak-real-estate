# C26 Integrated Case Review UI Closure

## Purpose

This closure implements the previously open integrated React review surface required by Issue #528 above the exact qualified C29 chain. It is a presentation and human-review boundary only. It does not create investment approval, transaction authority, Public AI authorization, production deployment authority, or commercial go-live authority.

## Evidence-first behavior

- The UI loads an exact local JSON review bundle; it never backfills missing governed values with defaults.
- The C24 result hash is recomputed and must be valid before any trusted case result is rendered.
- C24 `HOLD` and `NOT_EVALUATED` states are preserved exactly and cannot be upgraded by presentation or reviewer actions.
- The bundle must carry the complete set of C24 result, stage packet, stage output, input and lineage SHA-256 hashes referenced by the supplied C24 result.
- Case/property scope must match across the C24 result, the access grant and any AI draft envelope.
- Invalid, tampered, expired or cross-context bundles fail closed and expose no trusted case data.

## Access control

The UI contract supports only `VIEWER`, `ANALYST` and `REVIEWER` presentation roles. Each access grant is bound to:

- subject reference;
- case and property scope;
- exact permission set for the role;
- authorization evidence SHA-256;
- issue and expiry timestamps;
- a deterministic access-grant SHA-256.

A browser role string by itself is not sufficient. The full hashed access grant must verify at the evaluation time.

## Human review dispositions

Only these non-authoritative dispositions exist:

- `ACKNOWLEDGED`
- `RETURN_FOR_EVIDENCE`
- `REJECT_DRAFT`

There is deliberately no `APPROVE`, `GO_LIVE` or `TRANSACT` disposition. A recorded disposition preserves the deterministic C24 state before and after review.

## AI presentation boundary

AI text is rendered only when its supplied validation status is `GROUNDED_REVIEW_READY`, its response and grounding hashes are valid, and every grounding evidence hash is already present in the governed evidence register. All rendered AI text is marked `DRAFT / HUMAN REVIEW REQUIRED`.

If the AI status is `HOLD` or `NOT_EVALUATED`, the contract forbids carrying draft text or fabricated grounding evidence into the review envelope.

## Draft export governance

A review export is explicitly classified `DRAFT / NOT AN APPROVAL` and exact-binds:

- C24 result hash;
- presentation hash;
- access-grant hash;
- review-record hash when a review exists;
- AI draft hash when present;
- locale;
- evidence-hash register.

The export retains all authority flags as false and `COMMERCIAL_GO_LIVE = HOLD`.

## Production React wiring

`IntegratedCaseReviewPanel` is imported and rendered by `src/main.jsx`. The dedicated regression asserts both the import and the live JSX wiring, while the production build validates bundling of the browser-safe Web Crypto SHA-256 implementation.

## Qualification

The dedicated workflow executes:

1. exact candidate-head assertion;
2. integrated review fail-closed regression;
3. inherited C26 operator-workspace RBAC regression;
4. inherited C29 shadow/UAT harness regression;
5. production build;
6. package verification;
7. dependency audit;
8. canonical release verification.

## Authority boundary

- `MERGE HOLD = ON`
- `DEPLOY = NO`
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
