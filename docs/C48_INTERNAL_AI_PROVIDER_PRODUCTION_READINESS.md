# C48 — Internal AI Provider Production Readiness

## Scope

C48 prepares the engineering control boundary required before an AI provider could ever be considered for production use. It is stacked on the exact C47 qualified head `e3dbbe1932751fff2f8b3ed45e5c2872d9d7199a`.

Internal engineering decision target: **READY_FOR_INDEPENDENT_PROVIDER_AUTHORIZATION_REVIEW**.

C48 does not satisfy external gate #547, does not authorize `PUBLIC_AI`, and does not create a production provider invocation path.

## Control objective

The production provider decision must be evidence-bound to:

- the exact candidate Git SHA;
- the governed AI use case;
- provider identity;
- model identity and pinned version or separately governed model-selection policy;
- production credential isolation from development/test environments;
- data handling and disclosure rules;
- retention terms;
- prohibition on provider training with customer data where required by the governed profile;
- residency and cross-border controls;
- provider logging controls;
- DLP controls;
- prompt registry/version control;
- role authorization;
- production environment authorization;
- tested kill switch;
- immutable evidence hashes and an identifiable independent reviewer.

## Engineering hard gates

`src/ai/provider-production-readiness.js` implements a separate production-readiness layer rather than weakening C23.

The existing C23 live provider gateway remains restricted to `ISOLATED_NON_PRODUCTION`. C48 therefore does **not** introduce a production mode into the current provider gateway.

C48 additionally enforces:

1. production and non-production credentials must be separated;
2. secret values cannot be stored in the production-readiness record;
3. customer-data training must remain false;
4. DLP and kill-switch controls must be validated;
5. the record must be bound to an exact 40-character candidate SHA, provider, model/version and use case;
6. internal engineering records cannot set `productionProviderUseAuthorized`, `publicAiAuthorized` or `productionInvocationAuthorized` to true;
7. external authorization evidence marked `NOT_SUPPLIED` cannot carry synthetic approval metadata;
8. a structurally complete `SUPPLIED_VERIFIED` record is only **ready for C30 gate ingestion**; it does not itself activate production;
9. a rejected independent authorization results in `REJECTED`;
10. production invocation remains blocked because C48 deliberately provides no production execution adapter and C30 gate authority is not consumed by runtime code.

## Authorization boundary

A working API key is not production authorization.

The following are also invalid substitutes for independent authorization:

- successful sandbox calls;
- C23/C29/C48 tests;
- CI success;
- provider marketing material;
- an internal engineering memorandum;
- an AI-generated statement;
- mere existence of a provider account or network connectivity.

## External gate #547

The authoritative external gate remains issue #547: `AI_PROVIDER_PRODUCTION_AUTHORIZATION`.

The independent artifact must identify the exact candidate SHA/build and governed use case, provider/model/version or governed model-selection policy, production credential separation, applicable data handling/retention/training/residency/logging controls, DLP/prompt/role/environment/kill-switch controls, reviewer/approver identity and date, and an immutable artifact SHA-256.

Until that evidence is independently supplied and accepted by the external gate:

- `C48_GATE_547_SATISFIED=FALSE`
- `PUBLIC_AI=FALSE`
- `C48_PRODUCTION_INVOCATION_AUTHORIZED=FALSE`
- `C48_DEPLOYMENT_AUTHORIZED=FALSE`
- `C48_COMMERCIAL_GO_LIVE_AUTHORIZED=FALSE`

## Candidate SHA handling

A file cannot safely contain the SHA of the commit that contains the file without creating a self-referential hash problem. Therefore C48 binds the exact candidate at runtime in CI using the pull-request head SHA. Any future external authorization artifact must state that exact resulting candidate SHA explicitly.

## Bounded internal claim

C48 may claim only:

**INTERNAL_AI_PROVIDER_PRODUCTION_READINESS_QUALIFIED_READY_FOR_INDEPENDENT_PROVIDER_AUTHORIZATION_REVIEW_EXTERNAL_GATE_547_HOLD**

It may not claim provider production authorization, `PUBLIC_AI=true`, production invocation authority, legal/privacy approval, deployment authorization, or commercial go-live authorization.
