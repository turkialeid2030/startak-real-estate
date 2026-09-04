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
