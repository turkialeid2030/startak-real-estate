'use strict';

const crypto = require('crypto');
const {
  COMMERCIAL_ASSET_CLASS,
  OCCUPANCY_STRUCTURE,
  COMMERCIAL_EVIDENCE_TOPIC,
  EVIDENCE_ITEM_STATUS,
  COMMERCIAL_SPECIALIZATION_STATUS,
  verifyCommercialSpecializationPacketIntegrity,
} = require('./commercial-specialization');

const COMMERCIAL_METHOD = Object.freeze({
  SALES_COMPARISON: 'SALES_COMPARISON',
  DIRECT_CAPITALIZATION: 'DIRECT_CAPITALIZATION',
  DISCOUNTED_CASH_FLOW: 'DISCOUNTED_CASH_FLOW',
  COST_APPROACH: 'COST_APPROACH',
});

const METHOD_READINESS_STATUS = Object.freeze({
  READY_FOR_EXISTING_METHOD_WORKFLOW: 'READY_FOR_EXISTING_METHOD_WORKFLOW',
  HOLD_EVIDENCE_GAPS: 'HOLD_EVIDENCE_GAPS',
  HOLD_SUPPLEMENTAL_EVIDENCE: 'HOLD_SUPPLEMENTAL_EVIDENCE',
  HOLD_SPECIALIZATION_PACKET: 'HOLD_SPECIALIZATION_PACKET',
  HOLD_INTEGRITY: 'HOLD_INTEGRITY',
});

const SUPPLEMENTAL_EVIDENCE_ROLE = Object.freeze({
  REPLACEMENT_OR_REPRODUCTION_COST_EVIDENCE: 'REPLACEMENT_OR_REPRODUCTION_COST_EVIDENCE',
  LAND_VALUE_EVIDENCE: 'LAND_VALUE_EVIDENCE',
  DEPRECIATION_EVIDENCE: 'DEPRECIATION_EVIDENCE',
});

const SUPPLEMENTAL_EVIDENCE_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROFESSIONAL_REVIEWED: 'PROFESSIONAL_REVIEWED',
  CLIENT_PROVIDED_UNVERIFIED: 'CLIENT_PROVIDED_UNVERIFIED',
  ASSUMED: 'ASSUMED',
});

const QUALIFIED_EVIDENCE_STATUSES = Object.freeze([
  EVIDENCE_ITEM_STATUS.VERIFIED,
  EVIDENCE_ITEM_STATUS.PROFESSIONAL_REVIEWED,
]);

const QUALIFIED_SUPPLEMENTAL_STATUSES = Object.freeze([
  SUPPLEMENTAL_EVIDENCE_STATUS.VERIFIED,
  SUPPLEMENTAL_EVIDENCE_STATUS.PROFESSIONAL_REVIEWED,
]);

const BASE_METHOD_TOPICS = Object.freeze({
  [COMMERCIAL_METHOD.SALES_COMPARISON]: Object.freeze([
    COMMERCIAL_EVIDENCE_TOPIC.PROPERTY_RIGHTS_AND_PHYSICAL_FACTS,
    COMMERCIAL_EVIDENCE_TOPIC.MEASUREMENTS,
    COMMERCIAL_EVIDENCE_TOPIC.SALE_COMPARABLES,
  ]),
  [COMMERCIAL_METHOD.DIRECT_CAPITALIZATION]: Object.freeze([
    COMMERCIAL_EVIDENCE_TOPIC.PROPERTY_RIGHTS_AND_PHYSICAL_FACTS,
    COMMERCIAL_EVIDENCE_TOPIC.MEASUREMENTS,
    COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
    COMMERCIAL_EVIDENCE_TOPIC.OCCUPANCY_AND_VACANCY,
    COMMERCIAL_EVIDENCE_TOPIC.OPERATING_EXPENSES,
  ]),
  [COMMERCIAL_METHOD.DISCOUNTED_CASH_FLOW]: Object.freeze([
    COMMERCIAL_EVIDENCE_TOPIC.PROPERTY_RIGHTS_AND_PHYSICAL_FACTS,
    COMMERCIAL_EVIDENCE_TOPIC.MEASUREMENTS,
    COMMERCIAL_EVIDENCE_TOPIC.MARKET_RENT,
    COMMERCIAL_EVIDENCE_TOPIC.OCCUPANCY_AND_VACANCY,
    COMMERCIAL_EVIDENCE_TOPIC.OPERATING_EXPENSES,
    COMMERCIAL_EVIDENCE_TOPIC.CAPITAL_EXPENDITURE,
  ]),
  [COMMERCIAL_METHOD.COST_APPROACH]: Object.freeze([
    COMMERCIAL_EVIDENCE_TOPIC.PROPERTY_RIGHTS_AND_PHYSICAL_FACTS,
    COMMERCIAL_EVIDENCE_TOPIC.MEASUREMENTS,
  ]),
});

