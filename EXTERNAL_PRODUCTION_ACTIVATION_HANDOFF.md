# EXTERNAL_PRODUCTION_ACTIVATION_HANDOFF

Everything locally achievable is complete and verified (`npm run release:verify` → PASS, 79/79 tests, 0 npm audit critical/high, canonical hash unchanged, 0 external network requests, CSP locally validated with 0 violations). Only the items below require human/external authority. Nothing was created, purchased, or committed.

---

## 1. Authoritative source repository / provider
**WHY_REQUIRED**: No `.git` exists; `REPOSITORY_PROVIDER = UNKNOWN`. CI/CD needs a real remote to attach to.
**WHO_MUST_ACT**: A human with authority to choose/create the org's repository (GitHub, GitLab, etc.).
**WHAT_INFORMATION_IS_NEEDED**: Chosen provider + repository URL/access.
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Run `git init`, add the remote, prepare the initial commit content (still requires explicit authorization to actually commit/push), and generate the provider-native CI workflow file (`.github/workflows/...` or `.gitlab-ci.yml`) that calls `npm ci && npm run release:verify`.
**BLOCKING_GATE**: PR-10B, CI/CD.

## 2. Repository creation/access
**WHY_REQUIRED**: A repository must actually exist to push to.
**WHO_MUST_ACT**: Same human authority as #1.
**WHAT_INFORMATION_IS_NEEDED**: Confirmation the repo exists and write access is available.
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Push the prepared source (only once explicitly authorized to commit).
**BLOCKING_GATE**: PR-10B.

## 3. CI/CD connection
**WHY_REQUIRED**: Automated enforcement of the 79-test regression gate on every change.
**WHO_MUST_ACT**: Repository admin (to enable Actions/Pipelines).
**WHAT_INFORMATION_IS_NEEDED**: Provider confirmed (#1) and CI enabled on the repo.
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Finalize and commit the workflow file; verify it runs `release:verify` and fails closed.
**BLOCKING_GATE**: PR-10B.

## 4. Actual HTTPS static host
**WHY_REQUIRED**: `PRODUCTION_HOST = NOT_CONFIGURED`. The app is deployment-capable (`dist/` is a complete static artifact) but nowhere is authorized to serve it.
**WHO_MUST_ACT**: Whoever has budget/organizational authority to choose and pay for hosting (Netlify, Vercel, S3+CloudFront, internal infra, etc. -- no provider is assumed).
**WHAT_INFORMATION_IS_NEEDED**: Chosen provider + account access.
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Prepare provider-specific deployment config matching `STATIC_HOSTING_REQUIREMENTS.md`, and apply the `CSP_POLICY.md` header set at that provider's edge/config layer.
**BLOCKING_GATE**: PR-10B.

## 5. Production domain/subdomain (if a custom domain is desired)
**WHY_REQUIRED**: Only relevant if the app should not live on the host's default subdomain.
**WHO_MUST_ACT**: Domain owner/IT.
**WHAT_INFORMATION_IS_NEEDED**: Desired domain/subdomain.
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Document the required DNS record shape (CNAME/A, per host's instructions) -- cannot create DNS records itself.
**BLOCKING_GATE**: PR-10B (optional, only if a custom domain is required).

## 6. DNS authority (only if #5 applies)
**WHY_REQUIRED**: Pointing a custom domain at the host requires DNS record changes.
**WHO_MUST_ACT**: Whoever controls the domain's DNS (registrar/IT).
**WHAT_INFORMATION_IS_NEEDED**: DNS record values from the chosen host.
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Nothing further -- this is entirely external to the application.
**BLOCKING_GATE**: PR-10B (conditional).

## 7. Live monitoring provider
**WHY_REQUIRED**: `LIVE_MONITORING_PROVIDER = NOT_CONFIGURED`. Application-side hooks exist and are tested (`PR-11A = PASS`) but report to a no-op.
**WHO_MUST_ACT**: Whoever has authority to choose/pay for an error-monitoring vendor (Sentry, etc. -- none assumed).
**WHAT_INFORMATION_IS_NEEDED**: Chosen provider.
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Implement `sendToProvider()` in `report-runtime-error.js` against that provider's safe/documented ingestion API, respecting the existing data-minimization envelope.
**BLOCKING_GATE**: PR-11B.

## 8. Monitoring project/endpoint credentials
**WHY_REQUIRED**: Sending telemetry requires a project key/DSN from the chosen provider.
**WHO_MUST_ACT**: Whoever created the monitoring account (#7).
**WHAT_INFORMATION_IS_NEEDED**: The provider's public client key (never a secret server key for a client-side-only app).
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Wire the key into the build config as a public, non-secret value (client-side monitoring keys are not secrets by design in virtually all providers) -- never invented, never guessed.
**BLOCKING_GATE**: PR-11B.

## 9. Deployment secrets (if the chosen host requires any)
**WHY_REQUIRED**: Some hosts require a deploy token for CI-driven deployment.
**WHO_MUST_ACT**: Host account owner.
**WHAT_INFORMATION_IS_NEEDED**: The token, stored in the CI provider's secret store (never in source).
**WHAT_CLAUDE_CAN_DO_AFTER_PROVIDED**: Reference the secret by name in the CI workflow (e.g. `${{ secrets.DEPLOY_TOKEN }}`) -- never see or store its value.
**BLOCKING_GATE**: PR-10B.

---

## HUMAN_ACTION_REQUIRED

The minimum decisions needed to proceed, in order:

1. **Choose a source-control provider** (GitHub/GitLab/other) and grant repository access.
2. **Choose a static-hosting provider** and grant account access (or confirm an existing internal target).
3. **Choose an error-monitoring provider** (or explicitly decide to defer this and accept `PR-11B = HOLD` for launch).
4. If a custom domain is wanted: name it and confirm DNS authority.

Everything else -- CI workflow content, deployment configuration, header application, monitoring wiring -- can be completed immediately once these four decisions are made. No code, test, or architecture changes are needed for any of them.

**Until then**: `PRODUCTION_READY = FALSE` remains the correct, honest state. `APPLICATION_RELEASE_QUALITY = PASS` and `APPLICATION_CONTROLLED_READINESS = PASS` are unaffected and do not change based on these external decisions.
