# STARTAK RE — exact-head expanded verification plan (23 Nov 2026)

**Target:** draft PR #818, the exact proposed source SHA, not the unrelated default `main` or a synthetic fixture presented as real Saudi sale data.

**Decision semantics:** *Engineering PASS* is a set of tested code and browser properties. It is **not** production authorization, licensed market-valuation certification, real-source data rights, or independent signer validation. The master HOLD gate in `tools/verify-all-stages.mjs` remains in force.

## 1. Why this suite is necessary
- The repository has 132 GitHub workflow definition files, but this does **not** establish 132 passes at the current candidate.
- `comprehensive-verify.yml` and `deep-platform-verify.yml` are filtered to pull requests targeting `main`. PR #818 currently targets PR #817's development branch and therefore their checks are absent from its exact-head status.
- Dedicated `release-verify.yml` tests 652 discovered regressions, build, and packaging, while `one-batch-qualification.yml` runs 14 engineering stages and then intentionally exits **2** for external HOLD.

## 2. Engineering matrix (all must be evidenced on one immutable candidate SHA)

| ID | Test focus | Executable / workflow | Claim permitted |
|---|---|---|---|
| E01 | Defect and architectural regression, production build, package, audit | `npm run release:verify` | Locked source code build and registered regressions pass |
| E02 | Randomized financial precision & invariants (5 seeds), fail-closed lifecycle, neutrality | `node tools/deep-platform-verify.js` | Synthetic/metamorphic behavior only |
| E03 | Playwright core and complete UI flows, desktop/mobile, keyboard/UX, document intake | `node tools/deep-platform-verify.js` plus `tools/comprehensive-verify.js` | Selected browser/task flows pass locally in CI |
| E04 | Authenticated cross-tenant API/object isolation, JWT identity, forged roles, HTTP negatives | `node tests/architecture/run_tenant_boundary_security_v1.js` and authenticated-workspace tests | Disposable CI objects only, not real users/tenant isolation |
| E05 | Real PostgreSQL 16 Row Level Security negative cases | `tools/security/generate-isolated-postgres-rls-fixture.js` | Isolated CI database only |
| E06 | Professional decision and regulatory gate negatives, QCR HOLD semantics | `tests/architecture/run_e2g_*.js`, `run_e2i_*.js`, `run_production_readiness_audit_v1.js` | Forgeries/rejected states fail closed |
| E07 | Legacy 57 manifest integrity and 17+4 fixture *synthetic* math contract | `run_legacy_57_manifest_integrity.js`, `run_private_golden_residual_reference_v1.js` | Structural manifest, arithmetic contract only; not feature or real-source parity |
| E08 | All GitHub targeted property market/source/locale/financial workflows | Exactly matching commit-specific GitHub Actions | Only the individual checked scope |
| E09 | One Batch engineering stages | `node tools/verify-all-stages.mjs` | Full-engineering PASS still yields external HOLD |

**Workflow:** `.github/workflows/startak-re-exact-head-matrix.yml` runs E02–E07 independently of PR base-branch targeting. It has read-only repository permissions, no production secrets, no deployment action, no source-data download, and uses an exact SHA checkout.

## 3. External verification matrix — required before merge into main / launch

| Gate | Real proof required | Present at start of plan |
|---|---|---|
| X01 — Q01 | Dataset-by-dataset rights + verified real executed sales with original issuer, date, area, interest | NOT PROVEN |
| X02 — Q02 | Sealed independent Saudi holdout protocol, real labels and error metrics signed by an independent qualified reviewer | NOT PROVEN |
| X03 — #774 | Authorized raw 17-case fixture + 4 auxiliary original cases; compare actual STARTAK engine/save/export outputs and IRR source, without public GitHub disclosure | BLOCKED |
| X04 | Two real authenticated tenants, deployed RLS/API tests, privacy/security review and signed findings closeout | NOT PROVEN |
| X05 | Full source-to-function parity for legacy 57 manifest and retiring 10 staging/1 insecure crypto contracts | NOT PROVEN |
| X06 | Production infrastructure + rollback/backup/restore/monitoring and live AI provider with permitted receipts and redaction controls | NOT PROVEN |
| X07 — Q12 | Signed separate legal/professional/technical owner reviews, real UAT, decision minutes identifying release SHA/artefact, GO and rollback authority | NOT PROVEN |

**Do not** invent artefacts, authorized source credentials, original byte signatures, completed external requests, independent approvals, test receipts, or user acceptance. No synthetic data or CI green can satisfy X01–X07.

## 4. Exact-head acceptance and reporting protocol
1. Record the final PR `head_sha`, compare against `main` and the stacked PR base.
2. Require each expanded E02–E07 CI job to show PASS, or open a blocking defect with exact workflow ID/log.
3. Require all pre-existing targeted checks and `release:verify` PASS on the **same final SHA**. If a change is made, requalify that SHA.
4. Record the separate `One Batch` internal status and its external decision as separate fields. Treat exit 2 HOLD as **not an engineering defect** and **not a production pass**.
5. Keep PR #818 draft, `main` unchanged, and production untouched until every applicable X gate has an authentic, independently verified signed reference and required human authorization.
6. Archive non-sensitive check IDs / source SHA in master issue #622. Keep raw licensed property/tenant documents off public GitHub.

**Governance status:** `HOLD_NOT_AUTHORIZED` until external gate completion. This document does not grant permission to deploy.