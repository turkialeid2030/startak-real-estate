'use strict';

const { GEOSPATIAL_EVIDENCE_TYPE } = require('../contracts/geospatial-evidence');

const OFFICIAL_GEOSPATIAL_SOURCE_REGISTRY_VERSION = 'C1_OFFICIAL_GEOSPATIAL_SOURCE_REGISTRY_V1';

const MACHINE_ACCESS_STATUS = Object.freeze({
  DATASET_AND_POLICY_DEPENDENT: 'DATASET_AND_POLICY_DEPENDENT',
  PUBLIC_API_NOT_VERIFIED: 'PUBLIC_API_NOT_VERIFIED',
  AUTHENTICATED_SERVICE: 'AUTHENTICATED_SERVICE',
});

const OFFICIAL_SOURCE_REGISTRY = Object.freeze({
  GEOSA_NATIONAL_GEOSPATIAL_PLATFORM: Object.freeze({
    id: 'GEOSA_NATIONAL_GEOSPATIAL_PLATFORM',
    authorityScope: 'NATIONAL_GEOSPATIAL_INFRASTRUCTURE',
    organization: 'General Authority for Survey and Geospatial Information',
    officialDomains: Object.freeze(['geosa.gov.sa', 'www.geosa.gov.sa', 'geoportal.geosa.gov.sa']),
    publicReferenceUrl: 'https://geoportal.geosa.gov.sa/geoportal/',
    machineAccessStatus: MACHINE_ACCESS_STATUS.DATASET_AND_POLICY_DEPENDENT,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      GEOSPATIAL_EVIDENCE_TYPE.ROAD_ACCESS,
      GEOSPATIAL_EVIDENCE_TYPE.SERVICE_CONTEXT,
      GEOSPATIAL_EVIDENCE_TYPE.POINTS_OF_INTEREST,
    ]),
    notes: 'National geospatial infrastructure, open-data/data-request services and web services are publicly documented. Dataset-specific access, publication policy and permitted use must be verified before enabling a production adapter.',
  }),

  REGA_GEOSPATIAL_REAL_ESTATE_PORTAL: Object.freeze({
    id: 'REGA_GEOSPATIAL_REAL_ESTATE_PORTAL',
    authorityScope: 'REAL_ESTATE_GEOSPATIAL_PORTAL',
    organization: 'Real Estate General Authority',
    officialDomains: Object.freeze(['rega.gov.sa', 'www.rega.gov.sa']),
    publicReferenceUrl: 'https://rega.gov.sa/rega-services/platforms/geospatial-real-estate-portal/',
    machineAccessStatus: MACHINE_ACCESS_STATUS.PUBLIC_API_NOT_VERIFIED,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      GEOSPATIAL_EVIDENCE_TYPE.PARCEL_IDENTITY,
      GEOSPATIAL_EVIDENCE_TYPE.PLAN_IDENTITY,
      GEOSPATIAL_EVIDENCE_TYPE.POINTS_OF_INTEREST,
      GEOSPATIAL_EVIDENCE_TYPE.SERVICE_CONTEXT,
    ]),
    notes: 'Official portal publicly documents spatial/descriptive data including regions, cities, neighborhoods, land parcels and points of interest. A production machine-access contract is not assumed until an API/licensing path is independently verified.',
  }),

  BALADY_URBAN_MAPS: Object.freeze({
    id: 'BALADY_URBAN_MAPS',
    authorityScope: 'MUNICIPAL_URBAN_PLANNING',
    organization: 'Ministry of Municipalities and Housing / Balady',
    officialDomains: Object.freeze(['balady.gov.sa', 'www.balady.gov.sa']),
    publicReferenceUrl: 'https://www.balady.gov.sa/',
    machineAccessStatus: MACHINE_ACCESS_STATUS.PUBLIC_API_NOT_VERIFIED,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      GEOSPATIAL_EVIDENCE_TYPE.PLAN_IDENTITY,
      GEOSPATIAL_EVIDENCE_TYPE.LAND_USE,
      GEOSPATIAL_EVIDENCE_TYPE.ZONING_BUILDABILITY,
      GEOSPATIAL_EVIDENCE_TYPE.MUNICIPAL_RESTRICTION,
      GEOSPATIAL_EVIDENCE_TYPE.ROAD_ACCESS,
      GEOSPATIAL_EVIDENCE_TYPE.SERVICE_CONTEXT,
      GEOSPATIAL_EVIDENCE_TYPE.POINTS_OF_INTEREST,
    ]),
    notes: 'Balady publicly describes Urban Maps as a government digital map covering road networks, land uses/classifications/areas and building requirements. No public production API contract is inferred from the web service description.',
  }),

  REAL_ESTATE_REGISTRY: Object.freeze({
    id: 'REAL_ESTATE_REGISTRY',
    authorityScope: 'TITLE_REGISTER_AND_PROPERTY_RIGHTS',
    organization: 'Real Estate Registry',
    officialDomains: Object.freeze(['rer.sa', 'www.rer.sa']),
    publicReferenceUrl: 'https://www.rer.sa/',
    machineAccessStatus: MACHINE_ACCESS_STATUS.AUTHENTICATED_SERVICE,
    productionAdapterEnabled: false,
    supportedEvidenceTypes: Object.freeze([
      GEOSPATIAL_EVIDENCE_TYPE.PARCEL_IDENTITY,
      GEOSPATIAL_EVIDENCE_TYPE.TITLE_STATUS,
      GEOSPATIAL_EVIDENCE_TYPE.RIGHTS_RESTRICTIONS_OBLIGATIONS,
    ]),
    notes: 'RER publicly documents title registration, property documents, split/merge and rights/restrictions/obligations services. It must not be treated as a zoning authority. Authenticated or contractual access is not assumed to be available programmatically.',
  }),
});

function getOfficialSource(sourceId) {
  return OFFICIAL_SOURCE_REGISTRY[sourceId] || null;
}

function sourceSupportsEvidenceType(sourceId, evidenceType) {
  const source = getOfficialSource(sourceId);
  return !!(source && source.supportedEvidenceTypes.includes(evidenceType));
}

function officialUrlMatchesSource(sourceId, urlText) {
  const source = getOfficialSource(sourceId);
  if (!source || typeof urlText !== 'string' || !urlText.trim()) return false;
  try {
    const hostname = new URL(urlText.trim()).hostname.toLowerCase();
    return source.officialDomains.includes(hostname);
  } catch (_) {
    return false;
  }
}

module.exports = {
  OFFICIAL_GEOSPATIAL_SOURCE_REGISTRY_VERSION,
  MACHINE_ACCESS_STATUS,
  OFFICIAL_SOURCE_REGISTRY,
  getOfficialSource,
  sourceSupportsEvidenceType,
  officialUrlMatchesSource,
};
