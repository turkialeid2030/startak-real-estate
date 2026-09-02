'use strict';

const {
  OPERATING_INPUT_STATUS,
  LINEAGE_KIND,
  LOCATION_FACTOR_HORIZON,
  UPSIDE_CATALYST_STATUS,
  SUBDIVISION_CHECK_TYPE,
  SUBDIVISION_CHECK_OUTCOME,
  deepFreeze,
} = require('./contracts');

const STRATEGIC_ASSET_INTELLIGENCE_STATUS = Object.freeze({
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_ASSUMPTIONS: 'CALCULATED_WITH_ASSUMPTIONS',
});

const SUBDIVISION_ASSESSMENT_STATUS = Object.freeze({
  NOT_ASSESSED: 'NOT_ASSESSED',
  DUE_DILIGENCE_REQUIRED: 'DUE_DILIGENCE_REQUIRED',
  FEASIBLE_FOR_SCENARIO_TESTING: 'FEASIBLE_FOR_SCENARIO_TESTING',
  NOT_FEASIBLE: 'NOT_FEASIBLE',
});

const REQUIRED_SUBDIVISION_CHECK_TYPES = Object.freeze(Object.values(SUBDIVISION_CHECK_TYPE));
const ADOPTABLE_STATUSES = new Set([OPERATING_INPUT_STATUS.VERIFIED_FACT, OPERATING_INPUT_STATUS.ASSUMED]);
const SOURCE_KINDS = new Set([
  LINEAGE_KIND.SOURCE_DOCUMENT,
  LINEAGE_KIND.EVIDENCE_FACT,
  LINEAGE_KIND.HUMAN_VERIFICATION,
  LINEAGE_KIND.POLICY,
  LINEAGE_KIND.ANALYTICAL_ASSESSMENT,
  LINEAGE_KIND.LEGAL_REVIEW,
  LINEAGE_KIND.OTHER,
]);

function addIssue(issues, code, field, refId = null) {
  if (!issues.some((item) => item.code === code && item.field === field && item.refId === refId)) {
    issues.push({ code, field, refId });
  }
}

function allStrategicInputs(profile) {
  const values = [profile.lifecycleAssessment.classification];
  for (const factor of profile.locationFactors) values.push(factor.score, factor.weight);
  for (const catalyst of profile.upsideCatalysts) {
    values.push(catalyst.assessmentStatus, catalyst.impactScore, catalyst.executionReadinessScore);
  }
  for (const check of profile.subdivisionChecks) values.push(check.outcome);
  return values;
}

function profileEvidenceRefs(profile) {
  const refs = [
    ...(profile.evidenceRefs || []),
    ...(profile.lifecycleAssessment.evidenceRefs || []),
  ];
  for (const factor of profile.locationFactors) refs.push(...(factor.evidenceRefs || []));
  for (const catalyst of profile.upsideCatalysts) refs.push(...(catalyst.evidenceRefs || []));
  for (const check of profile.subdivisionChecks) refs.push(...(check.evidenceRefs || []));
  for (const input of allStrategicInputs(profile)) refs.push(...(input.lineageRefs || []));
  return [...new Set(refs.filter(Boolean))];
}

function validateLineage(input, lineageByRef, issues) {
  for (const refId of input.lineageRefs || []) {
    if (!lineageByRef.has(refId)) addIssue(issues, 'STRATEGIC_EVIDENCE_LINEAGE_REFERENCE_MISSING', input.field, refId);
  }
  if (input.sourceRef) {
    const source = lineageByRef.get(input.sourceRef);
    if (source && !SOURCE_KINDS.has(source.kind)) addIssue(issues, 'INVALID_STRATEGIC_SOURCE_LINEAGE_KIND', input.field, input.sourceRef);
  }
  if (input.adoptionDecisionRef) {
    const adoption = lineageByRef.get(input.adoptionDecisionRef);
    if (adoption && adoption.kind !== LINEAGE_KIND.UNDERWRITING_ADOPTION) {
      addIssue(issues, 'INVALID_STRATEGIC_ADOPTION_LINEAGE_KIND', input.field, input.adoptionDecisionRef);
    }
  }
  if (input.assumptionOverride) {
    const approver = lineageByRef.get(input.assumptionOverride.approvedByRef);
    if (approver && approver.kind !== LINEAGE_KIND.HUMAN_IDENTITY) {
      addIssue(issues, 'INVALID_STRATEGIC_ASSUMPTION_APPROVER_LINEAGE_KIND', input.field, input.assumptionOverride.approvedByRef);
    }
    if (input.assumptionOverride.policyRef) {
      const policy = lineageByRef.get(input.assumptionOverride.policyRef);
      if (policy && policy.kind !== LINEAGE_KIND.POLICY) {
        addIssue(issues, 'INVALID_STRATEGIC_ASSUMPTION_POLICY_LINEAGE_KIND', input.field, input.assumptionOverride.policyRef);
      }
    }
  }
}

