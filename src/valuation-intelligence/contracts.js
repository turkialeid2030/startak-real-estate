'use strict';

const BASIS_OF_VALUE = Object.freeze({
  MARKET_VALUE: 'MARKET_VALUE',
  FAIR_VALUE: 'FAIR_VALUE',
  MARKET_RENT: 'MARKET_RENT',
  INVESTMENT_VALUE: 'INVESTMENT_VALUE',
  RESIDUAL_LAND_VALUE: 'RESIDUAL_LAND_VALUE',
  OTHER: 'OTHER',
});

const VALUATION_METHOD = Object.freeze({
  MARKET_COMPARABLE: 'MARKET_COMPARABLE',
  INCOME_DIRECT_CAPITALIZATION: 'INCOME_DIRECT_CAPITALIZATION',
  INCOME_DCF: 'INCOME_DCF',
  INCOME_OPERATING_BUSINESS: 'INCOME_OPERATING_BUSINESS',
  COST_DEPRECIATED_REPLACEMENT: 'COST_DEPRECIATED_REPLACEMENT',
  RESIDUAL: 'RESIDUAL',
});

const EVIDENCE_GRADE = Object.freeze({
  A_VERIFIED_OFFICIAL: 'A_VERIFIED_OFFICIAL',
  B_VERIFIED_TRANSACTION: 'B_VERIFIED_TRANSACTION',
  C_CONTRACTUAL: 'C_CONTRACTUAL',
  D_OPERATING_ACTUAL: 'D_OPERATING_ACTUAL',
  E_MARKET_OBSERVATION: 'E_MARKET_OBSERVATION',
  F_THIRD_PARTY_APPRAISAL: 'F_THIRD_PARTY_APPRAISAL',
  G_EXPERT_ASSUMPTION: 'G_EXPERT_ASSUMPTION',
  H_CLIENT_SUPPLIED_UNVERIFIED: 'H_CLIENT_SUPPLIED_UNVERIFIED',
});

const EVIDENCE_GRADE_ORDER = Object.freeze([
  EVIDENCE_GRADE.A_VERIFIED_OFFICIAL,
  EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
  EVIDENCE_GRADE.C_CONTRACTUAL,
  EVIDENCE_GRADE.D_OPERATING_ACTUAL,
  EVIDENCE_GRADE.E_MARKET_OBSERVATION,
  EVIDENCE_GRADE.F_THIRD_PARTY_APPRAISAL,
  EVIDENCE_GRADE.G_EXPERT_ASSUMPTION,
  EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED,
]);

const INPUT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  OBSERVED: 'OBSERVED',
  ASSUMED: 'ASSUMED',
  UNVERIFIED: 'UNVERIFIED',
  CONFLICT: 'CONFLICT',
});

const INDICATION_STATUS = Object.freeze({
  QUALIFIED: 'QUALIFIED',
  HOLD_EVIDENCE_CONFLICT: 'HOLD_EVIDENCE_CONFLICT',
  HOLD_INPUTS: 'HOLD_INPUTS',
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

function finiteNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`);
  return value;
}

function enumValue(value, enumeration, field) {
  if (!Object.values(enumeration).includes(value)) throw new TypeError(`${field} is invalid: ${value}`);
  return value;
}

function createEvidenceRecord({
  field,
  grade,
  status,
  sourceType,
  sourceRef = null,
  observedAt = null,
  note = null,
}) {
  requiredString(field, 'field');
  enumValue(grade, EVIDENCE_GRADE, 'grade');
  enumValue(status, INPUT_STATUS, 'status');
  requiredString(sourceType, 'sourceType');
  if (sourceRef !== null) requiredString(sourceRef, 'sourceRef');
  if (observedAt !== null) requiredString(observedAt, 'observedAt');
  if (note !== null && typeof note !== 'string') throw new TypeError('note must be a string or null');

  return deepFreeze({
    field: field.trim(),
    grade,
    status,
    sourceType: sourceType.trim(),
    sourceRef: sourceRef ? sourceRef.trim() : null,
    observedAt: observedAt ? observedAt.trim() : null,
    note: note ? note.trim() : null,
  });
}

function weakestEvidenceGrade(evidence = []) {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  let weakestIndex = -1;
  for (const item of evidence) {
    const index = EVIDENCE_GRADE_ORDER.indexOf(item.grade);
    if (index < 0) throw new TypeError(`unknown evidence grade: ${item.grade}`);
    weakestIndex = Math.max(weakestIndex, index);
  }
  return EVIDENCE_GRADE_ORDER[weakestIndex];
}

function createValuationIndication({
  method,
  basis,
  value,
  currency = 'SAR',
  valuationDate = null,
  evidence = [],
  assumptions = [],
  warnings = [],
  components = {},
}) {
  enumValue(method, VALUATION_METHOD, 'method');
  enumValue(basis, BASIS_OF_VALUE, 'basis');
  finiteNumber(value, 'value');
  requiredString(currency, 'currency');
  if (valuationDate !== null) requiredString(valuationDate, 'valuationDate');
  if (!Array.isArray(evidence)) throw new TypeError('evidence must be an array');
  if (!Array.isArray(assumptions)) throw new TypeError('assumptions must be an array');
  if (!Array.isArray(warnings)) throw new TypeError('warnings must be an array');
  if (!components || typeof components !== 'object' || Array.isArray(components)) throw new TypeError('components must be an object');

  const hasConflict = evidence.some((item) => item.status === INPUT_STATUS.CONFLICT);
  const status = hasConflict ? INDICATION_STATUS.HOLD_EVIDENCE_CONFLICT : INDICATION_STATUS.QUALIFIED;

  return deepFreeze({
    schemaVersion: 1,
    method,
    basis,
    value,
    currency: currency.trim(),
    valuationDate: valuationDate ? valuationDate.trim() : null,
    status,
    weakestEvidenceGrade: weakestEvidenceGrade(evidence),
    evidence: [...evidence],
    assumptions: assumptions.map(String),
    warnings: warnings.map(String),
    components: { ...components },
    semantics: 'A valuation indication is not an investment decision and is not automatically a verified fact.',
  });
}

module.exports = {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  EVIDENCE_GRADE_ORDER,
  INPUT_STATUS,
  INDICATION_STATUS,
  createEvidenceRecord,
  createValuationIndication,
  weakestEvidenceGrade,
};
