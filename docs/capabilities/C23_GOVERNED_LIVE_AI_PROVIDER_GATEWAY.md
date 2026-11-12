# C23 — Governed Live AI Provider Gateway and Proof-Grounded Output Enforcement

## Status
Engineering capability only. `MERGE HOLD = ON`, `DEPLOY = NO`, `COMMERCIAL_GO_LIVE = HOLD`, `PUBLIC_AI = FALSE`.

## Purpose
C23 introduces the provider-facing runtime contract above C22. It permits a model-provider adapter to be integrated only through a fail-closed gateway and rejects generated facts or numeric/date assertions that are not backed by exact governed evidence or deterministic engine output.

C23 does not claim that a generative model can never hallucinate. Instead, the system prevents unsupported model output from becoming an accepted Startak result: unsupported literals, missing bindings, model/version mismatch, stale evidence, cross-context evidence, authority overrides and provider failures return HOLD and the draft is suppressed.

## Proof-grounding rule
The live-provider path does not trust a caller-created free-form numeric allow-list. A `GroundingManifest` is required. Every grounding item exact-binds one and only one source hash:

- a governed retrieval evidence SHA-256 already present in the C22 request; or
- a deterministic engine-output SHA-256 already present in the C22 request.

Every item carries case/property identity, canonical value, source reference, data class, time window, human verification and its own record SHA-256. `proof-grounded-ai-runtime.js` rejects any source hash that is not already bound into the originating C22 request.

## Provider authorization
A provider invocation is technically eligible only from `ISOLATED_NON_PRODUCTION` and only when an exact-hashed authorization packet contains explicit references for security, privacy/DLP, contract approval, data residency, retention, no customer-data training, prompt registry, role authorization, environment authorization and a kill switch. The packet also requires multiple evidence hashes and has an explicit validity window.

No API key or provider credential is stored in this repository. A runtime adapter is injected from the deployment environment. There is no silent provider fallback.

## Generated output contract
Provider output is structured claims only. Each claim must identify grounding item IDs and declared asserted literals. The gateway independently extracts numeric, percentage and ISO-date literals from claim text and checks them against the declaration; every declared literal must then match a value in the claim's exact grounding items.

Therefore a model cannot make an unsupported amount, percentage, count or date acceptable merely by placing it in natural-language text or by self-declaring it.

The final user-visible draft is constructed only from validated structured claim text. An invalid claim suppresses the entire draft.

## Deterministic authority boundary
The provider must echo the deterministic decision state from the C22 request. Any attempt to change `HOLD`, `REJECT`, `NOT_EVALUATED` or another deterministic state is a security hold. C23 never grants transaction, approval, autonomous-action, public-AI, production-deployment or commercial-go-live authority.

## Prompt injection
C22 marks source content as untrusted/data-only and isolates instruction-like source content. C23 sends the provider adapter only the governed request metadata and grounding manifest; the provider path receives no authority from retrieved source instructions. No tools or autonomous actions are enabled by the invocation envelope.

## Failure behavior
Provider disabled, missing authorization, missing adapter, timeout, rate limit, network error, schema error, model/version mismatch or grounding failure returns a HOLD state. The gateway does not invent a fallback response.

## Qualification
The exact-head C23 workflow must run:

- C23 adversarial proof-grounding regression;
- inherited C22 adversarial regression;
- canonical `npm run release:verify` including regression discovery, production build, package verification, audit and baseline verification.

## Non-goals
No autonomous real-estate decision, certified valuation, legal opinion, purchase/sale/development approval, bid, payment, filing, transaction execution, Public AI or production deployment authorization is introduced by C23.
