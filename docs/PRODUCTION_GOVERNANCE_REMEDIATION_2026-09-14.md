# Production Governance Remediation — 2026-09-14

## Objective

Restore separation between source-code merge authority and production deployment authority for STARTAK Real Estate, while moving the Cloudflare provider configuration to a fail-closed posture without deploying the frozen application candidate.

## Triggering evidence

Read-only production posture capture showed that a governance-only merge to `main` was automatically deployed by Cloudflare Pages. This violates the intended governance sequence in which `MERGE_APPROVAL` and `DEPLOYMENT_APPROVAL` are distinct gates.

The same provider state showed `RIAI_PUBLIC_AI_ENABLED=true` and `production.fail_open=true` while the legal/regulatory and commercial Go-Live gates remain unresolved.

## Chosen remediation

The control-plane workflow introduced by this change is designed to:

1. disable automatic production deployments from the Git-connected `main` branch;
2. set Cloudflare Pages production `fail_open=false`;
3. set provider configuration `RIAI_PUBLIC_AI_ENABLED=false`;
4. verify that no production deployment is executed by this control-plane mutation;
5. preserve preview-branch configuration and repository identity;
6. emit auditable evidence and require a fresh V2 environment configuration capture.

This is a control-plane safety remediation only. It is not an application deployment, candidate release, canonical-baseline activation, Go-Live decision, transaction authorization, or substitute for legal/professional review.

## Important evidence correction

The authoritative normalized V1 environment-config manifest from run `34822795880`, artifact `10339351143`, hashes to:

`59928738bf41ead1408d836d7c558a92af4607fbb59ba58ae5c34216d3fce93f`

Earlier governance comments that referenced `26ffd781122ec32eafd3e11166c864463657557eee4766897c31c30a25f687ea` as the environment-config digest are superseded. The retained artifact and workflow log are authoritative for the V1 capture. Because this remediation changes provider configuration, neither V1 digest is eligible as the final release environment-config digest; a fresh V2 capture is required after remediation.

## Frozen application candidate

The application candidate remains unchanged:

`21f51ad5b4c6787c556aa3b8528d9c3ec17f12c3`

Selected deterministic release artifact SHA-256 remains:

`6d0a43021a7758e9e83c026ada2c43b274b109146e5d078015505dfb3fea5bea`

No change in this governance branch authorizes mutation of that candidate.
