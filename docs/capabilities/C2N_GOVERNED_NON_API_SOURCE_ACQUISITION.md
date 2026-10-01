# C2N — Governed Non-API Source Acquisition

## Objective
C2N extends the C1/C2/C2S evidence stack so Startak Real Estate can ingest evidence from Saudi web sources without requiring a production API.

The design intentionally separates **source authority** from **acquisition permission**. A source may be authoritative but still prohibit or restrict automated copying. C2N therefore never treats public visibility as permission to scrape, copy, redistribute or automate.

## Non-API acquisition hierarchy
The governed preference order is:

1. **Official open-data file download** — CSV/XLSX/GeoJSON/KML/PDF or another file explicitly offered through the source website or national open-data portal.
2. **Official report/document download** — published PDF/office document exposed to users through the normal website UI.
3. **Public browser-rendered capture** — only if the source-specific terms explicitly permit automation/reuse.
4. **User-authorized browser export** — the user operates or authorizes a normal browser session and exports/downloads an artifact through the site's own UI; contractual/use rights must be verified where required.
5. **Manual governed upload** — a human supplies an authorized export/document/snapshot, which is then hash-bound and provenance-reviewed.

C2N never discovers hidden/private endpoints and never bypasses credentials, CAPTCHA, access controls, rate limits or other site controls.

## Initial source acquisition matrix

| Source/profile | Authority tier | Non-API path | Automated web scraping |
| --- | --- | --- | --- |
| Balady open data | A — official | Website/open-data file download | Browser scraping disabled; open-data file download allowed |
| Madinah Municipality open data | A — official | CSV/XLSX and official downloads | Browser scraping disabled; open-data file download allowed |
| Riyadh Municipality open data | A — official | Licensed/open-data files and reports | Map-portal scraping disabled |
| Riyadh spatial map portal | A — official | Manual evidence only unless written permission is verified | Disabled |
| Jeddah spatial portal | A — official | Manual governed evidence until terms are independently verified | Disabled |
| REGA open-data publications | A — official aggregator | File/report ingestion after rights review | Disabled by default |
| REGA indicator website | A — official aggregator | Do not scrape; prefer REGA open data or separately authorized export | Disabled |
| Earth App | B — commercial corroboration | User-authorized export/manual artifact only after verified contractual rights | Disabled |
| Tathmin | C — indicative AVM | Manual/user-authorized output only after verified use rights | Disabled |

## Research basis captured for Phase 0
- Balady's open-data page states that open data are available for reuse, requires source attribution and states that Balady-exported open data published on the Saudi open-data platform are licensed under Creative Commons.
- Madinah Municipality states that its open data may be used/reused subject to its published policy, and its open-data pages expose CSV/XLSX downloads for datasets such as approved plans.
- Riyadh Municipality states that geospatial/open-data resources exist, while the general portal terms restrict copying/reuse of portal materials without prior written permission. C2N therefore separates Riyadh open-data downloads from the map portal and blocks map scraping.
- REGA's indicator-platform terms restrict copying/downloading/republication without written approval. C2N blocks REGA indicator-page scraping and routes ingestion toward separately governed open-data releases or authorized exports.
- Earth App's published terms prohibit copying data/content for republication and restrict commercial use without permission. C2N keeps Earth as commercial corroboration and blocks automated ingestion absent separately verified rights.
- Tathmin publicly describes its automated result as preliminary/not official. C2N preserves it as an AVM benchmark only and does not treat it as an official or certified valuation.

## Provider registry expansion
C2N adds explicit official provider identities for:
- `RIYADH_MUNICIPALITY_GEOSPATIAL`
- `MADINAH_MUNICIPALITY_GEOSPATIAL`
- `JEDDAH_MUNICIPALITY_GEOSPATIAL`

These remain `productionAdapterEnabled=false`.

## Acquisition evidence contract
Every acquisition record binds:
- acquisition ID and governed profile;
- provider ID and exact HTTPS source URL;
- acquisition method and whether retrieval was automated;
- retrieval/effective timestamps;
- artifact MIME type/format and SHA-256;
- extraction method/version;
- extracted payload and deterministic SHA-256;
- terms evidence reference;
- license/attribution metadata where required;
- explicit rights-verification evidence for restricted/commercial/uncertain sources;
- user browser-session authorization when applicable;
- an acquisition-record SHA-256.

Any post-creation mutation fails integrity verification.

## Rights gates
### Published open data
Published open-data profiles require:
- license/reference evidence;
- source attribution;
- use only through the governed download/report/manual methods.

### Restricted or uncertain terms
Restricted/commercial/uncertain profiles require:
- `rightsVerified=true`;
- a trusted rights verifier;
- verification timestamp;
- rights evidence reference;
- user-session authorization for browser exports.

No verified rights means no ingestion readiness.

## Output boundary
Passing C2N means only:

`READY_FOR_C2S_PROVENANCE_EVALUATION`

It does **not** mean that the artifact is already authoritative evidence. C2S must still verify provenance, source authority, freshness, official corroboration and downstream admissibility.

Commercial Earth artifacts remain corroboration-only. Tathmin artifacts remain AVM-benchmark-only.

## Explicitly prohibited behavior
- hidden endpoint discovery;
- private/internal endpoint use;
- credential or login bypass;
- CAPTCHA bypass;
- access-control evasion;
- rate-limit evasion;
- prohibited web scraping;
- source-tier elevation because data were successfully downloaded;
- automatic legal/licensing interpretation;
- final/certified valuation or transaction authority.

## Governance posture
- `COMMERCIAL_GO_LIVE = HOLD`
- `TRANSACTION_AUTHORITY = FALSE`
- `APPROVAL_AUTHORIZED = FALSE`
- `PUBLIC_AI = FALSE`
- `CANONICAL_BASELINE_ACTIVATION_AUTHORIZED = FALSE`
- `MERGE HOLD = ON`
- `DEPLOY = NO`
