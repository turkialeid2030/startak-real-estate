# Atomic quota worker — gateway integrated, deployment unqualified

The gateway now calls this namespace before any provider request. Missing or
failed bindings block traffic; legacy KV admission exports always reject.
Deployment and real runtime qualification are still outstanding. Do not enable
provider traffic on the strength of the synthetic tests.

`quota.mjs` reserves minute/subject-day/global-day requests and token capacity in
one persistent transaction. All production callers must use ONE shared actor
name (for example `riai-global-quota-v1`), not one actor per user: separate actors
cannot enforce a global cap. Only the Pages server may call the binding. The
worker's public fetch handler always returns 403.

Before activation:

1. Deploy this separate Durable Object worker and bind its `RiaiQuota` namespace
   to Pages as `RIAI_AI_QUOTA`; verify the same deployment/environment is used.
2. Verify the integrated `/reserve` path: subject hashes and invocation IDs are
   server-generated; replayed reservations cannot authorize another provider call.
   Binding requests have a three-second deadline; uncertain reservations remain.
3. Set and independently qualify `RIAI_AI_INPUT_TOKEN_UPPER_BOUND` for the actual
   model/protocol and hidden overhead. The gateway requires it to cover the full
   serialized request byte count and adds the output cap. This configuration
   check alone is NOT proof of a model-specific billing bound. The old
   snapshot-bytes/3 estimate is no longer used for admission.
4. Verify settlement using internally consistent provider usage fields. This
   validates the provider response structure, not an independent billing record.
   Missing usage, timeouts, interrupted
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
