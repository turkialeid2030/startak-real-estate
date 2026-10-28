# STARTAK Real Estate — appraisal integrated delivery and remaining external gates

## Engineering deliverables in the combined change

This change deliberately extends **existing**, not duplicated, models. It adds
- a specialist appraisal evidence preflight for hotel operating NOI and ADR/RevPAR, mall GLA and rental mix, warehouse specification and income, and fuel-station separation of landlord rent from operator income;
- historical executed-transaction holdout metrics and out-of-sample/leakage rejection, with explicit rejection of valuation reports as sale-price labels;
- an optional encrypted server-side evidence storage **contract** using AES-256-GCM with external key-provider and storage adapter, tenant-scoped authenticated roles, immutable document IDs, SHA-256 checks and ciphertext tamper rejection.

None of these modules is an independent real estate valuer, a professionally certified pricing engine or a deployed institutional storage service. Input references and boolean attestations do **not** prove that regulatory approvals or independent validation took place.

## Absolutely not complete without external dependency

| Work | Status / evidence boundary |
| --- | --- |
| Licensed production real-estate data | NOT_CONNECTED; no verified signed historical holdout sample supplied |
| Real sector-specific appraisal models | Existing hospitality / commercial / logistics engines are present, but independent specialist inputs and property-specific calibration unverified |
| Institutional document vault | Server-side encryption and role contract only; NO production KMS, backend-authenticated identity, durable store, backup, key rotation, audit retention, deletion process or penetration test supplied |
| Legal title / ownership checks | NOT_CONNECTED to official land rights or case-specific authoritative title |
| All export channels and saved transactions | Research-session gates implemented for designated paths; universal professional report/export permission not proved |
| Independent professional review | NOT_SUBMITTED / NOT_AUTHORIZED |
| E2F / E2G release and commercial publication | HOLD / NOT_AUTHORIZED, no human signoff or production deployment |

## Data safety and validation

No real user's appraisal, deed, owner, rent roll, confidential report values or repository-inaccessible files are committed. All unit tests use synthetic records. The existence of 35 received appraisal documents cannot establish 35 independent transactions, market representativeness or a validated prediction-accuracy percentage. Holdout measurement must use explicitly rights-cleared, deduplicated real executed transactions that were not in the training sample, with prediction made on/before the actual transaction date.

The existing PR #764 is a draft stack on #763. It must pass full CI on the final SHA. Any conversion of an appraisal input into a certified/authoritative property valuation requires separate legal and professional signoffs. Full-scope external gates stay open under issue #765.

## Integration in valuation report intake UI

The sector preflight is now invoked by the existing appraisal audit when the manually entered asset type is HOTEL, WAREHOUSE, LOGISTICS_PARK or COMMERCIAL_MALL (and additionally FUEL_STATION for headless use). The Arabic reviewer workbench displays sector-specific manually verified numeric fields and documents, returns a HOLD issue for incomplete evidence, and reuses the existing appraisal HOLD decision bridge. This does not compute a new property value, import OCR into financial inputs, or authorize specialized professional valuation. All supporting data remain transient in the local session.
