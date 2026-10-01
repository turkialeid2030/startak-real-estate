# C19 — Governed Policy Shock / Comparable-Impact Intelligence

## Status
Draft capability. Technical qualification does not grant merge, deployment, commercial, transaction, approval, Public AI, or canonical-baseline activation authority.

## Purpose
C19 is a governed professional-review layer for evaluating the scenario effect of externally evidenced policy/regulatory/market shocks on explicit governed comparable records.

It is deliberately not a legal-interpretation engine, market-impact estimator, automated comparable-selection engine, or valuation engine.

## Dependency
Qualified C18 dependency head:

`35ceae211418649b59e0990bb36b10628b5459bb`

## Inputs

### 1. Governed comparable evidence
C19 consumes the existing comparable evidence contract and verifies the comparable SHA-256 before use. A comparable remains an evidence record; C19 does not rewrite or mutate it.

### 2. Policy-shock evidence
Each shock evidence record binds:
- case and market scope;
- shock class;
- evidence state;
- source capability / source record / source SHA-256 / status / reference;
- known-at timestamp;
- effective-at timestamp;
- professional review and validity timestamps;
- SHA-256 integrity.

Supported classes are classification labels only:
- `TRANSFER_COST_TAX_OR_FEE`
- `RENTAL_REGULATION`
- `ZONING_OR_LAND_USE`
- `FINANCING_OR_RATE_ENVIRONMENT`
- `MUNICIPAL_OR_INFRASTRUCTURE`
- `MARKET_DISCLOSURE_OR_REGISTRY`
- `OTHER`

C19 contains no Saudi statutory threshold, tax rate, fee, rent-control rule, zoning conclusion, or financing-rate assumption.

A future effective date is allowed only when the event was already known and reviewed as of the evaluation timestamp. Evidence first known after the `asOf` timestamp is blocked.

### 3. Professional comparable-impact disposition
Each impact record exact-binds one comparable hash to one policy-shock evidence hash.

Allowed actions:
- `REVIEW_ONLY`
- `APPLY_SCENARIO_ADJUSTMENT`
- `NO_SCENARIO_ADJUSTMENT`
- `PROFESSIONAL_SCENARIO_EXCLUSION`

Only `APPLY_SCENARIO_ADJUSTMENT` may contain numeric adjustment parameters. Those parameters must be externally authored and professionally reviewed.

Supported arithmetic methods:
- percent of base unit value;
- amount in SAR per sqm.

The engine only performs deterministic arithmetic from those supplied inputs. It does not estimate the magnitude or direction.

### 4. Review policy
The policy exact-binds:
- allowed shock classes;
- allowed impact actions;
- exact shock hashes;
- exact comparable hashes;
- exact impact hashes;
- whether every comparable × shock pair must receive an explicit professional disposition;
- reviewer evidence and validity window.

## Fail-closed behavior
C19 holds rather than silently infers when it encounters:
- hash tampering;
- duplicate comparable/shock/impact IDs or hashes;
- duplicate comparable-shock dispositions;
- case or market-scope mismatch;
- future knowledge or future review;
- stale evidence or stale policy;
- unresolved or `NOT_REQUIRED` shock evidence used as satisfied evidence;
- missing comparable or shock reference;
- policy hash-binding mismatch;
- disallowed shock/action;
- incomplete full matrix when required;
- non-positive arithmetic scenario unit value;
- attempted authority, legal conclusion, automatic market-impact, automated exclusion, valuation, recommendation, or transaction-authority injection.

When any blocker exists, numeric scenario impact rows are suppressed from the result.

## Output semantics
A `READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW` result means only that the evidence packet and professional dispositions passed the C19 engineering/governance contract.

It does **not** mean:
- the policy is legally applicable;
- the software interpreted the statute or regulation;
- the market will move by the supplied adjustment;
- the comparable should be selected or excluded for certified valuation;
- a valuation conclusion has been established;
- an investment action is recommended;
- a transaction is authorized.

## Authority flags
All remain false:
- transaction authorization;
- approval authorization;
- production authorization;
- Public AI authorization;
- commercial go-live authorization;
- canonical baseline activation authorization;
- automatic legal interpretation;
- automatic market-impact estimation;
- automatic comparable exclusion;
- automatic valuation adjustment/weighting;
- valuation conclusion/certified valuation;
- investment recommendation.

## Qualification contract
Exact-head qualification requires:
1. C19 dedicated deterministic/adversarial regression;
2. inherited C18 regression;
3. canonical `npm run release:verify`;
4. production build, package verification, npm audit threshold and canonical baseline registry checks through canonical release verification.

`NOT_EVALUATED` canonical shadow/cutover/external-source states do not grant authority and are not converted into PASS by C19.
