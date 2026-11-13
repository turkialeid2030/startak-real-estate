# STARTAK Real Estate — Case-Bound Report Evidence Hardening
**Date:** 2026-11-13 · **Repository:** `turkialeid2030/startak-real-estate` ONLY.

## Defect identified in recovered historic report builder
Previously, `evaluateGovernedValuationReportReadiness` in `src/decision-governance/valuation-report-export.js` checked evidence source dates but did not require:
- `runtime.caseId` to match the valuation evidence's `valuationCase.caseId`.
- `runtime.projectId` and `valuationCase.projectId` to match if either exists.
- explicit, nonblank `sourceType` and `sourceRef` for **every** evidence descriptor.
- the evidence descriptor's source-verification status to be `VERIFIED` before emitting a source-backed **analytical** report.
- all evidence entries to be typed objects instead of silently dropping invalid entries.

**Impact:** In an isolated call to this recovered report API, a fresh dated record from a different case could support a report with the current case's identity. A descriptor with no sourceRef could also pass solely because its property key and date were present. This is a provenance and case-scope risk; no live owner/external data leak has been observed or asserted.

## Remediation
1. Fail closed with `REPORT_CASE_BINDING_REQUIRED` and `REPORT_CASE_BINDING_MISMATCH`.
2. Fail closed with `REPORT_PROJECT_BINDING_REQUIRED` and `REPORT_PROJECT_BINDING_MISMATCH` when either side declares a project/tenant.
3. Fail closed with `REPORT_EVIDENCE_SOURCE_PROVENANCE_REQUIRED`, `REPORT_EVIDENCE_DESCRIPTOR_INVALID`, and `REPORT_EVIDENCE_STATUS_NOT_VERIFIED`.
4. Preserve the earlier stale/future/undated source blocks. No automatic source selection, value adjustment or cashflow change.
5. Add a negative source-level regression for wrong case, wrong tenant, missing case/project, blank sourceType/sourceRef, unverified claims and malformed evidence.
6. Check the exact source SHA in GitHub Actions and run canonical Release Verify.

**Important limitation:** `status='VERIFIED'` is a *data field declared by the caller*, NOT an independent official-record authentication, legal source permission or an approved professional appraisal. The builder remains isolated; no live owner save/export UI has been activated. This fix cannot substitute for server-authenticated tenant and provider rights checks, human licensed-valuer sign-off, signed UAT, and production release authorization.

`REPORT_SOURCE_BINDING=SOURCE_TEST_REQUIRED`, `EXTERNAL_PROVIDER_AUTHENTICITY=NOT_PROVEN`, `P25_FULL_ECONOMIC_OVERRIDES=OPEN`, `17_PRIVATE_REAL_CASE_ENGINE_PARITY=OPEN`, `MAIN_UNCHANGED`, `COMMERCIAL_GO_LIVE=HOLD_NOT_AUTHORIZED`.

## Additional scope-identity hardening — 13 November 2026

The previous projectId check did not cover a separately declared `tenantId` or
`organizationId`. Two tenants can reuse the same project or case identifiers
within separate identity namespaces. This independent follow-up explicitly
checks the symmetric binding for both fields: when either the runtime or the
valuation case carries an identifier, both must carry the exact same nonblank
identifier. A missing side fails with `REPORT_TENANT_BINDING_REQUIRED` or
`REPORT_ORGANIZATION_BINDING_REQUIRED`; a mismatch fails with
`REPORT_TENANT_BINDING_MISMATCH` or
`REPORT_ORGANIZATION_BINDING_MISMATCH`.

When any evidence descriptor declares `caseId`, `projectId`, `tenantId`
or `organizationId`, it must match the surrounding valuation case's exact
nonblank identifier. Spoofed, malformed or unmatched descriptor identifiers
fail with `REPORT_EVIDENCE_<SCOPE>_BINDING_MISMATCH` instead of inheriting
case-level trust. Synthetic adversarial tests cover missing, mismatched and
nonstring claims and the non-authorizing analytical export response.

**Scope limitation:** This additional check does not invent identity when both
records omit tenant/organization fields. It cannot authenticate a caller-supplied
`VERIFIED` flag and does not connect to live IAM or an encrypted vault.
`src/decision-governance/valuation-report-export.js` remains isolated from
the production owner application. Actual authenticated tenant-scoped custody,
independent source-rights confirmation, professional review and Q01–Q12 remain
mandatory; no main merge or Cloudflare release is authorized.
