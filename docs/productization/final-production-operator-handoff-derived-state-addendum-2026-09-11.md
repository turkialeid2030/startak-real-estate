# Final Production Operator Handoff — Derived-State Integrity Addendum

## Superseding operator rule

For any real E2F → E2G → E2H → E2I production-readiness operation, the production operator must use:

```text
node tools/production-go-live-runbook-strict.js ...
```

The earlier `production-go-live-runbook.js` remains useful for structural/pinning regression and historical compatibility, but it must not be treated as the complete production trust boundary by itself because the current E2F/E2G/E2H/E2I packet hashes cover core records rather than every derived status/authority field.

## Required trust composition

A stage is eligible to drive the next production step only when all of the following are true:

1. the packet core hash is internally valid;
2. that packet hash matches the independently retained out-of-band pin;
3. the packet's derived status/authorization/execution/readiness fields are deterministically consistent with the records covered by the packet hash;
4. the exact cross-stage packet ID/hash link is intact;
5. the exact release candidate tuple is unchanged;
6. the applicable registry hash is independently pinned and the required signatures/evidence have been verified by the governed stage factory/aggregator.

No single condition substitutes for another.

## Hard-stop rule

Any strict-runbook result containing:

`<STAGE>_DERIVED_STATE_INTEGRITY_INVALID`

is a production hard stop. Do not repair the JSON by editing status or boolean fields. Recreate the stage packet through the governed factory from the trusted upstream packet, registry, signatures and evidence.

## No authority expansion

This addendum does not authorize release, merge, deployment, canonical-registry activation, Cloudflare mutation, AI activation, go-live, professional valuation issuance or transactions. It only strengthens the validation required before the already-governed human/external sequence may continue.
