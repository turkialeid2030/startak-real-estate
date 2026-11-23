# STARTAK Real Estate — personal no-API market research capture (23 November 2026)

## Scope and practical feature
The platform is an **owner-operated personal research tool**. An API contract is not a prerequisite for user-operated research links and manual observations. User flow:

1. From the property market view, select the original source from the existing **53 manually navigable sources / 19 service entrypoints**, or the **11 sources with a registered typed research-data schema**.
2. Use the current property's city and district when appropriate, or enter the actual comparison location; the tool never invents a parcel, title or property identifier. Open the provider in a separate browser tab.
3. Copy the original public page URL and manually transcribe a research note, a source-reported sale with original reference/date, an aggregated rental/sales metric with a reporting period, or a third-party AVM estimate.
4. The observation is converted **in memory** to the existing local CSV schema and passed to `importNationalSourcesCsv` then `mergeNationalResearch`, and becomes visible in the current national research panel and evidence review as a research item. No live provider API, login automation, scraping, database credentials, bypassing provider interfaces or network data retrieval is performed.
5. Manual URLs and research references can be downloaded/restored through the existing portable no-API link register. Typed market research observations are kept in the current session and can also be **downloaded as a separate local JSON register**, then deliberately restored by file selection on a later visit. The restore path applies the same market merge validation; it neither performs hidden autosync nor uses browser-local credential storage. The register is not a professional case backup or an authorized source dataset.

### Registered typed research sources
`REGA_REI`, `MOJ_SREM`, `MOJ_REPORTS`, `EHSIBHA`, `PASEETAH`, `GREM_AI`, `TATHMIN`, `ART_OF_VALUE`, `THREE_QAR_AI`, `BAYUT_TRUVALUE`, `MANUS_SHARE`. The prior separately configured Kite adapter remains optional, not required for this manual path. Source choice constrains allowed evidence class; user cannot label a price as an authenticated executed transaction.

### Integrity and acceptance
- No-API links use registered HTTPS hosts, with query/fragment stripped from portable references to exclude tokens. Dates and numeric values are parsed by the existing canonical national research importer, not by a new valuation engine.
- The no-API reference registry now rejects inherited prototype IDs, handles invalid native Dates with `NOAPI_DATE_INVALID`, uses local Saudi calendar date and unambiguous structured duplicate keys.
- Personal typed research rows remain `marketValuationEligible=false`, `executedTransactionRecord=false`, `professionalReportAuthorized=false`, no independently verified comparables or market rent. A manual average rental indicator is not a signed lease or a certified property market rent.
- No changes to `main`, source terms/permissions, tenant IAM, 17+4 original real-engine parity, the 57 historical functional contracts or independent Q01–Q12 professional/commercial release requirements.

**Testing:** dedicated regression `tests/defects/personal_noapi_manual_capture.js` covers all four valid research categories and malformed source, date, numeric, URL, asset type and approval boundaries; existing `tests/defects/no_api_source_bridge.js` regression expanded. Run Release Verify and exact-head scoped workflows before claiming technical qualification. Professional and commercial release remains separate HOLD.

## Portable personal market register integrity
The register serializes a **strict allowlist of research-only fields** from existing canonical, source-checked rows. Raw Kite provider-attribution objects and unexpected third-party payload fields are not written into the file; for Kite month-only observations, `dayKnown=false` must be retained. Import requires the exact register schema and valid source metrics/URL, rejects prototype/authority additions and rechecks dates and amount bounds through `mergeNationalResearch`. The user selects when to download/restore; no automatic API calls or background syncing are implied. The file may contain voluntarily entered prices and reference IDs: keep it under the owner's control.

## D04 bilingual UI contract
The selected **source names are third-party proper-name labels**, not user-facing STARTAK system prose. Their select option nodes are attributed as `data-user-content translate="no"`, matching the existing national-source filter; the original provider label remains unchanged in both locales. The owner-only `assetType` enum values are preserved as machine-readable codes but displayed via proper **Arabic/English asset labels** (land, residential land, apartment, villa, floor, office, retail, warehouse, hotel, industrial), not raw English constants in the Arabic interface. The strict locale scanner remains fully enabled and will check all other control copy in both languages.

## Monthly Kite data are not a manual exact-day sale
The initial manual source dropdown accidentally exposed `KITE_MOJ_QUARTERLY` as a day-specific reported-sale type even though Kite records are **month-only** (`eventDate=null`, `dayKnown=false`). Passing such a row through the day-specific canonical CSV import either fails or misstates its provenance. This was corrected by showing **exactly eleven** sources which support the manual entry schema and explicitly refusing Kite in `buildPersonalNoApiResearchEntry`. Kite's separate month-only intake and the local portable Kite research restore remain unchanged; no API is required by this new personal workflow.

## Saudi midnight chronology consistency
The manual research UI and no-API reference panel already used Riyadh-local calendar days, while `importNationalSourcesCsv` with Date-valued `asOf` and `mergeNationalResearch` used UTC. Between 00:00 and 02:59 in Riyadh, valid same-day research could be rejected. Canonical CSV intake and merge now use an `Asia/Riyadh` date helper, computed once per merge; explicit string `asOf` stays unchanged. Synthetic regression covers before/after Saudi midnight and Invalid Date. The personal manual workflow remains independent of vendor APIs.
