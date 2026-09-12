'use strict';

const crypto = require('crypto');
const {
  PROPERTY_EVIDENCE_PACKET_STATUS,
} = require('../property/property-evidence-bridge');

const COMMERCIAL_ASSET_CLASS = Object.freeze({
  OFFICE: 'OFFICE',
  STREET_RETAIL: 'STREET_RETAIL',
  SHOPPING_CENTRE: 'SHOPPING_CENTRE',
  BUSINESS_PARK: 'BUSINESS_PARK',
  INDUSTRIAL_LOGISTICS: 'INDUSTRIAL_LOGISTICS',
  COMMERCIAL_MIXED_USE: 'COMMERCIAL_MIXED_USE',
});

const OCCUPANCY_STRUCTURE = Object.freeze({
  OWNER_OCCUPIED: 'OWNER_OCCUPIED',
  SINGLE_TENANT: 'SINGLE_TENANT',
  MULTI_TENANT: 'MULTI_TENANT',
  VACANT: 'VACANT',
  MIXED: 'MIXED',
});

const COMMERCIAL_ANALYSIS_CONTEXT = Object.freeze({
  PROFESSIONAL_VALUATION: 'PROFESSIONAL_VALUATION',
  INVESTMENT_ANALYSIS: 'INVESTMENT_ANALYSIS',
  FINANCIAL_REPORTING: 'FINANCIAL_REPORTING',
  FINANCING_REVIEW: 'FINANCING_REVIEW',
});

const COMMERCIAL_EVIDENCE_TOPIC = Object.freeze({
  PROPERTY_RIGHTS_AND_PHYSICAL_FACTS: 'PROPERTY_RIGHTS_AND_PHYSICAL_FACTS',
  MEASUREMENTS: 'MEASUREMENTS',
  LEASE_AND_RENT_ROLL: 'LEASE_AND_RENT_ROLL',
  MARKET_RENT: 'MARKET_RENT',
  OCCUPANCY_AND_VACANCY: 'OCCUPANCY_AND_VACANCY',
  OPERATING_EXPENSES: 'OPERATING_EXPENSES',
  SERVICE_CHARGE_AND_RECOVERIES: 'SERVICE_CHARGE_AND_RECOVERIES',
  TENANT_COVENANT_AND_CONCENTRATION: 'TENANT_COVENANT_AND_CONCENTRATION',
  CAPITAL_EXPENDITURE: 'CAPITAL_EXPENDITURE',
  PARKING_ACCESS_AND_AMENITIES: 'PARKING_ACCESS_AND_AMENITIES',
  RETAIL_TRADING_PERFORMANCE: 'RETAIL_TRADING_PERFORMANCE',
  LOGISTICS_TECHNICAL_SPECIFICATION: 'LOGISTICS_TECHNICAL_SPECIFICATION',
  MIXED_USE_ALLOCATION: 'MIXED_USE_ALLOCATION',
  SALE_COMPARABLES: 'SALE_COMPARABLES',
});

const EVIDENCE_EXPECTATION = Object.freeze({
  REQUIRED: 'REQUIRED',
  CONDITIONAL: 'CONDITIONAL',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const EVIDENCE_ITEM_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROFESSIONAL_REVIEWED: 'PROFESSIONAL_REVIEWED',
  CLIENT_PROVIDED_UNVERIFIED: 'CLIENT_PROVIDED_UNVERIFIED',
  ASSUMED: 'ASSUMED',
  MISSING: 'MISSING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const COMMERCIAL_SPECIALIZATION_STATUS = Object.freeze({
  READY_FOR_PROFESSIONAL_METHOD_WORKFLOW: 'READY_FOR_PROFESSIONAL_METHOD_WORKFLOW',
  HOLD_PROPERTY_EVIDENCE: 'HOLD_PROPERTY_EVIDENCE',
  HOLD_COMMERCIAL_EVIDENCE: 'HOLD_COMMERCIAL_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const BASE_REQUIRED = Object.freeze([
  COMMERCIAL_EVIDENCE_TOPIC.PROPERTY_RIGHTS_AND_PHYSICAL_FACTS,
  COMMERCIAL_EVIDENCE_TOPIC.MEASUREMENTS,
  COMMERCIAL_EVIDENCE_TOPIC.OCCUPANCY_AND_VACANCY,
  COMMERCIAL_EVIDENCE_TOPIC.OPERATING_EXPENSES,
  COMMERCIAL_EVIDENCE_TOPIC.CAPITAL_EXPENDITURE,
]);

