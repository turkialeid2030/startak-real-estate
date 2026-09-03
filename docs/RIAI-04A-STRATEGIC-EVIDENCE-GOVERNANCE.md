# RIAI-04A — Strategic Evidence Governance

## Outcome

This wave hardens the existing lifecycle, location, forward-attraction, upside, decision, and subdivision modules. It does not introduce a parallel strategic engine.

## Fail-closed strategic evidence contract

An adopted `lifecycle.*`, `location.*`, `forward.*`, or `upside.*` input is usable only when all of the following hold:

- its verification status is adoptable;
- confidence is a finite ratio from zero to one;
- `sourceRef` resolves to evidence/source lineage;
- `adoptionDecisionRef` resolves to `UNDERWRITING_ADOPTION` lineage;
- every explicit `lineageRef` resolves;
- its effective date is not later than the operating-case `asOfDate`;
- the field is not duplicated.

An invalid adopted input is projected as unadopted into the strategic analytical engines. It therefore contributes no lifecycle metric, location score, forward-attraction signal, or upside value. The governance result retains the exact issue codes and evidence-coverage ratio for review.

## Subdivision cross-gate

A catalyst with `type = SUBDIVISION` receives zero effective probability unless the existing eleven-check subdivision gate has status `FEASIBLE_FOR_SCENARIO_TESTING` and `scenarioTestingEligible = true`.

Passing the gate allows explicit scenario testing only. It does not infer authority approval, legal feasibility, engineering certification, investment approval, or transaction authorization. Subdivision economics are still not injected automatically into NPV, IRR, rent growth, exit cap rate, or terminal value.

## Surfaces

- The Residential Income API exposes the evidence-governance version and calculation state.
- The decision UI shows strategic evidence coverage, usable adopted inputs, subdivision status, check coverage, and scenario-testing eligibility.
- The AI-assist snapshot receives only a compact governance summary and issue codes; raw assessments and source content are excluded.
- The package index exports the existing subdivision gate and the new strategic governance contract.

## Regression boundary

`run_riai_strategic_evidence_governance_v1.js` proves missing source lineage, missing adoption lineage, future-effective evidence, duplicate fields, fail-closed exclusion, subdivision-upside cross-gating, and sanitized AI projection.
