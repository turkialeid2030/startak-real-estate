'use strict';

const { TITLE_RESULT_STATUS } = require('../title-intelligence');
const { TENANT_RESULT_STATUS } = require('../tenant-intelligence');

const PROPERTY_INTEREST_TYPE = Object.freeze({
  FREEHOLD: 'FREEHOLD',
  LEASEHOLD: 'LEASEHOLD',
  USUFRUCT: 'USUFRUCT',
  GROUND_LEASE: 'GROUND_LEASE',
  LONG_TERM_LEASE: 'LONG_TERM_LEASE',
  WAQF_DEVELOPMENT_RIGHT: 'WAQF_DEVELOPMENT_RIGHT',
  JV_ECONOMIC_INTEREST: 'JV_ECONOMIC_INTEREST',
  OTHER_CONTRACTUAL_INTEREST: 'OTHER_CONTRACTUAL_INTEREST',
});

const TIME_LIMITED_INTEREST_TYPES = Object.freeze([
  PROPERTY_INTEREST_TYPE.LEASEHOLD,
  PROPERTY_INTEREST_TYPE.USUFRUCT,
  PROPERTY_INTEREST_TYPE.GROUND_LEASE,
  PROPERTY_INTEREST_TYPE.LONG_TERM_LEASE,
  PROPERTY_INTEREST_TYPE.WAQF_DEVELOPMENT_RIGHT,
]);

const PROPERTY_ASSET_CLASS = Object.freeze({
  RESIDENTIAL_INCOME: 'RESIDENTIAL_INCOME',
  MIXED_USE_WITH_RESIDENTIAL: 'MIXED_USE_WITH_RESIDENTIAL',
});

const UNIT_TYPE = Object.freeze({
  RESIDENTIAL_APARTMENT: 'RESIDENTIAL_APARTMENT',
  RESIDENTIAL_VILLA: 'RESIDENTIAL_VILLA',
  RESIDENTIAL_COMPOUND_UNIT: 'RESIDENTIAL_COMPOUND_UNIT',
  RETAIL: 'RETAIL',
  OFFICE: 'OFFICE',
  STORAGE: 'STORAGE',
  PARKING: 'PARKING',
  OTHER: 'OTHER',
});

const UNIT_OPERATING_STATUS = Object.freeze({
  OCCUPIED: 'OCCUPIED',
  VACANT: 'VACANT',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN',
});

const LEASE_LIFECYCLE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  FUTURE: 'FUTURE',
  EXPIRED: 'EXPIRED',
  TERMINATED: 'TERMINATED',
  UNKNOWN: 'UNKNOWN',
});

const RENT_FREQUENCY = Object.freeze({
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  SEMI_ANNUAL: 'SEMI_ANNUAL',
  ANNUAL: 'ANNUAL',
  CUSTOM: 'CUSTOM',
});

const RENT_ESCALATION_TYPE = Object.freeze({
  NONE: 'NONE',
  FIXED_PERCENT: 'FIXED_PERCENT',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
  STEP_RENT: 'STEP_RENT',
  INDEXED: 'INDEXED',
  MANUAL_SCHEDULE: 'MANUAL_SCHEDULE',
});

const OPERATING_INPUT_STATUS = Object.freeze({
  VERIFIED_FACT: 'VERIFIED_FACT',
  OBSERVED: 'OBSERVED',
  ASSUMED: 'ASSUMED',
  UNVERIFIED: 'UNVERIFIED',
  CONFLICT: 'CONFLICT',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});

const LINEAGE_KIND = Object.freeze({
  SOURCE_DOCUMENT: 'SOURCE_DOCUMENT',
  EVIDENCE_FACT: 'EVIDENCE_FACT',
  HUMAN_VERIFICATION: 'HUMAN_VERIFICATION',
  UNDERWRITING_ADOPTION: 'UNDERWRITING_ADOPTION',
  HUMAN_IDENTITY: 'HUMAN_IDENTITY',
  POLICY: 'POLICY',
  ANALYTICAL_ASSESSMENT: 'ANALYTICAL_ASSESSMENT',
  LEGAL_REVIEW: 'LEGAL_REVIEW',
  OTHER: 'OTHER',
});

const OPERATING_EXPENSE_BASIS = Object.freeze({
  ACTUAL: 'ACTUAL',
  BUDGET: 'BUDGET',
  NORMALIZED: 'NORMALIZED',
  BENCHMARK: 'BENCHMARK',
});

const OPERATING_EXPENSE_CATEGORY = Object.freeze({
  MAINTENANCE: 'MAINTENANCE',
  FACILITIES_MANAGEMENT: 'FACILITIES_MANAGEMENT',
  UTILITIES: 'UTILITIES',
  INSURANCE: 'INSURANCE',
  SECURITY: 'SECURITY',
  CLEANING: 'CLEANING',
  COMMON_AREAS: 'COMMON_AREAS',
  MANAGEMENT_FEE: 'MANAGEMENT_FEE',
  MUNICIPAL_CHARGES: 'MUNICIPAL_CHARGES',
  LEGAL: 'LEGAL',
  COLLECTION: 'COLLECTION',
  REPLACEMENT_RESERVE: 'REPLACEMENT_RESERVE',
  OTHER: 'OTHER',
});

const CAPEX_CATEGORY = Object.freeze({
  LIFE_SAFETY: 'LIFE_SAFETY',
  FIRE_PROTECTION: 'FIRE_PROTECTION',
  STRUCTURE: 'STRUCTURE',
  ENVELOPE: 'ENVELOPE',
  ROOF_WATERPROOFING: 'ROOF_WATERPROOFING',
  MECHANICAL: 'MECHANICAL',
  ELECTRICAL: 'ELECTRICAL',
  PLUMBING_DRAINAGE: 'PLUMBING_DRAINAGE',
  HVAC: 'HVAC',
  LIFTS: 'LIFTS',
  SECURITY_MONITORING: 'SECURITY_MONITORING',
  ACCESSIBILITY: 'ACCESSIBILITY',
  COSMETIC: 'COSMETIC',
  OTHER: 'OTHER',
});

const CAPEX_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  COSMETIC: 'COSMETIC',
});

const EXIT_STRATEGY_TYPE = Object.freeze({
  HOLD_AS_IS: 'HOLD_AS_IS',
  SELL_AS_IS: 'SELL_AS_IS',
  STABILIZE_AND_SELL: 'STABILIZE_AND_SELL',
  RE_LEASE_AND_HOLD: 'RE_LEASE_AND_HOLD',
  RENOVATE_AND_REPOSITION: 'RENOVATE_AND_REPOSITION',
  HOLD_TO_INTEREST_EXPIRY: 'HOLD_TO_INTEREST_EXPIRY',
});

