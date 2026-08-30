# CI_RELEASE_POLICY

CI_POLICY_FAIL_CLOSED = TRUE

Mandatory fail-closed gates -- CI MUST fail the pipeline (no `continue-on-error`) if ANY of these fail:
1. `npm ci` (clean dependency install from lockfile)
2. `npm run release:verify` (orchestrates: full 79-test regression, production build, `verify:package`, `npm audit` critical/high threshold, canonical-hash check)

CI_PROVIDER_CONFIGURATION = HOLD_REPOSITORY_PROVIDER_REQUIRED (no `.git`/remote exists in this environment; no vendor-specific workflow file was fabricated, per explicit instruction not to assume GitHub or any other provider without evidence).

Once a repository provider is authorized, its native CI file should invoke exactly `npm ci && npm run release:verify` as its required job -- not reimplement the checks inline.
