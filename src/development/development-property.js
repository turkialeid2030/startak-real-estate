'use strict';

const crypto = require('crypto');
const { PROPERTY_EVIDENCE_PACKET_STATUS } = require('../property/property-evidence-bridge');
const { HBU_DECISION_STATUS } = require('../hbu/hbu-workflow');

const DEVELOPMENT_GDV_TYPE = Object.freeze({
  SALE_RECEIPT: 'SALE_RECEIPT',
  CAPITAL_VALUE: 'CAPITAL_VALUE',
  OTHER: 'OTHER',
});

const DEVELOPMENT_COST_TYPE = Object.freeze({
  HARD_COST: 'HARD_COST',
  SOFT_COST: 'SOFT_COST',
  PROFESSIONAL_FEES: 'PROFESSIONAL_FEES',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  SITE_WORKS: 'SITE_WORKS',
  MARKETING_SALES: 'MARKETING_SALES',
  LEASING: 'LEASING',
  CONTINGENCY: 'CONTINGENCY',
  OTHER: 'OTHER',
});

const FINANCE_COST_TYPE = Object.freeze({
  INTEREST: 'INTEREST',
  ARRANGEMENT_FEE: 'ARRANGEMENT_FEE',
  COMMITMENT_FEE: 'COMMITMENT_FEE',
  OTHER: 'OTHER',
});

const DEVELOPMENT_FEE_TYPE = Object.freeze({
  STATUTORY_FEE: 'STATUTORY_FEE',
  PERMIT_FEE: 'PERMIT_FEE',
  SALES_FEE: 'SALES_FEE',
  OTHER: 'OTHER',
});

const DEVELOPER_RETURN_METHOD = Object.freeze({
  AMOUNT_SAR: 'AMOUNT_SAR',
  PERCENT_OF_GDV: 'PERCENT_OF_GDV',
});

const DEVELOPMENT_RESIDUAL_INPUT_STATUS = Object.freeze({
  READY_FOR_CANONICAL_RESIDUAL_CALCULATION: 'READY_FOR_CANONICAL_RESIDUAL_CALCULATION',
  HOLD_PROPERTY_EVIDENCE: 'HOLD_PROPERTY_EVIDENCE',
  HOLD_HBU: 'HOLD_HBU',
  HOLD_SUBJECT_AREA: 'HOLD_SUBJECT_AREA',
  HOLD_ECONOMIC_INPUTS: 'HOLD_ECONOMIC_INPUTS',
  HOLD_TIMELINE: 'HOLD_TIMELINE',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const SQM_UNIT = 'sqm';
const LAND_AREA_MEASUREMENT_TYPE = 'LAND_AREA';

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
function assertNonEmpty(value, field) {
  if (!nonEmpty(value)) throw new TypeError(`${field} must be a non-empty string`);
}
function assertEnum(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid`);
}
function iso(value, field) {
  assertNonEmpty(value, field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be a valid date/time`);
  return d.toISOString();
}
function positiveFinite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be a finite positive number`);
}
function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative integer`);
}
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex');
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function validSha(value) {
  return nonEmpty(value) && /^[a-f0-9]{64}$/i.test(value);
}

function normalizeReviewedProvenance({ sourceRef, evidenceRefs, rationale, preparedByRef, preparedAt, reviewedByRef, reviewedAt, reviewEvidenceRef }, prefix) {
  for (const [field, value] of [
    ['sourceRef', sourceRef], ['rationale', rationale], ['preparedByRef', preparedByRef],
    ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, `${prefix}.${field}`);
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !nonEmpty(ref))) {
    throw new TypeError(`${prefix}.evidenceRefs must be a non-empty array`);
  }
  const preparedAtIso = iso(preparedAt, `${prefix}.preparedAt`);
  const reviewedAtIso = iso(reviewedAt, `${prefix}.reviewedAt`);
  if (Date.parse(reviewedAtIso) < Date.parse(preparedAtIso)) throw new TypeError(`${prefix.toUpperCase()}_REVIEW_BEFORE_PREPARATION`);
  return {
    sourceRef: sourceRef.trim(),
    evidenceRefs: [...new Set(evidenceRefs.map((ref) => ref.trim()))],
    rationale: rationale.trim(),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewedAtIso,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };
}

function createEconomicComponent(kind, enumeration, {
  componentId, caseId, propertyRef, componentType, label, amountSar, month,
  sourceRef, evidenceRefs, rationale, preparedByRef, preparedAt, reviewedByRef, reviewedAt, reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [['componentId', componentId], ['caseId', caseId], ['propertyRef', propertyRef], ['label', label]]) {
    assertNonEmpty(value, field);
  }
  assertEnum(componentType, enumeration, 'componentType');
  positiveFinite(amountSar, 'amountSar');
  nonNegativeInteger(month, 'month');
  const provenance = normalizeReviewedProvenance({ sourceRef, evidenceRefs, rationale, preparedByRef, preparedAt, reviewedByRef, reviewedAt, reviewEvidenceRef }, kind);
  const core = {
    schemaVersion: 1,
    kind,
    componentId: componentId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    componentType,
    label: label.trim(),
    amountSar,
    month,
    ...provenance,
  };
  return deepFreeze({ ...core, componentHashSha256: sha256(core) });
}