const EXIT_STRATEGY_INPUT_TYPE = Object.freeze({
  HOLD_PERIOD_YEARS: 'HOLD_PERIOD_YEARS',
  STRATEGY_CAPEX: 'STRATEGY_CAPEX',
  EXECUTION_PERIOD_YEARS: 'EXECUTION_PERIOD_YEARS',
  YEAR_ONE_NOI_RETENTION_RATE: 'YEAR_ONE_NOI_RETENTION_RATE',
  STABILIZED_NOI_DELTA: 'STABILIZED_NOI_DELTA',
  ANNUAL_NOI_GROWTH_RATE: 'ANNUAL_NOI_GROWTH_RATE',
  ANNUAL_HOLDING_COST: 'ANNUAL_HOLDING_COST',
  EXIT_CAP_RATE: 'EXIT_CAP_RATE',
  CONTRACTUAL_TERMINAL_VALUE: 'CONTRACTUAL_TERMINAL_VALUE',
  SELLING_COST_RATE: 'SELLING_COST_RATE',
  DISCOUNT_RATE: 'DISCOUNT_RATE',
});

const EXIT_STRATEGY_INPUT_DEFINITION = Object.freeze({
  [EXIT_STRATEGY_INPUT_TYPE.HOLD_PERIOD_YEARS]: Object.freeze({ key: 'holdPeriodYears', unit: 'years' }),
  [EXIT_STRATEGY_INPUT_TYPE.STRATEGY_CAPEX]: Object.freeze({ key: 'strategyCapex', unit: 'SAR' }),
  [EXIT_STRATEGY_INPUT_TYPE.EXECUTION_PERIOD_YEARS]: Object.freeze({ key: 'executionPeriodYears', unit: 'years' }),
  [EXIT_STRATEGY_INPUT_TYPE.YEAR_ONE_NOI_RETENTION_RATE]: Object.freeze({ key: 'yearOneNoiRetentionRate', unit: 'ratio' }),
  [EXIT_STRATEGY_INPUT_TYPE.STABILIZED_NOI_DELTA]: Object.freeze({ key: 'stabilizedNoiDelta', unit: 'SAR/year' }),
  [EXIT_STRATEGY_INPUT_TYPE.ANNUAL_NOI_GROWTH_RATE]: Object.freeze({ key: 'annualNoiGrowthRate', unit: 'ratio' }),
  [EXIT_STRATEGY_INPUT_TYPE.ANNUAL_HOLDING_COST]: Object.freeze({ key: 'annualHoldingCost', unit: 'SAR/year' }),
  [EXIT_STRATEGY_INPUT_TYPE.EXIT_CAP_RATE]: Object.freeze({ key: 'exitCapRate', unit: 'ratio' }),
  [EXIT_STRATEGY_INPUT_TYPE.CONTRACTUAL_TERMINAL_VALUE]: Object.freeze({ key: 'contractualTerminalValue', unit: 'SAR' }),
  [EXIT_STRATEGY_INPUT_TYPE.SELLING_COST_RATE]: Object.freeze({ key: 'sellingCostRate', unit: 'ratio' }),
  [EXIT_STRATEGY_INPUT_TYPE.DISCOUNT_RATE]: Object.freeze({ key: 'discountRate', unit: 'ratio' }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalString(value, field) {
  if (value === null || value === undefined) return null;
  return requiredString(value, field);
}

function enumValue(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid: ${value}`);
  return value;
}

function isoDate(value, field) {
  const text = requiredString(value, field);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid ISO date or timestamp`);
  return text;
}

function optionalIsoDate(value, field) {
  if (value === null || value === undefined) return null;
  return isoDate(value, field);
}

function finiteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`);
  return value;
}

function uniqueStrings(values, field) {
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array`);
  const normalized = values.map((value, index) => requiredString(value, `${field}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new TypeError(`${field} must not contain duplicates`);
  return normalized;
}

function distinctStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim() !== '').map((value) => value.trim()))];
}

function normalizeAssumptionOverride(value) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('assumptionOverride must be an object or null');
  return {
    reason: requiredString(value.reason, 'assumptionOverride.reason'),
    approvedByRef: requiredString(value.approvedByRef, 'assumptionOverride.approvedByRef'),
    approvedAt: isoDate(value.approvedAt, 'assumptionOverride.approvedAt'),
    policyRef: optionalString(value.policyRef, 'assumptionOverride.policyRef'),
  };
}

function createEvidenceLineageRecord({
  caseId,
  refId,
  kind,
  recordedAt,
  documentId = null,
  factId = null,
  contentHashSha256 = null,
  sourceLocator = null,
  note = null,
}) {
  requiredString(caseId, 'caseId');
  requiredString(refId, 'refId');
  enumValue(kind, LINEAGE_KIND, 'kind');
  const normalizedRecordedAt = isoDate(recordedAt, 'recordedAt');
  const normalizedDocumentId = optionalString(documentId, 'documentId');
  const normalizedFactId = optionalString(factId, 'factId');
  if (contentHashSha256 !== null && (typeof contentHashSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(contentHashSha256))) {
    throw new TypeError('contentHashSha256 must be a 64-character SHA-256 hex digest or null');
  }
  if (sourceLocator !== null && (!sourceLocator || typeof sourceLocator !== 'object' || Array.isArray(sourceLocator))) {
    throw new TypeError('sourceLocator must be an object or null');
  }
  if (note !== null && typeof note !== 'string') throw new TypeError('note must be a string or null');

  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    refId: refId.trim(),
    kind,
    recordedAt: normalizedRecordedAt,
    documentId: normalizedDocumentId,
    factId: normalizedFactId,
    contentHashSha256: contentHashSha256 ? contentHashSha256.toLowerCase() : null,
    sourceLocator: sourceLocator ? { ...sourceLocator } : null,
    note: note === null ? null : note.trim(),
  });
}

function createEvidenceAwareValue({
  field,
  value = null,
  unit = null,
  sourceRef = null,
  evidenceType,
  effectiveDate = null,
  verificationStatus = OPERATING_INPUT_STATUS.UNVERIFIED,
  confidence = null,
  adoptedForUnderwriting = false,
  adoptionDecisionRef = null,
  assumptionOverride = null,
  lineageRefs = [],
}) {
  const normalizedField = requiredString(field, 'field');
  const normalizedEvidenceType = requiredString(evidenceType, 'evidenceType');
  enumValue(verificationStatus, OPERATING_INPUT_STATUS, 'verificationStatus');
  const normalizedUnit = optionalString(unit, 'unit');
  const normalizedSourceRef = optionalString(sourceRef, 'sourceRef');
  const normalizedEffectiveDate = optionalIsoDate(effectiveDate, 'effectiveDate');
  const normalizedAdoptionRef = optionalString(adoptionDecisionRef, 'adoptionDecisionRef');
  const normalizedOverride = normalizeAssumptionOverride(assumptionOverride);
  const suppliedLineageRefs = uniqueStrings(lineageRefs, 'lineageRefs');

  if (confidence !== null) {
    finiteNumber(confidence, 'confidence');
    if (confidence < 0 || confidence > 1) throw new RangeError('confidence must be between 0 and 1');
  }
  if (typeof adoptedForUnderwriting !== 'boolean') throw new TypeError('adoptedForUnderwriting must be a boolean');
  if (verificationStatus === OPERATING_INPUT_STATUS.NOT_AVAILABLE) {
    if (value !== null) throw new TypeError('NOT_AVAILABLE evidence-aware values must use value=null');
    if (adoptedForUnderwriting) throw new TypeError('NOT_AVAILABLE values cannot be adopted for underwriting');
  } else {
    if (value === null || value === undefined) throw new TypeError(`${normalizedField} requires a value unless status is NOT_AVAILABLE`);
    if (!normalizedEffectiveDate) throw new TypeError(`${normalizedField}.effectiveDate is required`);
  }
  if ([OPERATING_INPUT_STATUS.VERIFIED_FACT, OPERATING_INPUT_STATUS.OBSERVED, OPERATING_INPUT_STATUS.UNVERIFIED, OPERATING_INPUT_STATUS.CONFLICT].includes(verificationStatus)
    && !normalizedSourceRef) {
    throw new TypeError(`${normalizedField}.sourceRef is required for ${verificationStatus}`);
  }
  if (verificationStatus === OPERATING_INPUT_STATUS.ASSUMED && !normalizedOverride) {
    throw new TypeError(`${normalizedField}.assumptionOverride is required for ASSUMED values`);
  }
  if (verificationStatus !== OPERATING_INPUT_STATUS.ASSUMED && normalizedOverride) {
    throw new TypeError('assumptionOverride is only valid for ASSUMED values');
  }
  if (adoptedForUnderwriting) {
    if (!normalizedAdoptionRef) throw new TypeError(`${normalizedField}.adoptionDecisionRef is required when adoptedForUnderwriting=true`);
    if ([OPERATING_INPUT_STATUS.UNVERIFIED, OPERATING_INPUT_STATUS.CONFLICT, OPERATING_INPUT_STATUS.NOT_AVAILABLE].includes(verificationStatus)) {
      throw new TypeError(`${verificationStatus} values cannot be adopted for underwriting`);
    }
  } else if (normalizedAdoptionRef) {
    throw new TypeError('adoptionDecisionRef requires adoptedForUnderwriting=true');
  }

  const refs = distinctStrings([
    ...suppliedLineageRefs,
    normalizedSourceRef,
    normalizedAdoptionRef,
    normalizedOverride && normalizedOverride.approvedByRef,
    normalizedOverride && normalizedOverride.policyRef,
  ]);

  return deepFreeze({
    schemaVersion: 1,
    field: normalizedField,
    value,
    unit: normalizedUnit,
    sourceRef: normalizedSourceRef,
    evidenceType: normalizedEvidenceType,
    effectiveDate: normalizedEffectiveDate,
    verificationStatus,
    confidence,
    adoptedForUnderwriting,
    adoptionDecisionRef: normalizedAdoptionRef,
    assumptionOverride: normalizedOverride,
    lineageRefs: refs,
    semantics: 'An evidence-aware operating input preserves source, verification, effective-date, and human-adoption lineage. Confidence is not a probability that the value is true.',
  });
}

function createPropertyInterest({
  caseId,
  propertyInterestId,
  propertyId,
  interestType,
  interestEvidenceRef = null,
  commencementDate = null,
  expiryDate = null,
  rightsSummary = null,
  titleAssessment = null,
  titleAssessmentRef = null,
  interestAdoptionDecisionRef = null,
  legalReviewRef = null,
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  requiredString(propertyInterestId, 'propertyInterestId');
  requiredString(propertyId, 'propertyId');
  enumValue(interestType, PROPERTY_INTEREST_TYPE, 'interestType');
  const start = optionalIsoDate(commencementDate, 'commencementDate');
  const end = optionalIsoDate(expiryDate, 'expiryDate');
  if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
    throw new RangeError('expiryDate must be after commencementDate');
  }
  if (interestType === PROPERTY_INTEREST_TYPE.FREEHOLD && end) {
    throw new TypeError('FREEHOLD property interests cannot carry an expiryDate');
  }
  const normalizedRightsSummary = optionalString(rightsSummary, 'rightsSummary');
  if (interestType === PROPERTY_INTEREST_TYPE.OTHER_CONTRACTUAL_INTEREST && !normalizedRightsSummary) {
    throw new TypeError('OTHER_CONTRACTUAL_INTEREST requires rightsSummary');
  }
  if (titleAssessment !== null) {
    if (!titleAssessment || typeof titleAssessment !== 'object') throw new TypeError('titleAssessment must be an object or null');
    if (titleAssessment.caseId !== caseId || titleAssessment.propertyId !== propertyId) {
      throw new TypeError('TITLE_ASSESSMENT_ISOLATION_VIOLATION');
    }
    enumValue(titleAssessment.status, TITLE_RESULT_STATUS, 'titleAssessment.status');
    if (!titleAssessmentRef) throw new TypeError('titleAssessmentRef is required when titleAssessment is supplied');
  }

  const normalizedInterestEvidenceRef = optionalString(interestEvidenceRef, 'interestEvidenceRef');
  const normalizedTitleAssessmentRef = optionalString(titleAssessmentRef, 'titleAssessmentRef');
  const normalizedInterestAdoptionRef = optionalString(interestAdoptionDecisionRef, 'interestAdoptionDecisionRef');
  const normalizedLegalReviewRef = optionalString(legalReviewRef, 'legalReviewRef');
  const refs = distinctStrings([
    ...uniqueStrings(evidenceRefs, 'evidenceRefs'),
    normalizedInterestEvidenceRef,
    normalizedTitleAssessmentRef,
    normalizedInterestAdoptionRef,
    normalizedLegalReviewRef,
  ]);

  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    propertyInterestId: propertyInterestId.trim(),
    propertyId: propertyId.trim(),
    interestType,
    interestEvidenceRef: normalizedInterestEvidenceRef,
    commencementDate: start,
    expiryDate: end,
    isTimeLimited: TIME_LIMITED_INTEREST_TYPES.includes(interestType),
    rightsSummary: normalizedRightsSummary,
    titleAssessment: titleAssessment ? {
      status: titleAssessment.status,
      blockerCount: Array.isArray(titleAssessment.blockers) ? titleAssessment.blockers.length : null,
      legalReviewFlagCount: Array.isArray(titleAssessment.legalReviewFlags) ? titleAssessment.legalReviewFlags.length : null,
    } : null,
    titleAssessmentRef: normalizedTitleAssessmentRef,
    interestAdoptionDecisionRef: normalizedInterestAdoptionRef,
    legalReviewRef: normalizedLegalReviewRef,
    evidenceRefs: refs,
    legalConclusion: null,
    semantics: 'This record describes the economic/property interest being underwritten. It does not certify title, ownership, enforceability, or transaction legality.',
  });
}

function createProperty({
  caseId,
  propertyId,
  assetClass = PROPERTY_ASSET_CLASS.RESIDENTIAL_INCOME,
  name = null,
  buildingIds = [],
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  requiredString(propertyId, 'propertyId');
  enumValue(assetClass, PROPERTY_ASSET_CLASS, 'assetClass');
  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    propertyId: propertyId.trim(),
    assetClass,
    name: optionalString(name, 'name'),
    buildingIds: uniqueStrings(buildingIds, 'buildingIds'),
    evidenceRefs: uniqueStrings(evidenceRefs, 'evidenceRefs'),
  });
}

function createBuilding({ caseId, propertyId, buildingId, name = null, unitIds = [], evidenceRefs = [] }) {
  requiredString(caseId, 'caseId');
  requiredString(propertyId, 'propertyId');
  requiredString(buildingId, 'buildingId');
  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    propertyId: propertyId.trim(),
    buildingId: buildingId.trim(),
    name: optionalString(name, 'name'),
    unitIds: uniqueStrings(unitIds, 'unitIds'),
    evidenceRefs: uniqueStrings(evidenceRefs, 'evidenceRefs'),
  });
}

function assertEvidenceAwareValue(value, field) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || typeof value.field !== 'string') {
    throw new TypeError(`${field} must be an evidence-aware value created by createEvidenceAwareValue`);
  }
  return value;
}

function createUnit({
  caseId,
  propertyInterestId,
  propertyId,
  buildingId,
  unitId,
  unitType,
  operatingStatus,
  rentableArea,
  leaseIds = [],
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  requiredString(propertyInterestId, 'propertyInterestId');
  requiredString(propertyId, 'propertyId');
  requiredString(buildingId, 'buildingId');
  requiredString(unitId, 'unitId');
  enumValue(unitType, UNIT_TYPE, 'unitType');
  assertEvidenceAwareValue(operatingStatus, 'operatingStatus');
  assertEvidenceAwareValue(rentableArea, 'rentableArea');
  if (operatingStatus.value !== null) enumValue(operatingStatus.value, UNIT_OPERATING_STATUS, 'operatingStatus.value');
  if (rentableArea.value !== null) {
    finiteNumber(rentableArea.value, 'rentableArea.value');
    if (rentableArea.value < 0) throw new RangeError('rentableArea.value must be >= 0');
  }
  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    propertyInterestId: propertyInterestId.trim(),
    propertyId: propertyId.trim(),
    buildingId: buildingId.trim(),
    unitId: unitId.trim(),
    unitType,
    operatingStatus,
    rentableArea,
    leaseIds: uniqueStrings(leaseIds, 'leaseIds'),
    evidenceRefs: uniqueStrings(evidenceRefs, 'evidenceRefs'),
  });
}

function createTenant({
  caseId,
  tenantId,
  displayName = null,
  tenantAssessment = null,
  tenantAssessmentRef = null,
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  requiredString(tenantId, 'tenantId');
  if (tenantAssessment !== null) {
    if (!tenantAssessment || typeof tenantAssessment !== 'object') throw new TypeError('tenantAssessment must be an object or null');
    if (tenantAssessment.tenantId !== tenantId) throw new TypeError('TENANT_ASSESSMENT_ISOLATION_VIOLATION');
    enumValue(tenantAssessment.status, TENANT_RESULT_STATUS, 'tenantAssessment.status');
    if (!tenantAssessmentRef) throw new TypeError('tenantAssessmentRef is required when tenantAssessment is supplied');
  }
  const normalizedAssessmentRef = optionalString(tenantAssessmentRef, 'tenantAssessmentRef');
  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    tenantId: tenantId.trim(),
    displayName: optionalString(displayName, 'displayName'),
    tenantAssessment: tenantAssessment ? {
      status: tenantAssessment.status,
      score: tenantAssessment.score === undefined ? null : tenantAssessment.score,
      assessedWeight: tenantAssessment.assessedWeight === undefined ? null : tenantAssessment.assessedWeight,
      prohibitedClaims: Array.isArray(tenantAssessment.prohibitedClaims) ? [...tenantAssessment.prohibitedClaims] : [],
    } : null,
    tenantAssessmentRef: normalizedAssessmentRef,
    evidenceRefs: distinctStrings([...uniqueStrings(evidenceRefs, 'evidenceRefs'), normalizedAssessmentRef]),
  });
}

function createRentEscalation({
  type = RENT_ESCALATION_TYPE.NONE,
  intervalYears = null,
  changeValue = null,
  schedule = [],
  indexName = null,
  indexEvidenceRef = null,
}) {
  enumValue(type, RENT_ESCALATION_TYPE, 'type');
  if (intervalYears !== null && (!Number.isInteger(intervalYears) || intervalYears < 1)) {
    throw new TypeError('intervalYears must be an integer >= 1 or null');
  }
  if (changeValue !== null) assertEvidenceAwareValue(changeValue, 'changeValue');
  if (!Array.isArray(schedule)) throw new TypeError('schedule must be an array');
  const normalizedSchedule = schedule.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new TypeError(`schedule[${index}] must be an object`);
    const effectiveDate = isoDate(entry.effectiveDate, `schedule[${index}].effectiveDate`);
    const rent = assertEvidenceAwareValue(entry.rent, `schedule[${index}].rent`);
    if (rent.value !== null) {
      finiteNumber(rent.value, `schedule[${index}].rent.value`);
      if (rent.value < 0) throw new RangeError(`schedule[${index}].rent.value must be >= 0`);
    }
    return { effectiveDate, rent };
  });
  for (let index = 1; index < normalizedSchedule.length; index += 1) {
    if (new Date(normalizedSchedule[index].effectiveDate).getTime() <= new Date(normalizedSchedule[index - 1].effectiveDate).getTime()) {
      throw new RangeError('rent escalation schedule dates must be strictly increasing');
    }
  }

  if (type === RENT_ESCALATION_TYPE.NONE && (intervalYears !== null || changeValue !== null || normalizedSchedule.length > 0 || indexName !== null || indexEvidenceRef !== null)) {
    throw new TypeError('NONE escalation cannot carry interval, change, schedule, or index fields');
  }
  if ([RENT_ESCALATION_TYPE.FIXED_PERCENT, RENT_ESCALATION_TYPE.FIXED_AMOUNT].includes(type) && (!changeValue || intervalYears === null)) {
    throw new TypeError(`${type} escalation requires changeValue and intervalYears`);
  }
  if ([RENT_ESCALATION_TYPE.FIXED_PERCENT, RENT_ESCALATION_TYPE.FIXED_AMOUNT].includes(type) && changeValue.value !== null) {
    finiteNumber(changeValue.value, 'changeValue.value');
  }
  if (type === RENT_ESCALATION_TYPE.FIXED_PERCENT && changeValue.value !== null) {
    if (changeValue.value <= -1) throw new RangeError('FIXED_PERCENT changeValue must be greater than -1');
  }
  if ([RENT_ESCALATION_TYPE.STEP_RENT, RENT_ESCALATION_TYPE.MANUAL_SCHEDULE].includes(type) && normalizedSchedule.length === 0) {
    throw new TypeError(`${type} escalation requires a non-empty schedule`);
  }
  if (type === RENT_ESCALATION_TYPE.INDEXED && (!indexName || !indexEvidenceRef)) {
    throw new TypeError('INDEXED escalation requires indexName and indexEvidenceRef');
  }

  return deepFreeze({
    schemaVersion: 1,
    type,
    intervalYears,
    changeValue,
    schedule: normalizedSchedule,
    indexName: optionalString(indexName, 'indexName'),
    indexEvidenceRef: optionalString(indexEvidenceRef, 'indexEvidenceRef'),
  });
}

function createLease({
  caseId,
  propertyInterestId,
  propertyId,
  buildingId,
  unitId,
  leaseId,
  tenantId = null,
  lifecycleStatus,
  startDate = null,
  endDate = null,
  baseRent,
  rentFrequency,
  escalation = createRentEscalation({}),
  securityRefs = [],
  termsEvidenceRef = null,
  termsAdoptionDecisionRef = null,
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  requiredString(propertyInterestId, 'propertyInterestId');
  requiredString(propertyId, 'propertyId');
  requiredString(buildingId, 'buildingId');
  requiredString(unitId, 'unitId');
  requiredString(leaseId, 'leaseId');
  enumValue(lifecycleStatus, LEASE_LIFECYCLE_STATUS, 'lifecycleStatus');
  enumValue(rentFrequency, RENT_FREQUENCY, 'rentFrequency');
  assertEvidenceAwareValue(baseRent, 'baseRent');
  if (baseRent.value !== null) {
    finiteNumber(baseRent.value, 'baseRent.value');
    if (baseRent.value < 0) throw new RangeError('baseRent.value must be >= 0');
  }
  if (!escalation || escalation.schemaVersion !== 1 || !Object.values(RENT_ESCALATION_TYPE).includes(escalation.type)) {
    throw new TypeError('escalation must be created by createRentEscalation');
  }
  const normalizedTenantId = optionalString(tenantId, 'tenantId');
  if ([LEASE_LIFECYCLE_STATUS.ACTIVE, LEASE_LIFECYCLE_STATUS.FUTURE].includes(lifecycleStatus) && !normalizedTenantId) {
    throw new TypeError(`${lifecycleStatus} leases require tenantId`);
  }
  const normalizedStart = optionalIsoDate(startDate, 'startDate');
  const normalizedEnd = optionalIsoDate(endDate, 'endDate');
  const normalizedTermsEvidenceRef = optionalString(termsEvidenceRef, 'termsEvidenceRef');
  const normalizedTermsAdoptionRef = optionalString(termsAdoptionDecisionRef, 'termsAdoptionDecisionRef');
  if (normalizedStart && normalizedEnd && new Date(normalizedEnd).getTime() <= new Date(normalizedStart).getTime()) {
    throw new RangeError('lease endDate must be after startDate');
  }

  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    propertyInterestId: propertyInterestId.trim(),
    propertyId: propertyId.trim(),
    buildingId: buildingId.trim(),
    unitId: unitId.trim(),
    leaseId: leaseId.trim(),
    tenantId: normalizedTenantId,
    lifecycleStatus,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    baseRent,
    rentFrequency,
    escalation,
    securityRefs: uniqueStrings(securityRefs, 'securityRefs'),
    termsEvidenceRef: normalizedTermsEvidenceRef,
    termsAdoptionDecisionRef: normalizedTermsAdoptionRef,
    evidenceRefs: distinctStrings([
      ...uniqueStrings(evidenceRefs, 'evidenceRefs'),
      normalizedTermsEvidenceRef,
      normalizedTermsAdoptionRef,
    ]),
  });
}

function createRentCollectionRecord({
  caseId,
  collectionId,
  propertyId,
  buildingId,
  unitId,
  leaseId,
  periodStart,
  periodEnd,
  contractualRentDue,
  collectedRent,
  potentialGrossRent,
  concessions,
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  const normalizedCollectionId = requiredString(collectionId, 'collectionId');
  requiredString(propertyId, 'propertyId');
  requiredString(buildingId, 'buildingId');
  requiredString(unitId, 'unitId');
  const normalizedLeaseId = optionalString(leaseId, 'leaseId');
  const normalizedPeriodStart = isoDate(periodStart, 'periodStart');
  const normalizedPeriodEnd = isoDate(periodEnd, 'periodEnd');
  if (new Date(normalizedPeriodEnd).getTime() <= new Date(normalizedPeriodStart).getTime()) {
    throw new RangeError('collection periodEnd must be after periodStart');
  }

  const values = {
    contractualRentDue,
    collectedRent,
    potentialGrossRent,
    concessions,
  };
  for (const [key, value] of Object.entries(values)) {
    assertEvidenceAwareValue(value, key);
    const expectedField = `collection.${normalizedCollectionId}.${key}`;
    if (value.field !== expectedField) throw new TypeError(`COLLECTION_INPUT_FIELD_MISMATCH: ${key}`);
    if (value.unit !== 'SAR') throw new TypeError(`${expectedField}.unit must be SAR`);
    if (value.value !== null) {
      finiteNumber(value.value, `${expectedField}.value`);
      if (value.value < 0) throw new RangeError(`${expectedField}.value must be >= 0`);
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    collectionId: normalizedCollectionId,
    propertyId: propertyId.trim(),
    buildingId: buildingId.trim(),
    unitId: unitId.trim(),
    leaseId: normalizedLeaseId,
    periodStart: normalizedPeriodStart,
    periodEnd: normalizedPeriodEnd,
    contractualRentDue,
    collectedRent,
    potentialGrossRent,
    concessions,
    evidenceRefs: uniqueStrings(evidenceRefs, 'evidenceRefs'),
    semantics: 'A period-specific collection record. Contractual rent due, cash collected, potential gross rent, and concessions remain separate evidence-aware facts and are never inferred from one another.',
  });
}

function createOperatingExpense({
  caseId,
  expenseId,
  propertyId,
  buildingId = null,
  category,
  basis,
  annualAmount,
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  requiredString(expenseId, 'expenseId');
  requiredString(propertyId, 'propertyId');
  enumValue(category, OPERATING_EXPENSE_CATEGORY, 'category');
  enumValue(basis, OPERATING_EXPENSE_BASIS, 'basis');
  assertEvidenceAwareValue(annualAmount, 'annualAmount');
  if (annualAmount.value !== null) {
    finiteNumber(annualAmount.value, 'annualAmount.value');
    if (annualAmount.value < 0) throw new RangeError('annualAmount.value must be >= 0');
  }
  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    expenseId: expenseId.trim(),
    propertyId: propertyId.trim(),
    buildingId: optionalString(buildingId, 'buildingId'),
    category,
    basis,
    annualAmount,
    evidenceRefs: uniqueStrings(evidenceRefs, 'evidenceRefs'),
    semantics: 'An operating-expense record preserves the stated basis. Actual, budget, normalized, and benchmark amounts are never silently substituted for one another.',
  });
}

function createCapexItem({
  caseId,
  capexItemId,
  propertyId,
  buildingId = null,
  category,
  severity,
  estimatedCost,
  lifeSafety = false,
  complianceImpact = false,
  immediate = false,
  requiredByDate = null,
  downtimeDays = null,
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  requiredString(capexItemId, 'capexItemId');
  requiredString(propertyId, 'propertyId');
  enumValue(category, CAPEX_CATEGORY, 'category');
  enumValue(severity, CAPEX_SEVERITY, 'severity');
  assertEvidenceAwareValue(estimatedCost, 'estimatedCost');
  if (estimatedCost.value !== null) {
    finiteNumber(estimatedCost.value, 'estimatedCost.value');
    if (estimatedCost.value < 0) throw new RangeError('estimatedCost.value must be >= 0');
  }
  for (const [field, value] of Object.entries({ lifeSafety, complianceImpact, immediate })) {
    if (typeof value !== 'boolean') throw new TypeError(`${field} must be a boolean`);
  }
  if (downtimeDays !== null && (!Number.isInteger(downtimeDays) || downtimeDays < 0)) {
    throw new TypeError('downtimeDays must be an integer >= 0 or null');
  }
  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    capexItemId: capexItemId.trim(),
    propertyId: propertyId.trim(),
    buildingId: optionalString(buildingId, 'buildingId'),
    category,
    severity,
    estimatedCost,
    lifeSafety,
    complianceImpact,
    immediate,
    requiredByDate: optionalIsoDate(requiredByDate, 'requiredByDate'),
    downtimeDays,
    evidenceRefs: uniqueStrings(evidenceRefs, 'evidenceRefs'),
    semantics: 'A technical CAPEX item records known cost and uncertainty separately. Missing or unpriced cost remains null and is never treated as zero.',
  });
}

function createExitStrategyInput({
  scenarioId,
  type,
  value = null,
  sourceRef = null,
  evidenceType,
  effectiveDate = null,
  verificationStatus = OPERATING_INPUT_STATUS.UNVERIFIED,
  confidence = null,
  adoptedForUnderwriting = false,
  adoptionDecisionRef = null,
  assumptionOverride = null,
  lineageRefs = [],
}) {
  const normalizedScenarioId = requiredString(scenarioId, 'scenarioId');
  const definition = EXIT_STRATEGY_INPUT_DEFINITION[type];
  if (!definition) throw new TypeError(`type is invalid: ${type}`);
  return createEvidenceAwareValue({
    field: `exit.${normalizedScenarioId}.${definition.key}`,
    value,
    unit: definition.unit,
    sourceRef,
    evidenceType,
    effectiveDate,
    verificationStatus,
    confidence,
    adoptedForUnderwriting,
    adoptionDecisionRef,
    assumptionOverride,
    lineageRefs,
  });
}

function createExitStrategyScenario({
  caseId,
  scenarioId,
  strategyType,
  label = null,
  isBenchmark = false,
  inputs,
  evidenceRefs = [],
}) {
  requiredString(caseId, 'caseId');
  const normalizedScenarioId = requiredString(scenarioId, 'scenarioId');
  enumValue(strategyType, EXIT_STRATEGY_TYPE, 'strategyType');
  if (typeof isBenchmark !== 'boolean') throw new TypeError('isBenchmark must be a boolean');
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) throw new TypeError('inputs must be an object');
  const normalizedInputs = {};
  for (const definition of Object.values(EXIT_STRATEGY_INPUT_DEFINITION)) {
    const input = inputs[definition.key];
    if (input !== null && input !== undefined) {
      assertEvidenceAwareValue(input, `inputs.${definition.key}`);
      if (input.field !== `exit.${normalizedScenarioId}.${definition.key}`) {
        throw new TypeError(`EXIT_SCENARIO_INPUT_FIELD_MISMATCH: ${definition.key}`);
      }
      normalizedInputs[definition.key] = input;
    }
  }
  const suppliedKeys = Object.keys(inputs);
  const unknownKeys = suppliedKeys.filter((key) => !Object.values(EXIT_STRATEGY_INPUT_DEFINITION).some((definition) => definition.key === key));
  if (unknownKeys.length) throw new TypeError(`UNKNOWN_EXIT_SCENARIO_INPUT: ${unknownKeys[0]}`);
  return deepFreeze({
    schemaVersion: 1,
    caseId: caseId.trim(),
    scenarioId: normalizedScenarioId,
    strategyType,
    label: optionalString(label, 'label'),
    isBenchmark,
    inputs: normalizedInputs,
    evidenceRefs: uniqueStrings(evidenceRefs, 'evidenceRefs'),
    investmentDecision: null,
    transactionAuthorized: false,
    semantics: 'An evidence-aware exit-strategy scenario for analytical comparison only. Creation does not calculate value, recommend a strategy, or authorize a transaction.',
  });
}

function assertUniqueBy(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object') throw new TypeError(`${label} must contain objects`);
    const value = requiredString(item[key], `${label}.${key}`);
    if (seen.has(value)) throw new TypeError(`DUPLICATE_${label.toUpperCase()}_ID: ${value}`);
    seen.add(value);
  }
  return seen;
}

function assertExactReferenceSet(declared, actual, field) {
  const declaredSet = new Set(declared);
  const actualSet = new Set(actual);
  const missing = [...actualSet].filter((id) => !declaredSet.has(id));
  const dangling = [...declaredSet].filter((id) => !actualSet.has(id));
  if (missing.length || dangling.length) {
    throw new TypeError(`${field} relationship mismatch; missing=[${missing.join(',')}], dangling=[${dangling.join(',')}]`);
  }
}

function createResidentialIncomeOperatingCase({
  caseId,
  asOfDate,
  propertyInterest,
  property,
  buildings = [],
  units = [],
  leases = [],
  rentCollections = [],
  tenants = [],
  operatingExpenses = [],
  capexItems = [],
  exitScenarios = [],
  additionalOperatingInputs = [],
  evidenceLineage = [],
}) {
  const normalizedCaseId = requiredString(caseId, 'caseId');
  const normalizedAsOfDate = isoDate(asOfDate, 'asOfDate');
  if (!propertyInterest || typeof propertyInterest !== 'object') throw new TypeError('propertyInterest is required');
  if (!property || typeof property !== 'object') throw new TypeError('property is required');
  for (const [field, list] of Object.entries({ buildings, units, leases, rentCollections, tenants, operatingExpenses, capexItems, exitScenarios, additionalOperatingInputs, evidenceLineage })) {
    if (!Array.isArray(list)) throw new TypeError(`${field} must be an array`);
  }
  for (const input of additionalOperatingInputs) assertEvidenceAwareValue(input, 'additionalOperatingInputs item');

  const scopedRecords = [propertyInterest, property, ...buildings, ...units, ...leases, ...rentCollections, ...tenants, ...operatingExpenses, ...capexItems, ...exitScenarios, ...evidenceLineage];
  if (scopedRecords.some((record) => record.caseId !== normalizedCaseId)) {
    throw new TypeError('OPERATING_CASE_ISOLATION_VIOLATION');
  }
  if (propertyInterest.propertyId !== property.propertyId) throw new TypeError('PROPERTY_INTEREST_PROPERTY_MISMATCH');

  const buildingIds = assertUniqueBy(buildings, 'buildingId', 'building');
  const unitIds = assertUniqueBy(units, 'unitId', 'unit');
  const leaseIds = assertUniqueBy(leases, 'leaseId', 'lease');
  const collectionIds = assertUniqueBy(rentCollections, 'collectionId', 'rent_collection');
  const tenantIds = assertUniqueBy(tenants, 'tenantId', 'tenant');
  const operatingExpenseIds = assertUniqueBy(operatingExpenses, 'expenseId', 'operating_expense');
  const capexItemIds = assertUniqueBy(capexItems, 'capexItemId', 'capex_item');
  const exitScenarioIds = assertUniqueBy(exitScenarios, 'scenarioId', 'exit_scenario');
  const lineageRefs = assertUniqueBy(evidenceLineage, 'refId', 'evidence_lineage');

  assertExactReferenceSet(property.buildingIds, [...buildingIds], 'property.buildingIds');
  for (const building of buildings) {
    if (building.propertyId !== property.propertyId) throw new TypeError('BUILDING_PROPERTY_ISOLATION_VIOLATION');
    const actualUnitIds = units.filter((unit) => unit.buildingId === building.buildingId).map((unit) => unit.unitId);
    assertExactReferenceSet(building.unitIds, actualUnitIds, `building.${building.buildingId}.unitIds`);
  }
  for (const unit of units) {
    if (!buildingIds.has(unit.buildingId)) throw new TypeError(`UNIT_BUILDING_REFERENCE_MISSING: ${unit.unitId}`);
    if (unit.propertyId !== property.propertyId || unit.propertyInterestId !== propertyInterest.propertyInterestId) {
      throw new TypeError('UNIT_PROPERTY_OR_INTEREST_ISOLATION_VIOLATION');
    }
    const actualLeaseIds = leases.filter((lease) => lease.unitId === unit.unitId).map((lease) => lease.leaseId);
    assertExactReferenceSet(unit.leaseIds, actualLeaseIds, `unit.${unit.unitId}.leaseIds`);
  }
  for (const lease of leases) {
    if (!unitIds.has(lease.unitId)) throw new TypeError(`LEASE_UNIT_REFERENCE_MISSING: ${lease.leaseId}`);
    const unit = units.find((candidate) => candidate.unitId === lease.unitId);
    if (lease.buildingId !== unit.buildingId || lease.propertyId !== property.propertyId || lease.propertyInterestId !== propertyInterest.propertyInterestId) {
      throw new TypeError('LEASE_PROPERTY_GRAPH_ISOLATION_VIOLATION');
    }
    if (lease.tenantId && !tenantIds.has(lease.tenantId)) throw new TypeError(`LEASE_TENANT_REFERENCE_MISSING: ${lease.leaseId}`);
  }
  for (const collection of rentCollections) {
    if (!unitIds.has(collection.unitId)) throw new TypeError(`COLLECTION_UNIT_REFERENCE_MISSING: ${collection.collectionId}`);
    const unit = units.find((candidate) => candidate.unitId === collection.unitId);
    if (unit.buildingId !== collection.buildingId || collection.propertyId !== property.propertyId) {
      throw new TypeError('COLLECTION_PROPERTY_GRAPH_ISOLATION_VIOLATION');
    }
    if (collection.leaseId) {
      if (!leaseIds.has(collection.leaseId)) throw new TypeError(`COLLECTION_LEASE_REFERENCE_MISSING: ${collection.collectionId}`);
      const lease = leases.find((candidate) => candidate.leaseId === collection.leaseId);
      if (lease.unitId !== collection.unitId || lease.buildingId !== collection.buildingId) {
        throw new TypeError('COLLECTION_PROPERTY_GRAPH_ISOLATION_VIOLATION');
      }
      if (lease.startDate && new Date(collection.periodStart).getTime() < new Date(lease.startDate).getTime()) {
        throw new TypeError(`COLLECTION_PERIOD_PRECEDES_LEASE: ${collection.collectionId}`);
      }
      if (lease.endDate && new Date(collection.periodEnd).getTime() > new Date(lease.endDate).getTime()) {
        throw new TypeError(`COLLECTION_PERIOD_EXCEEDS_LEASE: ${collection.collectionId}`);
      }
    } else if (unit.operatingStatus.value === UNIT_OPERATING_STATUS.OCCUPIED) {
      throw new TypeError(`OCCUPIED_COLLECTION_RECORD_REQUIRES_LEASE: ${collection.collectionId}`);
    }
  }
  for (const unitId of unitIds) {
    const periods = rentCollections
      .filter((collection) => collection.unitId === unitId)
      .sort((a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime());
    for (let index = 1; index < periods.length; index += 1) {
      if (new Date(periods[index].periodStart).getTime() < new Date(periods[index - 1].periodEnd).getTime()) {
        throw new TypeError(`OVERLAPPING_COLLECTION_PERIODS: ${unitId}`);
      }
    }
  }
  for (const item of [...operatingExpenses, ...capexItems]) {
    if (item.propertyId !== property.propertyId) throw new TypeError('PROPERTY_COST_PROPERTY_ISOLATION_VIOLATION');
    if (item.buildingId && !buildingIds.has(item.buildingId)) throw new TypeError(`PROPERTY_COST_BUILDING_REFERENCE_MISSING: ${item.buildingId}`);
  }

  return deepFreeze({
    schemaVersion: 1,
    contractType: 'RESIDENTIAL_INCOME_OPERATING_CASE_V1',
    caseId: normalizedCaseId,
    asOfDate: normalizedAsOfDate,
    propertyInterest,
    property,
    buildings: [...buildings],
    units: [...units],
    leases: [...leases],
    rentCollections: [...rentCollections],
    tenants: [...tenants],
    operatingExpenses: [...operatingExpenses],
    capexItems: [...capexItems],
    exitScenarios: [...exitScenarios],
    additionalOperatingInputs: [...additionalOperatingInputs],
    evidenceLineage: [...evidenceLineage],
    graphCounts: {
      buildings: buildingIds.size,
      units: unitIds.size,
      leases: leaseIds.size,
      rentCollections: collectionIds.size,
      tenants: tenantIds.size,
      operatingExpenses: operatingExpenseIds.size,
      capexItems: capexItemIds.size,
      exitScenarios: exitScenarioIds.size,
      evidenceLineageRefs: lineageRefs.size,
    },
    financialCalculationExecuted: false,
    investmentDecision: null,
    legalConclusion: null,
    creditRating: null,
    semantics: 'Canonical operating-underwriting graph only. Creation validates entity isolation and lineage structure; it does not calculate NOI, value, returns, legal validity, credit rating, or an investment decision.',
  });
}

function evidenceAwareValuesForCase(operatingCase) {
  const values = [];
  for (const unit of operatingCase.units || []) values.push(unit.operatingStatus, unit.rentableArea);
  for (const lease of operatingCase.leases || []) {
    values.push(lease.baseRent);
    if (lease.escalation && lease.escalation.changeValue) values.push(lease.escalation.changeValue);
    for (const entry of (lease.escalation && lease.escalation.schedule) || []) values.push(entry.rent);
  }
  for (const collection of operatingCase.rentCollections || []) {
    values.push(collection.contractualRentDue, collection.collectedRent, collection.potentialGrossRent, collection.concessions);
  }
  for (const expense of operatingCase.operatingExpenses || []) values.push(expense.annualAmount);
  for (const item of operatingCase.capexItems || []) values.push(item.estimatedCost);
  for (const scenario of operatingCase.exitScenarios || []) values.push(...Object.values(scenario.inputs || {}));
  values.push(...(operatingCase.additionalOperatingInputs || []));
  return values;
}

function collectOperatingCaseEvidenceRefs(operatingCase) {
  const refs = [];
  const collect = (items) => refs.push(...(items || []));
  collect(operatingCase.propertyInterest && operatingCase.propertyInterest.evidenceRefs);
  collect(operatingCase.property && operatingCase.property.evidenceRefs);
  for (const building of operatingCase.buildings || []) collect(building.evidenceRefs);
  for (const unit of operatingCase.units || []) collect(unit.evidenceRefs);
  for (const lease of operatingCase.leases || []) {
    collect(lease.evidenceRefs);
    collect(lease.securityRefs);
    if (lease.escalation && lease.escalation.indexEvidenceRef) refs.push(lease.escalation.indexEvidenceRef);
  }
  for (const collection of operatingCase.rentCollections || []) collect(collection.evidenceRefs);
  for (const tenant of operatingCase.tenants || []) collect(tenant.evidenceRefs);
  for (const expense of operatingCase.operatingExpenses || []) collect(expense.evidenceRefs);
  for (const item of operatingCase.capexItems || []) collect(item.evidenceRefs);
  for (const scenario of operatingCase.exitScenarios || []) collect(scenario.evidenceRefs);
  for (const value of evidenceAwareValuesForCase(operatingCase)) collect(value.lineageRefs);
  return distinctStrings(refs);
}

module.exports = {
  PROPERTY_INTEREST_TYPE,
  TIME_LIMITED_INTEREST_TYPES,
  PROPERTY_ASSET_CLASS,
  UNIT_TYPE,
  UNIT_OPERATING_STATUS,
  LEASE_LIFECYCLE_STATUS,
  RENT_FREQUENCY,
  RENT_ESCALATION_TYPE,
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  OPERATING_EXPENSE_BASIS,
  OPERATING_EXPENSE_CATEGORY,
  CAPEX_CATEGORY,
  CAPEX_SEVERITY,
  EXIT_STRATEGY_TYPE,
  EXIT_STRATEGY_INPUT_TYPE,
  EXIT_STRATEGY_INPUT_DEFINITION,
  deepFreeze,
  createEvidenceLineageRecord,
  createEvidenceAwareValue,
  createPropertyInterest,
  createProperty,
  createBuilding,
  createUnit,
  createTenant,
  createRentEscalation,
  createLease,
  createRentCollectionRecord,
  createOperatingExpense,
  createCapexItem,
  createExitStrategyInput,
  createExitStrategyScenario,
  createResidentialIncomeOperatingCase,
  evidenceAwareValuesForCase,
  collectOperatingCaseEvidenceRefs,
};
