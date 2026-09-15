# Main Merge Production Governance Gate

## Purpose

`main` is the production-governed default branch. The existing repository ruleset currently requires the engineering `release-verify` status before merge, while the engineering verifier intentionally permits external inputs to remain `NOT_EVALUATED` during ordinary development qualification.

That behavior is appropriate for stacked engineering branches but is not a sufficient production authorization boundary. A green engineering check must never be interpreted as proof that real E2F/E2G production governance exists.

This package adds the cryptographic gate and a separate **trusted base-branch workflow** for the final production-governance decision.

## What the gate requires

For a production-governed pull request targeting `main`, the trusted gate requires independently supplied out-of-band production governance inputs:

- complete E2F production-validation packet;
- independent E2F packet hash pin;
- independent E2F trusted-verifier-registry hash pin;
- complete E2G human release-decision packet;
- independent E2G packet hash pin;
- E2G release-authority registry containing public keys only;
- independent release-authority-registry hash pin;
- exact pull-request head SHA.

The E2F packet must pass:

- closed top-level packet contract;
- structural packet-hash integrity;
- deterministic derived-state integrity;
- exact external packet hash pin;
- exact trusted-verifier-registry hash pin;
- complete external-conformance/security/performance/resilience state;
- exact source-commit binding to the PR head.

The E2G packet must pass:

- closed top-level packet contract;
- deterministic derived-state integrity;
- exact external packet hash pin;
- exact upstream E2F ID/hash binding;
- exact source-commit binding to the PR head;
- exact independently pinned release-authority registry;
- a cryptographic rebuild through the existing governed E2G factory, which re-verifies each RSA-SHA256 human decision signature, authority scope, validity period, release/merge/deployment ordering, actor-separation policy and release-candidate bindings.

A supplied E2G packet is rejected if it differs from the cryptographically rebuilt governed packet even when its internal hash has been recomputed.

## Trusted GitHub Actions boundary

Real production-governance material must **not** be passed into a normal `pull_request` workflow that executes code controlled by the proposed PR. Doing so would let a PR modify the workflow or executable code that receives those values.

The dedicated workflow is:

`.github/workflows/trusted-main-production-governance.yml`

It uses `pull_request_target`, which means the workflow definition is loaded from the trusted base branch. The workflow:

1. rejects production-governed PRs originating outside the repository;
2. checks out **only** `github.event.pull_request.base.sha`;
3. runs the governance verifier implementation from that trusted base commit;
4. supplies the external governance values only to that trusted execution;
5. injects `github.event.pull_request.head.sha` as `STARTAK_EXPECTED_RELEASE_SOURCE_COMMIT_SHA` so evidence for another commit cannot authorize the PR;
6. never checks out or executes PR-head code in the secret-bearing job.

`actions/checkout` is pinned to commit `11d5960a326750d5838078e36cf38b85af677262` rather than a mutable tag in this trusted workflow.

The governance values are delivered through GitHub Actions secrets and are not committed to the repository:

- `STARTAK_E2F_PACKET_B64`
- `STARTAK_E2F_PACKET_PIN_SHA256`
- `STARTAK_E2F_VERIFIER_REGISTRY_PIN_SHA256`
- `STARTAK_E2G_PACKET_B64`
- `STARTAK_E2G_PACKET_PIN_SHA256`
- `STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_B64`
- `STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_PIN_SHA256`

If any required value is absent or malformed, the trusted governance job fails closed.

## Required repository-ruleset change

The current repository ruleset requires only the `release-verify` context. That context remains an **engineering qualification** check and intentionally receives no external production-governance secrets.

Before the aggregate productization PR may be merged to `main`, a repository administrator must update `STARTAK Main Production Governance` so that the independent status context:

`trusted-main-production-governance`

is also a required status check for the default branch.

This administration step cannot be substituted by a PR change because a required trust boundary must not be self-authorized by the same proposed code it protects.

Until the trusted workflow exists on `main`, its context is required by the ruleset, and real E2F/E2G inputs pass it for the exact PR head, the aggregate production merge remains blocked.

## Bootstrap constraint

There is a one-time trust bootstrap problem: `pull_request_target` executes the workflow from the current base branch, so the new trusted workflow cannot protect the very first PR that introduces it to `main`.

Therefore the project must treat introduction of this workflow as a separate governance bootstrap operation, not as evidence that the aggregate application release itself is authorized. That bootstrap must also ensure that any existing `push`-triggered Cloudflare production-mutation workflows are converted to explicit/manual authorization before the bootstrap merge, so a governance-only main update cannot unintentionally mutate production.

No automated bootstrap merge is performed by this package.

## Important trust statement

This gate does not create external evidence and does not sign anything. The E2F packet and its independent pins must still originate from the externally governed validation process. The release-authority registry and E2G signatures must still originate from the actual authorized human actors.

GitHub Secrets are only a protected delivery mechanism. They do not by themselves prove who generated the evidence. The operating record must retain the independent source/audit trail for every packet, registry and pin.

## Success state

A successful gate result is:

`MAIN_MERGE_GOVERNANCE_VERIFIED_PENDING_GITHUB_MERGE`

This means only that the exact PR source commit has a complete independently pinned E2F validation packet and a cryptographically reconstructed E2G packet containing valid human `RELEASE_APPROVAL`, `MERGE_APPROVAL`, and `DEPLOYMENT_APPROVAL` decisions.

It does **not** execute the merge. It does not deploy to Cloudflare. It does not establish E2H closeout or E2I go-live readiness. Deployment remains a separate authorized action after merge, followed by real E2H execution evidence and E2I external readiness evidence.

## Regression boundary

Runtime tests use synthetic RSA keys and synthetic E2F records strictly for code-path verification. They are not real production evidence, not real human authority, and not permission to merge or deploy.