function createGdvComponent(input) {
  return createEconomicComponent('GDV', DEVELOPMENT_GDV_TYPE, input);
}
function createDevelopmentCostComponent(input) {
  return createEconomicComponent('DEVELOPMENT_COST', DEVELOPMENT_COST_TYPE, input);
}
function createFinanceCostComponent(input) {
  return createEconomicComponent('FINANCE_COST', FINANCE_COST_TYPE, input);
}
function createDevelopmentFeeComponent(input) {
  return createEconomicComponent('FEE', DEVELOPMENT_FEE_TYPE, input);
}

function verifyEconomicComponentIntegrity(component) {
  if (!component || !validSha(component.componentHashSha256)) return false;
  const { componentHashSha256, ...core } = component;
  return sha256(core) === componentHashSha256.toLowerCase();
}

function createRequiredDeveloperReturn({
  returnId, caseId, propertyRef, method, value, rationale, evidenceRefs,
  preparedByRef, preparedAt, reviewedByRef, reviewedAt, reviewEvidenceRef,
} = {}) {
  for (const [field, item] of [['returnId', returnId], ['caseId', caseId], ['propertyRef', propertyRef]]) assertNonEmpty(item, field);
  assertEnum(method, DEVELOPER_RETURN_METHOD, 'method');
  positiveFinite(value, 'value');
  if (method === DEVELOPER_RETURN_METHOD.PERCENT_OF_GDV && value > 1) throw new TypeError('PERCENT_OF_GDV_VALUE_MUST_BE_FRACTION_AT_OR_BELOW_1');
  const provenance = normalizeReviewedProvenance({ sourceRef: 'PROFESSIONAL_DEVELOPER_RETURN', evidenceRefs, rationale, preparedByRef, preparedAt, reviewedByRef, reviewedAt, reviewEvidenceRef }, 'developerReturn');
  const core = {
    schemaVersion: 1,
    returnId: returnId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    method,
    value,
    ...provenance,
    automaticDeveloperReturnEstimated: false,
  };
  return deepFreeze({ ...core, developerReturnHashSha256: sha256(core) });
}

function verifyRequiredDeveloperReturnIntegrity(record) {
  if (!record || !validSha(record.developerReturnHashSha256)) return false;
  const { developerReturnHashSha256, ...core } = record;
  return sha256(core) === record.developerReturnHashSha256.toLowerCase();
}

function hbuDecisionCore(decision) {
  return {
    schemaVersion: decision.schemaVersion,
    decisionId: decision.decisionId,
    caseId: decision.caseId,
    propertyRef: decision.propertyRef,
    selectedScenarioId: decision.selectedScenarioId,
    comparisonBasis: decision.comparisonBasis,
    rationale: decision.rationale,
    evidenceRefs: decision.evidenceRefs,
    scenarioOutcomes: decision.scenarioOutcomes,
    decidedByRef: decision.decidedByRef,
    decidedAt: decision.decidedAt,
    decisionEvidenceRef: decision.decisionEvidenceRef,
  };
}

function verifyHbuDecisionIntegrity(decision) {
  return Boolean(decision && validSha(decision.hbuDecisionHashSha256)
    && sha256(hbuDecisionCore(decision)) === decision.hbuDecisionHashSha256.toLowerCase());
}

function hold(status, blockers, context = {}) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: context.caseId || null,
    propertyRef: context.propertyRef || null,
    status,
    blockers,
    readyForCanonicalResidualCalculation: false,
    automaticGdvEstimated: false,
    automaticCostEstimated: false,
    automaticFinanceCostEstimated: false,
    automaticDeveloperReturnEstimated: false,
    automaticLandValueSelection: false,
    canonicalEngineInputsWritten: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  });
}

function verifyDevelopmentResidualInputIntegrity(packet) {
  if (!packet || !validSha(packet.developmentResidualInputHashSha256)) return false;
  const { developmentResidualInputHashSha256, ...payload } = packet;
  const core = { ...payload };
  delete core.status;
  delete core.blockers;
  delete core.readyForCanonicalResidualCalculation;
  delete core.automaticGdvEstimated;
  delete core.automaticCostEstimated;
  delete core.automaticFinanceCostEstimated;
  delete core.automaticDeveloperReturnEstimated;
  delete core.automaticLandValueSelection;
  delete core.canonicalEngineInputsWritten;
  delete core.finalValuationConclusionEstablished;
  delete core.certifiedValuationEstablished;
  delete core.transactionAuthorized;
  delete core.semantics;
  return sha256(core) === packet.developmentResidualInputHashSha256.toLowerCase();
}

