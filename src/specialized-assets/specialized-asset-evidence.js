'use strict';

const crypto = require('crypto');
const { PROPERTY_EVIDENCE_PACKET_STATUS } = require('../property/property-evidence-bridge');

const SPECIALIZED_ASSET_CLASS = Object.freeze({
  HOTEL_FULL_SERVICE: 'HOTEL_FULL_SERVICE',
  HOTEL_LIMITED_SERVICE: 'HOTEL_LIMITED_SERVICE',
  SERVICED_APARTMENTS: 'SERVICED_APARTMENTS',
  RESORT: 'RESORT',
  LEISURE_ATTRACTION: 'LEISURE_ATTRACTION',
  HERITAGE_ASSET: 'HERITAGE_ASSET',
});

const SPECIALIZED_OPERATING_STATE = Object.freeze({
  OPERATING: 'OPERATING',
  RAMP_UP: 'RAMP_UP',
  CLOSED_TEMPORARILY: 'CLOSED_TEMPORARILY',
  VACANT: 'VACANT',
  DEVELOPMENT: 'DEVELOPMENT',
});

const SPECIALIZED_OPERATING_MODEL = Object.freeze({
  OWNER_OPERATED: 'OWNER_OPERATED',
  MANAGEMENT_AGREEMENT: 'MANAGEMENT_AGREEMENT',
  FRANCHISE: 'FRANCHISE',
  LEASED_OPERATOR: 'LEASED_OPERATOR',
  INDEPENDENT_OPERATOR: 'INDEPENDENT_OPERATOR',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const SPECIALIZED_ANALYSIS_CONTEXT = Object.freeze({
  PROFESSIONAL_VALUATION: 'PROFESSIONAL_VALUATION',
  INVESTMENT_ANALYSIS: 'INVESTMENT_ANALYSIS',
  FINANCIAL_REPORTING: 'FINANCIAL_REPORTING',
  FINANCING_REVIEW: 'FINANCING_REVIEW',
});

const SPECIALIZED_EVIDENCE_TOPIC = Object.freeze({
  PROPERTY_RIGHTS_AND_PHYSICAL_FACTS: 'PROPERTY_RIGHTS_AND_PHYSICAL_FACTS',
  MEASUREMENTS_AND_AREA_SCHEDULE: 'MEASUREMENTS_AND_AREA_SCHEDULE',
  ROOM_KEY_OR_UNIT_INVENTORY: 'ROOM_KEY_OR_UNIT_INVENTORY',
  OPERATING_STATEMENTS: 'OPERATING_STATEMENTS',
  OCCUPANCY_ADR_REVPAR: 'OCCUPANCY_ADR_REVPAR',
  MARKET_DEMAND_AND_COMPETITIVE_SET: 'MARKET_DEMAND_AND_COMPETITIVE_SET',
  DEPARTMENTAL_REVENUES: 'DEPARTMENTAL_REVENUES',
  DEPARTMENTAL_AND_UNDISTRIBUTED_EXPENSES: 'DEPARTMENTAL_AND_UNDISTRIBUTED_EXPENSES',
  MANAGEMENT_FRANCHISE_AND_OPERATOR_AGREEMENTS: 'MANAGEMENT_FRANCHISE_AND_OPERATOR_AGREEMENTS',
  FF_AND_E_RESERVE_AND_CAPEX: 'FF_AND_E_RESERVE_AND_CAPEX',
  LICENSES_CLASSIFICATION_AND_PERMITS: 'LICENSES_CLASSIFICATION_AND_PERMITS',
  SEASONALITY_AND_EVENT_CALENDAR: 'SEASONALITY_AND_EVENT_CALENDAR',
  FOOD_BEVERAGE_AND_OTHER_REVENUE: 'FOOD_BEVERAGE_AND_OTHER_REVENUE',
  LEISURE_ATTENDANCE_AND_SPEND: 'LEISURE_ATTENDANCE_AND_SPEND',
  AMENITIES_AND_RECREATION: 'AMENITIES_AND_RECREATION',
  HERITAGE_DESIGNATION_AND_RESTRICTIONS: 'HERITAGE_DESIGNATION_AND_RESTRICTIONS',
  CONSERVATION_AND_ADAPTIVE_REUSE_REQUIREMENTS: 'CONSERVATION_AND_ADAPTIVE_REUSE_REQUIREMENTS',
  BRAND_STANDARD_AND_PIP: 'BRAND_STANDARD_AND_PIP',
  SUPPLY_PIPELINE: 'SUPPLY_PIPELINE',
});

const SPECIALIZED_EVIDENCE_EXPECTATION = Object.freeze({
  REQUIRED: 'REQUIRED',
  CONDITIONAL: 'CONDITIONAL',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const SPECIALIZED_EVIDENCE_ITEM_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROFESSIONAL_REVIEWED: 'PROFESSIONAL_REVIEWED',
  CLIENT_PROVIDED_UNVERIFIED: 'CLIENT_PROVIDED_UNVERIFIED',
  ASSUMED: 'ASSUMED',
  MISSING: 'MISSING',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const SPECIALIZED_ASSET_PACKET_STATUS = Object.freeze({
  READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW: 'READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW',
  HOLD_PROPERTY_EVIDENCE: 'HOLD_PROPERTY_EVIDENCE',
  HOLD_SPECIALIZED_EVIDENCE: 'HOLD_SPECIALIZED_EVIDENCE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const BASE_REQUIRED = Object.freeze([
  SPECIALIZED_EVIDENCE_TOPIC.PROPERTY_RIGHTS_AND_PHYSICAL_FACTS,
  SPECIALIZED_EVIDENCE_TOPIC.MEASUREMENTS_AND_AREA_SCHEDULE,
  SPECIALIZED_EVIDENCE_TOPIC.MARKET_DEMAND_AND_COMPETITIVE_SET,
  SPECIALIZED_EVIDENCE_TOPIC.FF_AND_E_RESERVE_AND_CAPEX,
  SPECIALIZED_EVIDENCE_TOPIC.LICENSES_CLASSIFICATION_AND_PERMITS,
  SPECIALIZED_EVIDENCE_TOPIC.SUPPLY_PIPELINE,
]);

const ASSET_REQUIREMENTS = Object.freeze({
  [SPECIALIZED_ASSET_CLASS.HOTEL_FULL_SERVICE]: Object.freeze({
    required: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.ROOM_KEY_OR_UNIT_INVENTORY,
      SPECIALIZED_EVIDENCE_TOPIC.SEASONALITY_AND_EVENT_CALENDAR,
    ]),
    operatingRequired: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS,
      SPECIALIZED_EVIDENCE_TOPIC.OCCUPANCY_ADR_REVPAR,
      SPECIALIZED_EVIDENCE_TOPIC.DEPARTMENTAL_REVENUES,
      SPECIALIZED_EVIDENCE_TOPIC.DEPARTMENTAL_AND_UNDISTRIBUTED_EXPENSES,
      SPECIALIZED_EVIDENCE_TOPIC.FOOD_BEVERAGE_AND_OTHER_REVENUE,
    ]),
    conditional: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.AMENITIES_AND_RECREATION,
      SPECIALIZED_EVIDENCE_TOPIC.BRAND_STANDARD_AND_PIP,
    ]),
  }),
  [SPECIALIZED_ASSET_CLASS.HOTEL_LIMITED_SERVICE]: Object.freeze({
    required: Object.freeze([SPECIALIZED_EVIDENCE_TOPIC.ROOM_KEY_OR_UNIT_INVENTORY]),
    operatingRequired: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS,
      SPECIALIZED_EVIDENCE_TOPIC.OCCUPANCY_ADR_REVPAR,
      SPECIALIZED_EVIDENCE_TOPIC.DEPARTMENTAL_AND_UNDISTRIBUTED_EXPENSES,
    ]),
    conditional: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.FOOD_BEVERAGE_AND_OTHER_REVENUE,
      SPECIALIZED_EVIDENCE_TOPIC.SEASONALITY_AND_EVENT_CALENDAR,
      SPECIALIZED_EVIDENCE_TOPIC.BRAND_STANDARD_AND_PIP,
    ]),
  }),
  [SPECIALIZED_ASSET_CLASS.SERVICED_APARTMENTS]: Object.freeze({
    required: Object.freeze([SPECIALIZED_EVIDENCE_TOPIC.ROOM_KEY_OR_UNIT_INVENTORY]),
    operatingRequired: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS,
      SPECIALIZED_EVIDENCE_TOPIC.OCCUPANCY_ADR_REVPAR,
      SPECIALIZED_EVIDENCE_TOPIC.DEPARTMENTAL_AND_UNDISTRIBUTED_EXPENSES,
    ]),
    conditional: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.SEASONALITY_AND_EVENT_CALENDAR,
      SPECIALIZED_EVIDENCE_TOPIC.BRAND_STANDARD_AND_PIP,
    ]),
  }),
  [SPECIALIZED_ASSET_CLASS.RESORT]: Object.freeze({
    required: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.ROOM_KEY_OR_UNIT_INVENTORY,
      SPECIALIZED_EVIDENCE_TOPIC.SEASONALITY_AND_EVENT_CALENDAR,
      SPECIALIZED_EVIDENCE_TOPIC.AMENITIES_AND_RECREATION,
    ]),
    operatingRequired: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS,
      SPECIALIZED_EVIDENCE_TOPIC.OCCUPANCY_ADR_REVPAR,
      SPECIALIZED_EVIDENCE_TOPIC.DEPARTMENTAL_REVENUES,
      SPECIALIZED_EVIDENCE_TOPIC.DEPARTMENTAL_AND_UNDISTRIBUTED_EXPENSES,
      SPECIALIZED_EVIDENCE_TOPIC.FOOD_BEVERAGE_AND_OTHER_REVENUE,
    ]),
    conditional: Object.freeze([SPECIALIZED_EVIDENCE_TOPIC.BRAND_STANDARD_AND_PIP]),
  }),
  [SPECIALIZED_ASSET_CLASS.LEISURE_ATTRACTION]: Object.freeze({
    required: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.SEASONALITY_AND_EVENT_CALENDAR,
      SPECIALIZED_EVIDENCE_TOPIC.AMENITIES_AND_RECREATION,
    ]),
    operatingRequired: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS,
      SPECIALIZED_EVIDENCE_TOPIC.DEPARTMENTAL_AND_UNDISTRIBUTED_EXPENSES,
      SPECIALIZED_EVIDENCE_TOPIC.LEISURE_ATTENDANCE_AND_SPEND,
    ]),
    conditional: Object.freeze([SPECIALIZED_EVIDENCE_TOPIC.FOOD_BEVERAGE_AND_OTHER_REVENUE]),
  }),
  [SPECIALIZED_ASSET_CLASS.HERITAGE_ASSET]: Object.freeze({
    required: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.HERITAGE_DESIGNATION_AND_RESTRICTIONS,
      SPECIALIZED_EVIDENCE_TOPIC.CONSERVATION_AND_ADAPTIVE_REUSE_REQUIREMENTS,
    ]),
    operatingRequired: Object.freeze([SPECIALIZED_EVIDENCE_TOPIC.OPERATING_STATEMENTS]),
    conditional: Object.freeze([
      SPECIALIZED_EVIDENCE_TOPIC.SEASONALITY_AND_EVENT_CALENDAR,
      SPECIALIZED_EVIDENCE_TOPIC.AMENITIES_AND_RECREATION,
      SPECIALIZED_EVIDENCE_TOPIC.LEISURE_ATTENDANCE_AND_SPEND,
      SPECIALIZED_EVIDENCE_TOPIC.FOOD_BEVERAGE_AND_OTHER_REVENUE,
    ]),
  }),
});

