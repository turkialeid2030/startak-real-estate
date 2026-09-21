# E2I external readiness evidence — operator handoff

## Purpose

Provide the non-authoritative operator handoff for the existing E2I readiness-evidence architecture after a genuine E2H closeout exists.

This runbook does **not** create external evidence, designate or authenticate a verifier, perform out-of-band pinning, create signatures, accept E2I evidence, authorize release/merge/deployment/Go-Live/transactions, or establish legal/professional authority.

## Frozen release tuple

The current release lineage remains bound to:

- releaseCandidateId: `startak-real-estate-rc-2026-09-16-e876208c19ff`
- sourceCommitSha: `e876208c19ffbddd0dacd2bf8fce24aba1e52b55`
- artifactSha256: `c3ddcd7b4a66fd58c271fb08b9e5a3efb5e4237f0015d3771e7ab9818412017f`
- environmentRef: `cloudflare-pages:startak-real-estate:production`
- environmentConfigSha256: `819183fb9f4fb09017c636d2d1d841dd086ac4ba4bbccd103dffbc4c5980bc73`

E2I additionally binds every evidence record to the genuine E2H `closeoutPacketHashSha256` and `preparedAt`.

## Required evidence classes

The existing E2I request matrix requires all six real external/production evidence classes:

1. `CANONICAL_SOURCE_HASH_COMPARISON`
2. `SAUDI_LEGAL_OPERATING_MODE_REVIEW`
3. `PDPL_DATA_GOVERNANCE_REVIEW`
4. `PROFESSIONAL_STANDARDS_SCOPE_REVIEW`
5. `PRODUCTION_EXECUTION_CHAIN_CONFIRMATION`
6. `OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION`

At least two distinct verifier subjects are required across the final evidence set. A single subject may not verify all six classes.

## Gate 1 — readiness verifier registry

1. Copy `e2i-readiness-verifier-registry.input.template.json` to a working file outside the committed template path.
2. Replace placeholders with genuine externally governed verifier identities and RSA public keys only.
3. Do not place private keys, passphrases, tokens, passwords, or credentials in the registry.
4. Run:

```bash
node tools/e2i-readiness-evidence-intake.js registry \
  --registry <working-readiness-verifier-registry.json> \
  --out <normalized-readiness-verifier-registry-intake.json>
```

5. Accept only:

`READY_FOR_E2I_READINESS_VERIFIER_TRUST_ROOT_PINNING`

6. Retain the emitted `registryHashSha256` through a genuine independent out-of-band governance channel. Repository/CI output alone is not the independent pin.

## Gate 2 — prepare each unsigned evidence record for external signature

This gate is available only after a genuine E2H closeout packet exists with status:

`EXECUTION_AND_POST_DEPLOYMENT_CLOSEOUT_COMPLETE`

For each of the six required evidence types:

1. Copy `e2i-readiness-evidence.input.template.json` to a separate working file.
2. Populate it from the genuine external review/production evidence and exact E2H/release tuple.
3. Keep it unsigned; do not add `signatureBase64` yet.
4. Run:

```bash
node tools/e2i-readiness-evidence-intake.js evidence \
  --policy governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json \
  --upstream <genuine-e2h-closeout.json> \
  --registry <working-readiness-verifier-registry.json> \
  --expected-registry-sha <independently-pinned-registry-sha256> \
  --evidence <unsigned-evidence.json> \
  --out <evidence-signing-request.json>
```

5. Accept only:

`READY_FOR_EXTERNAL_READINESS_RSA_SHA256_SIGNATURE`

6. Give the exact emitted canonical UTF-8 signing payload to the designated external verifier.
7. The verifier signs outside the repository, CI, and chat using the corresponding independently controlled private key.
8. Return only the resulting `signatureBase64` with the completed evidence record. Never return the private key or passphrase.

## Gate 3 — assemble the signed six-record response set

Populate a working copy of `e2i-readiness-evidence-set.input.template.json` with the six genuine signed evidence records.

Every record must:

