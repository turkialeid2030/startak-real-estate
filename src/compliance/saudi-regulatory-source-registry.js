'use strict';

// Engineering provenance registry only. This file records official-source
// metadata used by compliance gates; it does not interpret law, establish
// licensing status, or replace review by Saudi legal/regulatory counsel.
const VERIFIED_AS_OF = '2026-09-06';
const REVIEW_AFTER = '2026-12-05';
const REVIEW_CADENCE_DAYS = 90;

const SOURCE_STATUS = Object.freeze({
  ACTIVE_AT_LAST_VERIFICATION: 'ACTIVE_AT_LAST_VERIFICATION',
  REGULATORY_REVIEW_REQUIRED: 'REGULATORY_REVIEW_REQUIRED',
});

const SAUDI_REGULATORY_SOURCES = Object.freeze([
  Object.freeze({
    id: 'REGA_REAL_ESTATE_BROKERAGE_LAW',
    authority: 'Real Estate General Authority (REGA)',
    instrument: 'Real Estate Brokerage Law',
    sourceUrl: 'https://rega.gov.sa/الأنظمة-والقرارات/الأنظمة-واللوائح-والأدلة/الأنظمة/نظام-الوساطة-العقارية/',
    sourcePublishedDateOfficial: '1443/12/23 AH',
    sourceIssuedDateOfficial: '1443/11/30 AH',
    effectiveDate: '180_DAYS_AFTER_OFFICIAL_GAZETTE_PUBLICATION',
    effectiveDateBasis: 'Article 24 states that the law applies 180 days after publication in the Official Gazette; exact Gregorian conversion is intentionally not asserted by software.',
    lastVerifiedDate: VERIFIED_AS_OF,
    reviewAfterDate: REVIEW_AFTER,
    reviewCadenceDays: REVIEW_CADENCE_DAYS,
    versionHash: '937440b04ef13afd17665009ff1a2dc53925da869e1dcf8bec5b9a2f30d165b2',
    status: SOURCE_STATUS.ACTIVE_AT_LAST_VERIFICATION,
    sourcePriority: 'OFFICIAL_GOVERNMENT_PRIMARY',
  }),
  Object.freeze({
    id: 'REGA_EXECUTIVE_REGULATIONS',
    authority: 'Real Estate General Authority (REGA)',
    instrument: 'Executive Regulations of the Real Estate Brokerage Law',
    sourceUrl: 'https://rega.gov.sa/الأنظمة-والقرارات/الأنظمة-واللوائح-والأدلة/اللوائح/اللائحة-التنفيذية-لنظام-الوساطة-العقارية/',
    sourcePublishedDateOfficial: '1444/06/27 AH',
    sourceIssuedDateOfficial: '1444/06/24 AH',
    effectiveDate: 'FROM_EFFECTIVE_DATE_OF_REAL_ESTATE_BROKERAGE_LAW',
    effectiveDateBasis: 'The governing law states that its executive regulations apply from the law effective date; exact Gregorian conversion is intentionally not asserted by software.',
    lastVerifiedDate: VERIFIED_AS_OF,
    reviewAfterDate: REVIEW_AFTER,
    reviewCadenceDays: REVIEW_CADENCE_DAYS,
    versionHash: '39f951079687e33432b67f67e32acfd1394b2152d83a262dfa82a9f35ea3836f',
    status: SOURCE_STATUS.ACTIVE_AT_LAST_VERIFICATION,
    sourcePriority: 'OFFICIAL_GOVERNMENT_PRIMARY',
  }),
  Object.freeze({
    id: 'REGA_CONSULTANCY_ANALYSIS_REGULATION',
    authority: 'Real Estate General Authority (REGA)',
    instrument: 'Regulation for Real Estate Consultancy and Analysis',
    sourceUrl: 'https://rega.gov.sa/الأنظمة-والقرارات/الأنظمة-واللوائح-والأدلة/اللوائح/اللائحة-التنظيمية-للاستشارات-والتحليلات-العقارية/',
    sourcePublishedDateOfficial: '1445/06/09 AH',
    sourceIssuedDateOfficial: '1445/05/19 AH',
    effectiveDate: 'NOT_ASSERTED_BY_SOFTWARE_REQUIRES_AUTHORIZED_REVIEW',
    effectiveDateBasis: 'The official REGA page confirms the regulation is active, but this engineering registry does not infer an exact effective date absent authorized legal confirmation.',
    lastVerifiedDate: VERIFIED_AS_OF,
    reviewAfterDate: REVIEW_AFTER,
    reviewCadenceDays: REVIEW_CADENCE_DAYS,
    versionHash: '2f6cc1719fa5e2ab66fc9fda9b9e1d7c5ccb7fd6afdc2104485f4abb99bc318f',
    status: SOURCE_STATUS.ACTIVE_AT_LAST_VERIFICATION,
    sourcePriority: 'OFFICIAL_GOVERNMENT_PRIMARY',
  }),
  Object.freeze({
    id: 'SDAIA_PDPL',
    authority: 'Saudi Data & AI Authority (SDAIA)',
    instrument: 'Personal Data Protection Law (PDPL)',
    sourceUrl: 'https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter',
    sourcePublishedDateOfficial: 'OFFICIAL_KNOWLEDGE_CENTER',
    sourceIssuedDateOfficial: 'OFFICIAL_KNOWLEDGE_CENTER',
    effectiveDate: 'NOT_ASSERTED_BY_SOFTWARE_REQUIRES_AUTHORIZED_REVIEW',
    effectiveDateBasis: 'Operational source registry records the official SDAIA knowledge-center source without self-establishing a legal effective date.',
    lastVerifiedDate: VERIFIED_AS_OF,
    reviewAfterDate: REVIEW_AFTER,
    reviewCadenceDays: REVIEW_CADENCE_DAYS,
    versionHash: '28fbcf5b0b337ae7c49286384ad7bdc3d26ea51102842f95d444a4433d198bd9',
    status: SOURCE_STATUS.ACTIVE_AT_LAST_VERIFICATION,
    sourcePriority: 'OFFICIAL_GOVERNMENT_PRIMARY',
  }),
  Object.freeze({
    id: 'SDAIA_PDPL_IMPLEMENTING_REGULATION',
    authority: 'Saudi Data & AI Authority (SDAIA)',
    instrument: 'Implementing Regulation of the Personal Data Protection Law',
    sourceUrl: 'https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL2/',
    sourcePublishedDateOfficial: 'OFFICIAL_KNOWLEDGE_CENTER',
    sourceIssuedDateOfficial: 'OFFICIAL_KNOWLEDGE_CENTER',
    effectiveDate: 'NOT_ASSERTED_BY_SOFTWARE_REQUIRES_AUTHORIZED_REVIEW',
    effectiveDateBasis: 'Operational source registry records the official SDAIA implementing-regulation source without self-establishing a legal effective date.',
    lastVerifiedDate: VERIFIED_AS_OF,
    reviewAfterDate: REVIEW_AFTER,
    reviewCadenceDays: REVIEW_CADENCE_DAYS,
    versionHash: '231b70a7ece4dc6c3d519e52cc8606df91223c388e9873879c97e970eef63e4c',
    status: SOURCE_STATUS.ACTIVE_AT_LAST_VERIFICATION,
    sourcePriority: 'OFFICIAL_GOVERNMENT_PRIMARY',
  }),
]);

