# STARTAK Real Estate — Saudi research CSV source-link privacy boundary

**Date:** 23 November 2026. **Scope:** pre-valuation research import / restored merge; stacked after Draft #819. **Decision:** DRAFT / HOLD.

## Confirmed source-level defects
- The national research CSV importer (`src/market/saudi-national-intelligence-sources.js`) removed only marketing tags from research URLs. It preserved arbitrary query parameters such as `?session=`, `?token=`, personal identifiers or access information inside `sourceUrl` on accepted imported records.
- The same source allowlist accepted arbitrary subdomains using `.endsWith('.'+domain)` and did not reject custom HTTPS ports.
- The restored/current record merge (`mergeNationalResearch`) checked whether `officialUrl` returned any result, but **did not require the saved original URL to equal the sanitized result**. A restored record with an embedded session token could pass through and remain stored. It also did not verify all source-claimed approval flags and Saudi source identity at this boundary.

## Code correction
1. Restrict to exact registered source host, declared root and its `www` variant, HTTPS with no userinfo or alternate ports. Keep the path, strip the **entire query and fragment** before accepting public research URL. Separate source IDs remain available for provenance; where the query was required for page navigation, the user must reacquire a safe reference via the source's authorized workflow.
2. On merge/reload demand the original URL is already canonical; **do not silently rewrite or preserve** altered untrusted saved rows. Require matching registered `origin`, `country='SA'`, `officialSourcePage` and explicit false status for each research/valuation/professional authorization flag. Malformed rows fail closed.
3. Synthetic regressions exercise a URL with session and personal information, stable clean source link, hostile subdomains, custom ports, HTTP, credentials, restored-row claims and continued `HOLD_EXTERNAL_VERIFICATION_REQUIRED`.

## Controlled boundary
These changes protect research record handling, **not** customer data licensed ingestion, authentic property transactions, professional valuations or production tenant authorization. No source acquisition through automation/API/scraping is added. 57 old route behavioral parity, private 17+4 case engine/UI parity, Q01–Q12 independent signoffs, live IdP/KMS/RLS/vault, Cloudflare RCA and production permission remain open in #622.

**Accept only actual exact-head CI success.** This patch may not be merged into `main`, nor deployed commercially, until the linked independent release/security gates pass and accountable people sign off.

## Prototype-chain lookup safety
The original source lookup used `BY_ID[untrustedSourceId]`, where special keys such as `__proto__`, `constructor` and `toString` resolve inherited properties even on a frozen registry. This could throw during CSV processing rather than reject the adversarial row, and could confuse restored-source matching. Both import and merge now require `Object.prototype.hasOwnProperty.call(BY_ID, sourceId)` before accepting the source. Regression mixes a forged row with a valid row and verifies only the invalid row is rejected, plus strict restored-row refusal for five prototype keys.

## Exact identity tuples and restored numeric integrity
The research merge previously joined untrusted city/district/source-identifiers with a literal pipe and therefore could conflate two distinct locations. Keys now use structured array JSON serialization, preserving full source ID spelling. Restored/provider records are separately checked for nonblank bounded location/IDs, numeric finite in-range values and permitted source category/metric units. Invalid rows fail closed even when earlier import or UI validation was bypassed. This is not evidence of a licensed Saudi sale or a certified valuation.
