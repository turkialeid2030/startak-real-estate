# C46 — Internal Security Review and Hardening

## Purpose

C46 performs a bounded internal engineering/security review on top of the qualified C45 head. It closes repository-level security-control drift that can be proven internally and prepares the candidate for the independent security authorization required by C30 issue #545.

Base C45 qualified head:

`4318c411a8dd41629f0f26c0d715615f5cdaef08`

C46 does not impersonate the independent security reviewer and does not convert internal CI evidence into production-security certification.

## Internal findings and remediation

### C46-F-001 — CSP documentation drift

Severity: **Medium**  
Disposition: **Remediated**

`CSP_POLICY.md` previously described a narrower policy than the actual shipped `public/_headers` artifact. The actual artifact permits Cloudflare Challenges in `script-src`, `connect-src`, and `frame-src`, and permits the governed Sentry ingestion endpoint in `connect-src`.

C46 synchronizes the documentation with the shipped artifact and adds a deterministic regression check requiring the documented CSP line to remain identical to `public/_headers`.

This does not prove live CDN/edge enforcement. `LIVE_EDGE_HEADER_ENFORCEMENT_VERIFIED` remains `FALSE` until response headers are captured from the exact deployed build.

### C46-F-002 — Mutable action references in Wave17A security workflow

Severity: **Medium**  
Disposition: **Remediated**

The Wave17A security qualification workflow used mutable major-tag action references. C46 pins the security workflow to immutable 40-character action commit SHAs, disables persisted checkout credentials, and explicitly limits the workflow token to `contents: read`.

C46 applies the same immutable-action and least-privilege requirements to its own workflow.

## C46 verification scope

The C46 workflow requires all of the following on the same checked-out PR head:

- C46 policy/evidence regression.
- Wave17A security qualification evidence regression.
- PostgreSQL RLS runtime-probe contract tests.
- Controlled staging API security qualification contract tests.
- Independent security/UAT evidence-gate contract tests.
- Public-AI security contract tests.
- Cloudflare production-secret boundary tests.
- Dependency audit with no accepted vulnerability threshold above zero (`npm audit --audit-level=low`).
- Production build and package verification.
- Canonical `release:verify`.
- Exact PR-head checkout assertion.

These are repository/CI and deterministic contract checks. Where a test models staging or production evidence, it remains a contract test unless the test itself explicitly executes against a real target environment.

## Preserved fail-closed boundaries

The current security composition layers retain the following semantics:

- missing or mismatched identity/RLS/authorization/audit evidence results in HOLD;
- Critical/High independent-review findings must be resolved before the production-security evidence pack can be complete;
- readiness may advance only to independent security review/validation readiness;
- internal modules do not certify production security;
- human/independent security approval remains required;
- no transaction, merge, deployment, or commercial go-live authority is granted by C46.

## External gate

Issue #545 remains the authoritative external security gate.

C46 explicitly records:

- `C46_EXTERNAL_SECURITY_AUTHORIZED=FALSE`
- `C46_GATE_545_SATISFIED=FALSE`
- `C46_DEPLOYMENT_AUTHORIZED=FALSE`
- `C46_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE`

The independent reviewer must supply traceable evidence bound to the exact release candidate/build, including review scope, reviewer authority, Critical/High disposition, residual risks, review date, durable evidence reference and immutable artifact hash. Where required by the production-security gate, independent penetration-test evidence and live runtime evidence must also be present.

## Internal decision

Subject to the C46 workflow passing on the exact candidate head:

`READY_FOR_INDEPENDENT_SECURITY_REVIEW`

This is an engineering readiness classification only. It is not `PRODUCTION_SECURITY_APPROVED` and not deployment authorization.
