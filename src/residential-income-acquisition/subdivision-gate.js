'use strict';

const SUBDIVISION_CHECK_TYPE = Object.freeze({
  ZONING_PERMISSION: 'ZONING_PERMISSION',
  TITLE_AND_WAQF_RESTRICTIONS: 'TITLE_AND_WAQF_RESTRICTIONS',
  MUNICIPAL_APPROVAL_PATH: 'MUNICIPAL_APPROVAL_PATH',
  BUILDING_CODE: 'BUILDING_CODE',
  FIRE_LIFE_SAFETY: 'FIRE_LIFE_SAFETY',
  STRUCTURAL_FEASIBILITY: 'STRUCTURAL_FEASIBILITY',
  INDEPENDENT_ACCESS: 'INDEPENDENT_ACCESS',
  UTILITY_SEPARATION: 'UTILITY_SEPARATION',
  PARKING_COMPLIANCE: 'PARKING_COMPLIANCE',
  MINIMUM_UNIT_AREA: 'MINIMUM_UNIT_AREA',
  SURVEY_AND_UNITIZATION: 'SURVEY_AND_UNITIZATION',
});

const SUBDIVISION_CHECK_OUTCOME = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
});

const SUBDIVISION_ASSESSMENT_STATUS = Object.freeze({
  NOT_ASSESSED: 'NOT_ASSESSED',
  DUE_DILIGENCE_REQUIRED: 'DUE_DILIGENCE_REQUIRED',
  FEASIBLE_FOR_SCENARIO_TESTING: 'FEASIBLE_FOR_SCENARIO_TESTING',
  NOT_FEASIBLE: 'NOT_FEASIBLE',
});

const REQUIRED_SUBDIVISION_CHECK_TYPES = Object.freeze(Object.values(SUBDIVISION_CHECK_TYPE));
const VERIFIED_STATUS = 'VERIFIED_FACT';
const ADOPTION_LINEAGE_KIND = 'UNDERWRITING_ADOPTION';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function projectedLineage(input) {
  if (!input) return null;
  return {
    field: input.field || null,
    sourceRef: input.sourceRef || null,
    verificationStatus: input.verificationStatus || null,
    confidence: finite(input.confidence) ? input.confidence : null,
    effectiveDate: input.effectiveDate || null,
    adoptionDecisionRef: input.adoptionDecisionRef || null,
    lineageRefs: Array.isArray(input.lineageRefs) ? [...input.lineageRefs] : [],
  };
}

function inputMap(operatingCase) {
  const map = new Map();
  const inputs = Array.isArray(operatingCase && operatingCase.additionalOperatingInputs)
    ? operatingCase.additionalOperatingInputs
    : [];
  for (const input of inputs) {
    if (input && typeof input.field === 'string' && !map.has(input.field)) map.set(input.field, input);
  }
  return map;
}

function lineageMap(operatingCase) {
  const map = new Map();
  const lineage = Array.isArray(operatingCase && operatingCase.evidenceLineage)
    ? operatingCase.evidenceLineage
    : [];
  for (const record of lineage) {
    if (record && typeof record.refId === 'string') map.set(record.refId, record);
  }
  return map;
}

function checkField(checkType) {
  return `subdivision.check.${checkType}.outcome`;
}

function assessCheck(checkType, input, lineageByRef, asOfDate) {
  const field = checkField(checkType);
  const issues = [];

  if (!input) {
    return {
      checkType,
      field,
      usable: false,
      outcome: null,
      status: 'MISSING',
      issues: [{ code: 'SUBDIVISION_CHECK_REQUIRED', field, checkType }],
      lineage: null,
    };
  }

  if (input.field !== field) issues.push({ code: 'SUBDIVISION_CHECK_FIELD_MISMATCH', field, checkType });
  if (!Object.values(SUBDIVISION_CHECK_OUTCOME).includes(input.value)) {
    issues.push({ code: 'SUBDIVISION_CHECK_OUTCOME_INVALID', field, checkType });
  }

  // A legal/technical subdivision gate must not become PASS on an assumption,
  // observation, unresolved conflict, or unavailable evidence. Verified facts only.
  if (input.verificationStatus !== VERIFIED_STATUS) {
    issues.push({ code: 'SUBDIVISION_VERIFIED_FACT_REQUIRED', field, checkType, verificationStatus: input.verificationStatus || null });
  }
  if (input.adoptedForUnderwriting !== true) {
    issues.push({ code: 'SUBDIVISION_CHECK_ADOPTION_REQUIRED', field, checkType });
  }

  const sourceRef = input.sourceRef || null;
  if (!sourceRef || !lineageByRef.has(sourceRef)) {
    issues.push({ code: 'SUBDIVISION_SOURCE_LINEAGE_REQUIRED', field, checkType, refId: sourceRef });
  }

  const adoptionRef = input.adoptionDecisionRef || null;
  const adoptionRecord = adoptionRef ? lineageByRef.get(adoptionRef) : null;
  if (!adoptionRecord || adoptionRecord.kind !== ADOPTION_LINEAGE_KIND) {
    issues.push({ code: 'SUBDIVISION_ADOPTION_LINEAGE_REQUIRED', field, checkType, refId: adoptionRef });
  }

  for (const refId of Array.isArray(input.lineageRefs) ? input.lineageRefs : []) {
    if (!lineageByRef.has(refId)) {
      issues.push({ code: 'SUBDIVISION_LINEAGE_REFERENCE_MISSING', field, checkType, refId });
    }
  }

  if (input.effectiveDate && asOfDate) {
    const effectiveTime = new Date(input.effectiveDate).getTime();
    const asOfTime = new Date(asOfDate).getTime();
    if (Number.isFinite(effectiveTime) && Number.isFinite(asOfTime) && effectiveTime > asOfTime) {
      issues.push({ code: 'SUBDIVISION_FUTURE_EFFECTIVE_EVIDENCE', field, checkType });
    }
  }

  const usable = issues.length === 0;
  return {
    checkType,
    field,
    usable,
    outcome: usable ? input.value : null,
    rawOutcome: Object.values(SUBDIVISION_CHECK_OUTCOME).includes(input.value) ? input.value : null,
    status: usable ? input.value : 'DUE_DILIGENCE_REQUIRED',
    issues,
    lineage: projectedLineage(input),
  };
}

