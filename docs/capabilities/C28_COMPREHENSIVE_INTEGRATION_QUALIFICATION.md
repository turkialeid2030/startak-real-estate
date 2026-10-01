# C28 — Comprehensive Integration Qualification

## Purpose
C28 freezes one exact integration candidate and requires explicit evidence for every technical qualification gate. It also exercises the C24 case state through C26 RBAC and C27 telemetry to prove that human workspace and observability layers do not upgrade deterministic state or grant authority.

## Identifier integrity
The exact candidate head is a Git commit SHA in its repository-native 40-hex form. Evidence, payload, result and qualification-record integrity values remain SHA-256 in 64-hex form. C28 validates these two hash domains separately and does not substitute a synthetic SHA-256 value for the actual Git head identifier.

## Mandatory technical gates
- full regression discovery;
- production build;
- package verification;
- npm audit release threshold;
- canonical baseline registry;
- canonical release verification;
- C23 AI grounding;
- C24 case/property orchestration;
- C25 source readiness;
- C26 RBAC;
- C27 observability.

Technical gates cannot be recorded as `NOT_EVALUATED`. PASS/FAIL evidence requires an evidence reference, SHA-256 and observation time bound to the same candidate Git head.

## External gates
Composite/fresh/successor shadow, cutover safety, canonical external source hash, security/privacy approval, live-AI-provider authorization and UAT/professional review can remain `NOT_EVALUATED` only with an explicit reason and **without fabricated evidence fields**.

## Status semantics
- any technical failure -> `HOLD_FAILURE`;
- missing technical gate -> `HOLD_EVIDENCE`;
- tamper/head mismatch/duplicate/future evidence -> `HOLD_INTEGRITY`;
- all technical gates pass but external evidence remains open -> `TECHNICALLY_QUALIFIED_EXTERNAL_ITEMS_OPEN`;
- technical qualification never grants production, transaction, approval, Public AI, commercial go-live or canonical activation authority.

No new pass threshold is invented by C28. The repository's existing release gates remain authoritative.