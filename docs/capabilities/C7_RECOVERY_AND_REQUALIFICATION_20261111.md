# STARTAK C7 — Controlled restoration and requalification of correlated Monte Carlo

**Date:** 2026-11-11  
**Scope:** standalone owner-research computation on a **staging branch only**; **not** an owner UI activation, certified valuation, automated decision, or production release.

## Exact provenance and evidence

- Immutable qualified C7 source: [PR #485](https://github.com/turkialeid2030/startak-real-estate/pull/485), SHA `a4f10e81366ea0f2887ddfcaa2b4bd2d4d123c8d`.
- Staging parent: [PR #777](https://github.com/turkialeid2030/startak-real-estate/pull/777), SHA `ba7c211f61305511a6ed4989dfbbb892dd99bc01`.
- Dependency check, original/current **identical Git blobs**:
  - `src/uncertainty/monte-carlo-governance.js`: `e71e6a4cfc636f8c52f30c59ad38745dafff647d`.
  - `src/scenario-risk/index.js`: `39390264fabb3a19021940c0903370dc5153e7eb`.
- Restored source blobs, **byte-identical to original C7**:
  - `src/scenario-risk/correlated-monte-carlo.js`: `2a7c205dc239ddd61d609894df4c36c97f1da93d`.
  - `src/uncertainty/correlated-monte-carlo-governance.js`: `7ea7be971a0f36467933daa1b37841f256d8f266`.
- Restored C7 regression test (original blob `92def8005f5670d9e29c50635e57e19fd65e1f7b`).
- Dedicated C7 CI workflow uses pinned checkout/setup-node actions; it runs C7 regression, legacy P7 Monte Carlo regression, build/release checks and a UI non-activation assertion.

## What the restored capability actually computes

Explicitly reviewed Gaussian-copula / triangular marginal correlation, ordered variables and PSD matrix validation, reproducible seeded samples, percentiles, tail probabilities and thresholds. The plan requires input source hashes, reviewer/date, distribution freshness and correlation-model integrity. Invalid or unsupported evidence **fails closed**; there is no nearest-PSD repair or automatic correlation inference.

The original *independent* Monte Carlo module and independent-only governance remain **untouched**. The correlated function is called only through explicit standalone API and its separate governed plan, not by altering existing `runMonteCarlo` or canonical property financial results.

## Hard boundaries

- `COMMERCIAL_GO_LIVE = HOLD`.
- `TRANSACTION_AUTHORITY = FALSE`.
- `APPROVAL_AUTHORIZED = FALSE`.
- `PUBLIC_AI = FALSE`.
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`.
- The deterministic outputs are **model-conditioned scenarios**. Correlation estimates without actual evidence are not predictions, objective probabilities, price certification or investment recommendations.
- No real personal/tenant/private source files, AI provider credentials or production database connections are introduced.
- No changes to `main`, the deployed Cloudflare application, frontend routing, deal storage, licensed reports or the economic investment engine.

## Acceptance and open follow-up

1. Require exact-SHA C7 workflow and independent Release Verify PASS; record failed tests and repair without altering historic baseline.
2. Confirm no regressions against the modern independent-only paths, even when source distributions have an unwanted correlation assumption.
3. Before UI activation: add a separately reviewed owner workflow that obtains source-supported correlation assumptions and discloses sensitivity, model risk and missing evidence. Validate the result on genuine owner cases and multi-browser tests.
4. Professional/certified valuation, Saudi market source rights, application data residency, producer KMS/tenant authentication and release signoff remain separate existing open gates in #622/#747/#765.
5. A branch/PR being present does **not** prove functional owner UI parity or production parity.

**Current verdict:** `C7_CODE_RECOVERED_UNQUALIFIED_ON_MODERN_HEAD` until this PR's own exact-SHA CI succeeds. Keep #484 open until owner-workflow integration and independent source evidence are actually verified.
