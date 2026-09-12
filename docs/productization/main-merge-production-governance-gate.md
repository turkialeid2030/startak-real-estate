# Main Merge Production Governance Gate

## Purpose

`main` is the production-governed default branch. The repository ruleset requires the `release-verify` status check before merge, but the engineering release verifier intentionally permits several external inputs to remain `NOT_EVALUATED` during ordinary development qualification.

That behavior is appropriate for stacked engineering branches but insufficient for the final aggregate pull request into `main`: a green engineering check must not be interpreted as proof that real E2F/E2G production governance exists.

This gate closes that boundary.

## What the gate requires

For a pull request targeting `main`, the `release-verify` job now requires independently supplied out-of-band production governance inputs:

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

## GitHub Actions input boundary

The workflow accepts the real governance objects through GitHub Actions secrets so they are not committed to the public repository:

- `STARTAK_E2F_PACKET_B64`
- `STARTAK_E2F_PACKET_PIN_SHA256`
- `STARTAK_E2F_VERIFIER_REGISTRY_PIN_SHA256`
- `STARTAK_E2G_PACKET_B64`
- `STARTAK_E2G_PACKET_PIN_SHA256`
- `STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_B64`
- `STARTAK_E2G_RELEASE_AUTHORITY_REGISTRY_PIN_SHA256`

The expected source commit is not operator-entered. The workflow injects `github.event.pull_request.head.sha` as `STARTAK_EXPECTED_RELEASE_SOURCE_COMMIT_SHA`, preventing approval evidence for a different commit from authorizing the current PR.

If any required secret is absent or malformed, the required `release-verify` check fails closed.

## Important trust statement

This gate does not create external evidence and does not sign anything. The E2F packet and its independent pins must still originate from the externally governed validation process. The release-authority registry and E2G signatures must still originate from the actual authorized human actors.

GitHub Secrets are only a delivery boundary for CI. They do not by themselves prove who generated the evidence. The project operating procedure must retain the independent source/audit trail for every packet and pin.

## Success state

A successful result is:

`MAIN_MERGE_GOVERNANCE_VERIFIED_PENDING_GITHUB_MERGE`

This means only that the exact PR source commit has a complete independently pinned E2F validation packet and a cryptographically reconstructed E2G packet containing valid human `RELEASE_APPROVAL`, `MERGE_APPROVAL`, and `DEPLOYMENT_APPROVAL` decisions.

It does **not** execute the merge. It does not deploy to Cloudflare. It does not establish E2H closeout or E2I go-live readiness. Deployment remains a separate authorized action after merge, followed by real E2H execution evidence and E2I external readiness evidence.

## Regression boundary

Runtime tests use synthetic RSA keys and synthetic E2F records strictly for code-path verification. They are not real production evidence, not real human authority, and not permission to merge or deploy.
