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

Decision-language filtering applies to all narrative arrays, risk rationales, early-warning text, and the final `decisionBoundary`. The browser-side contract independently re-validates the same boundary, so an invalid provider response cannot be accepted merely because it reached the client.

## Prompt-injection boundary

All fields in the sanitized decision snapshot are treated as **untrusted data, not instructions**. The system prompt instructs the provider to ignore any embedded prompt, role, policy, behavior-change request, secret-retrieval request, or governance override that might appear in a snapshot field. Snapshot text cannot supersede the system governance boundary.

No raw chain-of-thought, hidden policy, system instruction, credential, or secret is requested from the model or accepted as a legitimate output objective.

## Mandatory production access control

The AI route is a quota-bearing server function and **must not be activated as an anonymous public endpoint**. Production activation requires Cloudflare Access in front of the application/route and cryptographic verification inside the Pages Function before any AI-provider request is made.

Required server-side variables:

- `RIAI_AI_ACCESS_ISSUER` — the HTTPS Cloudflare Access issuer/team domain, for example the tenant-specific `https://<team>.cloudflareaccess.com` issuer.
- `RIAI_AI_ACCESS_AUD` — the expected Cloudflare Access application audience tag.

The gateway requires `Cf-Access-Jwt-Assertion` and verifies:

- JWT structure and `RS256` algorithm;
- `kid` signing-key identifier;
- token expiry (`exp`) and not-before (`nbf`) constraints;
- exact configured issuer;
- expected audience;
- the issuer certificate set from `/cdn-cgi/access/certs`;
- RSA PKCS#1 v1.5 SHA-256 signature with Web Crypto.

It also rejects cross-origin `Origin` values and cross-site `Sec-Fetch-Site` requests. Missing or invalid Access configuration fails closed before provider configuration is evaluated.

Local unauthenticated development is permitted only when **both** conditions are true:

1. `RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED=true`; and
2. the request hostname is `localhost`, `127.0.0.1`, or `::1`.

This override must never be configured in Cloudflare production environments.

## Provider configuration

The Cloudflare Pages Function is `POST /api/riai/ai-assist` and uses server-side environment variables only:

- `RIAI_AI_PROVIDER_URL` — HTTPS endpoint for an OpenAI-compatible JSON chat-completions interface.
- `RIAI_AI_ALLOWED_HOSTS` — comma-separated host allowlist. The endpoint host must be explicitly listed.
- `RIAI_AI_PROVIDER_KEY` — provider credential; never exposed to the browser or repository.
- `RIAI_AI_MODEL` — explicit provider model identifier.
- `RIAI_AI_MAX_OUTPUT_TOKENS` — optional bounded output-token ceiling. Default `1200`; accepted range `128..4096`.
- `RIAI_AI_TOKEN_LIMIT_FIELD` — optional provider-compatibility selector. Allowed values are only `max_tokens` or `max_completion_tokens`; default is `max_tokens`.

Invalid token-budget configuration fails closed and does not invoke the provider. If Access is valid but any required provider configuration is absent, the endpoint fails closed with `AI_PROVIDER_NOT_CONFIGURED` and `aiModelUsed=false`.

## Operational controls

- Cloudflare Access verification occurs before AI-provider invocation.
- HTTPS-only Access issuer restricted to `cloudflareaccess.com` or its subdomains.
- HTTPS-only AI-provider endpoint.
- Explicit provider-host allowlist to prevent arbitrary outbound requests/SSRF.
- Same-origin browser request controls.
- 32 KiB request cap and 64 KiB provider-response cap.
- 15 second provider timeout and 5 second Access-certificate timeout.
- Bounded provider output-token budget with a fixed safe default and hard min/max limits.
- Provider token-limit field is selected from a two-value allowlist; arbitrary request-field injection is prohibited.
- `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer` on gateway responses.
- No provider credential in frontend source or persisted deal records.
- No raw chain-of-thought request or response; the provider is instructed to return concise structured conclusions only.
- AI output cannot alter NPV, IRR, NOI, cap rates, terminal value, acquisition price limits, or the deterministic analytical score.
- AI review is manually invoked by the user and the result remains ephemeral UI state.

Cloudflare Access is authentication/authorization, not a substitute for quota management. Before external or institutional use, configure Cloudflare Rate Limiting/WAF or an equivalent account-level quota control for `/api/riai/ai-assist`. This account-level control is intentionally not simulated with an in-memory application limiter.

## Production activation sequence

1. Create/configure the Cloudflare Access application and identity policy for the intended authorized users.
2. Obtain the Access issuer and application audience tag.
3. Set `RIAI_AI_ACCESS_ISSUER` and `RIAI_AI_ACCESS_AUD` as Cloudflare server-side environment variables.
4. Configure `RIAI_AI_PROVIDER_URL` and the exact `RIAI_AI_ALLOWED_HOSTS` allowlist.
5. Store `RIAI_AI_PROVIDER_KEY` as a secret and set `RIAI_AI_MODEL` explicitly.
6. Set the provider-compatible token ceiling: normally `RIAI_AI_MAX_OUTPUT_TOKENS=1200`; set `RIAI_AI_TOKEN_LIMIT_FIELD=max_completion_tokens` only when the selected provider/model requires that field instead of `max_tokens`.
7. Configure an account-level rate limit / WAF quota for `/api/riai/ai-assist` appropriate to the authorized pilot population and provider budget.
8. Confirm `RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED` is absent/false in production.
9. Run an authenticated synthetic AI review and verify a structured response.
10. Confirm an unauthenticated request returns `AI_ACCESS_REQUIRED` and does not invoke the provider.
11. Confirm a wrong-audience or wrong-issuer token is rejected.
12. Submit adversarial snapshot text containing embedded instructions and confirm it cannot override the system/decision boundary.
13. Confirm forbidden decision language in `decisionBoundary` is rejected.
14. Re-run the canonical release, comprehensive browser, and deep-platform gates before institutional activation.

## Activation status

Code path: IMPLEMENTED.
Cloudflare Access configuration: EXTERNAL CONFIGURATION REQUIRED.
Provider credential/model activation: EXTERNAL CONFIGURATION REQUIRED.
Account-level rate limiting/WAF quota: EXTERNAL CONFIGURATION REQUIRED.
Automatic investment/legal decisioning: PROHIBITED.

## Wave C application-level guardrails

Wave C adds a fail-closed KV-backed rate limiter before provider invocation, an independent server-side token-shape privacy discipline over the decision snapshot, and a best-effort hash-only audit trail.

Required Cloudflare bindings/secrets before production AI activation:
- `RIAI_RATE_LIMIT_KV` — required; missing binding returns `503 AI_RATE_LIMIT_STORE_UNAVAILABLE`.
- `RIAI_AUDIT_KV` — recommended; audit is best-effort and does not block the user response.
- `RIAI_AUDIT_SUBJECT_SALT` — set as a real secret in production.
- Optional limits: `RIAI_AI_RATE_PER_MINUTE` (default 6), `RIAI_AI_RATE_PER_DAY` (default 60), `RIAI_AI_RATE_GLOBAL_PER_DAY` (default 2000).

Workers KV counters are eventually consistent and are a spend guard, not a strict security boundary. Keep account-level Cloudflare WAF/rate limiting in front of this endpoint; use a Durable Object if atomic counting becomes mandatory.
