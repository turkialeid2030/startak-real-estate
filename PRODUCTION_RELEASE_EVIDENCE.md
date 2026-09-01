# PRODUCTION_RELEASE_EVIDENCE

## Current repository evidence

This repository is under Git version control on GitHub and currently contains three automated verification workflows:

- Release Verify
- Comprehensive Verify
- Deep Platform Verify

The canonical release gate performs regression discovery, production build, package verification, npm audit threshold checks, and optional canonical-source hash verification. Comprehensive and Deep verification add real-browser and deeper platform checks.

The exact test count is intentionally **not hard-coded in this document** because the suite changes as the platform evolves. GitHub Actions execution evidence is authoritative for the exact count and result of a specific commit.

## Build/source traceability

Build & Release Traceability v1 embeds a build metadata object into the browser bundle and emits:

`dist/release-manifest.json`

The manifest contains:

- application/package version;
- build ID;
- source commit SHA when supplied by the build environment (`STARTAK_SOURCE_COMMIT`, Cloudflare Pages commit SHA, Vercel commit SHA, or GitHub Actions SHA);
- whether a valid source commit was bound to the artifact;
- build environment label;
- explicit negative claims that the build itself does **not** establish deployment verification or production authorization.

Runtime observability uses the same immutable compile-time metadata. It no longer relies on a caller-editable `window.__STARTAK_BUILD_ID__` value as its source of truth.

## Security-header artifact evidence

`public/_headers` is part of the repository and the static build includes the configured CSP/HSTS/security-header policy for hosting providers that honor this file. Repository presence proves **configuration in the artifact**, not live-edge enforcement. Live response headers must be independently captured from the deployed URL before claiming they are enforced.

## Monitoring evidence

A privacy-minimized Sentry transport is configured in application source. Runtime events are tagged with source-bound build/release metadata when available. Source configuration does not by itself prove continuous delivery health or successful event ingestion; those require provider/runtime evidence.

## Deployment evidence boundary

A successful GitHub merge, CI workflow, build, Cloudflare/Vercel preview, or generated release manifest is **not** by itself production deployment authorization or proof that a particular URL is currently serving that commit.

A production deployment evidence record must independently bind at minimum:

1. deployed URL/environment;
2. release-manifest build ID;
3. source commit SHA;
4. deployment provider evidence/timestamp;
5. post-deploy smoke/E2E result;
6. live security-header observation;
7. monitoring/rollback evidence where required by policy.

Until those external/runtime facts are supplied and reviewed, the repository must not self-assert `productionDeploymentAuthorized`, `deploymentVerified`, security certification, legal approval, or transaction authorization.

## Historical note

Earlier text in this file stated that no Git remote, CI/CD, monitoring provider, or security-header deployment configuration existed. Those statements described an earlier project state and are superseded by the repository evidence above. They are removed rather than preserved as current facts.
