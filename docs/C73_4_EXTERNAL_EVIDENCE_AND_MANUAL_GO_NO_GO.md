# C73.4 — Cryptographic evidence gate for eight external P0 approvals

## Scope
This is the **final human-approval preparation gate**, stacked atop C73.3D [#652](https://github.com/turkialeid2030/startak-real-estate/pull/652). It does not certify the infrastructure, issue a production permit, merge PRs or deploy.

The previous security evidence tools included metadata and supplied status fields but did not themselves establish independent issuer signatures. This stage adds `src/security/c73-external-readiness-approval-gate.js`. It verifies attached **raw evidence bytes** (not just typed hashes), SHA-256, an Ed25519 signature over canonically serialized scope and decision, and pinned public keys for eight distinct issuer roles. A successfully verified evidence bundle returns `CRYPTOGRAPHIC_P0_EVIDENCE_VERIFIED_MANUAL_GO_NO_GO_REQUIRED` and **always** sets `approvalForProduction=false`, `transactionAuthorized=false`, `professionalValuationAuthorized=false`.

## Mandatory distinct P0 categories
| Gate | Approval domain | Required role |
|---|---|---|
| P0-A | Saudi region secure object vault, enterprise KMS/HSM, independently held WORM and recovery | CLOUD_INFRASTRUCTURE |
| P0-B | Production OIDC/JWKS/IAM, authenticated interservice TLS and key rotation | IDENTITY_SECURITY |
| P0-C | Actual certified scanning, quarantine, retention, immutable object-to-ledger mapping | DOCUMENT_SECURITY |
| P0-D | Saudi PDPL/DPIA, legal rights of official sources, regulator/commercial usage permission | SAUDI_LEGAL_PRIVACY |
| P0-E | Independently verified active Saudi professional valuer and actual review/approval | LICENSED_VALUATION |
| P0-F | Real Saudi holdout asset-class financial, NPV and property valuation/model benchmarking | MODEL_VALIDATION |
| P0-G | Independent penetration, tenant isolation, load/DR recovery and security assurance | INDEPENDENT_ASSURANCE |
| P0-H | Signed accountable product/board/delegated release Go/No-Go | BOARD_RELEASE_AUTHORITY |

## Fail-closed controls
- Every category is mandatory. No absent, duplicate, unknown or extra signed claim fields.
- Every issuer identity must map to a **trusted separately configured** gate and role; 8 distinct Ed25519 public-key fingerprints are required; a signer cannot issue two independent approvals.
- Each original evidence content is hashed at runtime from bytes (up to 4 MiB per item). No reliance on a user-entered expected hash alone.
- The evidence signature binds environment, exact 40-character target Git SHA, gate, role, issuer, hash, issuance time, expiry, explicit decision and nonce.
- No expired/future approval, duration beyond 90 days, invalid timestamp, wrong deployment environment, modified evidence, replaced signature, forged issuer, wrong role or shared signer key.
- A positive **synthetic** bundle demonstrates only that the signature-checking contract is coherent. It does **not** independently check actual identity/employment/authority, legal rights, third-party signer control, certified storage, professional license, regulator standards or human Go/No-Go. The `trustPolicy` is supplied by a trusted application caller; secure production key registration and out-of-band trust establishment are not implemented.
- No real production infrastructure account, actual independent signatures or genuine Saudi source rights have been provided. **All external categories remain HOLD in reality**.

## Operational evidence submission requirements
For each P0 owner, collect actual original provider documentation, contract or independent test deliverable and a publicly auditable issuer identity/authority path; verify legitimacy **out of band**, cryptographically anchor the exact release SHA and environment, configure pinned issuer key registration protected from runtime callers, then perform joint counsel, professional, security and authorized management review. A cryptographic signature from a synthetic CI key is NEVER substantive sign-off. An independent authorized release controller must issue any actual deployment authorization through an explicitly separate trusted process, after human Go/No-Go.

## Decision
**No actual live production activation in C73.4.** Preserve #644, #648, #622, #634 as HOLD, all stacked PRs Draft/unmerged, no genuine customer documents, official appraisals or transactions.