function validateInput(input, operatingCase, issues, assumptions, {
  allowUnavailable = false,
  unit,
  valueValidator = () => true,
} = {}) {
  const lineageByRef = new Map(operatingCase.evidenceLineage.map((item) => [item.refId, item]));
  validateLineage(input, lineageByRef, issues);
  if (unit !== undefined && input.unit !== unit) addIssue(issues, 'STRATEGIC_INPUT_UNIT_MISMATCH', input.field, input.sourceRef);
  if (input.effectiveDate && new Date(input.effectiveDate).getTime() > new Date(operatingCase.asOfDate).getTime()) {
    addIssue(issues, 'FUTURE_EFFECTIVE_STRATEGIC_INPUT', input.field, input.sourceRef);
  }
  if (allowUnavailable && input.verificationStatus === OPERATING_INPUT_STATUS.NOT_AVAILABLE && input.value === null) return false;
  if (!ADOPTABLE_STATUSES.has(input.verificationStatus) || input.adoptedForUnderwriting !== true) {
    addIssue(issues, 'ADOPTED_STRATEGIC_INPUT_REQUIRED', input.field, input.sourceRef);
    return false;
  }
  if (!valueValidator(input.value)) {
    addIssue(issues, 'STRATEGIC_INPUT_VALUE_INVALID', input.field, input.sourceRef);
    return false;
  }
  if (input.verificationStatus === OPERATING_INPUT_STATUS.ASSUMED) {
    assumptions.push({ field: input.field, reason: input.assumptionOverride.reason, approvedByRef: input.assumptionOverride.approvedByRef });
  }
  return true;
}