- use `RSA-SHA256`;
- bind to the same exact E2H closeout hash and release tuple;
- use a verifier authorized for its evidence type and active at `verifiedAt`;
- carry a real evidence artifact SHA-256 and source reference;
- contain a genuine external signature;
- have result `VERIFIED` for readiness preflight to pass.

## Gate 4 — response preflight

Populate a working copy of `e2i-release-binding.input.template.json` from the genuine E2H closeout packet and remove `templateOnly` from the working copy.

Run:

```bash
node tools/e2i-external-evidence-response-preflight.js \
  --policy governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json \
  --registry <working-readiness-verifier-registry.json> \
  --expected-registry-sha256 <independently-pinned-registry-sha256> \
  --release-binding <working-e2i-release-binding.json> \
  --evidence <working-signed-evidence-set.json> \
  --intake-prepared-at <ISO8601_INTAKE_TIME> \
  --output <e2i-response-preflight.json>
```

Accept only:

`READY_FOR_E2I_AGGREGATION_NOT_ACCEPTED`

That status means the signed responses are structurally and cryptographically ready for E2I aggregation. It explicitly does **not** mean E2I acceptance, legal approval, professional authority, transaction authority, or Go-Live authorization.

## Gate 5 — final E2I readiness aggregation

Only after Gates 1–4 are supported by genuine external inputs and a genuine completed E2H packet, run the existing E2I readiness standard through the fail-closed operator wrapper:

```bash
node tools/e2i-production-readiness-aggregate.js \
  --packet-id <READINESS_PACKET_ID> \
  --policy governance/e2i-production-evidence-go-live-readiness-policy-2026-09-08.json \
  --upstream <genuine-e2h-closeout.json> \
  --registry <working-readiness-verifier-registry.json> \
  --expected-registry-sha256 <independently-pinned-registry-sha256> \
  --evidence <working-signed-evidence-set.json> \
  --prepared-by <PREPARER_REF> \
  --prepared-at <ISO8601_TIME> \
  --output <e2i-readiness-packet.json>
```

The wrapper rejects template-only inputs and input objects containing private-key, secret, password, token or credential fields. It does not sign, call an external service or mutate production.

Accept the final engineering-readiness result only when the exact status is:

`GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT`

This is the maximum E2I engineering status defined by the current policy. It means only that the exact release lineage has satisfied the E2I evidence gate for the operating mode `UNLICENSED_DECISION_SUPPORT`. The E2I architectural stop remains in force.

Do **not** interpret `GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT` as licensed valuation authority, certified professional authority, permission for external professional valuation issuance, transaction authority, rule activation, or any broader commercial authority. Those boundaries remain separately governed.

Any other E2I status is a HOLD/wait state and must not be promoted manually.

## Hard boundaries

- Never fabricate verifier identity, external review, evidence artifacts, signatures, administrator state or production facts.
- Never commit or paste private keys, passphrases, protected tokens, passwords, credentials, or production secret values.
- Never treat a template, CI result, signing request, repository commit, preflight status, or synthetic test as genuine external evidence by itself.
- Never treat the emitted registry hash as independently pinned merely because the repository computed it.
- Never treat `READY_FOR_E2I_AGGREGATION_NOT_ACCEPTED` as final E2I acceptance.
- Never interpret `GO_LIVE_READY_FOR_UNLICENSED_DECISION_SUPPORT` as licensed/professional/transaction authority.
- Do not alter the frozen RC to prepare or execute this handoff.

`E2I_OPERATOR_HANDOFF=PREPARED_NON_AUTHORITATIVE`
`E2I_FINAL_AGGREGATOR=TOOLING_PREPARED_EXTERNAL_INPUTS_REQUIRED`
`E2I_READINESS_VERIFIER_TRUST=EXTERNAL_INPUT_REQUIRED`
`E2I_EXTERNAL_EVIDENCE=EXTERNAL_INPUT_REQUIRED`
`E2I_ACCEPTANCE=NOT_ESTABLISHED`
`GO_LIVE_AUTHORITY=false`
`TRANSACTION_AUTHORITY=false`
