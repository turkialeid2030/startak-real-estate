# P30 — Reviewer Lifecycle Lock

P30 enforces the boundary implied by P28/P29: the owner may replace the workflow reviewer only before an independent review has been accepted.

## States

- `REVIEWER_MUTABLE_PENDING_INDEPENDENT_REVIEW` — no P27 verified review is bound to the current designation; the owner may append a replacement designation.
- `REVIEWER_LOCKED_BY_VERIFIED_REVIEW` — a P27 cryptographically verified review response is bound to the exact P26 packet and current P29 designation; reviewer replacement is frozen for that governance path.
- `HOLD_REVIEWER_LIFECYCLE` — stale packet, wrong reviewer, wrong designation or incomplete cryptographic guarantees.

The lifecycle lock checks the P29 current designation hash, P26 review-packet hash, effective reviewer reference, and P27 reviewer/trust/signature guarantees together. A review for an earlier reviewer cannot be carried forward after the owner changes the reviewer.

The current reviewer remains `سعيد المراجع` (`reviewer:saeed-pending`) until the owner replaces that designation or a verified review locks it.

P30 does not activate the canonical baseline and grants no release, merge, deployment, go-live or transaction authority.
