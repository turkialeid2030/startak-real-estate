# C45 — Internal Source Rights Advisory Review

## Purpose

This review records the owner's delegated **internal advisory** assessment of the six governed Saudi official-source entries currently known to the product. It is a decision-support and engineering-control artifact, not an independent external legal opinion and not a substitute for the external legal/data-rights authority required by C30 issue #548.

Qualified C44 base: `560ab02b3164f3462b3f1645cc7fa11a6d5d3d6f`  
Frozen product candidate: `db05999e5a3c995235ac290c256251ab1592072b`

## Internal advisory decision

**APPROVED WITH RESTRICTIONS** for a fail-closed production-source policy:

- Default deny unless the specific dataset is explicitly open-licensed or written permission is retained.
- No general website scraping.
- No credentialed/private data reuse without a separate agreement.
- No personal/protected data.
- Capture source attribution, dataset/license reference, retrieval timestamp, observation period and integrity metadata.
- Preserve original source data; derived analytics must remain distinguishable from source facts.

## Source-by-source disposition

| Source | Internal advisory disposition | Permitted channel | Main restriction |
|---|---|---|---|
| REGA | Conditional | Explicitly licensed open dataset or written permission/governed connector | General website terms prohibit copying, distribution and derivative use without written approval. |
| GASTAT | Conditional | Official open-data API and published open data under the applicable license | Restricted/scientific microdata and personal data are excluded. |
| ZATCA | Conditional | Explicit open-data channel and source-linked regulatory facts | General portal content is not approved for commercial copying/republication without written permission. |
| SAMA | Conditional | Open-data platform/API only | General website content has commercial-use restrictions. |
| Ministry of Justice | Conditional | Open-data library, interactive-report export, approved open-data request | Attribution and source-data integrity are required; protected/personal data excluded. |
| Ejar | **HOLD** | Separate written data-sharing/API agreement or explicit dataset-specific open license | Current terms limit content to personal use and prohibit ingestion into automated information-retrieval systems beyond personal use. |

## Evidence reviewed

Official evidence paths reviewed on 2026-10-04 include:

- REGA open data: `https://rega.gov.sa/البيانات-المفتوحة/`
- REGA terms: `https://rega.gov.sa/الأحكام-والشروط/`
- GASTAT open-data/microdata policy: `https://www.stats.gov.sa/ar/microdata`
- GASTAT API portal: `https://dp.stats.gov.sa/?locale=ar`
- ZATCA open-data request: `https://www.zatca.gov.sa/ar/eServices/Pages/OpenDataRequestCard.aspx`
- ZATCA terms: `https://zatca.gov.sa/ar/Pages/Terms.aspx`
- SAMA open-data platform: `https://www.sama.gov.sa/ar-sa/Statistics/Pages/Summary.aspx`
- SAMA terms: `https://www.sama.gov.sa/ar-sa/pages/termsofuse.aspx`
- Ministry of Justice open-data policy: `https://www.moj.gov.sa/ar/OpenData/Pages/OpenDataPolicy.aspx`
- Ministry of Justice terms: `https://www.moj.gov.sa/ar/Ministry/Pages/TermsOfUse.aspx`
- Ejar privacy/use policy: `https://www.ejar.sa/ar/privacy-policy`
- Saudi Open Data License: `https://open.data.gov.sa/odp-public/static/ar/assets/Open_Data_License_Ar.pdf`

## Approval boundary

The owner has delegated internal advisory review authority. On that basis, the restricted source-use policy above is internally approved for engineering planning and source-connector design.

This does **not** set `SOURCE_RIGHTS_AUTHORIZATION=SUPPLIED_VERIFIED`, does not satisfy C30 issue #548, and grants no merge, deployment, commercial go-live, transaction, approval or Public-AI authority.

The external gate remains HOLD until a qualified Saudi legal/data-governance reviewer provides a traceable source-by-source production-use/reuse-rights disposition bound to the exact release candidate and it is ingested through the governed C30 evidence intake path.

## Required next action

1. Obtain dataset-level licenses or written permissions for every source actually activated in production.
2. For Ejar, obtain an explicit data-sharing/API agreement or do not activate Ejar as a production source.
3. Obtain independent qualified Saudi legal/data-governance sign-off.
4. Ingest that evidence through C30 and rerun the release-governance gates.
