# Wave 16B — Tail-Risk & Explicit Threshold Analytics

## Purpose

Wave 16B adds probability analysis against explicit, caller-supplied decision thresholds on top of the governed Monte Carlo plan from Wave 16A.

It does not invent hurdle rates, derive an investment approval, modify a professional valuation conclusion, or authorize a transaction.

## Core simulation extension

The existing Monte Carlo engine now accepts optional explicit threshold conditions while preserving its previous output shape when no thresholds are supplied.

Supported operators:

- `BELOW`
- `AT_OR_BELOW`
- `ABOVE`
- `AT_OR_ABOVE`

For each threshold, the engine reports the simulated frequency with which the stated condition is met. This is a conditional analytical frequency, not a forecast or guarantee.

## Threshold governance

Every threshold is immutable and SHA-256 addressed and records:

- threshold id and kind;
- metric code and unit;
- explicit operator and numeric value;
- rationale;
- optional policy reference;
- non-empty evidence references;
- preparer, reviewer and review timestamp;
- an explicit marker that the threshold was caller supplied and not invented by the system.

The threshold metric and unit must match the governed Monte Carlo plan. Empty threshold sets, duplicate thresholds, tampered thresholds, scope mismatches and parent Monte Carlo HOLD states fail closed.

## Execution binding

Threshold analytics are bound to the exact Wave 16A Monte Carlo plan id/hash and exact base-input hash. Execution reuses the same governed distributions, evaluator provenance, iterations and seed.

Outputs include:

- mean, P05, P50, P95, min and max;
- P05–P95 tail range;
- probability below zero;
- probability that each explicit threshold condition is met and not met.

## Decision boundary

Threshold probabilities do not create an approval/rejection state. They are evidence for human investment-committee judgment.

The following remain invariant:

- `decisionStateDerived=false`
- `automaticInvestmentDecisionAuthorized=false`
- `humanCommitteeDecisionRequired=true`
- `professionalValuationConclusionModified=false`
- `externalIssuanceAuthorized=false`
- `transactionAuthorized=false`

Operating mode remains `UNLICENSED_DECISION_SUPPORT`.

## Correlation boundary

Wave 16B inherits Wave 16A's `INDEPENDENT_ONLY_V1` restriction. Correlated sampling remains unsupported and must not be inferred from threshold probabilities.