function buildDevelopmentResidualInputPacket({
  packetId,
  caseId,
  propertyRef,
  valuationDate,
  propertyEvidencePacket,
  hbuDecision,
  developmentScenarioId,
  developmentUse,
  developmentStartDate,
  terminalMonth,
  subjectLandAreaMeasurementId,
  gdvComponents,
  developmentCostComponents,
  financeCostComponents = [],
  feeComponents = [],
  requiredDeveloperReturn,
  preparedByRef,
  preparedAt,
  packetEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['packetId', packetId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['developmentScenarioId', developmentScenarioId], ['developmentUse', developmentUse],
    ['subjectLandAreaMeasurementId', subjectLandAreaMeasurementId], ['preparedByRef', preparedByRef], ['packetEvidenceRef', packetEvidenceRef],
  ]) assertNonEmpty(value, field);
  const valuationDateIso = iso(valuationDate, 'valuationDate');
  const developmentStartDateIso = iso(developmentStartDate, 'developmentStartDate');
  const preparedAtIso = iso(preparedAt, 'preparedAt');
  nonNegativeInteger(terminalMonth, 'terminalMonth');
  if (terminalMonth < 1) throw new TypeError('terminalMonth must be at least 1');
  if (!Array.isArray(gdvComponents) || gdvComponents.length === 0) throw new TypeError('gdvComponents must be a non-empty array');
  if (!Array.isArray(developmentCostComponents) || developmentCostComponents.length === 0) throw new TypeError('developmentCostComponents must be a non-empty array');
  if (!Array.isArray(financeCostComponents) || !Array.isArray(feeComponents)) throw new TypeError('financeCostComponents and feeComponents must be arrays');

  if (!propertyEvidencePacket || propertyEvidencePacket.caseId !== caseId || propertyEvidencePacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:propertyEvidencePacket');
  }
  if (propertyEvidencePacket.status !== PROPERTY_EVIDENCE_PACKET_STATUS.READY_FOR_PROFESSIONAL_VALUATION_WORKFLOW
      || propertyEvidencePacket.professionalValuationWorkflowReady !== true || !validSha(propertyEvidencePacket.packetHashSha256)) {
    return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_PACKET_NOT_READY'], { caseId, propertyRef });
  }
  if (iso(propertyEvidencePacket.valuationDate, 'propertyEvidencePacket.valuationDate') !== valuationDateIso) {
    return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_PROPERTY_EVIDENCE, ['PROPERTY_EVIDENCE_VALUATION_DATE_MISMATCH'], { caseId, propertyRef });
  }

  if (!hbuDecision || hbuDecision.caseId !== caseId || hbuDecision.propertyRef !== propertyRef) {
    return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_HBU, ['HBU_DECISION_CASE_OR_PROPERTY_MISMATCH'], { caseId, propertyRef });
  }
  if (hbuDecision.status !== HBU_DECISION_STATUS.HBU_CONCLUSION_RECORDED
      || hbuDecision.highestAndBestUseConclusionEstablished !== true || !verifyHbuDecisionIntegrity(hbuDecision)) {
    return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_HBU, ['HBU_DECISION_NOT_CONCLUDED_OR_INTEGRITY_FAILED'], { caseId, propertyRef });
  }
  if (hbuDecision.selectedScenarioId !== developmentScenarioId) {
    return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_HBU, ['DEVELOPMENT_SCENARIO_MUST_MATCH_SELECTED_HBU_SCENARIO'], { caseId, propertyRef });
  }
  const selectedOutcome = (hbuDecision.scenarioOutcomes || []).find((item) => item.scenarioId === developmentScenarioId && item.selected === true);
  if (!selectedOutcome || selectedOutcome.proposedUse !== developmentUse) {
    return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_HBU, ['DEVELOPMENT_USE_MUST_MATCH_SELECTED_HBU_USE'], { caseId, propertyRef });
  }

  const measurements = Array.isArray(propertyEvidencePacket.measurements) ? propertyEvidencePacket.measurements : [];
  const landArea = measurements.find((item) => item.measurementId === subjectLandAreaMeasurementId);
  if (!landArea || landArea.type !== LAND_AREA_MEASUREMENT_TYPE || landArea.unit !== SQM_UNIT
      || typeof landArea.value !== 'number' || !Number.isFinite(landArea.value) || landArea.value <= 0 || !validSha(landArea.measurementHashSha256)) {
    return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_SUBJECT_AREA, ['VALID_LAND_AREA_SQM_MEASUREMENT_REQUIRED'], { caseId, propertyRef });
  }

  const allGroups = [gdvComponents, developmentCostComponents, financeCostComponents, feeComponents];
  const ids = new Set();
  const economicBlockers = [];
  const timelineBlockers = [];
  for (const group of allGroups) {
    for (const component of group) {
      if (!component || component.caseId !== caseId || component.propertyRef !== propertyRef) throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:developmentComponent');
      if (ids.has(component.componentId)) economicBlockers.push(`DUPLICATE_DEVELOPMENT_COMPONENT_ID:${component.componentId}`);
      ids.add(component.componentId);
      if (!verifyEconomicComponentIntegrity(component)) economicBlockers.push(`DEVELOPMENT_COMPONENT_INTEGRITY_FAILED:${component.componentId || 'UNKNOWN'}`);
      if (component.month > terminalMonth) timelineBlockers.push(`COMPONENT_AFTER_TERMINAL_MONTH:${component.componentId}:${component.month}/${terminalMonth}`);
    }
  }
  if (!requiredDeveloperReturn || requiredDeveloperReturn.caseId !== caseId || requiredDeveloperReturn.propertyRef !== propertyRef
      || !verifyRequiredDeveloperReturnIntegrity(requiredDeveloperReturn)) {
    economicBlockers.push('REQUIRED_DEVELOPER_RETURN_MISSING_OR_INTEGRITY_FAILED');
  }
  if (economicBlockers.length) return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_INTEGRITY, economicBlockers, { caseId, propertyRef });
  if (timelineBlockers.length) return hold(DEVELOPMENT_RESIDUAL_INPUT_STATUS.HOLD_TIMELINE, timelineBlockers, { caseId, propertyRef });

  const core = {
    schemaVersion: 1,
    packetId: packetId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: valuationDateIso,
    propertyEvidencePacketHashSha256: propertyEvidencePacket.packetHashSha256,
    hbuDecisionHashSha256: hbuDecision.hbuDecisionHashSha256,
    developmentScenarioId: developmentScenarioId.trim(),
    developmentUse: developmentUse.trim(),
    developmentStartDate: developmentStartDateIso,
    terminalMonth,
    subjectLandAreaMeasurement: {
      measurementId: landArea.measurementId,
      valueSqm: landArea.value,
      source: landArea.source,
      sourceEvidenceRef: landArea.sourceEvidenceRef,
      measurementStandardRef: landArea.measurementStandardRef,
      measurementMethod: landArea.measurementMethod,
      measurementHashSha256: landArea.measurementHashSha256,
    },
    gdvComponents: gdvComponents.map((item) => stableClone(item)),
    developmentCostComponents: developmentCostComponents.map((item) => stableClone(item)),
    financeCostComponents: financeCostComponents.map((item) => stableClone(item)),
    feeComponents: feeComponents.map((item) => stableClone(item)),
    requiredDeveloperReturn: stableClone(requiredDeveloperReturn),
    preparedByRef: preparedByRef.trim(),
    preparedAt: preparedAtIso,
    packetEvidenceRef: packetEvidenceRef.trim(),
    timingConvention: 'NOMINAL_MONTH_INDEX_NO_DISCOUNTING_IN_WAVE_11C',
  };
  const result = {
    ...core,
    developmentResidualInputHashSha256: sha256(core),
    status: DEVELOPMENT_RESIDUAL_INPUT_STATUS.READY_FOR_CANONICAL_RESIDUAL_CALCULATION,
    blockers: [],
    readyForCanonicalResidualCalculation: true,
    automaticGdvEstimated: false,
    automaticCostEstimated: false,
    automaticFinanceCostEstimated: false,
    automaticDeveloperReturnEstimated: false,
    automaticLandValueSelection: false,
    canonicalEngineInputsWritten: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet binds reviewed Development Property assumptions to a concluded HBU use and verified property evidence. It performs no residual arithmetic, estimates no GDV/cost/finance/fees/developer return, applies no discount rate, establishes no final valuation, and authorizes no transaction.',
  };
  return deepFreeze(result);
}

module.exports = {
  DEVELOPMENT_GDV_TYPE,
  DEVELOPMENT_COST_TYPE,
  FINANCE_COST_TYPE,
  DEVELOPMENT_FEE_TYPE,
  DEVELOPER_RETURN_METHOD,
  DEVELOPMENT_RESIDUAL_INPUT_STATUS,
  createGdvComponent,
  createDevelopmentCostComponent,
  createFinanceCostComponent,
  createDevelopmentFeeComponent,
  createRequiredDeveloperReturn,
  verifyEconomicComponentIntegrity,
  verifyRequiredDeveloperReturnIntegrity,
  verifyHbuDecisionIntegrity,
  buildDevelopmentResidualInputPacket,
  verifyDevelopmentResidualInputIntegrity,
};