function emptyResult(operatingCase) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase && operatingCase.caseId || null,
    asOfDate: operatingCase && operatingCase.asOfDate || null,
    status: SUBDIVISION_ASSESSMENT_STATUS.NOT_ASSESSED,
    scenarioTestingEligible: false,
    checkCount: REQUIRED_SUBDIVISION_CHECK_TYPES.length,
    verifiedCheckCount: 0,
    passCount: 0,
    failCount: 0,
    missingCount: REQUIRED_SUBDIVISION_CHECK_TYPES.length,
    evidenceCoverage: 0,
    missingCheckTypes: [...REQUIRED_SUBDIVISION_CHECK_TYPES],
    failedCheckTypes: [],
    dueDiligenceCheckTypes: [...REQUIRED_SUBDIVISION_CHECK_TYPES],
    checks: [],
    issues: [{ code: 'SUBDIVISION_DUE_DILIGENCE_NOT_ASSESSED', field: 'subdivision.check.*.outcome' }],
    legalConclusion: null,
    authorityApprovalInferred: false,
    automaticFinancializationAllowed: false,
    investmentRecommendation: null,
    transactionAuthorized: false,
    semantics: 'Subdivision has not been assessed. No subdivision upside may be financialized or treated as legally/technically feasible.',
  });
}

function calculateSubdivisionDueDiligenceGate(operatingCase) {
  if (!operatingCase || typeof operatingCase !== 'object') throw new TypeError('operatingCase must be an object');

  const inputs = inputMap(operatingCase);
  const anySubdivisionInput = REQUIRED_SUBDIVISION_CHECK_TYPES.some((checkType) => inputs.has(checkField(checkType)));
  if (!anySubdivisionInput) return emptyResult(operatingCase);

  const lineageByRef = lineageMap(operatingCase);
  const checks = REQUIRED_SUBDIVISION_CHECK_TYPES.map((checkType) => (
    assessCheck(checkType, inputs.get(checkField(checkType)), lineageByRef, operatingCase.asOfDate)
  ));
  const issues = checks.flatMap((check) => check.issues);
  const verifiedChecks = checks.filter((check) => check.usable);
  const passed = verifiedChecks.filter((check) => check.outcome === SUBDIVISION_CHECK_OUTCOME.PASS);
  const failed = verifiedChecks.filter((check) => check.outcome === SUBDIVISION_CHECK_OUTCOME.FAIL);
  const missing = checks.filter((check) => check.status === 'MISSING');
  const dueDiligence = checks.filter((check) => !check.usable);

  let status = SUBDIVISION_ASSESSMENT_STATUS.DUE_DILIGENCE_REQUIRED;
  if (failed.length > 0) {
    status = SUBDIVISION_ASSESSMENT_STATUS.NOT_FEASIBLE;
  } else if (passed.length === REQUIRED_SUBDIVISION_CHECK_TYPES.length && issues.length === 0) {
    status = SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING;
  }

  const scenarioTestingEligible = status === SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING;
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId || null,
    asOfDate: operatingCase.asOfDate || null,
    status,
    scenarioTestingEligible,
    checkCount: REQUIRED_SUBDIVISION_CHECK_TYPES.length,
    verifiedCheckCount: verifiedChecks.length,
    passCount: passed.length,
    failCount: failed.length,
    missingCount: missing.length,
    evidenceCoverage: verifiedChecks.length / REQUIRED_SUBDIVISION_CHECK_TYPES.length,
    missingCheckTypes: missing.map((check) => check.checkType),
    failedCheckTypes: failed.map((check) => check.checkType),
    dueDiligenceCheckTypes: dueDiligence.map((check) => check.checkType),
    checks,
    issues,
    legalConclusion: null,
    authorityApprovalInferred: false,
    automaticFinancializationAllowed: false,
    investmentRecommendation: null,
    transactionAuthorized: false,
    semantics: scenarioTestingEligible
      ? 'All eleven mandatory evidence gates passed with adopted VERIFIED_FACT inputs. This permits explicit scenario testing only; it is not an authority approval, legal opinion, engineering certification, or automatic financial adjustment.'
      : status === SUBDIVISION_ASSESSMENT_STATUS.NOT_FEASIBLE
        ? 'At least one verified mandatory subdivision gate failed. Subdivision-dependent scenarios are not eligible unless the failed condition is lawfully and technically resolved with new verified evidence.'
        : 'Subdivision due diligence is incomplete. Missing, assumed, observed, conflicting, unadopted, future-effective, or lineage-deficient evidence cannot satisfy the gate and contributes no automatic financial upside.',
  });
}

module.exports = {
  SUBDIVISION_CHECK_TYPE,
  SUBDIVISION_CHECK_OUTCOME,
  SUBDIVISION_ASSESSMENT_STATUS,
  REQUIRED_SUBDIVISION_CHECK_TYPES,
  calculateSubdivisionDueDiligenceGate,
};
