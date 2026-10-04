# C50 — Internal Human UAT Readiness

## Purpose

C50 prepares a fail-closed engineering contract for external gate #549, `UAT_HUMAN_APPROVAL`.

It creates a predefined UAT plan, exact-release binding, structural evidence validation, scenario coverage checks, defect/usability disposition fields, named reviewer roles, immutable evidence hashing, and C30 ingestion readiness.

## Boundary

C50 **does not satisfy external gate #549** and does not approve UAT. Playwright/Chromium is not human UAT. Synthetic harness execution, CI success, automated browser tests, or engineering self-testing cannot substitute for execution and sign-off by authorized business/professional users independent from the engineering self-test function.

`C30 remains HOLD` while the independent UAT record is absent.

## Required independent evidence

For a structurally complete `SUPPLIED_VERIFIED` record, C50 expects:

- exact candidate SHA/build;
- named authorized reviewers and roles;
- all predefined scenarios;
- expected outcomes fixed before execution;
- actual observations and pass/fail results;
- material defect disposition;
- usability/workflow observations affecting professional decisions;
- no unresolved blocker;
- accountable sign-off, reviewer/date and immutable SHA-256.

A rejected UAT record is represented honestly as `REJECTED` and may make C30 `NO_GO`. A missing/expired record remains `HOLD`.

## Authority separation

Even a structurally complete signed record is only `READY_FOR_C30_GATE_INGESTION`. Engineering does not set `humanUatApproved=true`, and C50 never authorizes deployment or commercial go-live.

## Linkage

- tracker: #541
- external gate: #549
- evidence ID: `UAT_HUMAN_APPROVAL`
- accountable owner: authorized business/professional users independent from engineering
- current external state: `NOT_SUPPLIED`