function validateRegistrySource(source, asOfDate = VERIFIED_AS_OF) {
  const requiredStrings = [
    'id', 'authority', 'instrument', 'sourceUrl', 'sourcePublishedDateOfficial',
    'sourceIssuedDateOfficial', 'effectiveDate', 'effectiveDateBasis',
    'lastVerifiedDate', 'reviewAfterDate', 'versionHash', 'status', 'sourcePriority',
  ];
  const missing = requiredStrings.filter((key) => typeof source?.[key] !== 'string' || source[key].trim() === '');
  if (missing.length || !Number.isInteger(source?.reviewCadenceDays) || source.reviewCadenceDays <= 0) {
    return Object.freeze({
      sourceId: source?.id || null,
      status: SOURCE_STATUS.REGULATORY_REVIEW_REQUIRED,
      reasons: Object.freeze([`SOURCE_METADATA_INCOMPLETE:${missing.join(',') || 'reviewCadenceDays'}`]),
      usableForComplianceEvidence: false,
      legalApprovalEstablished: false,
    });
  }
  const asOf = Date.parse(asOfDate);
  const verified = Date.parse(source.lastVerifiedDate);
  const reviewAfter = Date.parse(source.reviewAfterDate);
  if (!Number.isFinite(asOf) || !Number.isFinite(verified) || !Number.isFinite(reviewAfter) || verified > asOf || reviewAfter < asOf) {
    return Object.freeze({
      sourceId: source.id,
      status: SOURCE_STATUS.REGULATORY_REVIEW_REQUIRED,
      reasons: Object.freeze(['SOURCE_STALE_OR_DATE_INVALID']),
      usableForComplianceEvidence: false,
      legalApprovalEstablished: false,
    });
  }
  return Object.freeze({
    sourceId: source.id,
    status: SOURCE_STATUS.ACTIVE_AT_LAST_VERIFICATION,
    reasons: Object.freeze([]),
    usableForComplianceEvidence: true,
    legalApprovalEstablished: false,
  });
}

function evaluateSaudiRegulatoryRegistry(asOfDate = VERIFIED_AS_OF) {
  const sourceResults = SAUDI_REGULATORY_SOURCES.map((source) => validateRegistrySource(source, asOfDate));
  const ready = sourceResults.every((result) => result.usableForComplianceEvidence === true);
  return Object.freeze({
    schemaVersion: 1,
    jurisdiction: 'SAUDI_ARABIA',
    asOfDate,
    status: ready ? SOURCE_STATUS.ACTIVE_AT_LAST_VERIFICATION : SOURCE_STATUS.REGULATORY_REVIEW_REQUIRED,
    sources: Object.freeze(sourceResults),
    legalApprovalEstablished: false,
    legalReviewRequiredBeforeCommercialExternalLaunch: true,
    transactionAuthorized: false,
    semantics: 'Registry freshness is an engineering evidence control only. It does not determine whether STARTAK activity is licensed, exempt, compliant, or legally authorized.',
  });
}

module.exports = {
  VERIFIED_AS_OF,
  REVIEW_AFTER,
  REVIEW_CADENCE_DAYS,
  SOURCE_STATUS,
  SAUDI_REGULATORY_SOURCES,
  validateRegistrySource,
  evaluateSaudiRegulatoryRegistry,
};
