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

The AI route is a quota-bearing server function and must never execute as an unprotected anonymous provider proxy. Production supports two explicit, fail-closed access modes:

1. **Cloudflare Access mode** for authenticated/internal users. A presented `Cf-Access-Jwt-Assertion` is cryptographically verified and, if invalid, is rejected. An invalid Access assertion never falls back to the public path.
2. **Public Turnstile mode** for intentionally enabled public use. This mode is disabled by default and is available only when `RIAI_PUBLIC_AI_ENABLED=true`. It requires a valid Cloudflare Turnstile token, exact hostname/action verification, same-origin request checks, application rate limits, and the global AI token-budget guard before provider invocation.

If public AI is disabled and no valid Access assertion is supplied, the route remains governed by the Cloudflare Access configuration and fails closed when Access is absent or not configured.

### Cloudflare Access variables

- `RIAI_AI_ACCESS_ISSUER` — the HTTPS Cloudflare Access issuer/team domain, for example `https://<team>.cloudflareaccess.com`.
- `RIAI_AI_ACCESS_AUD` — the expected Cloudflare Access application audience tag.

Cloudflare Access verification checks:

- JWT structure and `RS256` algorithm;
- `kid` signing-key identifier;
- token expiry (`exp`) and not-before (`nbf`) constraints;
- exact configured issuer;
- expected audience;
- the issuer certificate set from `/cdn-cgi/access/certs`;
- RSA PKCS#1 v1.5 SHA-256 signature with Web Crypto.

### Public Turnstile variables

- `RIAI_PUBLIC_AI_ENABLED=true` — explicit public-mode activation switch.
- `RIAI_TURNSTILE_SITE_KEY` — public browser site key returned only by the non-secret public config endpoint.
- `RIAI_TURNSTILE_SECRET_KEY` — server-side secret used only for Siteverify.
- `RIAI_AUDIT_SUBJECT_SALT` — server-side secret used to hash the Cloudflare connecting IP into a pseudonymous subject; the raw IP is not persisted.
- `RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY` — required positive integer daily estimated-token budget.

Turnstile verification requires the expected `riai_ai_assist` action and exact request hostname. Turnstile tokens are not sent to the AI provider and are not written to the audit store.

The route rejects cross-origin `Origin` values and cross-site `Sec-Fetch-Site` requests before external verification/provider calls.

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

Invalid provider or token-budget configuration fails closed and does not invoke the provider.

## Operational controls

- Same-origin enforcement occurs before Cloudflare Access, Turnstile, or AI-provider invocation.
- Cloudflare Access verification occurs before AI-provider invocation whenever an Access assertion is present or public mode is disabled.
- Presented invalid Access assertions never downgrade to Turnstile.
- Public Turnstile verification occurs before provider invocation when public mode is explicitly enabled and no Access assertion is presented.
- HTTPS-only Access issuer restricted to `cloudflareaccess.com` or its subdomains.
- HTTPS-only AI-provider endpoint.
- Explicit provider-host allowlist to prevent arbitrary outbound requests/SSRF.
- 32 KiB request cap and 64 KiB provider-response cap.
- 15 second provider timeout and 5 second Access-certificate timeout.
- Bounded provider output-token budget with a fixed safe default and hard min/max limits.
- Required global daily estimated-token reservation guard before provider invocation.
- Provider token-limit field is selected from a two-value allowlist; arbitrary request-field injection is prohibited.
- `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer` on gateway responses.
- No provider credential, Turnstile secret, raw connecting IP, or Turnstile token is persisted in client state or audit payloads.
- No raw chain-of-thought request or response; the provider is instructed to return concise structured conclusions only.
- AI output cannot alter NPV, IRR, NOI, cap rates, terminal value, acquisition price limits, or the deterministic analytical score.
- AI review is manually invoked by the user and the result remains ephemeral UI state.

Cloudflare Access/Turnstile are access-control layers, not substitutes for quota management. Keep Cloudflare Rate Limiting/WAF or an equivalent account-level quota control for `/api/riai/ai-assist` in addition to the application KV rate and token-budget guards.

