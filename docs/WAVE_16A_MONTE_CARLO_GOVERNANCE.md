# Wave 16A — Governed Monte Carlo Uncertainty Analysis

## Purpose

Wave 16A governs the existing deterministic Monte Carlo capability so simulation assumptions cannot become decision outputs merely because numeric distributions were supplied.

The simulation remains an investment/uncertainty analytics layer. It does not alter a professional valuation conclusion and does not authorize an investment or transaction decision.

## Distribution governance

Every distribution is immutable and SHA-256 addressed. A qualified distribution records:

- variable key and unit;
- distribution family and parameters;
- evidence/source references;
- as-of date and explicit freshness policy;
- rationale and confidence;
- preparer, reviewer and review timestamp;
- explicit acknowledgement of the V1 independence assumption.

V1 supports triangular distributions only. Unsupported distributions fail closed.

## Correlation boundary

The existing simulation engine samples variables independently. Wave 16A therefore does **not** accept a correlation assumption as if it were implemented.

`INDEPENDENT_ONLY_V1` is the only supported correlation policy. If correlation assumptions are supplied, the governance plan is placed on HOLD with `CORRELATION_MODEL_UNSUPPORTED_BY_V1_ENGINE`.

A future wave must implement and separately qualify a correlation model before correlated results can be produced.

## Execution binding

A governed simulation plan binds:

- case and property;
- analysis date;
- exact SHA-256 of base inputs;
- evaluator reference and version;
- metric code and unit;
- reviewed distributions;
- iterations and random seed.

Execution refuses a modified plan or a changed base-input payload. Identical governed inputs and seed reproduce identical summary outputs.

## Output semantics

Outputs include mean, P05, P50, P95, min, max and probability below zero. They are conditional on the reviewed distributions and deterministic evaluator.

They are **not** a prediction, guarantee, professional valuation conclusion or automatic investment recommendation.

The following remain false:

- `professionalValuationConclusionModified`
- `automaticInvestmentDecisionAuthorized`
- `externalIssuanceAuthorized`
- `transactionAuthorized`

Operating mode remains `UNLICENSED_DECISION_SUPPORT`.

## Non-production boundary

This wave is engineering qualification only. It does not merge to `main`, deploy, authorize BUY/SELL/APPROVE/REJECT actions, activate professional standards, or establish licensed valuation authority.
