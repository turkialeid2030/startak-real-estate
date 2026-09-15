# Release chain provenance hardening

## Purpose

Prevent a successful direct/manual production verification workflow from being misclassified downstream as commit-correlated production evidence.

## Problem

`Post-Release Production Verify` can run directly by `workflow_dispatch` or as a pull-request diagnostic, in addition to its correlated `workflow_run` path from `Cloudflare Control Plane Verify`.

`Release Governance Verify` also has direct/manual modes and a downstream `workflow_run` path from `Post-Release Production Verify`.

Without explicit provenance checks, a successful direct/manual upstream run on `main` could cause the next workflow to see a successful upstream workflow and a `head_sha` even though the expected production correlation chain had not been established through the intended preceding verifier.

## Hardened chain

The accepted production evidence chain is now:

1. `Cloudflare Control Plane Verify` succeeds on `main` and has itself verified the exact deployed commit.
2. `Post-Release Production Verify` accepts only a successful upstream Control Plane run whose branch is `main`, whose commit is a 40-character SHA, and whose trigger is `push` or explicit `workflow_dispatch`. It records `COMMIT_CORRELATED_FROM_CONTROL_PLANE` provenance.
3. `Release Governance Verify` accepts downstream production evidence only when the upstream Post-Release run was itself triggered by `workflow_run`. This distinguishes the correlated production chain from direct/manual Post-Release diagnostics. It records `COMMIT_CORRELATED_POST_RELEASE_CHAIN` provenance.
4. Release-governance evidence qualifies as commit-correlated only when provenance is established and both production health and rollback readiness pass.

## Diagnostic modes

Pull-request and direct/manual invocations remain available for engineering diagnostics. They are explicitly recorded as `DIAGNOSTIC_UNCORRELATED` and cannot qualify as commit-correlated production or release evidence.

## Authority boundary

This hardening performs no production mutation and grants no release, merge, deployment, go-live, rollback, or transaction authority. Automatic rollback remains prohibited. Human release/deployment authority remains separate.

## Regression contract

`tests/runtime/run_release_chain_provenance_hardening_tests.js` locks the upstream workflow identities, event/branch/SHA provenance requirements, diagnostic classification, evidence qualification conditions, and fail-closed authority flags.
