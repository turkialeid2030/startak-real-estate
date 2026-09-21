# Owner RSA Public-Key Setup — E2G

For `github:turkialeid2030` only. Perform the private-key steps on a trusted local workstation or HSM-controlled environment outside GitHub, CI, and chat.

## Purpose

The current owner is designated for:

- `RELEASE_APPROVAL`
- `MERGE_APPROVAL`

A real RSA public key must be registered and pinned before either canonical signing request can be accepted. The corresponding private key must remain under the owner's independent control.

## Option A — One owner key pair for both owner authority records

The current validator does not prohibit the same subject/public key from backing both RELEASE and MERGE authority records, provided Deployment authority remains a different subject.

Generate a minimum 3072-bit RSA key locally:

```bash
umask 077
openssl genpkey \
  -algorithm RSA \
  -pkeyopt rsa_keygen_bits:3072 \
  -out startak-owner-e2g-private.pem

openssl pkey \
  -in startak-owner-e2g-private.pem \
  -pubout \
  -out startak-owner-e2g-public.pem

chmod 600 startak-owner-e2g-private.pem
chmod 644 startak-owner-e2g-public.pem
```

Never upload `startak-owner-e2g-private.pem`.

## Compute the exact publicKeySha256 expected by the verifier

The project hashes the trimmed PEM text, not arbitrary surrounding whitespace. Compute the digest with Node.js:

```bash
node -e "const fs=require('fs'),crypto=require('crypto');const pem=fs.readFileSync('startak-owner-e2g-public.pem','utf8').trim();console.log(crypto.createHash('sha256').update(pem,'utf8').digest('hex'))"
```

Record only:

1. the public PEM text from `startak-owner-e2g-public.pem`;
2. the 64-hex SHA-256 value;
3. a non-secret governance evidence reference;
4. the activation timestamp.

Insert the public material into:

`governance/operator-templates/e2g-release-authority-registry.current.template.json`

for both owner authority records if using one key pair.

## Optional — Separate owner keys for RELEASE and MERGE

Separate key pairs may be used for stronger role-level audit separation. If chosen, generate two independent RSA key pairs and compute each public PEM hash separately. Do not reuse the Deployment authority's key.

## Verification before use

After replacing placeholders, run the repository's public registry intake:

```bash
node tools/e2g-release-authority-decision-intake.js registry \
  --registry release-authority-registry.json \
  --out release-authority-registry-intake.json
```

Expected status only after all three authority records are complete and Deployment has a distinct subject:

`READY_FOR_E2G_RELEASE_AUTHORITY_TRUST_ROOT_PINNING`

The emitted `registryHashSha256` must then be pinned independently/out-of-band before decision signing requests are generated.

## Prohibited

- Do not paste the private key into GitHub, CI, an issue, PR, repository file, environment variable, ChatGPT, Slack, email, or any shared document.
- Do not commit passphrases or recovery material.
- Do not use a fixture/test key.
- Do not use the owner key as the Deployment authority key.
- Do not sign until the E2F packet is genuinely qualified and the signing request status is `READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE`.
