# Runtime Production Readiness Hardening

## Purpose

This slice hardens the existing Cloudflare production-mutation workflows after the P79/E2I external-evidence handoff. It does not create another readiness gate and does not perform a production mutation.

The review found two existing workflows capable of changing production state without a separate manual production authorization boundary:

- `.github/workflows/cloudflare-ai-production-activation.yml` could run from a `push` to `main` when the workflow file changed and then patch Cloudflare Pages production configuration, create/reuse a Turnstile widget, enable public AI and retry a production deployment.
- `.github/workflows/cloudflare-access-runtime-sync.yml` could run from a `push` to `main` when the workflow file changed and then create a Bypass/Everyone Access policy, patch production runtime variables and retry a production deployment.

That behavior was inconsistent with the repository's fail-closed release/deployment authority model because merging workflow code alone could become the production mutation trigger.

## Hardened contract

Both production-mutating workflows now require `workflow_dispatch` for any mutation. A production mutation requires all of the following at execution time:

1. workflow ref is exactly `refs/heads/main`;
2. caller supplies an exact 40-character `expected_commit_sha`;
3. supplied SHA equals `GITHUB_SHA` exactly;
4. caller supplies the explicit acknowledgement `I_AUTHORIZE_STARTAK_PRODUCTION_MUTATION`.

The Access/runtime workflow retains a pull-request path for read-only inspection only. There is no `push` production-mutation trigger.

## AI activation identity and failure controls

The AI activation workflow no longer retries the latest arbitrary successful production deployment. It must locate a successful production deployment whose commit hash is exactly the separately acknowledged workflow SHA, retry that deployment, and verify the retried deployment preserves the same commit identity.

After activation it performs a production smoke boundary check covering:

- public runtime config is enabled and exposes a Turnstile site key without using secret values;
- an invalid/unauthenticated AI request remains rejected before provider invocation;
- browser CSP permits Cloudflare Turnstile.

If the activation path fails, the workflow attempts a fail-closed project configuration change setting `RIAI_PUBLIC_AI_ENABLED=false`. If an exact authorized deployment is available it starts a retry of that exact deployment with public AI disabled. It never falls back to an unrelated deployment.

## Access/runtime reconciliation semantics

The Access workflow summary is aligned with the implemented runtime modes:

- when `RIAI_PUBLIC_AI_ENABLED=true`, the AI route uses the public Turnstile path;
- otherwise the route uses the Cloudflare Access JWT path.

The Access/runtime workflow reconciles Access metadata only; it does not enable public AI.

## Regression lock

`tests/runtime/run_production_mutation_workflow_hardening_tests.js` prevents regression to implicit production mutation by asserting:

- both mutating workflows lack a `push` trigger;
- manual dispatch inputs and explicit acknowledgement are present;
- exact `main`/commit binding is present;
- AI activation selects an exact commit-bound deployment rather than the latest arbitrary deployment;
- post-activation smoke checks exist;
- activation failure has an explicit public-AI-disable path;
- public runtime environment names remain aligned with `functions/api/riai/public-config.js`;
- the stale Access-only AI summary does not return.

## Authority boundary

This change only hardens the future execution boundary. It does not assert that any production secret, Cloudflare policy, Turnstile widget, deployment, E2H closeout, external E2I evidence, release authorization, deployment authorization or go-live authorization exists.

No workflow is dispatched by this change. No canonical registry is changed. No merge, deployment, activation, go-live or transaction is performed.
