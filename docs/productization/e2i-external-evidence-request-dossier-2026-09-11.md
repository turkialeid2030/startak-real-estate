# E2I External Evidence Request Dossier — 2026-09-11

## Purpose

This dossier is an operational handoff for obtaining the **real external and production evidence** required by the existing E2I architectural-stop contract.

It is not a legal opinion, professional valuation opinion, verifier designation, trust-root pin, production-readiness decision, release approval, deployment approval, or go-live approval.

The corresponding machine-readable request matrix is:

`governance/e2i-external-evidence-request-matrix-2026-09-11.json`

## Current operating boundary under review

The repository currently defines the maximum engineering operating mode as:

`UNLICENSED_DECISION_SUPPORT`

That label is only an internal operating-mode boundary. It does not itself establish that every current or future platform function is outside Saudi licensing requirements. The legal and professional evidence requests below exist specifically to obtain an independent determination for the exact production scope.

## Official public-source pack reviewed on 2026-09-11

The following official Saudi sources were identified as relevant starting points for external reviewers:

### Real Estate General Authority — REGA

1. **Real Estate Brokerage Law**  
   https://rega.gov.sa/الأنظمة-والقرارات/الأنظمة-واللوائح-والأدلة/الأنظمة/نظام-الوساطة-العقارية/

   The law defines real-estate brokerage and identifies real-estate services including marketing, property management, facility management, auctions, advertising, and real-estate consultations and analyses.

2. **Executive Regulation of the Real Estate Brokerage Law**  
   https://rega.gov.sa/الأنظمة-والقرارات/الأنظمة-واللوائح-والأدلة/اللوائح/اللائحة-التنفيذية-لنظام-الوساطة-العقارية/

   The regulation treats licensing as authorization from REGA to practice brokerage or real-estate services and includes operating obligations for licensed activities.

3. **Regulation of Real Estate Consultations and Analyses**  
   https://rega.gov.sa/الأنظمة-والقرارات/الأنظمة-واللوائح-والأدلة/اللوائح/اللائحة-التنظيمية-للاستشارات-والتحليلات-العقارية/

   The regulation defines written real-estate recommendations/opinions/advice to a beneficiary as real-estate consultation, and public real-estate opinion/analysis through media, social platforms or similar channels as real-estate analysis. It sets licensing conditions and states that when the service includes real-estate valuation, an accredited-valuer licence is required.

4. **Regulation of Real Estate Marketing and Advertising**  
   https://rega.gov.sa/الأنظمة-والقرارات/الأنظمة-واللوائح-والأدلة/اللوائح/اللائحة-التنظيمية-للتسويق-والإعلانات-العقارية/

   This source is relevant to production-facing product, marketing and advertising claims where the platform or its users publish material promoting real-estate products.

### Saudi Authority for Accredited Valuers — Taqeem

5. **Accredited Valuers Law**  
   https://taqeem.gov.sa/web/content/portal.rules/8/attachment_ar?download=false

   The law defines valuation as estimating the value of real estate or other covered assets for a specified type of value and purpose, and states that a person may not practice the valuation profession in a valuation branch without the required licence.

6. **Regulations and Rules**  
   https://taqeem.gov.sa/rules/category/llyh-ltnfydhy-wlqw-d-4

   Taqeem's current rules page includes the implementing regulation, professional conduct rules, and other professional-practice documents. The page showed a last-modified date in August 2026 when reviewed.

7. **Valuation Standards Digital Library**  
   https://taqeem.gov.sa/digital-lib/category/m-yyr-ltqyym-1

   Taqeem's digital library includes valuation-standards materials and professional references. These are source materials for the professional-scope reviewer; their presence in the library does not by itself mean the platform conforms to them.

### Saudi Data & AI Authority — SDAIA

8. **Personal Data Protection Law — PDPL**  
   https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL

9. **Implementing Regulations of the Personal Data Protection Law**  
   https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL2

   These sources are the starting point for the independent privacy/data-governance review of actual production data flows, purposes, lawful basis, notices, rights, retention, access controls, processors, transfer arrangements and incident handling.

## Evidence request 1 — CANONICAL_SOURCE_HASH_COMPARISON

**Reviewer:** independent canonical-source custodian or evidence verifier authorized for canonical-source comparison.

**Required review:** verify the exact external canonical source artifact against the repository-pinned SHA-256 and independently document provenance.

**Required binding:** exact E2H closeout packet hash, release-candidate ID, source commit, release artifact SHA-256, environment reference and environment-configuration SHA-256.

**Required output:** signed E2I evidence record with the external evidence artifact hash, source reference, scope reference, verifier identity, verification time, result and RSA-SHA256 signature.

The repository already has a separate canonical-source evidence operator/package. This dossier does not replace it.

## Evidence request 2 — SAUDI_LEGAL_OPERATING_MODE_REVIEW

**Reviewer:** independent Saudi-qualified legal reviewer competent to assess the platform's real-estate operating model.

The legal reviewer should inspect the actual production functions and answer at least:

