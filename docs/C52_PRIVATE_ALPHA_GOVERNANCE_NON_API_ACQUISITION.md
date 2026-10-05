# C52 — Private Alpha Governance + Non-API Data Acquisition

## Decision

The current Startak Real Estate operating phase is **PRIVATE_ALPHA**: owner-only, private, non-commercial, experimental and test-oriented.

The eight C30 external evidence gates remain valid as **commercial/public-production readiness gates**, but missing external evidence does not by itself block a strictly private-alpha deployment.

C30 evidence is not rewritten or fabricated. Missing evidence remains `NOT_SUPPLIED`; C30 commercial posture remains preserved. C52 creates a separate private-alpha operating lane on top of qualified C51 historical-replay readiness.

## Private Alpha authorization rule

A private-alpha deployment may proceed only when:

- the platform is owner-only;
- there is no public access or commercial use;
- no transaction execution or approval authority is granted;
- no certified valuation claim is made;
- no public AI authority is implied;
- there is no technical/upstream `NO_GO`;
- there is no unresolved non-external technical `HOLD`;
- no credential, CAPTCHA, access-control or rate-limit bypass is used.

External C30 evidence holds are retained as advisory readiness items for future commercial/public production.

## Non-API-first acquisition policy

An API is **not required and not preferred by default** in PRIVATE_ALPHA. Data acquisition is planned through a governed fallback chain selected by source/access mode.

### Public web sources

1. Direct HTTPS fetch.
2. Official file download (PDF/CSV/XLSX/etc.).
3. Browser-rendered capture for JavaScript-driven pages.
4. Sitemap/RSS/index discovery.
5. Manual-assisted capture.
6. Manual upload.

### User-authenticated sources

1. Browser session explicitly authorized by the owner/user.
2. User-authorized export/download.
3. Manual-assisted capture.
4. Manual upload.

### File/document sources

1. Official file download.
2. Manual upload.
3. Manual-assisted capture.

## Governed providers

The existing source registry represents, among others:

- Ejar Network / registered rent-contract source;
- Real Estate General Authority indicators;
- Ministry of Justice real-estate transactions;
- Real Estate Registry market records;
- GASTAT real-estate indices;
- Balady;
- Riyadh, Madinah and Jeddah municipal/geospatial sources;
- Earth App, Suhail and Tathmin as corroborative/indicative sources.

C52 uses the existing provider/domain registry to prevent source/provider mismatch while allowing non-API acquisition strategies.

## Safety boundary

C52 does not authorize:

- credential bypass;
- CAPTCHA bypass;
- access-control evasion;
- rate-limit evasion;
- claiming external legal/security/privacy/source-rights approval when it has not actually been supplied;
- commercial/public go-live under the private-alpha exception.

## Evidence and provenance

Every successful acquisition path is expected to hand off to the existing C2N/C2S provenance controls with:

- source URL;
- retrieval timestamp;
- acquisition method;
- original artifact hash;
- extracted payload hash;
- source/provider identity.

## Promotion path

`PRIVATE_ALPHA` -> `CONTROLLED_PILOT` -> `COMMERCIAL_PRODUCTION`

Promotion to commercial/public production reactivates the full C30 external evidence requirements and separate deployment/go-live decisions.