const ASSET_REQUIREMENTS = Object.freeze({
  [COMMERCIAL_ASSET_CLASS.OFFICE]: Object.freeze({
    required: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
      COMMERCIAL_EVIDENCE_TOPIC.PARKING_ACCESS_AND_AMENITIES,
    ]),
    conditional: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL,
      COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES,
      COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION,
      COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES,
    ]),
  }),
  [COMMERCIAL_ASSET_CLASS.STREET_RETAIL]: Object.freeze({
    required: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
      COMMERCIAL_EVIDENCE_TOPIC.PARKING_ACCESS_AND_AMENITIES,
    ]),
    conditional: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL,
      COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION,
      COMMERCIAL_EVIDENCE_TOPIC.RETAIL_TRADING_PERFORMANCE,
      COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES,
    ]),
  }),
  [COMMERCIAL_ASSET_CLASS.SHOPPING_CENTRE]: Object.freeze({
    required: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL,
      COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
      COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES,
      COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION,
      COMMERCIAL_EVIDENCE_TOPIC.PARKING_ACCESS_AND_AMENITIES,
    ]),
    conditional: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.RETAIL_TRADING_PERFORMANCE,
      COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES,
    ]),
  }),
  [COMMERCIAL_ASSET_CLASS.BUSINESS_PARK]: Object.freeze({
    required: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL,
      COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
      COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES,
      COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION,
      COMMERCIAL_EVIDENCE_TOPIC.PARKING_ACCESS_AND_AMENITIES,
    ]),
    conditional: Object.freeze([COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES]),
  }),
  [COMMERCIAL_ASSET_CLASS.INDUSTRIAL_LOGISTICS]: Object.freeze({
    required: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
      COMMERCIAL_EVIDENCE_TOPIC.LOGISTICS_TECHNICAL_SPECIFICATION,
    ]),
    conditional: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL,
      COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION,
      COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES,
    ]),
  }),
  [COMMERCIAL_ASSET_CLASS.COMMERCIAL_MIXED_USE]: Object.freeze({
    required: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.MIXED_USE_ALLOCATION,
      COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
      COMMERCIAL_EVIDENCE_TOPIC.PARKING_ACCESS_AND_AMENITIES,
    ]),
    conditional: Object.freeze([
      COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL,
      COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES,
      COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION,
      COMMERCIAL_EVIDENCE_TOPIC.RETAIL_TRADING_PERFORMANCE,
      COMMERCIAL_EVIDENCE_TOPIC.LOGISTICS_TECHNICAL_SPECIFICATION,
      COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES,
    ]),
  }),
});

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertNonEmpty(value, field) { if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`); }
function assertEnum(value, enumeration, field) { if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`); }
function iso(value, field) {
  assertNonEmpty(value, field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return parsed.toISOString();
}
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function normalizeRefs(values, field) {
  if (!Array.isArray(values) || values.length === 0 || values.some((item) => !nonEmpty(item))) throw new TypeError(`${field} must contain at least one non-empty reference`);
  return [...new Set(values.map((item) => item.trim()))].sort();
}

function propertyEvidenceCore(packet) {
  return {
    schemaVersion: packet.schemaVersion,
    caseId: packet.caseId,
    propertyRef: packet.propertyRef,
    assignmentRef: packet.assignmentRef,
    assignmentHashSha256: packet.assignmentHashSha256,
    inspectionId: packet.inspectionId,
    inspectionHashSha256: packet.inspectionHashSha256,
    valuationDate: packet.valuationDate,
    reportDate: packet.reportDate,
    jurisdiction: packet.jurisdiction,
    assetType: packet.assetType,
    assetLocation: packet.assetLocation,
    valuedRights: packet.valuedRights,
    basisOfValue: packet.basisOfValue,
    purpose: packet.purpose,
    evidenceFacts: packet.evidenceFacts,
    measurements: packet.measurements,
    propertyDataGateStatus: packet.propertyDataGateStatus,
    measurementGateStatus: packet.measurementGateStatus,
  };
}

function verifyPropertyEvidencePacketIntegrity(packet) {
  if (!packet || !validSha(packet.packetHashSha256)) return false;
  return sha256(propertyEvidenceCore(packet)) === packet.packetHashSha256.toLowerCase();
}

function createCommercialEvidenceItem({
  evidenceItemId,
  caseId,
  propertyRef,
  topic,
  status,
  evidenceRefs,
  asOfDate,
  rationale,
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['evidenceItemId', evidenceItemId], ['caseId', caseId], ['propertyRef', propertyRef], ['rationale', rationale],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(topic, COMMERCIAL_EVIDENCE_TOPIC, 'topic');
  assertEnum(status, EVIDENCE_ITEM_STATUS, 'status');
  const asOf = iso(asOfDate, 'asOfDate');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(prepared) < Date.parse(asOf)) throw new TypeError('COMMERCIAL_EVIDENCE_PREPARED_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('COMMERCIAL_EVIDENCE_REVIEW_BEFORE_PREPARATION');
  const refs = status === EVIDENCE_ITEM_STATUS.MISSING || status === EVIDENCE_ITEM_STATUS.NOT_APPLICABLE
    ? []
    : normalizeRefs(evidenceRefs, 'evidenceRefs');
  if ((status === EVIDENCE_ITEM_STATUS.MISSING || status === EVIDENCE_ITEM_STATUS.NOT_APPLICABLE)
      && Array.isArray(evidenceRefs) && evidenceRefs.length > 0) {
    throw new TypeError('MISSING_OR_NOT_APPLICABLE_EVIDENCE_CANNOT_CARRY_EVIDENCE_REFS');
  }
  const core = {
    schemaVersion: 1,
    evidenceItemId: evidenceItemId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    topic,
    status,
    evidenceRefs: refs,
    asOfDate: asOf,
    rationale: rationale.trim(),
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    professionalReviewExplicit: true,
    automaticValuationInputAdoption: false,
  };
  return deepFreeze({ ...core, evidenceItemHashSha256: sha256(core) });
}

function verifyCommercialEvidenceItemIntegrity(item) {
  if (!item || !validSha(item.evidenceItemHashSha256)) return false;
  const { evidenceItemHashSha256, ...core } = item;
  return sha256(core) === item.evidenceItemHashSha256.toLowerCase();
}

function expectationMatrix(assetClass, occupancyStructure) {
  const config = ASSET_REQUIREMENTS[assetClass];
  if (!config) throw new TypeError(`unsupported commercial asset class: ${assetClass}`);
  const required = new Set(BASE_REQUIRED);
  const conditional = new Set(config.conditional);
  config.required.forEach((topic) => required.add(topic));

  if ([OCCUPANCY_STRUCTURE.SINGLE_TENANT, OCCUPANCY_STRUCTURE.MULTI_TENANT, OCCUPANCY_STRUCTURE.MIXED].includes(occupancyStructure)) {
    required.add(COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL);
    required.add(COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION);
  }
  if ([OCCUPANCY_STRUCTURE.MULTI_TENANT, OCCUPANCY_STRUCTURE.MIXED].includes(occupancyStructure)) {
    required.add(COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES);
  }
  if ([OCCUPANCY_STRUCTURE.OWNER_OCCUPIED, OCCUPANCY_STRUCTURE.VACANT].includes(occupancyStructure)) {
    conditional.delete(COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL);
    conditional.delete(COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION);
    conditional.delete(COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES);
  }

  required.forEach((topic) => conditional.delete(topic));
  const result = {};
  for (const topic of Object.values(COMMERCIAL_EVIDENCE_TOPIC)) {
    result[topic] = required.has(topic)
      ? EVIDENCE_EXPECTATION.REQUIRED
      : conditional.has(topic)
        ? EVIDENCE_EXPECTATION.CONDITIONAL
        : EVIDENCE_EXPECTATION.NOT_APPLICABLE;
  }
  return deepFreeze(result);
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    specializationId: context.specializationId || null,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    readyForProfessionalMethodWorkflow: false,
    automaticMethodSelection: false,
    automaticValuationInputAdoption: false,
    valuationArithmeticPerformed: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildCommercialSpecializationPacket({
  specializationId,
  caseId,
  propertyRef,
  commercialAssetClass,
  occupancyStructure,
  analysisContext,
  propertyEvidencePacket,
  evidenceItems,
  conditionalApplicability = {},
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['specializationId', specializationId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(commercialAssetClass, COMMERCIAL_ASSET_CLASS, 'commercialAssetClass');
  assertEnum(occupancyStructure, OCCUPANCY_STRUCTURE, 'occupancyStructure');
  assertEnum(analysisContext, COMMERCIAL_ANALYSIS_CONTEXT, 'analysisContext');
  if (!Array.isArray(evidenceItems)) throw new TypeError('evidenceItems must be an array');
  if (!conditionalApplicability || typeof conditionalApplicability !== 'object' || Array.isArray(conditionalApplicability)) throw new TypeError('conditionalApplicability must be an object');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('COMMERCIAL_SPECIALIZATION_REVIEW_BEFORE_PREPARATION');

  const context = { specializationId: specializationId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim() };
  if (!propertyEvidencePacket || propertyEvidencePacket.caseId !== caseId || propertyEvidencePacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:propertyEvidencePacket');
  }
  if (propertyEvidencePacket.status !== PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW
      || propertyEvidencePacket.professionalValuationWorkflowReady !== true
      || !verifyPropertyEvidencePacketIntegrity(propertyEvidencePacket)) {
    return hold(COMMERCIAL_SPECIALIZATION_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }

  const matrix = expectationMatrix(commercialAssetClass, occupancyStructure);
  const blockers = [];
  const integrityBlockers = [];
  const itemIds = new Set();
  const topicMap = new Map();
  const normalizedItems = [];

  for (const item of evidenceItems) {
    if (!item || item.caseId !== caseId || item.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:commercialEvidenceItem');
    if (!verifyCommercialEvidenceItemIntegrity(item)) {
      integrityBlockers.push(`COMMERCIAL_EVIDENCE_ITEM_INTEGRITY_FAILED:${item?.evidenceItemId || 'UNKNOWN'}`);
      continue;
    }
    if (itemIds.has(item.evidenceItemId)) blockers.push(`DUPLICATE_COMMERCIAL_EVIDENCE_ITEM_ID:${item.evidenceItemId}`);
    itemIds.add(item.evidenceItemId);
    if (topicMap.has(item.topic)) blockers.push(`DUPLICATE_COMMERCIAL_EVIDENCE_TOPIC:${item.topic}`);
    topicMap.set(item.topic, item);
    if (Date.parse(item.reviewedAt) > Date.parse(reviewed)) blockers.push(`COMMERCIAL_EVIDENCE_REVIEW_AFTER_SPECIALIZATION_REVIEW:${item.evidenceItemId}`);
    normalizedItems.push(item);
  }
  if (integrityBlockers.length) return hold(COMMERCIAL_SPECIALIZATION_STATUS.HOLD_INTEGRITY, integrityBlockers, context);

  for (const topic of Object.values(COMMERCIAL_EVIDENCE_TOPIC)) {
    const expectation = matrix[topic];
    const item = topicMap.get(topic);
    if (expectation === EVIDENCE_EXPECTATION.REQUIRED) {
      if (!item) blockers.push(`REQUIRED_COMMERCIAL_EVIDENCE_MISSING:${topic}`);
      else if (![EVIDENCE_ITEM_STATUS.VERIFIED, EVIDENCE_ITEM_STATUS.PROFESSIONAL_REVIEWED].includes(item.status)) {
        blockers.push(`REQUIRED_COMMERCIAL_EVIDENCE_NOT_VERIFIED:${topic}:${item.status}`);
      }
    } else if (expectation === EVIDENCE_EXPECTATION.CONDITIONAL) {
      const applicability = conditionalApplicability[topic];
      if (typeof applicability !== 'boolean') blockers.push(`CONDITIONAL_APPLICABILITY_DECISION_REQUIRED:${topic}`);
      else if (applicability === true) {
        if (!item) blockers.push(`CONDITIONAL_COMMERCIAL_EVIDENCE_REQUIRED_BUT_MISSING:${topic}`);
        else if (![EVIDENCE_ITEM_STATUS.VERIFIED, EVIDENCE_ITEM_STATUS.PROFESSIONAL_REVIEWED].includes(item.status)) {
          blockers.push(`CONDITIONAL_COMMERCIAL_EVIDENCE_NOT_VERIFIED:${topic}:${item.status}`);
        }
      } else if (item && item.status !== EVIDENCE_ITEM_STATUS.NOT_APPLICABLE) {
        blockers.push(`CONDITIONAL_TOPIC_MARKED_NOT_APPLICABLE_BUT_ITEM_STATUS_CONFLICTS:${topic}:${item.status}`);
      }
    } else if (item && item.status !== EVIDENCE_ITEM_STATUS.NOT_APPLICABLE) {
      blockers.push(`NON_APPLICABLE_COMMERCIAL_TOPIC_HAS_ACTIVE_EVIDENCE_ITEM:${topic}:${item.status}`);
    }
  }

  if (blockers.length) return hold(COMMERCIAL_SPECIALIZATION_STATUS.HOLD_COMMERCIAL_EVIDENCE, blockers, context);

  const core = {
    schemaVersion: 1,
    specializationId: specializationId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: propertyEvidencePacket.valuationDate,
    jurisdiction: propertyEvidencePacket.jurisdiction,
    commercialAssetClass,
    occupancyStructure,
    analysisContext,
    propertyEvidencePacketHashSha256: propertyEvidencePacket.packetHashSha256,
    expectationMatrix: matrix,
    conditionalApplicability: Object.freeze({ ...conditionalApplicability }),
    evidenceItems: normalizedItems,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
  return deepFreeze({
    ...core,
    commercialSpecializationHashSha256: sha256(core),
    status: COMMERCIAL_SPECIALIZATION_STATUS.READY_FOR_PROFESSIONAL_METHOD_WORKFLOW,
    blockers: [],
    readyForProfessionalMethodWorkflow: true,
    internalQualityControlOnly: true,
    standardsApplicabilityConclusionEstablished: false,
    automaticMethodSelection: false,
    automaticValuationInputAdoption: false,
    valuationArithmeticPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This commercial specialization packet applies an internal evidence-completeness taxonomy after qualified property evidence. It does not select a valuation method, adopt valuation inputs automatically, change valuation arithmetic, establish standards/legal applicability, certify a valuation or authorize a transaction.',
  });
}

function verifyCommercialSpecializationPacketIntegrity(packet) {
  if (!packet || !validSha(packet.commercialSpecializationHashSha256)) return false;
  const core = { ...packet };
  [
    'commercialSpecializationHashSha256', 'status', 'blockers', 'readyForProfessionalMethodWorkflow',
    'internalQualityControlOnly', 'standardsApplicabilityConclusionEstablished', 'automaticMethodSelection',
    'automaticValuationInputAdoption', 'valuationArithmeticPerformed', 'finalValuationConclusionEstablished',
    'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.commercialSpecializationHashSha256.toLowerCase();
}

module.exports = {
  COMMERCIAL_ASSET_CLASS,
  OCCUPANCY_STRUCTURE,
  COMMERCIAL_ANALYSIS_CONTEXT,
  COMMERCIAL_EVIDENCE_TOPIC,
  EVIDENCE_EXPECTATION,
  EVIDENCE_ITEM_STATUS,
  COMMERCIAL_SPECIALIZATION_STATUS,
  expectationMatrix,
  verifyPropertyEvidencePacketIntegrity,
  createCommercialEvidenceItem,
  verifyCommercialEvidenceItemIntegrity,
  buildCommercialSpecializationPacket,
  verifyCommercialSpecializationPacketIntegrity,
};
