# CI_RELEASE_POLICY

CI_POLICY_FAIL_CLOSED = TRUE
CI_PROVIDER = GITHUB_ACTIONS_CONFIGURED

## Required verification layers

The repository contains native GitHub Actions verification workflows. Feature changes are not considered verified until the required workflows for the final head commit complete successfully.

The canonical provider-neutral gate remains:

1. `npm ci` — clean dependency installation from the lockfile.
2. `npm run release:verify` — regression discovery, production build, package verification, npm-audit critical/high threshold, and optional canonical-source hash verification.

Additional workflows execute Comprehensive and Deep Platform verification, including real-browser checks.

The exact regression test count is intentionally not embedded in this policy because it changes as tests are added. The workflow log for a specific commit is the authoritative execution record.

## Build traceability requirement

Every production-candidate artifact must contain `release-manifest.json`. When the CI/build environment supplies a valid source commit SHA, the manifest must bind the artifact to that SHA. A source-bound build is still **not** evidence that the artifact was deployed or authorized for production.

## Fail-closed rule

No required CI gate may use `continue-on-error` to convert a substantive verification failure into a release pass. A production decision must additionally satisfy the separate human/evidence gates; CI success alone is not production authorization.

## Superseded historical state

Earlier text stated that the repository provider was unknown and that no `.git`/remote or provider workflow existed. That statement is obsolete and has been replaced by the current GitHub Actions configuration described above.
