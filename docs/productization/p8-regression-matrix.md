# P8 Regression Matrix

The executable P8 suite is `tests/runtime/run_authenticated_operations_service_tests.js` and is automatically discovered by the canonical `release:verify` test-discovery step because every JavaScript file under `tests/runtime` is executed.

| Test | Control |
|---|---|
| PRODUCTIZATION-P8-01 | constructor fails closed when authentication boundary is missing |
| PRODUCTIZATION-P8-02 | authenticated ADMIN receives only the bounded read-only HOLD snapshot; authority flags remain false; secrets do not leak |
| PRODUCTIZATION-P8-03 | non-ADMIN principal is denied before workspace access |
| PRODUCTIZATION-P8-04 | caller actor/tenant/role/identity overrides are rejected before authentication/runtime work |
| PRODUCTIZATION-P8-05 | caller production/release/merge/deployment/transaction authority overrides are rejected |
| PRODUCTIZATION-P8-06 | persistence capability disclosure is allowlisted and cannot self-validate production persistence |
| PRODUCTIZATION-P8-07 | authenticated tenant and persisted workspace tenant mismatch fails closed |
| PRODUCTIZATION-P8-08 | malformed/unverified identity context is rejected |
| PRODUCTIZATION-P8-09 | operations service exposes no save/delete/update mutation API |

Passing these tests validates the code contract only. It does not establish the external production controls listed in the P8 qualification checklist.