- whether any feature constitutes real-estate brokerage or another regulated real-estate service;
- whether written recommendations or advice to a beneficiary constitute regulated real-estate consultation;
- whether public-facing analyses constitute regulated real-estate analysis;
- whether any automated or human-assisted output constitutes valuation practice;
- whether any user workflow, API, exported report, commercial model, disclaimer or marketing statement changes the licensing analysis;
- what functions must be disabled, relabeled, constrained or routed through licensed professionals before production use.

The required evidence artifact must identify the exact product version and reviewed scope, applicable legal sources, assumptions, required controls, unresolved questions and final `VERIFIED`, `REJECTED` or `INCONCLUSIVE` result.

## Evidence request 3 — PDPL_DATA_GOVERNANCE_REVIEW

**Reviewer:** independent Saudi privacy/data-governance reviewer.

The review should be performed on the actual production architecture and data flows, not on a generic privacy checklist. At minimum it should cover:

- data inventory and data-flow mapping;
- processing purposes and applicable lawful basis;
- privacy notices and consent where applicable;
- data-subject rights handling;
- retention and deletion;
- user/account access controls;
- uploaded property documents and generated reports;
- application, authentication and audit logs;
- analytics/telemetry;
- processor/subprocessor arrangements;
- cloud-region and cross-border-transfer questions where applicable;
- incident and breach procedures;
- operational evidence that documented controls are actually configured.

The signed artifact must be tied to the exact production release and environment.

## Evidence request 4 — PROFESSIONAL_STANDARDS_SCOPE_REVIEW

**Reviewer:** independent reviewer competent in Saudi valuation/professional standards for the relevant real-estate scope.

The reviewer should map the actual platform functions, calculations, terminology, reports and user journeys against the professional boundary and identify:

- outputs that could reasonably be interpreted as valuation/appraisal;
- outputs that are only investment/decision-support analytics;
- features that require a licensed accredited valuer or licensed valuation establishment;
- claims, report formats or labels that could imply accredited valuation authority;
- whether any cited valuation standards are actually applicable to the intended use;
- required limitations and intended-user/intended-use statements;
- functions that must be disabled or professionally supervised.

The review must not assume that the use of valuation formulas or standards terminology automatically establishes professional conformity or authority.

## Evidence request 5 — PRODUCTION_EXECUTION_CHAIN_CONFIRMATION

**Reviewer:** independent production/release assurance verifier.

This evidence cannot be obtained from public law or guidance pages. It requires real production execution artifacts after authorized merge/deployment activity.

The reviewer must independently confirm that the actually deployed runtime corresponds to the exact authorized release candidate and verify at least:

- merge execution;
- deployment execution;
- source commit;
- artifact SHA-256;
- environment reference;
- environment-configuration SHA-256;
- provider-side deployment identifier and timestamps;
- post-deployment smoke result;
- rollback readiness;
- E2H closeout integrity;
- absence of unexplained divergence between qualified artifact and running production version.

This request remains blocked until an authorized real deployment exists.

## Evidence request 6 — OPERATING_MODE_CLAIMS_RESTRICTION_CONFIRMATION

**Reviewer:** independent legal/compliance reviewer of the exact production UI, reports, API descriptions, marketing, onboarding and contractual claims.

The reviewer should confirm that the production release does not represent itself as having authority that has not been independently established. The review should specifically inspect claims around:

- accredited or certified valuation;
- licensed real-estate consultation or analysis;
- brokerage or transaction execution;
- regulator approval or endorsement;
- professional certification;
- guaranteed returns or investment outcomes;
- official or legally binding property values;
- user ability to issue professional valuation reports;
- transaction authority.

Restrictions must appear at the point where users consume or export decision-support outputs; internal documentation alone is insufficient.

## Independence and signing requirements

The existing E2I contract requires a readiness-verifier registry whose SHA-256 is pinned out of band. The full evidence set may not be verified by only one verifier subject.

Each accepted evidence record must use the exact E2I signing payload and RSA-SHA256. The verifier must be authorized in the pinned registry for that evidence type and active at the verification time.

The repository tooling can prepare the unsigned payloads and proposed public registry hash, but it cannot self-establish the external verifier's identity, independence, legal/professional competence, trust root, or signature.

## What can be completed internally now

The engineering team can prepare:

- exact unsigned E2I evidence payloads;
- proposed verifier registry material containing public keys only;
- evidence request scopes;
- artifact SHA-256 values;
- release/environment identifiers;
- source packs and system documentation;
- production execution evidence after separately authorized deployment.

## What requires external/human action

The following cannot be manufactured by another internal engineering gate:

- external legal review;
- external PDPL/data-governance review;
- external professional-scope review;
- independent claims review;
- independent production execution confirmation;
- verifier identity/competence approval;
- out-of-band registry-hash pinning;
- private-key signatures by the approved verifiers;
- final human release/deployment/go-live authority where applicable.

## Current authority boundary

This dossier leaves all release, merge, deployment, go-live, transaction, legal-approval, verifier-trust and professional-authority flags false. It performs no production mutation.
