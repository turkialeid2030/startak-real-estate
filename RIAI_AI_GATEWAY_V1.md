# RIAI AI Gateway v1

## Purpose

Adds a server-side, provider-agnostic narrative-analysis boundary for Residential Income Acquisition Intelligence (RIAI). The deterministic acquisition score remains the auditable source of truth. AI is limited to structured observations, risk explanations, evidence gaps, due-diligence questions, scenario checks, and early-warning indicators.

## Privacy and evidence boundary

The browser must send only the output of `buildResidentialIncomeAiDecisionSnapshot(viewModel)`.

The snapshot intentionally excludes:

- raw operating-case payloads;
- tenant names or tenant-level records;
- evidence-document text;
- exact property addresses and project titles;
- document binaries or attachments.

The gateway rejects snapshots that do not explicitly assert those exclusions.

## Decision boundary

The gateway must not return or imply:

- buy/sell/proceed/reject/approve recommendations;
- a regulated investment recommendation;
- a legal, title, zoning, subdivision, permit, lease, tax, or regulatory conclusion;
- valuation certification;
- financing approval;
- transaction authorization.

Allowed output keys are constrained and the response is sanitized before it reaches the browser. `investmentRecommendation`, `investmentDecision`, and `legalConclusion` are always `null`; `transactionAuthorized` is always `false`.

## Provider configuration

The Cloudflare Pages Function is `POST /api/riai/ai-assist` and uses server-side environment variables only:

- `RIAI_AI_PROVIDER_URL` — HTTPS endpoint for an OpenAI-compatible JSON chat-completions interface.
- `RIAI_AI_ALLOWED_HOSTS` — comma-separated host allowlist. The endpoint host must be explicitly listed.
- `RIAI_AI_PROVIDER_KEY` — provider credential; never exposed to the browser or repository.
- `RIAI_AI_MODEL` — explicit provider model identifier.

If any required configuration is absent, the endpoint fails closed with `AI_PROVIDER_NOT_CONFIGURED` and `aiModelUsed=false`.

## Operational controls

- HTTPS-only provider endpoint.
- Explicit provider-host allowlist to prevent arbitrary outbound requests/SSRF.
- 32 KiB request cap and 64 KiB provider-response cap.
- 15 second provider timeout.
- `Cache-Control: no-store` on gateway responses.
- No provider credential in frontend source or persisted deal records.
- No raw chain-of-thought request or response; the provider is instructed to return concise structured conclusions only.
- AI output cannot alter NPV, IRR, NOI, cap rates, terminal value, acquisition price limits, or the deterministic analytical score.

## Activation status

Code path: IMPLEMENTED.
Provider credential/model activation: EXTERNAL CONFIGURATION REQUIRED.
Automatic investment/legal decisioning: PROHIBITED.