const ACTIVE_OPERATING_STATES = Object.freeze([
  SPECIALIZED_OPERATING_STATE.OPERATING,
  SPECIALIZED_OPERATING_STATE.RAMP_UP,
  SPECIALIZED_OPERATING_STATE.CLOSED_TEMPORARILY,
]);

const QUALIFIED_STATUSES = Object.freeze([
  SPECIALIZED_EVIDENCE_ITEM_STATUS.VERIFIED,
  SPECIALIZED_EVIDENCE_ITEM_STATUS.PROFESSIONAL_REVIEWED,
]);

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
function validSha(value) { return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function normalizeRefs(values, field) {
  if (!Array.isArray(values) || values.length === 0 || values.some((item) => !nonEmpty(item))) {
    throw new TypeError(`${field} must contain at least one non-empty reference`);
  }
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

function expectationMatrix(assetClass, operatingState, operatingModel) {
  assertEnum(assetClass, SPECIALIZED_ASSET_CLASS, 'assetClass');
  assertEnum(operatingState, SPECIALIZED_OPERATING_STATE, 'operatingState');
  assertEnum(operatingModel, SPECIALIZED_OPERATING_MODEL, 'operatingModel');
  const config = ASSET_REQUIREMENTS[assetClass];
  const required = new Set(BASE_REQUIRED);
  const conditional = new Set(config.conditional);
  config.required.forEach((topic) => required.add(topic));
  if (ACTIVE_OPERATING_STATES.includes(operatingState)) config.operatingRequired.forEach((topic) => required.add(topic));

  if ([SPECIALIZED_OPERATING_MODEL.MANAGEMENT_AGREEMENT, SPECIALIZED_OPERATING_MODEL.FRANCHISE, SPECIALIZED_OPERATING_MODEL.LEASED_OPERATOR].includes(operatingModel)) {
    required.add(SPECIALIZED_EVIDENCE_TOPIC.MANAGEMENT_FRANCHISE_AND_OPERATOR_AGREEMENTS);
  }
  if (operatingModel === SPECIALIZED_OPERATING_MODEL.FRANCHISE) required.add(SPECIALIZED_EVIDENCE_TOPIC.BRAND_STANDARD_AND_PIP);

  required.forEach((topic) => conditional.delete(topic));
  const matrix = {};
  for (const topic of Object.values(SPECIALIZED_EVIDENCE_TOPIC)) {
    matrix[topic] = required.has(topic)
      ? SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED
      : conditional.has(topic)
        ? SPECIALIZED_EVIDENCE_EXPECTATION.CONDITIONAL
        : SPECIALIZED_EVIDENCE_EXPECTATION.NOT_APPLICABLE;
  }
  return deepFreeze(matrix);
}

function createSpecializedEvidenceItem({
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
  assertEnum(topic, SPECIALIZED_EVIDENCE_TOPIC, 'topic');
  assertEnum(status, SPECIALIZED_EVIDENCE_ITEM_STATUS, 'status');
  const asOf = iso(asOfDate, 'asOfDate');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(prepared) < Date.parse(asOf)) throw new TypeError('SPECIALIZED_EVIDENCE_PREPARED_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('SPECIALIZED_EVIDENCE_REVIEW_BEFORE_PREPARATION');
  const refs = [SPECIALIZED_EVIDENCE_ITEM_STATUS.MISSING, SPECIALIZED_EVIDENCE_ITEM_STATUS.NOT_APPLICABLE].includes(status)
    ? []
    : normalizeRefs(evidenceRefs, 'evidenceRefs');
  if ([SPECIALIZED_EVIDENCE_ITEM_STATUS.MISSING, SPECIALIZED_EVIDENCE_ITEM_STATUS.NOT_APPLICABLE].includes(status)
      && Array.isArray(evidenceRefs) && evidenceRefs.length > 0) {
    throw new TypeError('MISSING_OR_NOT_APPLICABLE_EVIDENCE_CANNOT_CARRY_REFS');
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
  return deepFreeze({ ...core, specializedEvidenceItemHashSha256: sha256(core) });
}

function verifySpecializedEvidenceItemIntegrity(item) {
  if (!item || !validSha(item.specializedEvidenceItemHashSha256)) return false;
  const { specializedEvidenceItemHashSha256, ...core } = item;
  return sha256(core) === item.specializedEvidenceItemHashSha256.toLowerCase();
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    specializationId: context.specializationId || null,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    readyForSpecializedAssetProfessionalWorkflow: false,
    automaticMethodSelection: false,
    automaticValuationInputAdoption: false,
    valuationArithmeticPerformed: false,
    legalOrLicensingConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function buildSpecializedAssetEvidencePacket({
  specializationId,
  caseId,
  propertyRef,
  assetClass,
  operatingState,
  operatingModel,
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
  assertEnum(assetClass, SPECIALIZED_ASSET_CLASS, 'assetClass');
  assertEnum(operatingState, SPECIALIZED_OPERATING_STATE, 'operatingState');
  assertEnum(operatingModel, SPECIALIZED_OPERATING_MODEL, 'operatingModel');
  assertEnum(analysisContext, SPECIALIZED_ANALYSIS_CONTEXT, 'analysisContext');
  if (!Array.isArray(evidenceItems)) throw new TypeError('evidenceItems must be an array');
  if (!conditionalApplicability || typeof conditionalApplicability !== 'object' || Array.isArray(conditionalApplicability)) throw new TypeError('conditionalApplicability must be an object');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('SPECIALIZED_PACKET_REVIEW_BEFORE_PREPARATION');

  const context = { specializationId: specializationId.trim(), caseId: caseId.trim(), propertyRef: propertyRef.trim() };
  if (!propertyEvidencePacket || propertyEvidencePacket.caseId !== caseId || propertyEvidencePacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:propertyEvidencePacket');
  }
  if (propertyEvidencePacket.status !== PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW
      || propertyEvidencePacket.professionalValuationWorkflowReady !== true
      || !verifyPropertyEvidencePacketIntegrity(propertyEvidencePacket)) {
    return hold(SPECIALIZED_ASSET_PACKET_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_PACKET_NOT_READY_OR_INTEGRITY_FAILED'], context);
  }

  const blockers = [];
  if (ACTIVE_OPERATING_STATES.includes(operatingState) && operatingModel === SPECIALIZED_OPERATING_MODEL.NOT_APPLICABLE) {
    blockers.push('OPERATING_MODEL_REQUIRED_FOR_ACTIVE_SPECIALIZED_ASSET');
  }

  const matrix = expectationMatrix(assetClass, operatingState, operatingModel);
  const integrityBlockers = [];
  const ids = new Set();
  const topicMap = new Map();
  const normalizedItems = [];
  for (const item of evidenceItems) {
    if (!item || item.caseId !== caseId || item.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:specializedEvidenceItem');
    if (!verifySpecializedEvidenceItemIntegrity(item)) {
      integrityBlockers.push(`SPECIALIZED_EVIDENCE_ITEM_INTEGRITY_FAILED:${item?.evidenceItemId || 'UNKNOWN'}`);
      continue;
    }
    if (ids.has(item.evidenceItemId)) blockers.push(`DUPLICATE_SPECIALIZED_EVIDENCE_ITEM_ID:${item.evidenceItemId}`);
    ids.add(item.evidenceItemId);
    if (topicMap.has(item.topic)) blockers.push(`DUPLICATE_SPECIALIZED_EVIDENCE_TOPIC:${item.topic}`);
    topicMap.set(item.topic, item);
    if (Date.parse(item.reviewedAt) > Date.parse(reviewed)) blockers.push(`SPECIALIZED_EVIDENCE_REVIEW_AFTER_PACKET_REVIEW:${item.evidenceItemId}`);
    normalizedItems.push(item);
  }
  if (integrityBlockers.length) return hold(SPECIALIZED_ASSET_PACKET_STATUS.HOLD_INTEGRITY, integrityBlockers, context);

  for (const topic of Object.values(SPECIALIZED_EVIDENCE_TOPIC)) {
    const expectation = matrix[topic];
    const item = topicMap.get(topic);
    if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.REQUIRED) {
      if (!item) blockers.push(`REQUIRED_SPECIALIZED_EVIDENCE_MISSING:${topic}`);
      else if (!QUALIFIED_STATUSES.includes(item.status)) blockers.push(`REQUIRED_SPECIALIZED_EVIDENCE_NOT_VERIFIED:${topic}:${item.status}`);
    } else if (expectation === SPECIALIZED_EVIDENCE_EXPECTATION.CONDITIONAL) {
      const applicable = conditionalApplicability[topic];
      if (typeof applicable !== 'boolean') blockers.push(`CONDITIONAL_SPECIALIZED_APPLICABILITY_DECISION_REQUIRED:${topic}`);
      else if (applicable === true) {
        if (!item) blockers.push(`CONDITIONAL_SPECIALIZED_EVIDENCE_REQUIRED_BUT_MISSING:${topic}`);
        else if (!QUALIFIED_STATUSES.includes(item.status)) blockers.push(`CONDITIONAL_SPECIALIZED_EVIDENCE_NOT_VERIFIED:${topic}:${item.status}`);
      } else if (item && item.status !== SPECIALIZED_EVIDENCE_ITEM_STATUS.NOT_APPLICABLE) {
        blockers.push(`CONDITIONAL_SPECIALIZED_TOPIC_MARKED_NOT_APPLICABLE_BUT_ITEM_CONFLICTS:${topic}:${item.status}`);
      }
    } else if (item && item.status !== SPECIALIZED_EVIDENCE_ITEM_STATUS.NOT_APPLICABLE) {
      blockers.push(`NON_APPLICABLE_SPECIALIZED_TOPIC_HAS_ACTIVE_EVIDENCE:${topic}:${item.status}`);
    }
  }

  if (blockers.length) return hold(SPECIALIZED_ASSET_PACKET_STATUS.HOLD_SPECIALIZED_EVIDENCE, blockers, context);

  const core = {
    schemaVersion: 1,
    specializationId: specializationId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: propertyEvidencePacket.valuationDate,
    jurisdiction: propertyEvidencePacket.jurisdiction,
    assetClass,
    operatingState,
    operatingModel,
    analysisContext,
    propertyEvidencePacketHashSha256: propertyEvidencePacket.packetHashSha256,
    expectationMatrix: matrix,
    conditionalApplicability: { ...conditionalApplicability },
    evidenceItems: normalizedItems,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    specializedAssetEvidenceHashSha256: sha256(core),
    status: SPECIALIZED_ASSET_PACKET_STATUS.READY_FOR_SPECIALIZED_ASSET_PROFESSIONAL_WORKFLOW,
    blockers: [],
    readyForSpecializedAssetProfessionalWorkflow: true,
    internalEvidenceCompletenessControlOnly: true,
    automaticMethodSelection: false,
    automaticValuationInputAdoption: false,
    valuationArithmeticPerformed: false,
    forecastOrGopCalculationPerformed: false,
    legalOrLicensingConclusionEstablished: false,
    brandOrOperatorAgreementInterpretationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This specialized-asset packet is an internal evidence-completeness and provenance control for hotels, serviced apartments, resorts, leisure attractions and heritage assets. It does not select a valuation method, calculate ADR/RevPAR/GOP/NOI, interpret operating or franchise agreements, establish licensing/legal compliance, adopt valuation inputs automatically, certify a valuation or authorize a transaction.',
  });
}

function verifySpecializedAssetEvidencePacketIntegrity(packet) {
  if (!packet || !validSha(packet.specializedAssetEvidenceHashSha256)) return false;
  const core = { ...packet };
  [
    'specializedAssetEvidenceHashSha256', 'status', 'blockers', 'readyForSpecializedAssetProfessionalWorkflow',
    'internalEvidenceCompletenessControlOnly', 'automaticMethodSelection', 'automaticValuationInputAdoption',
    'valuationArithmeticPerformed', 'forecastOrGopCalculationPerformed', 'legalOrLicensingConclusionEstablished',
    'brandOrOperatorAgreementInterpretationPerformed', 'finalValuationConclusionEstablished',
    'certifiedValuationEstablished', 'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.specializedAssetEvidenceHashSha256.toLowerCase();
}

module.exports = {
  SPECIALIZED_ASSET_CLASS,
  SPECIALIZED_OPERATING_STATE,
  SPECIALIZED_OPERATING_MODEL,
  SPECIALIZED_ANALYSIS_CONTEXT,
  SPECIALIZED_EVIDENCE_TOPIC,
  SPECIALIZED_EVIDENCE_EXPECTATION,
  SPECIALIZED_EVIDENCE_ITEM_STATUS,
  SPECIALIZED_ASSET_PACKET_STATUS,
  expectationMatrix,
  verifyPropertyEvidencePacketIntegrity,
  createSpecializedEvidenceItem,
  verifySpecializedEvidenceItemIntegrity,
  buildSpecializedAssetEvidencePacket,
  verifySpecializedAssetEvidencePacketIntegrity,
};
