# MASTER_INDEX
Single entry point. When any two documents disagree, the file listed here as authoritative wins.

## Defect status (authoritative)
- `audit/DEFECT_REGISTER.csv` — the single canonical defect register. All 4 target defects RESOLVED, COV-001 RESOLVED.
- `FINAL_CLOSURE_SUMMARY.md` — the accurate final narrative (supersedes FINAL_DEFECT_REMEDIATION_REPORT.md).
- `DECISION-DEF-001/DEF-001-DECISION-BRIEF.md` — neutral analysis that informed the decision (historical; decision made: Forward NOI Cap for both studies).

## Superseded documents (kept for history, marked with a warning header)
- `FINAL_DEFECT_REMEDIATION_REPORT.md` — reflects D4 only, not the final D6 correction.
- `CHARACTERIZATION_BEHAVIOR_FREEZE.md`, `REBASE_KNOWN_LIMITATIONS.md`, `REBASE_MODEL_ASYMMETRY_CHECK.md` — pre-remediation snapshots.

## Runtime / build
- `RUNTIME_WORKSPACE_INVENTORY.md`, `POST_REBASE_RUNTIME_E2E_REPORT.md`, `POST_REBASE_RUNTIME_CHANGE_MANIFEST.csv` — runtime enablement trail.
- `package.json` scripts: `npm test`, `npm run build`, `npm run dev`, `npm run preview`, `npm run verify:package`.

## Portability
- `tests/config/paths.js` — single path-resolution module (env overrides: `STARTAK_CANONICAL_SOURCE`, `STARTAK_GOLD_BASELINE`, `STARTAK_CHROMIUM_EXECUTABLE`).
- `characterization/reference/platform-source.jsx`, `tests/reference/RE-GOLD-baseline.json` — in-package canonical copies.

## Rebase architecture trail (historical, in chronological order)
`REBASE_UI_CALCULATION_BOUNDARY.md` → `REBASE_APP_DIFF_AUDIT.md` → `REBASE_PRODUCTION_CALCULATION_GRAPH.md` → `REBASE_TRACEABILITY.csv` / `REBASE_C3_TRACEABILITY.csv` → `REBASE_REQUIREMENT_REGISTER.csv` → `REBASE_FINAL_GATE_REPORT.md`. Supporting: `REBASE_CHANGE_MANIFEST.csv`, `REBASE_SAVED_DEAL_SCHEMA.md`, `REBASE_PHASE_REFERENCE_MAPPING.md`, `REBASE_I18N_INVENTORY.csv`, `REBASE_BUILD_READINESS.md`.

## Test suite (22 scripts, all passing as of this index)
`tests/characterization/` (12), `tests/architecture/` (3), `tests/defects/` (5), `tests/runtime/` (1), plus `tests/e2e/core_runtime_e2e.mjs` (6/6) and `tests/e2e/secondary_runtime_e2e.mjs` (7/7).

## Verification
Run `npm run verify:package` for a self-contained proof: build + full regression + zero hardcoded `/mnt/user-data` paths.
