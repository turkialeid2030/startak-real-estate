# PR33 — no mandatory API
Public data entry paths:
- REGA rental market: https://rei.rega.gov.sa/ar/advanced-search/rental-market
- REGA latest open data: https://rega.gov.sa/البيانات-المفتوحة/أحدث-البيانات-المفتوحة/
- National open data portal: https://open.data.gov.sa/
REGA catalog lists historical city-level average rent, contract count and asset type (2019–2024). Do not assign city aggregates to districts. Obtain files under applicable terms and map only fields supported by source. This release accepts normalized neighborhood CSV/TSV, not arbitrary raw spreadsheets, city aggregates or automated retrieval. Source reference and attribution required; date, metric, VAT basis and sample size remain explicit. No real records included. Use authorized individual lease comparables separately. No scraping of gated services. No API credentials required for local import.
Workflow: open data source -> authorized download or transcription -> normalize columns -> preview validation -> append to local archive -> export archive text for retention. Unknown VAT remains unknown; no invented dates, sample counts or contract rows. Local archive is session-scoped, not production DB. Hash is not proof of source authenticity. Native CI and browser qualification required before merge.
