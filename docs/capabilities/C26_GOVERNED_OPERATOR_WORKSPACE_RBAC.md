# C26 — Governed Operator Workspace & RBAC

## Purpose
C26 exposes the governed case/property state to human operators without allowing the workspace or role model to override deterministic C24/C25 results or grant transaction, approval, deployment, Public AI, commercial go-live or canonical-baseline authority.

## Roles
- `VIEWER`: view case and evidence only.
- `ANALYST`: viewer permissions plus evidence requests, analyst notes and draft-report requests.
- `REVIEWER`: analyst permissions plus human review disposition and HOLD acknowledgement.
- `APPROVER`: reviewer permissions plus human-review acknowledgement. The role name does **not** grant `APPROVAL_AUTHORIZED`; that flag remains false.
- `OPS_ADMIN`: view, HOLD acknowledgement and operational triage only.

## Integrity and context
Every operator session binds user, role, case, property, authorization evidence, validity window, role-permission-set SHA-256 and session SHA-256. Every action binds the session SHA-256, exact case/property, action type, payload SHA-256, request timestamp and action SHA-256.

Evaluation fails closed on tampering, expiry, cross-case/property access, session mismatch, unknown role/action, permission escalation or authority-injection fields.

## Deterministic decision boundary
The workspace consumes a governed case snapshot containing the upstream result SHA-256. `deterministicStateAfter` is always exactly the upstream deterministic state. Human notes, dispositions and acknowledgements cannot transform `HOLD` or `NOT_EVALUATED` into approval.

## Audit
Each evaluated action emits an immutable audit envelope with exact session/action/case-result hashes and its own SHA-256. Re-evaluation of the exact same inputs is deterministic.

## Authority posture
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `PRODUCTION_DEPLOYMENT_AUTHORIZED = FALSE`
- `COMMERCIAL_GO_LIVE = HOLD`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `AUTONOMOUS_ACTION_EXECUTED = FALSE`

C26 is an operator-control layer only. It does not merge, deploy, submit filings, place bids, move funds, accept legal terms, activate Public AI or authorize a real-estate transaction.