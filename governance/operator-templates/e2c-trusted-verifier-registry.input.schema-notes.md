# E2C Trusted Verifier Registry — schema notes

This note documents the repository-native input contract only. It is not a trust-root designation or approval.

The E2C registry input consumed by `normalizeTrustedVerifierRegistry` must contain:

- `registryId`: non-empty string.
- `status`: exactly `EXTERNALLY_GOVERNED`.
- optional `governanceOwnerRef`.
- non-empty `verifiers` array.

Each verifier must contain:

- `verifierId`
- `verifierSubjectRef`
- `authorityClass`
- `publicKeyPem`
- `publicKeySha256`
- `governanceEvidenceRef`
- `activeFrom`
- optional `activeUntil`

The implementation verifies that `publicKeySha256` equals the SHA-256 produced by the repository `sha256` function over the normalized PEM string and that the PEM parses as a public key.

The deterministic E2C `registryHashSha256` is computed from the normalized core:

```json
{
  "schemaVersion": 1,
  "registryId": "...",
  "status": "EXTERNALLY_GOVERNED",
  "governanceOwnerRef": "... or null",
  "verifiers": ["normalized verifier records"]
}
```

Production packet mode additionally requires the independently supplied `--expected-registry-sha` to equal this deterministic registry hash. Repository presence alone is not the out-of-band pin.

Self-validation is prohibited. For any attestation whose resolved reviewer subject equals the verifier's `verifierSubjectRef`, E2C emits `SELF_VALIDATION_PROHIBITED` and fails closed.

`DOCUMENTATION_ONLY=true`
`TRUST_ROOT_DESIGNATED=false`
`OUT_OF_BAND_PIN_PRESENT=false`
`AUTHORITY_EFFECT=NONE`
