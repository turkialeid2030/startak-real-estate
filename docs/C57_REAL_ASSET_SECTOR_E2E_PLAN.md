# C57 — Real Asset-Type E2E Acceptance Register, Structural Stage 1

## Scope and objective
A real operational valuation journey must be proved by actual UI/browser, independent source evidence, calculation, decision gates, persistent save/reload, audit events, Arabic right-to-left governed report and real human UAT. Presence of modules or Node-only unit tests is insufficient.

The dedicated engine `src/pilot/asset-sector-e2e-evidence-matrix.js` is a strict **evidence completeness validator**, NOT a browser test. The CI test uses synthetic fixture declarations to exercise this validator and outputs `C57_REAL_BROWSER_E2E_EXECUTED=FALSE` and `C57_REAL_HUMAN_UAT_VERIFIED=FALSE`.

## Eight required scenarios
1. Residential apartment/villa sales comparison;
2. Existing office income;
3. Existing retail income;
4. Vacant land / HBU;
5. Development land residual (dependent C55);
6. Industrial warehouse/factory;
7. Hotel property interest versus operating business;
8. Mixed-use multi-method allocation.

## Mandatory steps per scenario
- input and real document intake;
- evidence and date checks;
- asset-to-method routing;
- calculated results with adversarial boundary conditions;
- fail-closed decision gates;
- saved-deal persistence and reload;
- audit trail;
- Arabic RTL governed report;
- real, authorized human UAT sign-off.

Each step requires an immutable artifact SHA-256 and provenance reference. Every scenario needs two real **negative** cases proving an invalid/missing or conflicting input was held, an independent reviewer, a human UAT approval reference, matching full candidate commit and source-rights evidence.

## Current status
No authentic real-browser execution pack, independent human acceptance or verified source-rights evidence is supplied in this PR. A fully populated *structural* record returns `READY_FOR_INDEPENDENT_REVIEW` and always `realE2ECoverageEstablished=false`. Nothing in this PR can authorize deployment, certified appraisal or transaction approval. All sector rows remain unclosed until actual signed evidence is reviewed.

## User actions / accountable evidence outside code
Authorized real test users must execute and record each case; professional valuers must independently inspect output and methodology; legal/data owner must attest source-use rights; security lead must attest exact-head readiness; product owner decides gated controlled launch only after independent authority acceptance.
