# STARTAK — Saudi National Market Listing Source Research
Date: 2026-10-28. **Personal research sandbox only.** This module is not a crawler, not a third-party data API client, and contains zero copied real listing records at initial load.

## Seven reviewed sources and nature of their signals
| Source | Official public entry | Research classes |
|---|---|---|
| Aqar | https://sa.aqar.fm/ | Asking sales, rentals, project indications |
| Haraj | https://haraj.com.sa/ | Classified asking sales and rentals |
| Bayut Saudi Arabia | https://www.bayut.sa/ | Asking sales, rentals, new projects |
| Property Finder Saudi Arabia | https://www.propertyfinder.sa/ | Asking sales, rentals, new developments |
| Wasalt | https://wasalt.sa/AR | Asking sales, rentals, projects, advertised auctions |
| Sakani | https://sakani.sa/ | Housing units, projects and indicative asking prices |
| Deal App | https://dealapp.sa/ | Buyer/tenant requests and offers |

Deal's platform has a buyer/tenant request mechanism, so requester **budget** is not a completed sale price. Sakani project's displayed unit price is not a recorded deed transaction. Auctions are advertised bids or indicative prices until independently corroborated as completed title transfers.

Sources verified through public site pages on 2026-10-28, without claim of provider API contracts or license rights.

## Implemented
- Native Arabic research panel in the existing market-study UI with seven direct official links and nationwide city/source/purpose filtering.
- Bounded local CSV import via existing STARTAK CSV parser. Fields: `source,city,district,kind,priceSar,areaSqm,listingUrl,listingId,assetType,listingDate`. Per-batch observation date is independent of any underlying listing date.
- Normalized explicit classes `SALE_OFFER`, `RENT_OFFER`, `PROJECT_INDICATIVE`, `AUCTION_ASK`, `BUYER_REQUEST`. Non-offer classes cannot silently become comparables. Even SALE_OFFER/RENT_OFFER remain **research-only** and require independent corroboration.
- Source origin domain verification (HTTPS, no credential-bearing URLs, reject lookalike hostnames); Arabic decimal and comma grouping validation; no ingestion of seller telephone, names, or unneeded contact fields.
- Same platform URL + observed date duplicates collapse; conflicting values for that same immutable identity are reported and **not** overwritten; cross-platform similar attributes are marked `POSSIBLE_CROSS_PLATFORM_REPEAT_NOT_PROVEN`, **not** automatically merged.
- All returned records have `executedTransactionRecord:false`, `marketValuationEligible:false`, `professionalReportAuthorized:false`; they never feed a certified market value.
- Synthetic unit and Playwright regression. No real user listing contents or credentials committed to GitHub.

## External limitations
- Live automated extraction or full listings index **NOT CONNECTED**: the official homepage links were reviewed but private/undocumented endpoints and site access controls were not used.
- No real executed transaction price labels from these seven listing sites.
- No production release, no licensed professional report authority, no truth claim for listing content; unverified data is marked as such.
- Using an available public page for personal study is a separate activity from acquiring a licensed commercial API. Actual technical permissions and terms remain applicable; this review does not authorize prohibited scraping or login circumvention.

## Remaining acceptance
For wider real-data coverage, import records from an available export/manual collection with explicit URL and observation date or use an independently established authorized provider endpoint. Validate city/district, asset type, area basis, current availability and independent sale/deed source before any use in a valuation model. Once authoritative feeds and controls are independently verified, reassess GO. Current professional/commercial decision remains HOLD/NOT_AUTHORIZED.

## Same-provider listing identity

Within a provider, the external listing/request ID is preferred when present, because multiple Deal buyer requests may share a generic public landing page URL. Without a provider ID, root and generic request landing routes do not count as specific unique listings. Distinct recorded observation dates remain separate versions. An URL matching an official domain is source provenance only, not proof that the listing or transaction is authentic.
