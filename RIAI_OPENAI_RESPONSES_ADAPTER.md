# RIAI OpenAI Responses Adapter

## Purpose

The RIAI AI gateway supports two explicit provider protocols without changing the deterministic underwriting engine or decision-governance boundary:

- `CHAT_COMPLETIONS` — backward-compatible OpenAI-compatible chat-completions payload/response shape. This remains the default when `RIAI_AI_PROVIDER_PROTOCOL` is absent.
- `OPENAI_RESPONSES` — native OpenAI Responses API payload/response shape for current OpenAI models.

Unknown protocol values fail closed with `AI_PROVIDER_PROTOCOL_INVALID` before any provider request.

## OpenAI Responses configuration

For OpenAI Responses mode configure the Cloudflare production environment as follows:

- `RIAI_AI_PROVIDER_PROTOCOL=OPENAI_RESPONSES`
- `RIAI_AI_PROVIDER_URL=https://api.openai.com/v1/responses`
- `RIAI_AI_ALLOWED_HOSTS=api.openai.com`
- `RIAI_AI_PROVIDER_KEY` as a server-side secret
- `RIAI_AI_MODEL` as an authorized OpenAI API model ID
- `RIAI_AI_MAX_OUTPUT_TOKENS` within the gateway's bounded range (`128..4096`; default `1200`)
- `RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY` as a positive integer operational spend guard

`RIAI_AI_TOKEN_LIMIT_FIELD` remains a compatibility option for `CHAT_COMPLETIONS`. Responses mode always emits `max_output_tokens` and does not expose an arbitrary field selector.

## Responses API privacy and output controls

The gateway sends `store: false` on Responses API requests. Only the pre-existing sanitized decision snapshot is sent. The request uses:

- `instructions` for the immutable system governance boundary;
- a user `input_text` item containing the sanitized decision snapshot;
- `max_output_tokens` using the gateway's bounded output budget;
- `text.format.type=json_schema` with strict schema enforcement.

The structured-output schema permits only the governed RIAI narrative fields: executive observations, risk flags, evidence gaps, due-diligence questions, scenario checks, early-warning indicators, and a decision-boundary statement. The existing server-side sanitizer and browser-side contract remain independent secondary validation layers.

The adapter accepts a completed Responses payload by extracting `output_text` content from the response message. Incomplete Responses fail closed with `AI_PROVIDER_RESPONSE_INCOMPLETE`; provider refusals fail closed with `AI_PROVIDER_REFUSAL`; unsupported response shapes fail closed.

## Compatibility

Existing chat-completions providers continue to use the original request and response contract when `RIAI_AI_PROVIDER_PROTOCOL` is absent or explicitly `CHAT_COMPLETIONS`. Existing Wave C/Wave D Access, Turnstile, rate-limit, token-budget, audit, privacy, and automatic-decision prohibitions apply identically to both provider protocols.

## Production recommendation

For a controlled authenticated pilot, keep Cloudflare Access as the access mode and use OpenAI Responses mode when selecting current OpenAI models. Do not enable public Turnstile mode merely to activate the provider; public access is an independent exposure decision.


## Governed GPT-6 refresh — 2026-11-24

Catalog and migration references:
- https://developers.openai.com/api/docs/models
- https://developers.openai.com/api/docs/guides/latest-model

Reviewed standard API price floors in integer USD micros per token (conservative maximum of published input/output rates, rounded upward): gpt-6.2-sol 10; gpt-6.2-astra 40; gpt-6.1-terra 5; gpt-6-luna 1. These floors are not an invoice, live entitlement, full price quote or an authorization to spend. A separate unexpired operator-qualified ceiling must cover all applicable charges and processing overhead.

Default candidate for qualitative RIAI narrative: gpt-6.2-sol. Other profiles are explicit operator selections, not automatic routing or fallbacks. Require native Responses endpoint, RIAI_AI_MODEL_POLICY_VERSION=GPT6_20261124, RIAI_AI_REASONING_EFFORT=low (or medium), model-specific monetary and token bounds, atomic quota, audit and existing access/privacy gates. For modern profiles stable governance is a developer input before sanitized user snapshot; store=false, strict JSON schema, no tools or raw documents. Reported model must match selected alias or date-suffixed snapshot of the same model, and usage totals must reconcile. No automatic retries or fallback on provider failure.

The production activation workflow is still explicit main-only exact-SHA manual dispatch, and is a public AI activation workflow, not a private pilot workflow. Do not run it for a private pilot. Model choice does not approve public access, data export, or production deployment. Live provider acceptance, actual project model permissions, latency, output quality in Arabic/English, refusal handling, budget reconciliation, data transfer and retention arrangements are still unqualified. Use synthetic cases first; never send private appraisal documents or tenant identity to qualify the model. GPT-6.2 is not an independent valuer; the deterministic calculation engine remains authoritative.

