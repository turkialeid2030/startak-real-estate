# Cloudflare production-secret trust boundary

## Decision

Production Cloudflare credentials must never be made available to a workflow execution whose definition is controlled by pull-request code.

The production boundary is therefore:

- `cloudflare-access-runtime-sync.yml`: `workflow_dispatch` only, from `main`, exact-SHA bound, and explicit mutation acknowledgement required.
- `cloudflare-ai-production-activation.yml`: `workflow_dispatch` only, from `main`, exact-SHA bound, and explicit mutation acknowledgement required.
- `cloudflare-control-plane-verify.yml`: `workflow_dispatch` only, from `main`, exact-SHA bound, read-only verification.
- `release-governance-verify.yml`: `workflow_run` only, chained from a successful `Post-Release Production Verify` run on `main`; the Cloudflare token is scoped only to the exact-SHA rollback-readiness step.
- `pull_request`, `pull_request_target`, and automatic `push` triggers are prohibited for workflows that receive `secrets.CLOUDFLARE_API_TOKEN` unless the workflow is redesigned so that the secret-bearing job cannot be reached from those events. The current repository intentionally uses no such exception.

## Why automatic push is also removed

The one-time governance bootstrap must not cause a production-credential workflow to execute merely because governance code was merged to `main`. Production-state access remains a separately authorized operation.

For the release-governance chain, the allowed automatic execution path is different: it is a trusted default-branch `workflow_run` chain that starts only after the exact production control-plane verification path has completed. It does not accept PR or arbitrary branch-dispatch execution.

## Regression enforcement

`tests/runtime/run_cloudflare_production_secret_boundary_tests.js` scans every workflow. Any workflow that references `secrets.CLOUDFLARE_API_TOKEN` and exposes it through `pull_request` or `pull_request_target` fails release verification. It also protects the production Cloudflare workflows against accidental trigger broadening and asserts that release governance remains chained from `Post-Release Production Verify` with exact-SHA correlation.

`tests/runtime/run_production_mutation_workflow_hardening_tests.js` separately verifies the manual production-mutation contract, explicit authorization phrase, main-only binding, exact-SHA correlation, fail-closed AI behavior, and the trusted release-governance chain.

## Administrative hardening still required before blocker closure

Repository code can eliminate PR-controlled secret execution, but it cannot prove how GitHub stores or releases the credential. The repository administrator should additionally move `CLOUDFLARE_API_TOKEN` into a protected production GitHub Environment with required reviewers and restricted deployment branches, then verify that the secret-bearing jobs reference that environment.

Until that administrative state is verified, Issue #327 remains open even when the code-side regression gate passes.

## Bootstrap sequencing

1. Qualify this hardening branch with the canonical engineering release gate.
2. Advance the aggregate integration branch only after the exact hardening head passes that gate.
3. Bootstrap trusted governance workflow code to `main` without invoking any production Cloudflare workflow.
4. Add `trusted-main-production-governance` as a required status check alongside `release-verify`.
5. Configure protected delivery of real E2F/E2G evidence.
6. Configure and verify protected GitHub Environment delivery for the Cloudflare production credential.
7. Only then allow the aggregate production candidate to be evaluated for merge and later deployment authorization.

No step in this document authorizes deployment, Cloudflare mutation, or Go-Live.
