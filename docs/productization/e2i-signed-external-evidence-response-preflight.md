# E2I Signed External Evidence Response Preflight

## Purpose

Provide an operational preflight for the real signed external evidence responses that will eventually be supplied to the existing E2I production-evidence/go-live-readiness aggregator.

This is not a new readiness gate and does not replace E2I. It performs only a fail-closed intake check before E2I aggregation.

## Inputs

The preflight requires:

- the existing E2I policy;
- a proposed public production-readiness verifier registry;
- the registry SHA-256 pinned independently out of band;
- the exact expected production release binding:
  - E2H closeout packet SHA-256;
  - release-candidate ID;
  - source commit SHA;
  - release artifact SHA-256;
  - production environment reference;
  - production environment-config SHA-256;
  - E2H closeout preparation timestamp;
- the signed external readiness-evidence records;
- the preflight preparation timestamp.

## Checks

The preflight reuses the repository's existing E2I contracts to:

1. normalize and hash the verifier registry;
2. require the normalized registry hash to equal the independently supplied expected hash;
3. normalize all readiness evidence records;
4. verify each RSA-SHA256 signature against the matching public verifier key;
5. enforce verifier allowed-evidence-type scope and active period;
6. bind every evidence record to the exact E2H/release tuple;
7. reject evidence created before E2H closeout, after intake preparation, or expired at intake;
8. reject duplicate evidence IDs or evidence types;
9. require exactly one response for each of the six E2I evidence types;
10. require at least two distinct verifier subjects across the complete set;
11. require every result to be `VERIFIED` before the response set is marked ready for E2I aggregation.

## Status boundary

The highest status is:

`READY_FOR_E2I_AGGREGATION_NOT_ACCEPTED`

This status means only that the response set passed the preflight checks against the supplied out-of-band registry hash and exact expected release binding.

It does **not** mean:

- E2I accepted the evidence;
- the E2H closeout packet itself was re-verified here;
- legal or PDPL compliance is independently established by this code;
- professional valuation authority is established;
- release, merge, deployment or go-live is authorized;
- transaction authority exists.

E2I remains the final internal engineering readiness aggregator and architectural stop.

## CLI

Use:

```bash
node tools/e2i-external-evidence-response-preflight.js \
  --policy governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json \
  --registry /secure/public-readiness-verifier-registry.json \
  --expected-registry-sha256 <OUT_OF_BAND_PINNED_SHA256> \
  --release-binding /secure/expected-production-release-binding.json \
  --evidence /secure/signed-readiness-evidence.json \
  --intake-prepared-at 2026-09-11T03:00:00Z \
  --output /secure/e2i-response-preflight.json
```

The operator rejects symlink inputs, rejects files larger than 2 MiB, rejects obvious private-key/secret/token/password/credential fields, and writes output with mode `0600`.

## Real-world dependency

This path cannot generate the missing evidence. It becomes operational only after qualified independent reviewers provide actual signed response records and the verifier registry hash has been pinned outside the repository/workflow that consumes it.

Until then, production readiness remains fail-closed.
