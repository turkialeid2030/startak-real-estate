# P41 — Canonical Baseline Activation Authorization Operator

## Purpose

P41 operationalizes the P40 human-owner activation authorization boundary without bringing a private signing key into the repository or applying the canonical-baseline change.

It has two modes:

- `prepare`: validates the P39 contract, pinned activation-authority registry and owner decision metadata, then emits the exact deterministic signing payload/bytes required by P40.
- `verify`: accepts a separately produced signed attestation and verifies it through the existing P40 RSA-SHA256 trust path.

## Prepare mode

```bash
node tools/canonical-baseline-activation-authorization.js prepare \
  --contract <p39-contract.json> \
  --authority-registry <activation-authority-registry.json> \
  --expected-authority-registry-sha256 <out-of-band-pinned-sha256> \
  --decision <owner-decision.json> \
  --output <unsigned-signing-package.json>
```

A successful result is:

`READY_FOR_EXTERNAL_OWNER_SIGNATURE`

The package includes the normalized signing payload, its SHA-256 and exact UTF-8 signing bytes encoded as Base64. It contains no private signing key and does not perform signing.

## External signing boundary

The authorized owner signs the exact decoded signing bytes outside the repository using the private key corresponding to the public key recorded in the pinned activation-authority registry.

The resulting signed attestation is then supplied to verify mode:

```bash
node tools/canonical-baseline-activation-authorization.js verify \
  --contract <p39-contract.json> \
  --authority-registry <activation-authority-registry.json> \
  --expected-authority-registry-sha256 <out-of-band-pinned-sha256> \
  --attestation <signed-owner-attestation.json> \
  --output <verified-authorization.json>
```

A successful result is:

`VERIFIED_SIGNED_OWNER_ACTIVATION_AUTHORIZATION`

This means the signed decision record is valid for the P40 trust model. It does **not** mean the canonical registry was changed or that release, merge, deployment, go-live or transaction authority was granted.

## Safety properties

- private-key arguments are unsupported and explicitly rejected;
- module input containing common private-key fields fails closed;
- authority-registry SHA-256 must match the value pinned out of band;
- authority actor must equal the P39 owner/preparer;
- purpose is fixed to `CANONICAL_BASELINE_ACTIVATION`;
- decision is fixed to `AUTHORIZE`;
- authority active period is enforced;
- input JSON files are size-bounded and symlinks are rejected;
- output files use mode `0600` where supported;
- file paths and source JSON are not echoed by successful CLI output.

## Governance boundary

P41 does not modify `config/governance/canonical-baseline.json`, does not create a P39 contract, does not perform a merge or deployment, and does not replace the pending independent-review requirement upstream of P30/P31/P38/P39.

`سعيد المراجع` remains only the mutable reviewer designation until a real independent review is accepted. All release and execution authority remains fail-closed.
