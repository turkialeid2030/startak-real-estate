# C7 — Governed Correlated Monte Carlo

## Purpose

C7 adds a governed correlated-risk simulation path above the existing Startak Real Estate risk stack. It is additive: it does not replace, relax, or silently modify the existing independent Monte Carlo engines or the `INDEPENDENT_ONLY_V1` governance contract.

## Dependency

C6 technically qualified head:

`9f234980efaafb6d1cba66fb54a7190b82284782`

## Sampling model

C7 uses `GAUSSIAN_COPULA_TRIANGULAR_V1`:

1. deterministic seeded standard-normal draws;
2. a reviewed correlation matrix is factorized without automatic repair;
3. correlated normals are produced through the matrix factor;
4. normal CDF values are mapped to uniform probabilities;
5. each probability is mapped through the inverse CDF of the corresponding reviewed triangular marginal;
6. the deterministic evaluator produces the analytical metric distribution.

The output is conditional on the supplied marginals, correlation assumptions, and evaluator. It is not a forecast or guarantee.

## Correlation hard gates

The correlation model fails closed when any of the following applies:

- variable identifiers are absent or duplicated;
- variable ordering does not match the governed distribution ordering;
- matrix dimensions do not match the ordered variables;
- a matrix element is non-finite;
- a coefficient is outside `[-1, 1]`;
- a diagonal element differs from `1` beyond the numerical tolerance;
- the matrix is asymmetric beyond the numerical tolerance;
- the matrix is not positive semidefinite;
- integrity hashing fails;
- evidence/source references, rationale, preparation/review metadata, or as-of controls are missing;
- the model is stale under the configured maximum-age policy.

C7 does **not** apply nearest-positive-semidefinite repair and does not infer correlations automatically.

## Governance objects

### Qualified correlation model

`C7_GAUSSIAN_COPULA_CORRELATION_V1`

Carries the exact ordered variable list, matrix, methodology, rationale, evidence references, as-of date, preparer/reviewer metadata, review timestamp, and SHA-256 integrity hash.

### Governed simulation plan

`C7_GOVERNED_CORRELATED_MONTE_CARLO_PLAN_V1`

Binds:

- case and property identity;
- exact base-input hash;
- reviewed marginal distributions;
- exact qualified correlation model;
- evaluator identity/version;
- metric identity/unit;
- iteration count and deterministic seed;
- distribution and correlation freshness policies;
- governed analytical thresholds;
- authority boundaries.

### Governed result

`C7_GOVERNED_CORRELATED_MONTE_CARLO_RESULT_V1`

Returns deterministic analytical distribution metrics including mean, standard deviation, P05/P50/P95, min/max, probability below zero, and configured threshold probabilities. The result is hash-bound to the plan and qualified correlation model.

## Compatibility boundary

The existing `src/scenario-risk/index.js::runMonteCarlo` path is unchanged. The existing `src/uncertainty/monte-carlo-governance.js` contract remains `INDEPENDENT_ONLY_V1` and continues to reject supplied correlation assumptions. C7 is exposed through dedicated modules so the legacy independent path cannot silently become correlated.

## Authority boundary

C7 is analytical decision support only:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- no automatic investment decision
- no external issuance authority
- no final, licensed, or certified valuation conclusion

## Qualification gate

The dedicated C7 workflow must pass on the exact candidate head:

1. C7 governed correlated Monte Carlo regression;
2. legacy Monte Carlo regression;
3. canonical `npm run release:verify`.

The branch and pull request remain Draft / Merge Hold until a later explicit authorization.