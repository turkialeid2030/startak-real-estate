# Production Environment Required Reviewer — administrator handoff

## Purpose

Close the remaining #327 independent deployment-approval boundary for the exact GitHub Environment name `production` without changing the frozen RC tuple.

This document does **not** designate a reviewer and does not modify GitHub Environment administration.

## Current verified controls

The recorded administrator posture already confirms:

- Environment `production` exists;
- deployment branch/tag scope is restricted to `main`;
- `CLOUDFLARE_API_TOKEN` is Environment-scoped;
- broader repository-level production token delivery was removed;
- administrator bypass is OFF;
- inspected production jobs bind to `environment: production` before consuming production credentials.

The remaining control is:

`REQUIRED_REVIEWER=NOT_CONFIGURED`

## Required genuine designation

Populate the working copy of:

`governance/operator-templates/production-required-reviewer-designation.input.template.json`

with a real GitHub account that is distinct from `github:turkialeid2030` and is intended to exercise independent production approval.

The reviewer must be a genuine separate identity. A repository template, bot, owner alias, or textual statement without the administrator configuration is not sufficient.

## Administrator execution

In repository Settings → Environments → `production`:

1. Add the designated distinct identity as a Required Reviewer.
2. Keep the governed branch/tag restriction limited to `main`.
3. Keep administrator bypass disabled.
4. Do not expose or move the protected E2E/E2F/E2G governance evidence secrets as part of this step.
5. Retain non-secret administrator evidence showing the Environment name, required reviewer identity, branch policy and bypass state.
6. Do not capture or expose the value of `CLOUDFLARE_API_TOKEN`.

## Closure evidence for #327

Accept closure only when administrator evidence supports all of the following simultaneously:

- `ENVIRONMENT=production`
- `REQUIRED_REVIEWER=<distinct GitHub identity>`
- `REQUIRED_REVIEWER_ENABLED=true`
- `PRODUCTION_BRANCH_SCOPE=main only`
- `ADMIN_BYPASS=OFF`
- production credential remains Environment-scoped

A successful ordinary CI run is not a substitute for this evidence.

## Architecture boundary

Under the frozen RC architecture, E2G is validated before merge, while the deployment workflow does not re-run a distinct E2G deployment signature at credential-release time. Therefore the Environment Required Reviewer remains a substantive control and cannot be waived by inference without changing the architecture or formally changing governance policy.

`#327=CLOSEOUT_REQUIRES_ADMIN_EVIDENCE`
`REQUIRED_REVIEWER=NOT_CONFIGURED`
`DEPLOY=HOLD`
`TRANSACTION_AUTHORITY=false`
`COMMERCIAL_GO_LIVE=HOLD`
