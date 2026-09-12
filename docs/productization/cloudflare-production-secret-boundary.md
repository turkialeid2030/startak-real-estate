# Cloudflare production-secret trust boundary

## Decision

Production Cloudflare credentials must never be made available to a workflow execution whose definition is controlled by pull-request code.

The production boundary is therefore:

- `cloudflare-access-runtime-sync.yml`: `workflow_dispatch` only, from `main`, exact-SHA bound, and explicit mutation acknowledgement required.
- `cloudflare-ai-production-activation.yml`: `workflow_dispatch` only, from `main`, exact-SHA bound, and explicit mutation acknowledgement required.
- `cloudflare-control-plane-verify.yml`: `workflow_dispatch` only, from `main`, exact-SHA bound, read-only verification.
- `pull_request`, `pull_request_target`, and automatic `push` triggers are prohibited for workflows that receive `secrets.CLOUDFLARE_API_TOKEN`.

## Why automatic push is also removed

The one-time governance bootstrap must not cause a production-credential workflow to execute merely because governance code was merged to `main`. Production-state access remains a separately authorized operation.

## Regression enforcement

`tests/runtime/run_cloudflare_production_secret_boundary_tests.js` scans every workflow. Any workflow that references `secrets.CLOUDFLARE_API_TOKEN` and exposes it through `pull_request` or `pull_request_target` fails release verification. It also protects the three production Cloudflare workflows against accidental trigger broadening.

## Administrative hardening still recommended

Repository code can eliminate PR-controlled secret execution, but it cannot prove how GitHub stores the credential. The repository administrator should additionally move `CLOUDFLARE_API_TOKEN` into a protected production GitHub Environment with required reviewers and restricted deployment branches. That administrative control is defense in depth and must not be claimed as complete until verified in repository settings.

## Bootstrap sequencing

1. Qualify this hardening branch with the canonical engineering release gate.
2. Bootstrap trusted governance workflow code to `main` without invoking any production Cloudflare workflow.
3. Add `trusted-main-production-governance` as a required status check alongside `release-verify`.
4. Configure protected delivery of real E2F/E2G evidence.
5. Only then allow the aggregate production candidate to be evaluated for merge.

No step in this document authorizes deployment, Cloudflare mutation, or Go-Live.
