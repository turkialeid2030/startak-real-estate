# C22 — Governed AI & Generative Intelligence Orchestration

## Purpose
C22 adds an internal, governed AI / Generative AI orchestration layer above the deterministic Startak Real Estate capability stack. It is intentionally **not** a source of record and cannot override deterministic gates, invent evidence, execute transactions, or operate publicly.

## Current activation state
C22 is **simulation-only**. It does not call a live external or private LLM. The purpose of this wave is to prove the governance, evidence-binding, prompt-injection isolation and output-validation contracts before any provider is considered.

A live provider remains separately gated by:
- security architecture review;
- data residency and retention review;
- contractual/training-use review;
- privacy/data classification controls;
- model evaluation and red-team evidence;
- human authorization;
- production deployment authorization.

## Allowed task classes
- `EVIDENCE_SUMMARY`
- `GAP_ANALYSIS`
- `RISK_SYNTHESIS`
- `SCENARIO_NARRATIVE`
- `COMPARABLE_EXPLANATION`
- `EXECUTIVE_DRAFT`

These are drafting/analysis tasks. They do not create decision authority.

## Governed model profile
Every model profile binds:
- provider/model/version references;
- deployment mode;
- allowed task and data classes;
- data-residency and retention policy references;
- customer-data training prohibition;
- token/temperature constraints;
- model card and review evidence;
- validity window and SHA-256.

`liveProviderEnabled=false`, `externalNetworkEnabled=false`, `publicAiAllowed=false`, `transactionAuthority=false`, and `approvalAuthority=false` are hard-coded governance properties of C22.

## Governed AI request
Every request exact-binds:
- case/property context;
- task class;
- prompt-template ID/version/hash;
- model-profile hash;
- governed retrieval items and evidence hashes;
- deterministic engine-output hashes;
- explicit numeric-literal allow-list derived from governed deterministic/evidence inputs;
- deterministic decision state;
- requester authorization reference;
- validity window and request SHA-256.

Retrieved source/listing/document text is untrusted data only. Instruction-like content is isolated and surfaced as a risk flag; it is never treated as executable instruction.

## Governed generated response
A response must:
- bind the exact request and model profile;
- contain structured claims;
- bind every claim to governed evidence hashes in the request;
- declare any numeric literals used by claims;
- preserve the deterministic decision state;
- remain `draftOnly=true`;
- use the deterministic simulated adapter;
- keep transaction, approval and Public AI authority false;
- never request deterministic gate override;
- never follow untrusted retrieved instructions;
- carry response SHA-256 integrity.

## Fail-closed controls
C22 holds on:
- tampered profile/request/response/policy;
- profile/request/policy binding mismatch;
- disallowed task/data/deployment mode;
- future/stale records;
- unbound evidence claims;
- numeric literals outside the explicit request allow-list;
- deterministic decision-state override;
- personal/confidential data outside the approved profile/policy;
- attempted live-provider activation;
- attempted autonomous action, transaction, approval, legal opinion or certified valuation authority.

## Prompt injection posture
Instruction-like content in retrieved evidence is treated as untrusted data. C22 surfaces an isolation risk flag when it is detected. A response claiming to have followed such instructions cannot be constructed through the governed response factory and would fail integrity/security review if injected after hashing.

## Explicit non-goals
C22 does not provide:
- autonomous decision making;
- autonomous browser/tool/transaction execution;
- legal opinions;
- certified valuation opinions;
- loan/credit approval;
- acquisition/disposal/development approval;
- live external-provider activation;
- training on customer data;
- public AI exposure.

## Authority boundary
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `MERGE HOLD = ON`
- `DEPLOY = NO`
