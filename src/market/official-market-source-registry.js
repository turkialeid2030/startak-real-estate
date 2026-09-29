'use strict';

const { MARKET_EVIDENCE_TYPE } = require('../contracts/market-evidence');

const OFFICIAL_MARKET_SOURCE_REGISTRY_VERSION = 'C2_OFFICIAL_MARKET_SOURCE_REGISTRY_V1';

const MARKET_MACHINE_ACCESS_STATUS = Object.freeze({
  PUBLIC_WEB_UI_API_NOT_VERIFIED: 'PUBLIC_WEB_UI_API_NOT_VERIFIED',
  AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED: 'AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED',
  DATASET_AND_POLICY_DEPENDENT: 'DATASET_AND_POLICY_DEPENDENT',
});

const MARKET_SOURCE_ROLE = Object.freeze({
  OFFICIAL_AGGREGATOR: 'OFFICIAL_AGGREGATOR',
  PRIMARY_OFFICIAL_SOURCE: 'PRIMARY_OFFICIAL_SOURCE',
  OFFICIAL_STATISTICAL_SOURCE: 'OFFICIAL_STATISTICAL_SOURCE',
});

const OFFICIAL_MARKET_SOURCE_REGISTRY = Object.freeze({
  REGA_REAL_ESTATE_INDICATORS: Object.freeze({
    id: 'REGA_REAL_ESTATE_INDICATORS',
    organization: 'Real Estate General Authority',
    authorityScope: 'OFFICIAL_REAL_ESTATE_MARKET_INDICATORS',
    sourceRole: MARKET_SOURCE_ROLE.OFFICIAL_AGGREGATOR,
    officialDomains: Object.freeze(['rei.rega.gov.sa', 'rega.gov.sa', 'www.rega.gov.sa']),
    publicReferenceUrl: 'https://rei.rega.gov.sa/ar',
    machineAccessStatus: MARKET_MACHINE_ACCESS_STATUS.PUBLIC_WEB_UI_API_NOT_VERIFIED,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
      MARKET_EVIDENCE_TYPE.SALE_MARKET_AGGREGATE,
      MARKET_EVIDENCE_TYPE.RENT_MARKET_AGGREGATE,
      MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX,
      MARKET_EVIDENCE_TYPE.RENT_INDEX,
      MARKET_EVIDENCE_TYPE.MARKET_LIQUIDITY_INDICATOR,
    ]),
    declaredUpstreamSources: Object.freeze([
      'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
      'REAL_ESTATE_REGISTRY_MARKET_RECORDS',
      'EJAR_REGISTERED_RENT_CONTRACTS',
      'GASTAT_REAL_ESTATE_INDICES',
    ]),
    notes: 'Official REGA platform publishes sale/rent market indicators and historical sale-deal views. C2 does not infer row-level closed-rent transaction authority from aggregate rental indicators. Public web access is not treated as an API, bulk-download, licensing or production machine-access grant.',
  }),

  MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS: Object.freeze({
    id: 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
    organization: 'Ministry of Justice',
    authorityScope: 'REGISTERED_REAL_ESTATE_SALE_TRANSACTIONS',
    sourceRole: MARKET_SOURCE_ROLE.PRIMARY_OFFICIAL_SOURCE,
    officialDomains: Object.freeze(['moj.gov.sa', 'www.moj.gov.sa']),
    publicReferenceUrl: 'https://www.moj.gov.sa/',
    machineAccessStatus: MARKET_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
    ]),
    declaredUpstreamSources: Object.freeze([]),
    notes: 'REGA publicly identifies Ministry of Justice as a source for sale-transaction indicators. Direct machine access, field-level schema, licensing and permitted reuse must be independently established.',
  }),

  REAL_ESTATE_REGISTRY_MARKET_RECORDS: Object.freeze({
    id: 'REAL_ESTATE_REGISTRY_MARKET_RECORDS',
    organization: 'Real Estate Registry',
    authorityScope: 'REGISTERED_REAL_ESTATE_RECORDS_AND_SALE_TRANSACTIONS',
    sourceRole: MARKET_SOURCE_ROLE.PRIMARY_OFFICIAL_SOURCE,
    officialDomains: Object.freeze(['rer.sa', 'www.rer.sa']),
    publicReferenceUrl: 'https://www.rer.sa/',
    machineAccessStatus: MARKET_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      MARKET_EVIDENCE_TYPE.CLOSED_SALE_TRANSACTION,
    ]),
    declaredUpstreamSources: Object.freeze([]),
    notes: 'REGA publicly identifies the Real Estate Registry as a source for sale-transaction indicators. C2 does not infer that title-record access automatically grants market-data API access.',
  }),

  EJAR_REGISTERED_RENT_CONTRACTS: Object.freeze({
    id: 'EJAR_REGISTERED_RENT_CONTRACTS',
    organization: 'Ejar Network',
    authorityScope: 'REGISTERED_RENT_CONTRACTS',
    sourceRole: MARKET_SOURCE_ROLE.PRIMARY_OFFICIAL_SOURCE,
    officialDomains: Object.freeze(['ejar.sa', 'www.ejar.sa']),
    publicReferenceUrl: 'https://www.ejar.sa/',
    machineAccessStatus: MARKET_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      MARKET_EVIDENCE_TYPE.CLOSED_RENT_TRANSACTION,
    ]),
    declaredUpstreamSources: Object.freeze([]),
    notes: 'REGA identifies Ejar as the source for rental transaction indicators. Direct production access, row-level field semantics and reuse rights are not assumed.',
  }),

  GASTAT_REAL_ESTATE_INDICES: Object.freeze({
    id: 'GASTAT_REAL_ESTATE_INDICES',
    organization: 'General Authority for Statistics',
    authorityScope: 'OFFICIAL_REAL_ESTATE_AND_RENT_PRICE_INDICES',
    sourceRole: MARKET_SOURCE_ROLE.OFFICIAL_STATISTICAL_SOURCE,
    officialDomains: Object.freeze(['stats.gov.sa', 'www.stats.gov.sa']),
    publicReferenceUrl: 'https://www.stats.gov.sa/',
    machineAccessStatus: MARKET_MACHINE_ACCESS_STATUS.DATASET_AND_POLICY_DEPENDENT,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      MARKET_EVIDENCE_TYPE.SALE_PRICE_INDEX,
      MARKET_EVIDENCE_TYPE.RENT_INDEX,
    ]),
    declaredUpstreamSources: Object.freeze([]),
    notes: 'Official statistical source for published real-estate/rent price indices. Dataset-specific API, licensing and redistribution conditions must be verified before production ingestion.',
  }),
});

function getOfficialMarketSource(sourceId) {
  return OFFICIAL_MARKET_SOURCE_REGISTRY[sourceId] || null;
}

function marketSourceSupportsEvidenceType(sourceId, evidenceType) {
  const source = getOfficialMarketSource(sourceId);
  return !!(source && source.supportedEvidenceTypes.includes(evidenceType));
}

function officialMarketUrlMatchesSource(sourceId, urlText) {
  const source = getOfficialMarketSource(sourceId);
  if (!source || typeof urlText !== 'string' || !urlText.trim()) return false;
  try {
    const parsed = new URL(urlText.trim());
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && source.officialDomains.includes(hostname);
  } catch (_) {
    return false;
  }
}

module.exports = {
  OFFICIAL_MARKET_SOURCE_REGISTRY_VERSION,
  MARKET_MACHINE_ACCESS_STATUS,
  MARKET_SOURCE_ROLE,
  OFFICIAL_MARKET_SOURCE_REGISTRY,
  getOfficialMarketSource,
  marketSourceSupportsEvidenceType,
  officialMarketUrlMatchesSource,
};