const COST_SUPPLEMENTAL_ROLES = Object.freeze([
  SUPPLEMENTAL_EVIDENCE_ROLE.REPLACEMENT_OR_REPRODUCTION_COST_EVIDENCE,
  SUPPLEMENTAL_EVIDENCE_ROLE.LAND_VALUE_EVIDENCE,
  SUPPLEMENTAL_EVIDENCE_ROLE.DEPRECIATION_EVIDENCE,
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

function createSupplementalMethodEvidence({
  supplementalEvidenceId,
  caseId,
  propertyRef,
  role,
  status,
  sourceRef,
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
    ['supplementalEvidenceId', supplementalEvidenceId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['sourceRef', sourceRef], ['rationale', rationale], ['preparedByRef', preparedByRef],
    ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  assertEnum(role, SUPPLEMENTAL_EVIDENCE_ROLE, 'role');
  assertEnum(status, SUPPLEMENTAL_EVIDENCE_STATUS, 'status');
  const asOf = iso(asOfDate, 'asOfDate');
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(prepared) < Date.parse(asOf)) throw new TypeError('SUPPLEMENTAL_EVIDENCE_PREPARED_BEFORE_AS_OF_DATE');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('SUPPLEMENTAL_EVIDENCE_REVIEW_BEFORE_PREPARATION');
  const core = {
    schemaVersion: 1,
    supplementalEvidenceId: supplementalEvidenceId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    role,
    status,
    sourceRef: sourceRef.trim(),
    evidenceRefs: normalizeRefs(evidenceRefs, 'evidenceRefs'),
    asOfDate: asOf,
    rationale: rationale.trim(),
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
    automaticValuationInputAdoption: false,
  };
  return deepFreeze({ ...core, supplementalEvidenceHashSha256: sha256(core) });
}

function verifySupplementalMethodEvidenceIntegrity(record) {
  if (!record || !validSha(record.supplementalEvidenceHashSha256)) return false;
  const { supplementalEvidenceHashSha256, ...core } = record;
  return sha256(core) === record.supplementalEvidenceHashSha256.toLowerCase();
}

function evidenceTopicMap(specializationPacket) {
  return new Map((Array.isArray(specializationPacket?.evidenceItems) ? specializationPacket.evidenceItems : [])
    .map((item) => [item.topic, item]));
}

function occupiedStructure(occupancyStructure) {
  return [
    OCCUPANCY_STRUCTURE.SINGLE_TENANT,
    OCCUPANCY_STRUCTURE.MULTI_TENANT,
    OCCUPANCY_STRUCTURE.MIXED,
  ].includes(occupancyStructure);
}

function multiTenantStructure(occupancyStructure) {
  return [OCCUPANCY_STRUCTURE.MULTI_TENANT, OCCUPANCY_STRUCTURE.MIXED].includes(occupancyStructure);
}

function methodRequiredTopics(method, specializationPacket) {
  const required = new Set(BASE_METHOD_TOPICS[method] || []);
  const occupancy = specializationPacket.occupancyStructure;

  if ([COMMERCIAL_METHOD.DIRECT_CAPITALIZATION, COMMERCIAL_METHOD.DISCOUNTED_CASH_FLOW].includes(method)) {
    if (occupiedStructure(occupancy)) {
      required.add(COMMERCIAL_EVIDENCE_TOPIC.LEASE_AND_RENT_ROLL);
      required.add(COMMERCIAL_EVIDENCE_TOPIC.TENANT_COVENANT_AND_CONCENTRATION);
    }
    if (multiTenantStructure(occupancy)) required.add(COMMERCIAL_EVIDENCE_TOPIC.SERVICE_CHARGE_AND_RECOVERIES);
  }

  if (method === COMMERCIAL_METHOD.DISCOUNTED_CASH_FLOW
      && specializationPacket.commercialAssetClass === COMMERCIAL_ASSET_CLASS.COMMERCIAL_MIXED_USE) {
    required.add(COMMERCIAL_EVIDENCE_TOPIC.MIXED_USE_ALLOCATION);
  }

  return [...required].sort();
}

function methodSupplementalRoles(method) {
  return method === COMMERCIAL_METHOD.COST_APPROACH ? [...COST_SUPPLEMENTAL_ROLES] : [];
}

function assessOneMethod({ method, specializationPacket, supplementalEvidence }) {
  const topics = evidenceTopicMap(specializationPacket);
  const requiredTopics = methodRequiredTopics(method, specializationPacket);
  const missingTopics = [];
  const unqualifiedTopics = [];

  for (const topic of requiredTopics) {
    const item = topics.get(topic);
    if (!item) missingTopics.push(topic);
    else if (!QUALIFIED_EVIDENCE_STATUSES.includes(item.status)) unqualifiedTopics.push(`${topic}:${item.status}`);
  }

  const requiredSupplementalRoles = methodSupplementalRoles(method);
  const supplementalByRole = new Map();
  const supplementalIntegrityFailures = [];
  for (const record of supplementalEvidence) {
    if (!verifySupplementalMethodEvidenceIntegrity(record)) {
      supplementalIntegrityFailures.push(record?.supplementalEvidenceId || 'UNKNOWN');
      continue;
    }
    if (!supplementalByRole.has(record.role)) supplementalByRole.set(record.role, []);
    supplementalByRole.get(record.role).push(record);
  }

  if (supplementalIntegrityFailures.length) {
    return deepFreeze({
      method,
      status: METHOD_READINESS_STATUS.HOLD_INTEGRITY,
      requiredEvidenceTopics: requiredTopics,
      missingEvidenceTopics: missingTopics,
      unqualifiedEvidenceTopics: unqualifiedTopics,
      requiredSupplementalRoles,
      missingSupplementalRoles: [],
      unqualifiedSupplementalRoles: [],
      blockers: supplementalIntegrityFailures.map((id) => `SUPPLEMENTAL_EVIDENCE_INTEGRITY_FAILED:${id}`),
      readyForExistingMethodWorkflow: false,
      automaticMethodSelection: false,
      valuationArithmeticPerformed: false,
    });
  }

  const missingSupplementalRoles = [];
  const unqualifiedSupplementalRoles = [];
  for (const role of requiredSupplementalRoles) {
    const records = supplementalByRole.get(role) || [];
    if (records.length === 0) missingSupplementalRoles.push(role);
    else if (!records.some((record) => QUALIFIED_SUPPLEMENTAL_STATUSES.includes(record.status))) {
      unqualifiedSupplementalRoles.push(`${role}:${records.map((record) => record.status).join('|')}`);
    }
  }

  const blockers = [
    ...missingTopics.map((topic) => `METHOD_EVIDENCE_TOPIC_MISSING:${topic}`),
    ...unqualifiedTopics.map((topic) => `METHOD_EVIDENCE_TOPIC_NOT_QUALIFIED:${topic}`),
    ...missingSupplementalRoles.map((role) => `METHOD_SUPPLEMENTAL_EVIDENCE_MISSING:${role}`),
    ...unqualifiedSupplementalRoles.map((role) => `METHOD_SUPPLEMENTAL_EVIDENCE_NOT_QUALIFIED:${role}`),
  ];

  let status = METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW;
  if (missingTopics.length || unqualifiedTopics.length) status = METHOD_READINESS_STATUS.HOLD_EVIDENCE_GAPS;
  else if (missingSupplementalRoles.length || unqualifiedSupplementalRoles.length) status = METHOD_READINESS_STATUS.HOLD_SUPPLEMENTAL_EVIDENCE;

  return deepFreeze({
    method,
    status,
    requiredEvidenceTopics: requiredTopics,
    missingEvidenceTopics: missingTopics,
    unqualifiedEvidenceTopics: unqualifiedTopics,
    requiredSupplementalRoles,
    missingSupplementalRoles,
    unqualifiedSupplementalRoles,
    blockers,
    readyForExistingMethodWorkflow: status === METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW,
    automaticMethodSelection: false,
    valuationArithmeticPerformed: false,
  });
}

function buildCommercialMethodReadinessPacket({
  readinessPacketId,
  caseId,
  propertyRef,
  specializationPacket,
  methodsToAssess,
  supplementalEvidence = [],
  preparedByRef,
  preparedAt,
  reviewedByRef,
  reviewedAt,
  reviewEvidenceRef,
} = {}) {
  for (const [field, value] of [
    ['readinessPacketId', readinessPacketId], ['caseId', caseId], ['propertyRef', propertyRef],
    ['preparedByRef', preparedByRef], ['reviewedByRef', reviewedByRef], ['reviewEvidenceRef', reviewEvidenceRef],
  ]) assertNonEmpty(value, field);
  if (!Array.isArray(methodsToAssess) || methodsToAssess.length === 0) throw new TypeError('methodsToAssess must be a non-empty array');
  if (!Array.isArray(supplementalEvidence)) throw new TypeError('supplementalEvidence must be an array');
  const uniqueMethods = [...new Set(methodsToAssess)];
  uniqueMethods.forEach((method) => assertEnum(method, COMMERCIAL_METHOD, 'method'));
  const prepared = iso(preparedAt, 'preparedAt');
  const reviewed = iso(reviewedAt, 'reviewedAt');
  if (Date.parse(reviewed) < Date.parse(prepared)) throw new TypeError('METHOD_READINESS_REVIEW_BEFORE_PREPARATION');

  if (!specializationPacket || specializationPacket.caseId !== caseId || specializationPacket.propertyRef !== propertyRef) {
    throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:specializationPacket');
  }
  for (const record of supplementalEvidence) {
    if (!record || record.caseId !== caseId || record.propertyRef !== propertyRef) {
      throw new TypeError('CASE_OR_PROPERTY_ISOLATION_VIOLATION:supplementalEvidence');
    }
  }

  if (specializationPacket.status !== COMMERCIAL_SPECIALIZATION_STATUS.READY_FOR_PROFESSIONAL_METHOD_WORKFLOW
      || specializationPacket.readyForProfessionalMethodWorkflow !== true
      || !verifyCommercialSpecializationPacketIntegrity(specializationPacket)) {
    return deepFreeze({
      schemaVersion: 1,
      readinessPacketId: readinessPacketId.trim(),
      caseId: caseId.trim(),
      propertyRef: propertyRef.trim(),
      status: METHOD_READINESS_STATUS.HOLD_SPECIALIZATION_PACKET,
      blockers: ['COMMERCIAL_SPECIALIZATION_PACKET_NOT_READY_OR_INTEGRITY_FAILED'],
      methodAssessments: [],
      automaticMethodSelection: false,
      selectedMethod: null,
      valuationArithmeticPerformed: false,
      certifiedValuationEstablished: false,
      transactionAuthorized: false,
    });
  }

  const methodAssessments = uniqueMethods.map((method) => assessOneMethod({ method, specializationPacket, supplementalEvidence }));
  const aggregateStatus = methodAssessments.every((assessment) => assessment.readyForExistingMethodWorkflow)
    ? METHOD_READINESS_STATUS.READY_FOR_EXISTING_METHOD_WORKFLOW
    : methodAssessments.some((assessment) => assessment.status === METHOD_READINESS_STATUS.HOLD_INTEGRITY)
      ? METHOD_READINESS_STATUS.HOLD_INTEGRITY
      : methodAssessments.some((assessment) => assessment.status === METHOD_READINESS_STATUS.HOLD_EVIDENCE_GAPS)
        ? METHOD_READINESS_STATUS.HOLD_EVIDENCE_GAPS
        : METHOD_READINESS_STATUS.HOLD_SUPPLEMENTAL_EVIDENCE;

  const core = {
    schemaVersion: 1,
    readinessPacketId: readinessPacketId.trim(),
    caseId: caseId.trim(),
    propertyRef: propertyRef.trim(),
    valuationDate: specializationPacket.valuationDate,
    commercialAssetClass: specializationPacket.commercialAssetClass,
    occupancyStructure: specializationPacket.occupancyStructure,
    commercialSpecializationHashSha256: specializationPacket.commercialSpecializationHashSha256,
    methodsAssessed: uniqueMethods.sort(),
    methodAssessments,
    supplementalEvidence,
    preparedByRef: preparedByRef.trim(),
    preparedAt: prepared,
    reviewedByRef: reviewedByRef.trim(),
    reviewedAt: reviewed,
    reviewEvidenceRef: reviewEvidenceRef.trim(),
  };

  return deepFreeze({
    ...core,
    commercialMethodReadinessHashSha256: sha256(core),
    status: aggregateStatus,
    blockers: methodAssessments.flatMap((assessment) => assessment.blockers),
    readyMethods: methodAssessments.filter((assessment) => assessment.readyForExistingMethodWorkflow).map((assessment) => assessment.method),
    automaticMethodSelection: false,
    selectedMethod: null,
    valuationInputsWritten: false,
    valuationArithmeticPerformed: false,
    methodReconciliationPerformed: false,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    legalOpinionEstablished: false,
    transactionAuthorized: false,
    semantics: 'This packet assesses commercial evidence readiness only for explicitly requested existing valuation-method workflows. It neither selects a method nor writes valuation inputs, performs valuation arithmetic, reconciles method indications, certifies a valuation, establishes legal conclusions or authorizes a transaction.',
  });
}

function verifyCommercialMethodReadinessPacketIntegrity(packet) {
  if (!packet || !validSha(packet.commercialMethodReadinessHashSha256)) return false;
  const core = { ...packet };
  [
    'commercialMethodReadinessHashSha256', 'status', 'blockers', 'readyMethods', 'automaticMethodSelection',
    'selectedMethod', 'valuationInputsWritten', 'valuationArithmeticPerformed', 'methodReconciliationPerformed',
    'finalValuationConclusionEstablished', 'certifiedValuationEstablished', 'legalOpinionEstablished',
    'transactionAuthorized', 'semantics',
  ].forEach((key) => delete core[key]);
  return sha256(core) === packet.commercialMethodReadinessHashSha256.toLowerCase();
}

module.exports = {
  COMMERCIAL_METHOD,
  METHOD_READINESS_STATUS,
  SUPPLEMENTAL_EVIDENCE_ROLE,
  SUPPLEMENTAL_EVIDENCE_STATUS,
  createSupplementalMethodEvidence,
  verifySupplementalMethodEvidenceIntegrity,
  methodRequiredTopics,
  methodSupplementalRoles,
  buildCommercialMethodReadinessPacket,
  verifyCommercialMethodReadinessPacketIntegrity,
};