## Production activation sequence

1. Keep `RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED` absent/false in production.
2. Confirm `RIAI_RATE_LIMIT_KV` and `RIAI_AUDIT_KV` bindings are present.
3. Configure `RIAI_AUDIT_SUBJECT_SALT` as a server-side secret.
4. Configure `RIAI_AI_PROVIDER_URL`, exact `RIAI_AI_ALLOWED_HOSTS`, `RIAI_AI_PROVIDER_KEY`, and `RIAI_AI_MODEL`.
5. Set `RIAI_AI_MAX_OUTPUT_TOKENS` and, only if required by the selected provider, `RIAI_AI_TOKEN_LIMIT_FIELD`.
6. Set `RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY` to a positive daily budget.
7. For internal/authenticated operation, configure the Cloudflare Access application, `RIAI_AI_ACCESS_ISSUER`, and `RIAI_AI_ACCESS_AUD`.
8. For intentional public operation, create a Turnstile widget, set `RIAI_TURNSTILE_SITE_KEY` and secret `RIAI_TURNSTILE_SECRET_KEY`, then set `RIAI_PUBLIC_AI_ENABLED=true` only after the remaining controls are verified.
9. Configure account-level Cloudflare Rate Limiting/WAF for `/api/riai/ai-assist` appropriate to the authorized population and provider budget.
10. Run an authenticated Access synthetic review and verify a structured response when Access mode is used.
11. Run a Turnstile-protected synthetic review when public mode is enabled and verify a structured response.
12. Confirm a missing/invalid Turnstile token fails closed and does not invoke the provider.
13. Confirm a presented malformed/wrong-audience/wrong-issuer Access assertion is rejected and never falls back to Turnstile.
14. Confirm a cross-origin or cross-site request is rejected before any external verification/provider call.
15. Confirm a missing global token budget fails closed and an exhausted budget returns a quota response before provider invocation.
16. Submit adversarial snapshot text containing embedded instructions and confirm it cannot override the system/decision boundary.
17. Confirm forbidden decision language in `decisionBoundary` is rejected.
18. Re-run the canonical release, comprehensive browser, and deep-platform gates before production activation.

## Activation status

Code path: IMPLEMENTED.
Cloudflare Access configuration: EXTERNAL CONFIGURATION REQUIRED FOR ACCESS MODE.
Cloudflare Turnstile configuration: EXTERNAL CONFIGURATION REQUIRED FOR PUBLIC MODE.
Provider credential/model activation: EXTERNAL CONFIGURATION REQUIRED.
Account-level rate limiting/WAF quota: EXTERNAL CONFIGURATION REQUIRED.
Automatic investment/legal decisioning: PROHIBITED.

## Wave C/Wave D application-level guardrails

Wave C added a fail-closed KV-backed rate limiter, independent server-side snapshot privacy discipline, and a best-effort hash-only audit trail. Wave D adds explicit public-mode Turnstile verification and a global estimated-token reservation guard before provider invocation while retaining Access as the authenticated/internal path.

Required Cloudflare bindings/secrets before production AI activation:

- `RIAI_RATE_LIMIT_KV` — required; missing binding returns `503 AI_RATE_LIMIT_STORE_UNAVAILABLE`.
- `RIAI_AUDIT_KV` — recommended; audit is best-effort and does not block the user response.
- `RIAI_AUDIT_SUBJECT_SALT` — required for public subject hashing; configure as a real secret.
- `RIAI_AI_GLOBAL_TOKEN_BUDGET_PER_DAY` — required positive integer.
- Optional rate limits: `RIAI_AI_RATE_PER_MINUTE` (default 6), `RIAI_AI_RATE_PER_DAY` (default 60), `RIAI_AI_RATE_GLOBAL_PER_DAY` (default 2000).

Workers KV counters are eventually consistent and are operational spend guards, not strict atomic billing caps. Keep account-level Cloudflare WAF/rate limiting in front of this endpoint; use a Durable Object if atomic counting becomes mandatory.
