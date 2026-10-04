'use strict';

/**
 * C40 trusted-source catalog.
 *
 * This registry identifies official authorities that may provide market,
 * regulatory or statistical evidence. It deliberately does NOT embed a live
 * market value, rent, transaction count or financing statistic. A value is not
 * decision-grade until the product has a configured retrieval path and stores
 * source URL/identifier, observation period, retrieval timestamp and integrity
 * metadata. The catalog itself is therefore discovery/governance metadata, not
 * market evidence.
 */
const SAUDI_OFFICIAL_SOURCE_CATALOG = Object.freeze([
  Object.freeze({
    id: 'REGA_REAL_ESTATE_INDICATORS',
    authority: 'الهيئة العامة للعقار',
    officialDomain: 'rega.gov.sa',
    officialProductDomain: 'rei.rega.gov.sa',
    purpose: Object.freeze(['SALE_MARKET_INDICATORS', 'RENTAL_MARKET_INDICATORS', 'REAL_ESTATE_REPORTS']),
    retrievalMode: 'MANUAL_OR_GOVERNED_CONNECTOR_REQUIRED',
    integrationStatus: 'NOT_CONFIGURED',
  }),
  Object.freeze({
    id: 'GASTAT_REAL_ESTATE_STATISTICS',
    authority: 'الهيئة العامة للإحصاء',
    officialDomain: 'stats.gov.sa',
    purpose: Object.freeze(['REAL_ESTATE_PRICE_INDEX', 'OFFICIAL_STATISTICS']),
    retrievalMode: 'MANUAL_OR_GOVERNED_CONNECTOR_REQUIRED',
    integrationStatus: 'NOT_CONFIGURED',
  }),
  Object.freeze({
    id: 'ZATCA_REAL_ESTATE_TAX',
    authority: 'هيئة الزكاة والضريبة والجمارك',
    officialDomain: 'zatca.gov.sa',
    purpose: Object.freeze(['RETT_RULES', 'VAT_AND_TAX_REGULATORY_EVIDENCE']),
    retrievalMode: 'MANUAL_OR_GOVERNED_CONNECTOR_REQUIRED',
    integrationStatus: 'NOT_CONFIGURED',
  }),
  Object.freeze({
    id: 'SAMA_REAL_ESTATE_FINANCE',
    authority: 'البنك المركزي السعودي',
    officialDomain: 'sama.gov.sa',
    purpose: Object.freeze(['REAL_ESTATE_FINANCE_STATISTICS', 'FINANCE_MARKET_CONTEXT']),
    retrievalMode: 'MANUAL_OR_GOVERNED_CONNECTOR_REQUIRED',
    integrationStatus: 'NOT_CONFIGURED',
  }),
  Object.freeze({
    id: 'MOJ_REAL_ESTATE_TRANSACTIONS',
    authority: 'وزارة العدل',
    officialDomain: 'moj.gov.sa',
    purpose: Object.freeze(['REAL_ESTATE_TRANSACTION_CONTEXT', 'TITLE_AND_JUSTICE_CONTEXT']),
    retrievalMode: 'MANUAL_OR_GOVERNED_CONNECTOR_REQUIRED',
    integrationStatus: 'NOT_CONFIGURED',
  }),
  Object.freeze({
    id: 'EJAR_RENTAL_ECOSYSTEM',
    authority: 'إيجار / الهيئة العامة للعقار',
    officialDomain: 'ejar.sa',
    purpose: Object.freeze(['RENTAL_CONTRACT_CONTEXT', 'RENTAL_MARKET_CONTEXT']),
    retrievalMode: 'MANUAL_OR_GOVERNED_CONNECTOR_REQUIRED',
    integrationStatus: 'NOT_CONFIGURED',
  }),
]);

const REQUIRED_OBSERVATION_PROVENANCE = Object.freeze([
  'sourceId',
  'sourceUrlOrDocumentRef',
  'retrievedAt',
  'observationPeriod',
  'geography',
  'propertyType',
  'unit',
  'value',
  'verificationStatus',
]);

function validateSourceObservation(observation) {
  if (!observation || typeof observation !== 'object') {
    return Object.freeze({ valid: false, reasonCode: 'SOURCE_OBSERVATION_MISSING' });
  }
  const source = SAUDI_OFFICIAL_SOURCE_CATALOG.find((item) => item.id === observation.sourceId);
  if (!source) return Object.freeze({ valid: false, reasonCode: 'UNTRUSTED_SOURCE_ID' });
  const missing = REQUIRED_OBSERVATION_PROVENANCE.filter((field) => {
    const value = observation[field];
    return value === undefined || value === null || value === '';
  });
  if (missing.length > 0) {
    return Object.freeze({ valid: false, reasonCode: 'SOURCE_PROVENANCE_INCOMPLETE', missing: Object.freeze(missing) });
  }
  if (observation.verificationStatus !== 'VERIFIED') {
    return Object.freeze({ valid: false, reasonCode: 'SOURCE_OBSERVATION_UNVERIFIED' });
  }
  if (typeof observation.value !== 'number' || !Number.isFinite(observation.value)) {
    return Object.freeze({ valid: false, reasonCode: 'SOURCE_VALUE_NONFINITE' });
  }
  const retrievedAt = Date.parse(observation.retrievedAt);
  if (!Number.isFinite(retrievedAt)) {
    return Object.freeze({ valid: false, reasonCode: 'SOURCE_RETRIEVAL_TIMESTAMP_INVALID' });
  }
  if (retrievedAt > Date.now()) {
    return Object.freeze({ valid: false, reasonCode: 'SOURCE_RETRIEVAL_TIMESTAMP_IN_FUTURE' });
  }
  return Object.freeze({
    valid: true,
    reasonCode: 'OFFICIAL_SOURCE_OBSERVATION_PROVENANCE_COMPLETE',
    sourceId: source.id,
    authority: source.authority,
  });
}

module.exports = {
  SAUDI_OFFICIAL_SOURCE_CATALOG,
  REQUIRED_OBSERVATION_PROVENANCE,
  validateSourceObservation,
};
