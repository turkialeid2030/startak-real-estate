# STARTAK Real Estate — personal no-API market research capture (23 November 2026)

## Scope and practical feature
The platform is an **owner-operated personal research tool**. An API contract is not a prerequisite for user-operated research links and manual observations. User flow:

1. From the property market view, select the original source from the existing **53 manually navigable sources / 19 service entrypoints**, or the **11 sources with a registered typed research-data schema**.
2. Use the current property's city and district when appropriate, or enter the actual comparison location; the tool never invents a parcel, title or property identifier. Open the provider in a separate browser tab.
3. Copy the original public page URL and manually transcribe a research note, a source-reported sale with original reference/date, an aggregated rental/sales metric with a reporting period, or a third-party AVM estimate.
4. The observation is converted **in memory** to the existing local CSV schema and passed to `importNationalSourcesCsv` then `mergeNationalResearch`, and becomes visible in the current national research panel and evidence review as a research item. No live provider API, login automation, scraping, database credentials, bypassing provider interfaces or network data retrieval is performed.
5. Manual URLs and research references can still be downloaded/restored through the existing portable no-API manual-reference register. The new numeric research entries are currently in-memory until a separately tested local/save/export integration is completed; no hidden persistence is claimed.

### Registered typed research sources
`REGA_REI`, `MOJ_SREM`, `MOJ_REPORTS`, `EHSIBHA`, `PASEETAH`, `GREM_AI`, `TATHMIN`, `ART_OF_VALUE`, `THREE_QAR_AI`, `BAYUT_TRUVALUE`, `MANUS_SHARE`. The prior separately configured Kite adapter remains optional, not required for this manual path. Source choice constrains allowed evidence class; user cannot label a price as an authenticated executed transaction.

### Integrity and acceptance
- No-API links use registered HTTPS hosts, with query/fragment stripped from portable references to exclude tokens. Dates and numeric values are parsed by the existing canonical national research importer, not by a new valuation engine.
- The no-API reference registry now rejects inherited prototype IDs, handles invalid native Dates with `NOAPI_DATE_INVALID`, uses local Saudi calendar date and unambiguous structured duplicate keys.
- Personal typed research rows remain `marketValuationEligible=false`, `executedTransactionRecord=false`, `professionalReportAuthorized=false`, no independently verified comparables or market rent. A manual average rental indicator is not a signed lease or a certified property market rent.
- No changes to `main`, source terms/permissions, tenant IAM, 17+4 original real-engine parity, the 57 historical functional contracts or independent Q01–Q12 professional/commercial release requirements.

**Testing:** dedicated regression `tests/defects/personal_noapi_manual_capture.js` covers all four valid research categories and malformed source, date, numeric, URL, asset type and approval boundaries; existing `tests/defects/no_api_source_bridge.js` regression expanded. Run Release Verify and exact-head scoped workflows before claiming technical qualification. Professional and commercial release remains separate HOLD.
