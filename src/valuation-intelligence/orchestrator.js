'use strict';

const {
  VALUATION_METHOD,
  INDICATION_STATUS,
} = require('./contracts');
const {
  METHOD_APPLICABILITY,
  planValuationMethods,
} = require('./planner');
const {
  RECONCILIATION_STATUS,
  reconcileValuationIndications,
} = require('./reconciliation');
const { calculateMarketComparableIndication } = require('./market-comparables');
const { calculateDirectCapitalization } = require('./income-capitalization');
const { calculateDepreciatedReplacementCost } = require('./cost-approach');
const { calculateResidualLandValue } = require('./residual-approach');
const {
  VALUATION_STAGE_STATUS,
  METHOD_STATE,
  VALUATION_REASON_CODE,
} = require('./reason-codes');

const METHOD_INPUT_REQUIREMENTS = Object.freeze({
  [VALUATION_METHOD.MARKET_COMPARABLE]: Object.freeze([
    'comparables',
    'subjectArea',
    'basis',
    'weightingPolicy',
    'currency',
  ]),
  [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: Object.freeze([
    'effectiveGrossIncome',
    'operatingExpenses',
    'capitalizationRate',
    'expenseTreatment',
    'incomeEvidence',
    'expenseEvidence',
    'capRateEvidence',
    'basis',
    'currency',
  ]),
  [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]: Object.freeze([
    'landValue',
    'directReplacementCost',
    'indirectCosts',
    'depreciationRate',
    'landEvidence',
    'replacementCostEvidence',
    'depreciationEvidence',
    'basis',
    'currency',
  ]),
  [VALUATION_METHOD.RESIDUAL]: Object.freeze([
    'completedAssetValue',
    'developmentCosts',
    'financeCosts',
    'developerProfit',
    'contingency',
    'sellingCosts',
    'developmentYears',
    'discountRate',
    'completedValueEvidence',
    'developmentCostEvidence',
    'discountRateEvidence',
    'basis',
    'currency',
  ]),
});

const METHOD_EXECUTORS = Object.freeze({
  [VALUATION_METHOD.MARKET_COMPARABLE]: calculateMarketComparableIndication,
  [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: calculateDirectCapitalization,
  [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]: calculateDepreciatedReplacementCost,
  [VALUATION_METHOD.RESIDUAL]: calculateResidualLandValue,
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function missingFields(input, requirements) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [...requirements];
  return requirements.filter((field) => !hasOwn(input, field) || input[field] === undefined || input[field] === null);
}

function unavailableMethod(planned, reasonCode, extra = {}) {
  return freeze({
    method: planned.method,
    plannerApplicability: planned.applicability,
    plannerReason: planned.reason,
    state: METHOD_STATE.UNAVAILABLE,
    reasonCode,
    evidenceGaps: [],
    indication: null,
    ...extra,
  });
}

function holdMethod(planned, reasonCode, evidenceGaps = [], extra = {}) {
  return freeze({
    method: planned.method,
    plannerApplicability: planned.applicability,
    plannerReason: planned.reason,
    state: METHOD_STATE.HOLD,
    reasonCode,
    evidenceGaps: [...evidenceGaps],
    indication: null,
    ...extra,
  });
}

function executePlannedMethod(planned, request) {
  if (planned.applicability === METHOD_APPLICABILITY.NOT_APPLICABLE) {
    return unavailableMethod(planned, VALUATION_REASON_CODE.METHOD_NOT_APPLICABLE);
  }

  if (planned.applicability === METHOD_APPLICABILITY.REQUIRES_ASSET_ADAPTER) {
    return unavailableMethod(planned, VALUATION_REASON_CODE.ASSET_ADAPTER_REQUIRED);
  }

  const executor = METHOD_EXECUTORS[planned.method];
  if (!executor) return unavailableMethod(planned, VALUATION_REASON_CODE.ASSET_ADAPTER_REQUIRED);

  const requirements = METHOD_INPUT_REQUIREMENTS[planned.method] || [];
  const input = request.methodInputs[planned.method];
  const gaps = missingFields(input, requirements).map((field) => `${planned.method}.${field}`);
  if (gaps.length > 0) return holdMethod(planned, VALUATION_REASON_CODE.METHOD_INPUTS_REQUIRED, gaps);

  try {
    const indication = executor(input);
    if (!indication || indication.status !== INDICATION_STATUS.QUALIFIED) {
      return holdMethod(planned, VALUATION_REASON_CODE.METHOD_EVIDENCE_CONFLICT, [], { indication: indication || null });
    }
    return freeze({
      method: planned.method,
      plannerApplicability: planned.applicability,
      plannerReason: planned.reason,
      state: METHOD_STATE.AVAILABLE,
      reasonCode: null,
      evidenceGaps: [],
      indication,
    });
  } catch (error) {
    return holdMethod(planned, VALUATION_REASON_CODE.METHOD_INPUT_INVALID, [], {
      errorName: error && error.name ? String(error.name) : 'Error',
      errorMessage: error && error.message ? String(error.message) : 'Unknown valuation engine error',
    });
  }
}

function reconciliationReason(status) {
  switch (status) {
    case RECONCILIATION_STATUS.HOLD_POLICY_REQUIRED:
      return VALUATION_REASON_CODE.RECONCILIATION_POLICY_REQUIRED;
    case RECONCILIATION_STATUS.HOLD_INPUT_METHOD:
      return VALUATION_REASON_CODE.RECONCILIATION_INPUT_METHOD_HOLD;
    case RECONCILIATION_STATUS.HOLD_BASIS_MISMATCH:
      return VALUATION_REASON_CODE.RECONCILIATION_BASIS_MISMATCH;
    case RECONCILIATION_STATUS.HOLD_CURRENCY_MISMATCH:
      return VALUATION_REASON_CODE.RECONCILIATION_CURRENCY_MISMATCH;
    case RECONCILIATION_STATUS.HOLD_DATE_MISMATCH:
      return VALUATION_REASON_CODE.RECONCILIATION_DATE_MISMATCH;
    case RECONCILIATION_STATUS.HOLD_DISPERSION:
      return VALUATION_REASON_CODE.RECONCILIATION_DISPERSION_HOLD;
    default:
      return VALUATION_REASON_CODE.RECONCILIATION_UNKNOWN_HOLD;
  }
}

function reconciliationMethodSetMatches(indications, policy) {
  const expected = indications.map((item) => item.method).sort();
  const actual = Object.keys(policy.methodWeights || {}).sort();
  return expected.length === actual.length && expected.every((method, index) => method === actual[index]);
}

function collectEvidenceRefs(indications) {
  return [...new Set(indications.flatMap((item) => item.evidence || []).map((item) => item.sourceRef).filter(Boolean).map(String))];
}

function baseStage(request, plan, methods, payload) {
  const indications = methods.filter((item) => item.state === METHOD_STATE.AVAILABLE).map((item) => item.indication);
  const evidenceGaps = [...new Set(methods.flatMap((item) => item.evidenceGaps || []))];
  return freeze({
    schemaVersion: 1,
    caseId: request.caseId,
    projectId: request.projectId,
    requiredEvidence: [...plan.requiredEvidence],
    methods,
    evidenceGaps,
    evidenceRefs: collectEvidenceRefs(indications),
    ...payload,
    humanDecisionRequired: true,
    transactionAuthorized: false,
    semantics: 'The valuation stage orchestrates deterministic valuation indications and explicit reconciliation policy. It does not invent missing evidence, silently select method weights, authorize an investment decision, or replace professional valuation review where required.',
  });
}

function orchestrateValuationStage(request) {
  if (!request || typeof request !== 'object') throw new TypeError('valuation request is required');
  if (!request.projectProfile || request.projectProfile.projectId !== request.projectId) throw new Error('VALUATION_STAGE_PROJECT_SCOPE_MISMATCH');

  const plan = planValuationMethods(request.projectProfile);
  const methods = plan.methods.map((planned) => executePlannedMethod(planned, request));
  const available = methods.filter((item) => item.state === METHOD_STATE.AVAILABLE).map((item) => item.indication);
  const holds = methods.filter((item) => item.state === METHOD_STATE.HOLD);

  if (available.length === 0) {
    const status = holds.length > 0
      ? (holds.some((item) => item.reasonCode === VALUATION_REASON_CODE.METHOD_EVIDENCE_CONFLICT)
        ? VALUATION_STAGE_STATUS.HOLD_EVIDENCE
        : VALUATION_STAGE_STATUS.HOLD_INPUTS)
      : VALUATION_STAGE_STATUS.UNAVAILABLE;
    return baseStage(request, plan, methods, {
      status,
      reasonCodes: [VALUATION_REASON_CODE.NO_QUALIFIED_VALUATION_METHOD],
      readyForDecisionControl: false,
      reconciliation: null,
      finalValue: null,
    });
  }

  if (available.length === 1) {
    return baseStage(request, plan, methods, {
      status: VALUATION_STAGE_STATUS.HOLD_POLICY,
      reasonCodes: [VALUATION_REASON_CODE.SINGLE_METHOD_ACCEPTANCE_POLICY_REQUIRED],
      readyForDecisionControl: false,
      reconciliation: null,
      finalValue: null,
    });
  }

  const policy = request.reconciliationPolicy;
  if (!policy) {
    return baseStage(request, plan, methods, {
      status: VALUATION_STAGE_STATUS.HOLD_POLICY,
      reasonCodes: [VALUATION_REASON_CODE.RECONCILIATION_POLICY_REQUIRED],
      readyForDecisionControl: false,
      reconciliation: null,
      finalValue: null,
    });
  }

  if (!reconciliationMethodSetMatches(available, policy)) {
    return baseStage(request, plan, methods, {
      status: VALUATION_STAGE_STATUS.HOLD_POLICY,
      reasonCodes: [VALUATION_REASON_CODE.RECONCILIATION_METHOD_SET_MISMATCH],
      readyForDecisionControl: false,
      reconciliation: null,
      finalValue: null,
    });
  }

  let reconciliation;
  try {
    reconciliation = reconcileValuationIndications({
      indications: available,
      methodWeights: policy.methodWeights,
      dispersionThreshold: policy.dispersionThreshold,
    });
  } catch (error) {
    return baseStage(request, plan, methods, {
      status: VALUATION_STAGE_STATUS.HOLD_POLICY,
      reasonCodes: [VALUATION_REASON_CODE.RECONCILIATION_POLICY_REQUIRED],
      readyForDecisionControl: false,
      reconciliation: null,
      finalValue: null,
      reconciliationError: {
        name: error && error.name ? String(error.name) : 'Error',
        message: error && error.message ? String(error.message) : 'Unknown reconciliation error',
      },
    });
  }

  if (reconciliation.status !== RECONCILIATION_STATUS.QUALIFIED) {
    const reasonCode = reconciliationReason(reconciliation.status);
    const status = reconciliation.status === RECONCILIATION_STATUS.HOLD_DISPERSION
      ? VALUATION_STAGE_STATUS.HOLD_EVIDENCE
      : VALUATION_STAGE_STATUS.HOLD_POLICY;
    return baseStage(request, plan, methods, {
      status,
      reasonCodes: [reasonCode],
      readyForDecisionControl: false,
      reconciliation,
      finalValue: null,
    });
  }

  return baseStage(request, plan, methods, {
    status: VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL,
    reasonCodes: [],
    readyForDecisionControl: true,
    reconciliation,
    finalValue: reconciliation.reconciledValue,
  });
}

module.exports = {
  METHOD_INPUT_REQUIREMENTS,
  orchestrateValuationStage,
};
