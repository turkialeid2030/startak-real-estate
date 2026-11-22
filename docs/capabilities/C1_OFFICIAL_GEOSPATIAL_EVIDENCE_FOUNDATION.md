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

## Sandbox ingestion boundary

`src/geospatial/sandbox-evidence-draft.js` provides a non-authorizing draft adapter for Phase 0.

It may capture a proposed evidence value only when:
- the source is already present in the official-source registry;
- the source is registered for that evidence type;
- the supplied URL belongs to the registered official domain.

The adapter always outputs:
- `verificationStatus = UNVERIFIED`;
- `verifiedBy = null`;
- `verificationReference = null`;
- `sandboxOnly = true`;
- `productionConnectorUsed = false`;
- `decisionReady = false`;
- `transactionAuthorized = false`;
- `publicAiAuthorized = false`.

Raw sandbox input is forbidden from setting trust/authority fields such as `verificationStatus`, `verifiedBy`, `decisionReady` or `transactionAuthorized`.

Therefore Sandbox ingestion can prepare material for later governed verification, but cannot create trust or decision readiness by itself.

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

## UMAPS government portal registered for manual source review — 2026-11-22

- **Direct official portal:** https://umaps.momah.gov.sa/
- **Authority's public service description:** https://momah.gov.sa/ar/e-services/urban-maps
- **Verified public service scope (not a data license):** Saudi urban/geospatial layers with streets, parcels, services, land-use classifications, areas and building regulations; users may inspect, measure and share displayed information.
- **Observed access boundary:** portal presents username/password or unified-login authentication. The public service description does **not** prove a public programmatic API, a commercial bulk-extraction license, unattended machine access or verified property-specific data.
- **C1 registry implementation:** `BALADY_URBAN_MAPS` accepts exact secure host `umaps.momah.gov.sa` in addition to existing Balady domains. `publicReferenceUrl` points directly to the official portal. `machineAccessStatus=PUBLIC_API_NOT_VERIFIED`, `productionAdapterEnabled=false`.
- **Property study UI:** a read-only external UMAPS link beside the user-entered location opens the official site in a separate tab; the link never appends a subject ID, coordinates, title, token, parcel number or user data. It does **not** embed or scrape the government's app.
- **Owner workflow:** manually use the official map to review *plan ID, parcel ID, use, building regulations, roads and municipal constraints* for a subject; save a **source-specific dated review/reference** via the existing governed evidence path. All manual imports start `UNVERIFIED`. A separately appointed reviewer must resolve parcel identity against an authorized title/plan document, verify intended use and effective regulatory rules, establish a governed freshness policy and authenticate the source before an evidence gate can change status. Location/land-use display is **not proof of legal title or certified zoning**.
- **Security:** source-reference matching now requires HTTPS, an exact registered hostname, default TLS port and no URL userinfo; fake subdomains, HTTP and credential-embedded URLs fail. Browser credentials and session cookies must never be copied into Startak's source registry.
- **Data rights:** no permission to reproduce, republish, systematically extract or cache urban map layers is inferred. The Ministry's general open-data policy must not be treated as a UMAPS API authorization or blanket commercial redistribution license. Request a written usage/API agreement and privacy/security review before enabling any live adapter.

**Acceptance scope:** link and source-host validation under synthetic tests, no production integration, `COMMERCIAL_GO_LIVE=HOLD`, and no binding municipal determination.
