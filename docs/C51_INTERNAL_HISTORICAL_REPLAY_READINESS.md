# C51 — Internal Historical Replay Readiness

## Purpose

C51 prepares the engineering contract for C30 external gate #550, `HISTORICAL_REPLAY_EVIDENCE`.

It binds a replay plan to the exact candidate, predeclares the replay method and measures before results are interpreted, and validates the structure and integrity of any independently supplied historical replay pack.

## Boundary

C51 **does not satisfy external gate #550**. Synthetic cases are not historical evidence. C29 or other harness simulations remain engineering evidence only and cannot become real historical replay evidence by relabeling them.

C51 contains no claim of real historical performance, no invented accuracy, no invented KPI, no invented tolerance, and no invented benchmark.

`C30 remains HOLD` while real historical evidence is absent.

## Independent evidence requirements

A structurally complete external pack requires:

- exact candidate SHA/build;
- actual historical cases, not synthetic cases;
- traceable source/provenance and historical observation dates;
- replay method fixed before interpretation;
- predeclared measures reference;
- historical truth/outcome reference;
- system replay result reference;
- deviation review per case and material-deviation disposition;
- accountable independent reviewer and date;
- immutable artifact SHA-256.

A material rejection is represented as `REJECTED` and may make C30 `NO_GO`. Missing/expired evidence remains `HOLD`.

## Authority separation

A structurally complete pack becomes only `READY_FOR_C30_GATE_INGESTION`. C51 never sets historical replay approval, deployment authorization, or commercial go-live authorization.

## Linkage

- tracker: #541
- external gate: #550
- evidence ID: `HISTORICAL_REPLAY_EVIDENCE`
- accountable owner: data/valuation owner plus independent professional reviewer
- current external state: `NOT_SUPPLIED`