function validateLocationFactors(profile, operatingCase, issues, assumptions) {
  const result = {};
  for (const horizon of Object.values(LOCATION_FACTOR_HORIZON)) {
    const factors = profile.locationFactors.filter((item) => item.horizon === horizon);
    if (factors.length === 0) {
      addIssue(issues, 'LOCATION_FACTOR_REQUIRED', `strategic.location.${horizon.toLowerCase()}`);
      continue;
    }
    let allValid = true;
    let weightTotal = 0;
    let weightedScore = 0;
    for (const factor of factors) {
      const scoreValid = validateInput(factor.score, operatingCase, issues, assumptions, {
        unit: 'score_0_100',
        valueValidator: (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
      });
      const weightValid = validateInput(factor.weight, operatingCase, issues, assumptions, {
        unit: 'ratio',
        valueValidator: (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1,
      });
      const weightSource = new Map(operatingCase.evidenceLineage.map((item) => [item.refId, item])).get(factor.weight.sourceRef);
      const policyValid = Boolean(weightSource && weightSource.kind === LINEAGE_KIND.POLICY);
      if (!policyValid) addIssue(issues, 'LOCATION_FACTOR_WEIGHT_POLICY_REQUIRED', factor.weight.field, factor.weight.sourceRef);
      allValid = scoreValid && weightValid && policyValid && allValid;
      if (scoreValid && weightValid) {
        weightTotal += factor.weight.value;
        weightedScore += factor.score.value * factor.weight.value;
      }
    }
    if (allValid && Math.abs(weightTotal - 1) > 1e-9) {
      addIssue(issues, 'LOCATION_FACTOR_WEIGHTS_MUST_SUM_TO_ONE', `strategic.location.${horizon.toLowerCase()}.weights`);
      allValid = false;
    }
    if (allValid) {
      result[horizon] = {
        score: weightedScore,
        factorCount: factors.length,
        weightTotal,
        factors: factors.map((factor) => ({
          factorId: factor.factorId,
          dimension: factor.dimension,
          score: factor.score.value,
          weight: factor.weight.value,
          weightedContribution: factor.score.value * factor.weight.value,
        })),
      };
    }
  }
  return result;
}

function assessSubdivision(profile, operatingCase, issues, assumptions) {
  const checks = profile.subdivisionChecks;
  if (checks.length === 0) {
    return {
      status: SUBDIVISION_ASSESSMENT_STATUS.NOT_ASSESSED,
      scenarioTestingEligible: false,
      passCount: 0,
      failCount: 0,
      unavailableCount: 0,
      missingCheckTypes: [...REQUIRED_SUBDIVISION_CHECK_TYPES],
      note: 'Subdivision has not been assessed and contributes no financial upside.',
    };
  }
  const byType = new Map(checks.map((item) => [item.checkType, item]));
  const missingCheckTypes = REQUIRED_SUBDIVISION_CHECK_TYPES.filter((type) => !byType.has(type));
  for (const type of missingCheckTypes) addIssue(issues, 'SUBDIVISION_CHECK_REQUIRED', `strategic.subdivision.${type}`);
  let passCount = 0;
  let failCount = 0;
  let unavailableCount = 0;
  let nonMandatoryCount = 0;
  for (const check of checks) {
    if (check.mandatory !== true) {
      nonMandatoryCount += 1;
      addIssue(issues, 'SUBDIVISION_MANDATORY_CHECK_REQUIRED', `strategic.subdivision.${check.checkType}`);
    }
    const valid = validateInput(check.outcome, operatingCase, issues, assumptions, {
      allowUnavailable: true,
      unit: null,
      valueValidator: (value) => Object.values(SUBDIVISION_CHECK_OUTCOME).includes(value),
    });
    if (!valid) unavailableCount += 1;
    else if (check.outcome.value === SUBDIVISION_CHECK_OUTCOME.PASS) passCount += 1;
    else failCount += 1;
  }
  let status = SUBDIVISION_ASSESSMENT_STATUS.DUE_DILIGENCE_REQUIRED;
  if (failCount > 0) status = SUBDIVISION_ASSESSMENT_STATUS.NOT_FEASIBLE;
  else if (missingCheckTypes.length === 0 && unavailableCount === 0 && nonMandatoryCount === 0 && passCount === REQUIRED_SUBDIVISION_CHECK_TYPES.length) {
    status = SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING;
  }
  return {
    status,
    scenarioTestingEligible: status === SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING,
    passCount,
    failCount,
    unavailableCount,
    nonMandatoryCount,
    missingCheckTypes,
    note: status === SUBDIVISION_ASSESSMENT_STATUS.FEASIBLE_FOR_SCENARIO_TESTING
      ? 'All required evidence gates passed for scenario testing only; no authority approval is inferred.'
      : 'Subdivision contributes no financial upside until required evidence gates are complete.',
  };
}

function summarizeCatalysts(profile, operatingCase, issues, assumptions, subdivision) {
  const countsByStatus = Object.fromEntries(Object.values(UPSIDE_CATALYST_STATUS).map((status) => [status, 0]));
  const catalysts = [];
  const subdivisionDependentCatalystIds = [];
  for (const catalyst of profile.upsideCatalysts) {
    const statusValid = validateInput(catalyst.assessmentStatus, operatingCase, issues, assumptions, {
      unit: null,
      valueValidator: (value) => Object.values(UPSIDE_CATALYST_STATUS).includes(value),
    });
    const impactValid = validateInput(catalyst.impactScore, operatingCase, issues, assumptions, {
      unit: 'score_0_100',
      valueValidator: (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
    });
    const readinessValid = validateInput(catalyst.executionReadinessScore, operatingCase, issues, assumptions, {
      unit: 'score_0_100',
      valueValidator: (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100,
    });
    if (!(statusValid && impactValid && readinessValid)) continue;
    countsByStatus[catalyst.assessmentStatus.value] += 1;
    if (catalyst.dependsOnSubdivision && !subdivision.scenarioTestingEligible) subdivisionDependentCatalystIds.push(catalyst.catalystId);
    catalysts.push({
      catalystId: catalyst.catalystId,
      catalystType: catalyst.catalystType,
      status: catalyst.assessmentStatus.value,
      impactScore: catalyst.impactScore.value,
      executionReadinessScore: catalyst.executionReadinessScore.value,
      dependsOnSubdivision: catalyst.dependsOnSubdivision,
      financialValueCalculated: false,
    });
  }
  return {
    total: profile.upsideCatalysts.length,
    evaluatedCount: catalysts.length,
    countsByStatus,
    subdivisionDependentCatalystIds,
    catalysts,
    financialValueCalculated: false,
  };
}

function emptyResult(operatingCase, status, issues = []) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    strategicAssetIntelligenceCalculated: false,
    issues,
    assumptions: [],
    lifecycleClassification: null,
    currentLocation: null,
    forwardAttraction: null,
    forwardScoreDelta: null,
    upsideCatalysts: null,
    subdivision: null,
    financialCalculationExecuted: false,
    financialModelWriteAuthorized: false,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    semantics: 'No strategic score, catalyst, or subdivision conclusion is available for financial use.',
  });
}

function calculateStrategicAssetIntelligence(operatingCase) {
  if (!operatingCase || operatingCase.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new TypeError('operatingCase must be created by createResidentialIncomeOperatingCase');
  }
  const profile = operatingCase.strategicAssetProfile;
  if (!profile) return emptyResult(operatingCase, STRATEGIC_ASSET_INTELLIGENCE_STATUS.NOT_AVAILABLE);

  const issues = [];
  const assumptions = [];
  const lineageByRef = new Map(operatingCase.evidenceLineage.map((item) => [item.refId, item]));
  for (const refId of profileEvidenceRefs(profile)) {
    if (!lineageByRef.has(refId)) addIssue(issues, 'STRATEGIC_EVIDENCE_LINEAGE_REFERENCE_MISSING', 'strategicAssetProfile', refId);
  }
  const lifecycleValid = validateInput(profile.lifecycleAssessment.classification, operatingCase, issues, assumptions, {
    unit: null,
    valueValidator: (value) => typeof value === 'string' && value.length > 0,
  });
  const locations = validateLocationFactors(profile, operatingCase, issues, assumptions);
  const subdivision = assessSubdivision(profile, operatingCase, issues, assumptions);
  const upsideCatalysts = summarizeCatalysts(profile, operatingCase, issues, assumptions, subdivision);

  const blockingIssues = issues.filter((item) => ![
    'SUBDIVISION_CHECK_REQUIRED',
    'SUBDIVISION_MANDATORY_CHECK_REQUIRED',
  ].includes(item.code));
  const coreValid = lifecycleValid
    && locations[LOCATION_FACTOR_HORIZON.CURRENT]
    && locations[LOCATION_FACTOR_HORIZON.FORWARD]
    && blockingIssues.length === 0;
  if (!coreValid) return emptyResult(operatingCase, STRATEGIC_ASSET_INTELLIGENCE_STATUS.NOT_CALCULABLE, issues);

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status: assumptions.length > 0
      ? STRATEGIC_ASSET_INTELLIGENCE_STATUS.CALCULATED_WITH_ASSUMPTIONS
      : STRATEGIC_ASSET_INTELLIGENCE_STATUS.CALCULATED,
    strategicAssetIntelligenceCalculated: true,
    issues,
    assumptions,
    lifecycleClassification: profile.lifecycleAssessment.classification.value,
    currentLocation: locations[LOCATION_FACTOR_HORIZON.CURRENT],
    forwardAttraction: locations[LOCATION_FACTOR_HORIZON.FORWARD],
    forwardScoreDelta: locations[LOCATION_FACTOR_HORIZON.FORWARD].score - locations[LOCATION_FACTOR_HORIZON.CURRENT].score,
    upsideCatalysts,
    subdivision,
    financialCalculationExecuted: false,
    financialModelWriteAuthorized: false,
    investmentDecision: null,
    legalConclusion: null,
    transactionAuthorized: false,
    prohibitedClaims: ['CERTIFIED_LOCATION_VALUE', 'GUARANTEED_UPSIDE', 'SUBDIVISION_APPROVED', 'APPROVE_INVESTMENT'],
    semantics: 'Evidence-linked lifecycle, current-location, forward-attraction, catalyst, and subdivision-gate analysis. Scores are analytical assessments, not forecasts; catalysts and subdivision add no financial value unless separately modeled and adopted.',
  });
}

module.exports = {
  STRATEGIC_ASSET_INTELLIGENCE_STATUS,
  SUBDIVISION_ASSESSMENT_STATUS,
  REQUIRED_SUBDIVISION_CHECK_TYPES,
  calculateStrategicAssetIntelligence,
};
