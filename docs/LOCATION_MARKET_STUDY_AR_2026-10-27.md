# STARTAK — location-aware property market study (experimental, 2026-10-27)

## Intended personal-use workflow
1. Select property type: residential compound/building, commercial complex, office tower, mixed-use, warehouses or land.
2. Enter property name, city, district, **Google Maps link containing coordinates**, or plain latitude,longitude. Shortened maps.app.goo.gl links do not disclose their coordinates locally. Do not infer location from the project name.
3. Enter land area, **total built area**, **rentable area**, number of buildings, number of units and floors. Exact apartment/retail/offices mix remains out of scope for v1.
4. Enter at least **three executed sales** within a 5-km radius and **three contracted rents** separately: each row must match the asset type, area basis, include original HTTPS source link, date no older than 365 days, and coordinates. Asking prices are excluded.
5. Current rent estimate = median annual rent/sqm of submitted executed leases * actual rentable area. Last rent is NOT used as an economic price proxy. Occupancy determines expected collected rent; assumed landlord expenses and adopted cap rate generate a separate income approach. Sale method uses comparable sales per **built sqm** (or **land sqm** for land). The arithmetic blend averages available sale and income indications.
6. Nearby projects are documented with location, official link and status. Manually claimed +/- impact up to 10% per project is disclosed ONLY as a separate unverified stress scenario. Market comparables may already price that impact in, so it is NOT automatically added to primary value.
7. Export user-provided inputs and results as a **personal JSON draft**. The new workbench is not yet part of the existing saved-deal schema.

## Limits and caution
- This initial version **does not call REGA, MoJ, Google Geocoding or any real-time comparable API**. A calculation performed today is **not proof that the inputs were retrieved today**. If there are fewer than three eligible comparables for a method, that method returns no estimate.
- The legal status of any comparable remains self-declared, unverified. No independent source verification, geocoded parcel identity, zoning confirmation, full tenant rent roll or professional valuation signature. No quantitative location premium is inferred from names or nearby projects.
- Asset-class-level sale comparability does not alone establish physical/quality/tenure equivalence. Mixed-use/towers require subtype and segment-level specialty review before institutional decisions.
- For Riyadh within the regulated urban boundary, Ejar history and the 25 September 2025 five-year rent controls constrain actual contractual pricing. Show a **market reference** separately from **legally permissible contractual rent**; the latter remains not calculated without Ejar and review.
- To fulfill "live comparisons at valuation time", obtain signed licensing and distribution rights, an authenticated/authorized back-end provider, stable transaction identifiers and legally allowed geospatial coordinates, type normalization, time-stamped source snapshots, rate limits, privacy controls, evidence retention and negative-contract tests. Do not embed keys in front-end code, scrape authenticated government services, or fabricate transactions.
- The existing platform-wide **HOLD / NOT_AUTHORIZED** remains fully effective. CI passing does not grant commercial activation or a valuation licence.

Official reference services: https://rei.rega.gov.sa/ and https://srem.moj.gov.sa/
Regulation: https://rega.gov.sa/media-center/الأخبار-والإعلانات/الموافقة-على-الأحكام-النظامية-الخاصة-بضبط-العلاقة-بين-الم-ؤجر-والم-ستأج-ر/


## 27 October 2026 — non-API public-dataset workflow
- The user may open the official open-data websites separately and download explicitly reusable CSV datasets. STARTAK now has a **local CSV importer** for executed sales/contracted rentals; the operator must provide the original HTTPS dataset URL and affirm the applicable reuse licence. Only a valid explicit executed transaction status is considered; asking and unknown-status rows are never silently promoted.
- The importer supports Arabic/English column aliases and source record identifiers, enforces a bounded file size and record count, and discloses that imported records remain **unverified by the system**.
- If a compliant dataset lacks individual geocoordinates, a matching city+district can qualify a record under a clearly labeled district-level approximation; this is **not** a distance check and does not imply a property-level price signal. Where coordinates are present, exact maximum 5-km distance controls and cannot be circumvented using district text.
- Original URLs, dates, source row IDs and CSV license acknowledgement must be retained with the case; no raw personal data should be uploaded or shared.
- Available official open dataset context: [Saudi national open data overview](https://my.gov.sa/content/open-Data), [MoJ open data and report exports](https://www.moj.gov.sa/ar/opendata/Pages/reports.aspx).
- **Not a crawler:** Suhail's [terms](https://suhail.ai/agreement) prohibit unauthorized collection or commercial exploitation; [REGA property indicators terms](https://rei.rega.gov.sa/ar/terms-and-conditions) reserve content reproduction/derivative rights without written consent. Directly automated systematic copying/republication from those site interfaces is excluded. Their public pages can be opened for permitted independent observation. Data specifically released as an official **open-licensed dataset** can be processed within that license, which is distinct from generic web pages.
- CI: `node tests/architecture/run_instant_market_study.js`; `node tests/architecture/run_public_market_csv_import.js`; `npm run build`. This only qualifies the private analytical workbench, not a live institutional appraiser.
