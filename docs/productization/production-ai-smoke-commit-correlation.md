# Production AI Smoke — Exact Deployment Correlation

## Purpose

This slice removes a race in the read-only production AI smoke path. The prior workflow ran directly from `push` to `main`, so it could probe the production hostname before Cloudflare had deployed the pushed commit. A passing smoke could therefore describe an older successful deployment while GitHub associated the run with a newer source commit.

The correction does not deploy anything. It binds production smoke evidence to the existing `Cloudflare Control Plane Verify` workflow, which already waits for the exact `GITHUB_SHA` to appear as the successful Cloudflare production deployment.

## Correlation contract

Commit-correlated production smoke now runs from a successful `workflow_run` of `Cloudflare Control Plane Verify` on `main`.

The smoke inherits and records:

- the exact upstream `head_sha` as `EXPECTED_DEPLOYED_SHA`;
- the upstream control-plane workflow run ID;
- the upstream control-plane workflow URL;
- `EXACT_DEPLOYMENT_CORRELATED` mode.

The job additionally checks that the upstream head branch is `main` and that the inherited SHA is exactly 40 hexadecimal characters.

Pull-request and manual-dispatch runs remain allowed for diagnostics, but are explicitly marked `DIAGNOSTIC_UNCORRELATED` and cannot qualify as commit-correlated smoke evidence.

## Evidence envelope

Every run writes `runtime-evidence/production-ai-smoke/result.json` and uploads it as a 30-day GitHub Actions artifact.

The envelope records the event, expected deployed SHA, upstream control-plane run identifiers, correlation mode, job status and a boolean `qualifiesAsCommitCorrelatedSmokeEvidence`.

That boolean can only be true when:

1. the run is inherited from the exact-deployment-correlated control-plane workflow; and
2. the smoke job itself succeeds.

The envelope leaves release, merge, deployment, go-live and transaction authority false.

## Smoke scope

The read-only checks remain:

- public shell HTTP/HTML reachability;
- `/api/riai/public-config` exposes enabled public AI and a public Turnstile site key without restricted provider/secret fields;
- an invalid unauthenticated `/api/riai/ai-assist` request fails closed before provider invocation;
- CSP permits Cloudflare Turnstile.

The smoke does not bypass Turnstile and does not fabricate a valid human challenge token.

## Authority boundary

This change improves provenance of future production smoke evidence only. It does not prove that a production deployment has occurred now, does not dispatch any production workflow, does not alter Cloudflare, does not establish E2H/E2I acceptance, and does not authorize release, merge, deployment, go-live, professional valuation or transactions.
