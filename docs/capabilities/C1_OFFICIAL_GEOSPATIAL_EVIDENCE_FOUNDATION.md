# C1 — Official Geospatial Evidence & Municipal Intelligence

Status: **FOUNDATION / SANDBOX ONLY**  
Last public-source verification: **2026-09-29**  
Parent roadmap: **#464**  
Implementation issue: **#465**

## Purpose

C1 creates an evidence-first geospatial/municipal layer for Startak Real Estate. It is not a parcel-inference engine, legal zoning opinion, cadastral title opinion, certified valuation, or transaction authority.

The foundation follows:

**Research → Schema → Evidence Model → Sandbox → Tests → Governed Integration**

No production adapter is enabled by this foundation.

## Official-source matrix

| Source | Official scope verified from public service | C1 use | Machine-access conclusion | Production adapter |
|---|---|---|---|---|
| General Authority for Survey and Geospatial Information (GEOSA) — National Geospatial Platform | National geospatial infrastructure, open data/data requests, national geospatial catalogue and web services | roads, service context, POI / national geospatial context | dataset- and policy-dependent; access rights must be verified per dataset/service | **DISABLED** |
| Real Estate General Authority (REGA) — Geospatial Real Estate Portal | Interactive spatial/descriptive real-estate data including regions, cities, neighborhoods, land parcels and POI | parcel/plan context, POI, real-estate spatial context | public portal verified; public production API contract **not verified** | **DISABLED** |
| Balady — Urban Maps | Government digital map covering city geospatial data, road network, land-use classes/categories/areas and building requirements | land use, zoning/buildability evidence, municipal restrictions, roads/services | public service verified; public production API contract **not verified** | **DISABLED** |
| Real Estate Registry (RER) | Title registration/property documents, split/merge, rights/restrictions/obligations | parcel/title identity and future title-evidence capability | authenticated/service access; programmatic contractual access **not assumed** | **DISABLED** |

### Public references

- GEOSA National Geospatial Platform: `https://geoportal.geosa.gov.sa/geoportal/`
- GEOSA: `https://geosa.gov.sa/`
- REGA Geospatial Real Estate Portal: `https://rega.gov.sa/rega-services/platforms/geospatial-real-estate-portal/`
- Balady: `https://www.balady.gov.sa/`
- RER: `https://www.rer.sa/`

## Authority rules

Authority is **scope-specific**, not a single global source ranking.

Examples:
- GEOSA may support national geospatial context, but is not silently treated as a municipal zoning authority.
- RER may support title/property-right evidence, but is not treated as a zoning authority.
- Balady municipal/urban evidence cannot manufacture title ownership.
- REGA parcel display cannot automatically be promoted to a legal title determination.

The code registry explicitly constrains which evidence types each source may support.

## C1 evidence contract

Decision-critical C1 evidence requires:

- explicit evaluation `subjectId`;
- each record bound to the same subject/property;
- registered official source;
- evidence type within that source's declared authority scope;
- source reference;
- official-domain URL;
- explicit `VERIFIED` status;
- explicit verifier identity and verification reference;
- verifier identity present in the evaluator's trusted verifier list;
- official resolution method (not merely user supplied);
- observation timestamp that is not future-dated;
- explicit freshness policy identifier;
- freshness policy present in the evaluator's governed policy list;
- explicit validity end date;
- non-stale evidence at evaluation time;
- JSON-safe normalized value used for deterministic conflict detection.

Default C1 decision-readiness requires, for the **same subject**:

1. `PARCEL_IDENTITY`
2. `LAND_USE`
3. `ZONING_BUILDABILITY`

A use case may supply a different explicit required-evidence set, but the evaluator never invents missing evidence.

## Trust boundary

Raw evidence cannot make itself trusted by writing `verificationStatus=VERIFIED`.

The evaluator separately receives:

- `trustedVerifierIds`
- `governedFreshnessPolicyIds`

If these trust-policy inputs are absent or do not contain the record's verifier/policy, critical evidence remains `HOLD_EVIDENCE`.

This separates evidence payload content from the authority that decides who may verify it and which freshness policies are governed.

## Subject-isolation rule

Evidence for one property/deal cannot satisfy a required evidence type for another property/deal.

A record whose `subjectId` differs from the evaluator's requested subject is ineligible and produces a subject-mismatch blocker. This prevents cross-property evidence mixing.

## Normalized-value safety

Normalized evidence must be JSON-safe and deterministic. Cyclic values, non-finite numbers and unsupported runtime objects are rejected from critical readiness rather than being silently stringified into ambiguous hashes.

## Conflict rule

If two otherwise eligible records for the same critical evidence type produce different normalized-value hashes, C1 returns:

`HOLD_EVIDENCE`

It does not choose the source with the most convenient answer and does not average incompatible regulatory facts.

Identical values from independent eligible sources can be recorded as cross-source corroboration.

## Freshness rule

C1 does **not** invent a universal number of days for cadastral/zoning freshness. Decision-critical evidence must carry an explicit governed `freshnessPolicyId` and `validUntil`.

This avoids silently imposing an unsupported legal/municipal validity period.

## Explicit non-authority

Every C1 evaluation returns:

- `bindingZoningDetermination = false`
- `professionalValuationOpinion = false`
- `transactionAuthorized = false`
- `publicAiAuthorized = false`

## Integration gate

C1 may be developed and tested on an isolated branch now. Integration into the main decision flow remains gated by:

1. governed disposition of the current P25→P26→P27 remediation stack;
2. source/API/licensing evidence for any live adapter;
3. privacy/security review where location/property data can identify a person or private asset;
4. explicit trust-policy ownership for verifier and freshness registries;
5. regression + decision-integrity qualification;
6. no weakening of existing fail-closed controls.

Current authority boundaries remain:

- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
