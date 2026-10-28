# STARTAK — Earth App Research National Integration (2026-10-28)

## Sources
The user provided ten Earth page links covering property transactions, value estimate, approved digital plans, market analysis, indicators, digital map, sale map, displayed real estate register, lease deals, and offers. Exact links are registered in `src/market/earth-national-research.js`, without inventing internal APIs or URL parameters.

**Verified visible public evidence:**
- `https://earthapp.com.sa/transaction` presents region/city/district, property type, transaction reference and date filters with **Excel** and **PDF** export buttons; records may depend on a dynamic query and were not successfully downloaded within this review.
- `https://map.earthapp.com.sa/deals` publicly displays separate navigation for property transactions, displayed register, and rent transactions, plus advertised last-updated metadata. This is page metadata, **not** evidence of a fetched and verified individual transaction.
- Earth describes national mapping of parcels, approved plans, transaction indicators and listings: https://www.earthapp.com.sa/about and https://earthapp.com.sa/faqs .
- The /map/ subpages use a client-rendered map; several query-specific URL endpoints did not return extractable records in the available web reader. No current file of real transactions was downloaded.

## Delivered in personal research sandbox
- Dedicated component `EarthNationalResearchPanel.jsx` in the existing STARTAK market location study, with 10 links and national city/filter UI.
- Bounded local CSV import (using existing `rowsFromCsv`), for `TRANSACTION_TABLE`, `SALES_MAP`, `RENTAL_DEALS`, `REAL_ESTATE_REGISTER`, `DIGITAL_PLANS`, `VALUE_ESTIMATE`, `MARKET_ANALYSIS`, `REAL_ESTATE_INDICATORS`, `MAP`, `OFFERS`. A *selected* source feature is stored in every imported record with exact source URL and observation date.
- `REPORTED_SALE` is a third-party **reported sale**, not proof of an actual completed deed or validated transaction. `REPORTED_RENT` is likewise third-party reported rental and not authenticated lease. `REGISTRY_CONTEXT` is not verification of ownership. `VALUE_INDICATION` is not a licensed valuation.
- Arabic digit and decimal-grouping checks, duplicate and contradictory source transaction IDs, per-city filtering, append-only local batches, source provenance, no PII contact collection.
- Every imported record has `executedTransactionRecord:false`, `transactionIndependentlyVerified:false`, `officialRegistryVerified:false`, `marketValuationEligible:false`, `professionalReportAuthorized:false`.
- Synthetic tests and market-study CI (must verify on final SHA). No Earth account, protected API, bulk crawling, or production changes.

## Outstanding
No direct bulk ingestion of the Earth live API, downloadable Excel/CSV transaction content, authoritative government deed validation, signed market-data reuse rights, or live valuation accuracy benchmarks. Use the public export available in the browser and import its relevant columns to populate the research display. The approach preserves the personal research/testing purpose and all release safety gates.

## Native table export compatibility

Earth's table visibly labels city/neighborhood together in some views, as `المدينة/الحي`, with general columns `التاريخ`, `الرقم المرجعي للصفقة` and `سعر الصفقة`. The research CSV importer now accepts these as a combined location field **only when separated unambiguously by a slash**; contradictory separately supplied city/district information is rejected. This enhances manual export usability without promoting the rows to independently verified sales.
