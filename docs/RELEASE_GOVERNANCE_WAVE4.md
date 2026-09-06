# STARTAK Real Estate — Wave 4 Release Governance

## Purpose

Wave 4 extends the release chain from deployment verification into production reliability and rollback readiness. It does not change financial formulas, deterministic decision logic, Saved Deal economics, AI authority, or transaction authority.

## Chain

```text
PR qualification
  → merge to main
  → Cloudflare Pages deployment
  → Cloudflare Control Plane Verify (exact production SHA)
  → Post-Release Production Verify (real production browser contract)
  → Release Governance Verify (short-window health + rollback readiness + evidence)
```

The Release Governance job only runs in exact-SHA post-release mode after `Post-Release Production Verify` succeeds on `main`.

## Release-health objective

The release-health gate is intentionally a short post-release observation window, not a monthly SLA/SLO claim.

Policy v1 requires:

- 5 production HTTP observations;
- 100% successful observations;
- zero request errors;
- zero HTTP 5xx responses;
- valid HTML document structure on every observation;
- `#root` application mount point on every observation;
- p95 response time no greater than 5,000 ms.

Thresholds are defined centrally in `governance/release-governance-policy.json` rather than embedded as undocumented test constants.

## Rollback readiness

After the exact production SHA is proven deployed and the real-browser post-release gate passes, Release Governance queries Cloudflare production deployment history read-only and requires:

1. the current exact SHA to exist as a successful production deployment;
2. at least one previous successful deployment with a distinct commit SHA;
3. a deployment ID and commit SHA for the rollback candidate.

The selected candidate is recorded as evidence. Discovery of a rollback target is not permission to execute a rollback.

### Rollback authority

`automaticRollback = false`

Rollback requires explicit human authorization. Preferred recovery paths are:

1. **Git revert/recovery commit to `main`** when repository state must remain the canonical source of truth; or
2. **manual Cloudflare redeploy of a previously verified successful deployment** when immediate service restoration is required and authorized.

After any rollback/recovery deployment, the full production verification chain must run again against the resulting exact SHA.

## Evidence

Wave 4 produces a 90-day GitHub Actions evidence artifact containing:

- production release-health observations and derived metrics;
- expected deployed SHA when operating in chained post-release mode;
- current successful Cloudflare deployment identity;
- previous successful rollback candidate identity;
- unified release-governance evidence record;
- explicit `automaticRollback: false` and `transactionAuthorized: false` markers.

Secrets and Cloudflare API tokens are never written to evidence.

## Alert surface

A failed `Release Governance Verify` check is the primary repository-level alert for post-release health or rollback-readiness failure. Wave 4 does not create automated production mutations, rollback actions, investment approvals, or transaction instructions.

## Failure interpretation

- **Health failure:** production is reachable inconsistently, returns an invalid shell, produces request errors/5xx, or exceeds the defined short-window latency threshold. Treat the release as operationally unhealthy until investigated.
- **Current deployment not found:** exact-SHA correlation has drifted or Cloudflare deployment state is inconsistent. Do not infer release success.
- **Previous successful deployment not found:** service may be healthy, but rollback readiness is incomplete. Release governance remains failed until a valid recovery target exists or policy is explicitly revised.
- **Workflow/contract failure:** governance configuration has drifted from fail-closed policy. Correct governance before treating the release chain as qualified.

## Non-authority statement

Wave 4 is an operational release-governance control. It does not authorize acquisition, financing, sale, deployment of capital, or any other real-estate transaction. It also does not grant automated authority to mutate production.
