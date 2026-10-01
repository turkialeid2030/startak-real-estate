'use strict';

const {
  SOURCE_TIER,
  SOURCE_PROVIDER_KIND,
} = require('../contracts/source-intelligence');

const SOURCE_PROVIDER_REGISTRY_VERSION = 'C2S_SOURCE_PROVIDER_REGISTRY_V1';

const SOURCE_MACHINE_ACCESS_STATUS = Object.freeze({
  PUBLIC_WEB_UI_ONLY_MACHINE_ACCESS_NOT_VERIFIED: 'PUBLIC_WEB_UI_ONLY_MACHINE_ACCESS_NOT_VERIFIED',
  AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED: 'AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED',
  DATASET_AND_POLICY_DEPENDENT: 'DATASET_AND_POLICY_DEPENDENT',
});

const CANONICAL_SOURCE_PROVIDER_REGISTRY = Object.freeze({
  REGA_REAL_ESTATE_INDICATORS: Object.freeze({
    id: 'REGA_REAL_ESTATE_INDICATORS',
    organization: 'Real Estate General Authority',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AGGREGATOR,
    officialDomains: Object.freeze(['rei.rega.gov.sa', 'rega.gov.sa', 'www.rega.gov.sa']),
    allowedUnderlyingAuthorities: Object.freeze([
      'REGA_REAL_ESTATE_INDICATORS',
      'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
      'REAL_ESTATE_REGISTRY_MARKET_RECORDS',
      'EJAR_REGISTERED_RENT_CONTRACTS',
      'GASTAT_REAL_ESTATE_INDICES',
    ]),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.PUBLIC_WEB_UI_ONLY_MACHINE_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  REGA_GEOSPATIAL_REAL_ESTATE_PORTAL: Object.freeze({
    id: 'REGA_GEOSPATIAL_REAL_ESTATE_PORTAL',
    organization: 'Real Estate General Authority',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AUTHORITY,
    officialDomains: Object.freeze(['rega.gov.sa', 'www.rega.gov.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['REGA_GEOSPATIAL_REAL_ESTATE_PORTAL']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.PUBLIC_WEB_UI_ONLY_MACHINE_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS: Object.freeze({
    id: 'MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS',
    organization: 'Ministry of Justice',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AUTHORITY,
    officialDomains: Object.freeze(['moj.gov.sa', 'www.moj.gov.sa', 'srem.moj.gov.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['MINISTRY_OF_JUSTICE_REAL_ESTATE_TRANSACTIONS']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  REAL_ESTATE_REGISTRY_MARKET_RECORDS: Object.freeze({
    id: 'REAL_ESTATE_REGISTRY_MARKET_RECORDS',
    organization: 'Real Estate Registry',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AUTHORITY,
    officialDomains: Object.freeze(['rer.sa', 'www.rer.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['REAL_ESTATE_REGISTRY_MARKET_RECORDS']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  EJAR_REGISTERED_RENT_CONTRACTS: Object.freeze({
    id: 'EJAR_REGISTERED_RENT_CONTRACTS',
    organization: 'Ejar Network',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AUTHORITY,
    officialDomains: Object.freeze(['ejar.sa', 'www.ejar.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['EJAR_REGISTERED_RENT_CONTRACTS']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  GASTAT_REAL_ESTATE_INDICES: Object.freeze({
    id: 'GASTAT_REAL_ESTATE_INDICES',
    organization: 'General Authority for Statistics',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_STATISTICAL_SOURCE,
    officialDomains: Object.freeze(['stats.gov.sa', 'www.stats.gov.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['GASTAT_REAL_ESTATE_INDICES']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.DATASET_AND_POLICY_DEPENDENT,
    productionAdapterEnabled: false,
  }),
  BALADY_URBAN_MAPS: Object.freeze({
    id: 'BALADY_URBAN_MAPS',
    organization: 'Balady / Ministry of Municipalities and Housing',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AUTHORITY,
    officialDomains: Object.freeze(['balady.gov.sa', 'www.balady.gov.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['BALADY_URBAN_MAPS']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.PUBLIC_WEB_UI_ONLY_MACHINE_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  RIYADH_MUNICIPALITY_GEOSPATIAL: Object.freeze({
    id: 'RIYADH_MUNICIPALITY_GEOSPATIAL',
    organization: 'Riyadh Municipality',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AUTHORITY,
    officialDomains: Object.freeze(['alriyadh.gov.sa', 'www.alriyadh.gov.sa', 'maps.alriyadh.gov.sa', 'rmp.alriyadh.gov.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['RIYADH_MUNICIPALITY_GEOSPATIAL']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.DATASET_AND_POLICY_DEPENDENT,
    productionAdapterEnabled: false,
  }),
  MADINAH_MUNICIPALITY_GEOSPATIAL: Object.freeze({
    id: 'MADINAH_MUNICIPALITY_GEOSPATIAL',
    organization: 'Madinah Municipality',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AUTHORITY,
    officialDomains: Object.freeze(['amana-md.gov.sa', 'www.amana-md.gov.sa', 'services.amana-md.gov.sa', 'geomed.amana-md.gov.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['MADINAH_MUNICIPALITY_GEOSPATIAL']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.DATASET_AND_POLICY_DEPENDENT,
    productionAdapterEnabled: false,
  }),
  JEDDAH_MUNICIPALITY_GEOSPATIAL: Object.freeze({
    id: 'JEDDAH_MUNICIPALITY_GEOSPATIAL',
    organization: 'Jeddah Municipality',
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    providerKind: SOURCE_PROVIDER_KIND.OFFICIAL_AUTHORITY,
    officialDomains: Object.freeze(['jeddah.gov.sa', 'www.jeddah.gov.sa', 'smartmap.jeddah.gov.sa', 'maps.jeddah.gov.sa']),
    allowedUnderlyingAuthorities: Object.freeze(['JEDDAH_MUNICIPALITY_GEOSPATIAL']),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.PUBLIC_WEB_UI_ONLY_MACHINE_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  EARTHAPP_COMMERCIAL_INTELLIGENCE: Object.freeze({
    id: 'EARTHAPP_COMMERCIAL_INTELLIGENCE',
    organization: 'Earth App',
    sourceTier: SOURCE_TIER.B_COMMERCIAL_CORROBORATION,
    providerKind: SOURCE_PROVIDER_KIND.COMMERCIAL_INTELLIGENCE_PLATFORM,
    officialDomains: Object.freeze(['earthapp.com.sa', 'www.earthapp.com.sa', 'map.earthapp.com.sa']),
    allowedUnderlyingAuthorities: Object.freeze([]),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  SUHAIL_COMMERCIAL_INTELLIGENCE: Object.freeze({
    id: 'SUHAIL_COMMERCIAL_INTELLIGENCE',
    organization: 'Suhail',
    sourceTier: SOURCE_TIER.B_COMMERCIAL_CORROBORATION,
    providerKind: SOURCE_PROVIDER_KIND.COMMERCIAL_INTELLIGENCE_PLATFORM,
    officialDomains: Object.freeze(['suhail.ai', 'www.suhail.ai']),
    allowedUnderlyingAuthorities: Object.freeze([]),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
  TATHMIN_INDICATIVE_AVM: Object.freeze({
    id: 'TATHMIN_INDICATIVE_AVM',
    organization: 'Tathmin',
    sourceTier: SOURCE_TIER.C_INDICATIVE_AVM,
    providerKind: SOURCE_PROVIDER_KIND.INDICATIVE_AVM_PLATFORM,
    officialDomains: Object.freeze(['tathmin.online', 'www.tathmin.online']),
    allowedUnderlyingAuthorities: Object.freeze([]),
    machineAccessStatus: SOURCE_MACHINE_ACCESS_STATUS.AUTHENTICATED_OR_CONTRACTUAL_ACCESS_NOT_VERIFIED,
    productionAdapterEnabled: false,
  }),
});

function getCanonicalSourceProvider(sourceProvider) {
  return CANONICAL_SOURCE_PROVIDER_REGISTRY[sourceProvider] || null;
}

function sourceUrlMatchesProvider(provider, urlText) {
  if (!provider || !Array.isArray(provider.officialDomains) || typeof urlText !== 'string' || !urlText.trim()) return false;
  try {
    const parsed = new URL(urlText.trim());
    return parsed.protocol === 'https:' && provider.officialDomains.includes(parsed.hostname.toLowerCase());
  } catch (_) {
    return false;
  }
}

module.exports = {
  SOURCE_PROVIDER_REGISTRY_VERSION,
  SOURCE_MACHINE_ACCESS_STATUS,
  CANONICAL_SOURCE_PROVIDER_REGISTRY,
  getCanonicalSourceProvider,
  sourceUrlMatchesProvider,
};