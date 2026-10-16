# Atomic quota worker — staged, not activated

This worker is not yet connected to `functions/api/riai/ai-assist.js`. The current
gateway's KV quota path remains an open N08 finding. Do not enable provider
traffic on the strength of these isolated tests.

`quota.mjs` reserves minute/subject-day/global-day requests and token capacity in
one persistent transaction. All production callers must use ONE shared actor
name (for example `riai-global-quota-v1`), not one actor per user: separate actors
cannot enforce a global cap. Only the Pages server may call the binding. The
worker's public fetch handler always returns 403.

Before activation:

1. Deploy this separate Durable Object worker and bind its `RiaiQuota` namespace
   to Pages as `RIAI_AI_QUOTA`; verify the same deployment/environment is used.
2. Replace both legacy KV admission paths with `/reserve`. Hash the subject on
   the server. Generate the invocation ID on the server. Never retry a provider
   request when a reservation is returned with `replayed: true`.
3. Reserve a qualified upper bound from the COMPLETE provider request, including
   instructions, protocol overhead and output budget. The old snapshot-bytes/3
   estimate is not a proven upper bound and must not be reused unchanged.
4. Settle once using verified provider usage. Missing usage, timeouts, interrupted
   requests and uncertain provider outcomes retain the full reservation. Repeated
   settlement must agree exactly. An overage charges the actual amount and blocks
   that day pending reconciliation; it is not proof the initial ceiling held.
5. Qualify real Durable Object concurrency, restart/persistence, errors, bounded
   binding calls, midnight settlement and the gateway's fail-closed behavior.
   Configure storage retention/cleanup without deleting active reservations.
6. Keep AI disabled until exact-tree deployment and these integration gates pass.

Tests use a serialized transactional in-memory double with rollback. They check
the algorithm, not Cloudflare's deployed binding or financial billing correctness.
Token counts are not monetary costs; currency/model-price limits remain separate.

Official implementation references:
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
