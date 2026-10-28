# Suhail — Saudi national neighborhood research intake (personal sandbox)

The public Suhail transactions route containing `Riyadh` in its URL has **rows for other cities**. It must not be handled as a Riyadh-only dataset. The platform describes transaction mapping for cities and neighborhoods across the Kingdom; its mobile release information refers to coverage across Saudi regions.

## Retrieved scope, 28 October 2026

A publicly indexable transactions summary exposed **10 neighborhood aggregate rows out of a page total of 765 displayed rows**. The 10 observed rows cover six cities: Riyadh, Shaqra, Al Kharj, Wadi Al Dawasir, Al Rayn and Dhurma. The index date is a research observation date, **not** a transaction date or last-updated timestamp. The 765 count is a page row count, not 765 executed transactions or proof of complete national coverage for this view. Input sample: `docs/research/suhail_neighborhood_public_sample_2026-10-28.csv`.

Source: https://www.suhail.ai/Riyadh/transactions — the page's displayed city field is authoritative for row selection, **not** the slug in the URL. The source may change or be personalized later.

## Integration behavior

- Added dedicated nationwide research display with city selector and district filter. No hardcoded Riyadh restriction; cities derive from actual imported records.
- Supports local CSV import (3,000 rows / 2 MiB) using city+district, reported transfer count, total value, displayed housing and commercial SAR/m² and growth. Null is distinct from zero. Arabic numeric separators are normalized.
- Keeps each row as `NEIGHBORHOOD_AGGREGATE_INDEXED_UNVERIFIED` or `USER_IMPORTED_NEIGHBORHOOD_AGGREGATE_UNVERIFIED`, with `executedTransactionRecord:false` and `marketValuationEligible:false`.
- No automatic transfer from district aggregates to executed-sale comparables, no invented sale identity, date, area, transaction price, or certified value.
- Only 10 public indexed rows have actually been retrieved, not the entire 765 table. Full live national sync/API and actual current transactions remain **NOT CONNECTED**; private site access, user authentication and protected APIs were not accessed.

## Controls / next evidence

To enable additional city datasets, import a bounded CSV export or connect an authorized publicly supported feed. Every record must preserve its actual city, district, source, observation time and separate underlying transaction period where available. Source-rights and technical-access rules still apply to automated collection; personal research does not make an inaccessible interface public. Production and professional-release gates remain HOLD / NOT_AUTHORIZED.

## 28 October — Provenance-safe multi-batch ingestion

Follow-on improvement: CSV import now **appends** without losing the initial 10-row public sample or older city datasets. A per-batch HTTPS source URL and observation date (not transaction date) are explicitly recorded. Identical records from the same city, district, source and observation date are deduplicated; differing values with the same identity are reported as conflicts and retain the existing value rather than silently overwriting it. Distinct observation dates remain separate research snapshots. Ambiguous numeric groupings such as `1,2` and percentage values in currency fields are rejected; Arabic grouping, decimals and negative growth rates remain accepted. No aggregate is made eligible for valuation. Unit and browser regression tests validate additions, duplication and city separation. Full automated Suhail data retrieval is still not connected.
