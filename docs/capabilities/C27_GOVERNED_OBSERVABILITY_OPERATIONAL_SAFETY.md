# C27 — Governed Observability & Operational Safety

## Purpose
C27 adds deterministic operational telemetry without confusing service health with investment, evidence, approval or transaction readiness.

## Event governance
Telemetry events bind event type, severity, time, correlation reference, optional exact case/property scope, request/session references, source component, technical health, externally supplied business-readiness state, error class and a redacted payload. The serialized event receives a SHA-256 integrity hash.

## Redaction
Known secret and direct-identifier key classes are replaced before event hashing/serialization. Raw passwords, secrets, tokens, authorization values, API keys, private keys, national IDs, Iqama values, email addresses and phone/mobile values are not intentionally retained in the governed payload. This is key-based deterministic redaction; it does not claim free-text DLP completeness.

## Metrics
Only governed metric names are accepted: source stale/outage counts, AI blocked-output count, RBAC denial count, replay-conflict count and kill-switch state. Every metric observation requires an evidence reference and SHA-256. C27 never fabricates a metric value.

## Health boundary
Technical service health is evaluated separately from observed upstream business readiness. A technically healthy service can still carry `HOLD`; C27 never promotes that state. Kill-switch engagement degrades technical state and never grants authority.

## Authority posture
C27 always returns transaction, approval, Public AI, production deployment and canonical-baseline activation authority as false, with `COMMERCIAL_GO_LIVE = HOLD`. Observability cannot override deterministic case state.