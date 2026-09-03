'use strict';

const STRATEGIC_EVIDENCE_STATUS = Object.freeze({
  NOT_ASSESSED: 'NOT_ASSESSED',
  COMPLIANT: 'COMPLIANT',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

const STRATEGIC_INPUT_PREFIXES = Object.freeze([
  'lifecycle.',
  'location.',
  'forward.',
  'upside.',
]);

const ADOPTABLE_STATUSES = new Set(['VERIFIED_FACT', 'OBSERVED', 'ASSUMED']);
const SOURCE_LINEAGE_KINDS = new Set([
  'SOURCE_DOCUMENT',
  'EVIDENCE_FACT',
  'HUMAN_VERIFICATION',
  'POLICY',
  'ANALYTICAL_ASSESSMENT',
  'LEGAL_REVIEW',
  'OTHER',
]);
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

function isStrategicField(field) {
  return typeof field === 'string' && STRATEGIC_INPUT_PREFIXES.some((prefix) => field.startsWith(prefix));
}

function buildLineageMap(operatingCase) {
  const map = new Map();
  const records = Array.isArray(operatingCase && operatingCase.evidenceLineage)
    ? operatingCase.evidenceLineage
    : [];
  for (const record of records) {
    if (record && typeof record.refId === 'string' && !map.has(record.refId)) map.set(record.refId, record);
  }
  return map;
}

function groupByField(inputs) {
  const groups = new Map();
  for (const input of inputs) {
    if (!groups.has(input.field)) groups.set(input.field, []);
    groups.get(input.field).push(input);
  }
  return groups;
}

function assessAdoptedInput(input, lineageByRef, asOfDate, duplicate) {
  const issues = [];
  const field = input.field;
  if (duplicate) issues.push({ code: 'STRATEGIC_INPUT_DUPLICATE_FIELD', field });
  if (!ADOPTABLE_STATUSES.has(input.verificationStatus)) {
    issues.push({ code: 'STRATEGIC_INPUT_VERIFICATION_STATUS_INVALID', field, verificationStatus: input.verificationStatus || null });
  }
  if (!finite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    issues.push({ code: 'STRATEGIC_INPUT_CONFIDENCE_INVALID', field });
  }

  const source = input.sourceRef ? lineageByRef.get(input.sourceRef) : null;
  if (!source || !SOURCE_LINEAGE_KINDS.has(source.kind)) {
    issues.push({ code: 'STRATEGIC_SOURCE_LINEAGE_REQUIRED', field, refId: input.sourceRef || null });
  }

  const adoption = input.adoptionDecisionRef ? lineageByRef.get(input.adoptionDecisionRef) : null;
  if (!adoption || adoption.kind !== ADOPTION_LINEAGE_KIND) {
    issues.push({ code: 'STRATEGIC_ADOPTION_LINEAGE_REQUIRED', field, refId: input.adoptionDecisionRef || null });
  }

  for (const refId of Array.isArray(input.lineageRefs) ? input.lineageRefs : []) {
    if (!lineageByRef.has(refId)) {
      issues.push({ code: 'STRATEGIC_LINEAGE_REFERENCE_MISSING', field, refId });
    }
  }

  if (input.effectiveDate) {
    const effectiveTime = new Date(input.effectiveDate).getTime();
    if (!Number.isFinite(effectiveTime)) {
      issues.push({ code: 'STRATEGIC_EFFECTIVE_DATE_INVALID', field });
    } else if (asOfDate) {
      const asOfTime = new Date(asOfDate).getTime();
      if (Number.isFinite(asOfTime) && effectiveTime > asOfTime) {
        issues.push({ code: 'STRATEGIC_FUTURE_EFFECTIVE_EVIDENCE', field });
      }
    }
  }

  return {
    field,
    usable: issues.length === 0,
    verificationStatus: input.verificationStatus || null,
    confidence: finite(input.confidence) ? input.confidence : null,
    sourceRef: input.sourceRef || null,
    adoptionDecisionRef: input.adoptionDecisionRef || null,
    issues,
  };
}

function assessStrategicEvidenceGovernance(operatingCase) {
  if (!operatingCase || typeof operatingCase !== 'object') throw new TypeError('operatingCase must be an object');
  const inputs = (Array.isArray(operatingCase.additionalOperatingInputs) ? operatingCase.additionalOperatingInputs : [])
    .filter((input) => input && isStrategicField(input.field));
  if (!inputs.length) {
    return deepFreeze({
      schemaVersion: 1,
      caseId: operatingCase.caseId || null,
      asOfDate: operatingCase.asOfDate || null,
      status: STRATEGIC_EVIDENCE_STATUS.NOT_ASSESSED,
      strategicInputCount: 0,
      adoptedInputCount: 0,
      usableAdoptedInputCount: 0,
      evidenceCoverage: 0,
      invalidInputFields: [],
      assessments: [],
      issues: [{ code: 'STRATEGIC_EVIDENCE_NOT_ASSESSED', field: 'lifecycle.|location.|forward.|upside.*' }],
      automaticFinancializationAllowed: false,
      legalConclusion: null,
      investmentRecommendation: null,
      semantics: 'No strategic operating inputs were supplied. No lifecycle, location, forward-attraction, or upside signal may be treated as evidence-governed.',
    });
  }

  const adoptedInputs = inputs.filter((input) => input.adoptedForUnderwriting === true);
  const lineageByRef = buildLineageMap(operatingCase);
  const groups = groupByField(inputs);
  const assessments = adoptedInputs.map((input) => assessAdoptedInput(
    input,
    lineageByRef,
    operatingCase.asOfDate || null,
    (groups.get(input.field) || []).length > 1,
  ));
  const issues = assessments.flatMap((assessment) => assessment.issues);
  const usable = assessments.filter((assessment) => assessment.usable);
  const invalidInputFields = [...new Set(assessments.filter((assessment) => !assessment.usable).map((assessment) => assessment.field))];

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId || null,
    asOfDate: operatingCase.asOfDate || null,
    status: issues.length === 0 && adoptedInputs.length > 0
      ? STRATEGIC_EVIDENCE_STATUS.COMPLIANT
      : STRATEGIC_EVIDENCE_STATUS.REVIEW_REQUIRED,
    strategicInputCount: inputs.length,
    adoptedInputCount: adoptedInputs.length,
    usableAdoptedInputCount: usable.length,
    evidenceCoverage: adoptedInputs.length > 0 ? usable.length / adoptedInputs.length : 0,
    invalidInputFields,
    assessments,
    issues,
    automaticFinancializationAllowed: false,
    legalConclusion: null,
    investmentRecommendation: null,
    semantics: 'Only adopted strategic inputs with valid source lineage, explicit underwriting-adoption lineage, valid confidence, non-future effective dates, and no duplicate field can enter the strategic analytical engines. Invalid inputs fail closed and contribute no score or modeled upside.',
  });
}

function createEvidenceGovernedStrategicCase(operatingCase, governance = assessStrategicEvidenceGovernance(operatingCase)) {
  const invalid = new Set(governance.invalidInputFields || []);
  if (!invalid.size) return operatingCase;
  return {
    ...operatingCase,
    additionalOperatingInputs: (operatingCase.additionalOperatingInputs || []).map((input) => (
      input && invalid.has(input.field)
        ? { ...input, adoptedForUnderwriting: false }
        : input
    )),
  };
}

module.exports = {
  STRATEGIC_EVIDENCE_STATUS,
  STRATEGIC_INPUT_PREFIXES,
  assessStrategicEvidenceGovernance,
  createEvidenceGovernedStrategicCase,
};
