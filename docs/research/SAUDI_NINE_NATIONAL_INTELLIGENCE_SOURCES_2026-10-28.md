# STARTAK — Nine National Real Estate Intelligence Sources (2026-10-28)

## Provenance and scope
This catalog supplements the existing Saudi-wide market-study panels without replacing the real-estate valuation or execution engines. Sources were individually reviewed on 2026-10-28. No live private API, account, login, bulk export or production data write was performed. Available evidence was gathered from ordinary public pages and search indexing.

| ID | User-supplied URL | Source-supported function | Research role |
|---|---|---|---|
| REGA_REI | https://rei.rega.gov.sa/ar | Saudi Real Estate General Authority city/district sales and rental metrics; original feeds include Ministry of Justice, property register and Ejar | OFFICIAL_AGGREGATE |
| MOJ_SREM | https://srem.moj.gov.sa/ | Ministry of Justice real estate exchange live sale records; direct page timed out, official Ministry of Justice description confirms the service | OFFICIAL_REPORTED_SALE, subject to record authentication |
| MOJ_REPORTS | https://www.moj.gov.sa/ar/OpenData/PowerBIReport/Pages/default.aspx | Interactive Ministry of Justice dashboards including real estate transactions, certification, execution | OFFICIAL_AGGREGATE |
| EHSIBHA | https://ehsibha.sa/ive | JavaScript-only screen; underlying calculations/service **NOT VERIFIED** | RESEARCH_NOTE only |
| PASEETAH | https://paseetah.com/ | Saudi real estate data, transaction maps, aggregates and AI indicative price; advertises enterprise APIs | Third-party aggregates, reported sales, or AVM if later documented |
| GREM_AI | https://ai.grem.capital/ar | AI AVM, macro/micro-market and profitability; advertises enterprise API. '97–98%' is provider marketing, **not independently validated** | EXTERNAL_AVM_ESTIMATE |
| TATHMIN | https://tathmin.online/valuation | Site did not yield accessible evidence, valuation hinted by URL alone | RESEARCH_NOTE only pending verification |
| ART_OF_VALUE | https://artofvalue.sa/ | Professional valuation firm with verifiable registry listing; no right to label an arbitrary imported number as a signed report | RESEARCH_NOTE only |
| THREE_QAR_AI | https://3qar.ai/ | AI real estate assistant/site public tagline | RESEARCH_NOTE only |

References: official REGA and Ministry of Justice sites, site homepage for Paseetah and GREM, Saudi Taqeem directory for Art of Value. The source is not a synonym for a transaction; even official-origin data copied as user CSV is unverified at the individual record level until corroborated.

## Engineering implementation
- Added `src/market/saudi-national-intelligence-sources.js` and `SaudiNationalIntelligenceSourcesPanel.jsx`: nine direct public links, strict registry, countrywide city/source/class filters.
- Manual bounded local CSV for comparison experiments: `source,city,district,kind,recordId,eventDate,periodStart,periodEnd,metricName,metricValue,unit,sourceUrl,assetType`.
- Official/third-party aggregates require start/end dates, named metric, explicit unit and actual city/district. Reported sales require reference and event date. External AVMs remain entirely separate from sale records. Unknown services accept nonnumeric research references only.
- Reject mismatched source domains, hidden URL credentials, disallowed source-kind combinations, invalid dates, ambiguous numbers (for example `1,2`), invalid metric units or unsupported schema.
- Dedupe repeated batch rows, flag same source/period/value contradictions; differing observation dates remain separately retained.
- Every imported record: `personalResearch:true`, `sourceRecordAuthenticated:false`, `executedTransactionRecord:false`, `marketValuationEligible:false`, `professionalReportAuthorized:false`. None can automatically compute a certified market value.
- Synthetic unit tests and Playwright market-study browser checks included in GitHub Actions.

## No false claims
No 9-source live API integration is currently running, no actual REGA daily/quarterly metric was imported into the code, no private MOJ records were accessed, no underlying dynamic data from EHSIBHA/TATHMIN was fetched, no GREM model underwent independent validation, and no valuer signed STARTAK's report. The public domain may have information, but per-field historical comparability and source terms still require verification before a real-data research export. GO/CONDITIONAL GO for commercial/professional release **not authorized**.
