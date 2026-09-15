# Productization P8 — Authenticated Admin Operations Runtime

## Purpose

Add a read-only operational inspection boundary above the authenticated canonical workspace without turning code-level capability into production evidence.

This slice is stacked on Productization P7 and must remain Draft until the existing release-governance process authorizes otherwise.

## Runtime boundary

`src/runtime/authenticated-operations-service.js` provides an `ADMIN`-only `INSPECT_OPERATIONS` action.

The runtime:

- derives actor and tenant authority exclusively from a verified identity context returned by the configured authenticator;
- derives workspace/project/case scope from the authenticated canonical workspace load result;
- rejects caller-supplied identity, actor, tenant, role, production-validation, release, merge, deployment, or transaction authority overrides;
- exposes only an allowlisted operational snapshot;
- keeps production authentication and persistence validation false;
- emits an in-memory security audit event for the inspection while explicitly reporting that durable audit persistence is not established;
- exposes no workspace mutation API.

## Persistence capability disclosure

Only the following persistence capability signals may be disclosed:

- atomic compare-and-set capability;
- tenant-key isolation capability;
- structured tenant scope capability;
- whether external database deployment is still required;
- the fixed statement `productionPersistenceValidated=false`.

Provider instances, connection strings, credentials, JWT/JWKS material, cookies, session data, arbitrary environment variables, and configuration objects are not serialized through this boundary.

A provider-supplied claim of `productionPersistenceValidated=true` cannot elevate the runtime response.

## External evidence still required

This code does not establish or validate:

- a production identity provider;
- production database deployment or connectivity;
- PostgreSQL RLS or runtime IDOR resistance;
- backup/restore controls;
- disaster recovery;
- production monitoring/alerting;
- incident response procedures;
- production secrets management;
- penetration testing;
- legal, PDPL, Taqeem, IVS, or RICS conformance;
- release, merge, deployment, go-live, or transaction authority.

Operational status therefore remains `HOLD_EXTERNAL_PRODUCTION_EVIDENCE`.

## Authority

The runtime and this slice keep these values false:

- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `deploymentAuthorized=false`
- `transactionAuthorized=false`
- `productionAuthenticationValidated=false`
- `productionPersistenceValidated=false`

## Regression coverage

`tests/runtime/run_authenticated_operations_service_tests.js` covers ADMIN authorization, non-ADMIN denial, caller authority injection rejection, tenant-scope mismatch rejection, secret/config allowlisting, non-elevation of production persistence claims, audit attribution, read-only surface enforcement, and preservation of all authority flags as false.
