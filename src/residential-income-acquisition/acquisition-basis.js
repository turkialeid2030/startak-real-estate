'use strict';

const {
  OPERATING_INPUT_STATUS,
  deepFreeze,
  createEvidenceAwareValue,
} = require('./contracts');
const { OPERATING_UNDERWRITING_STATUS, assessOperatingUnderwritingReadiness } = require('./readiness');
const { calculateOperatingMetrics } = require('./operating-metrics');
const { PROPERTY_COST_STATUS, calculatePropertyCosts } = require('./property-costs');

const ACQUISITION_BASIS_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  CALCULATED_WITH_ASSUMPTIONS: 'CALCULATED_WITH_ASSUMPTIONS',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
});

const ACQUISITION_BASIS_INPUT_TYPE = Object.freeze({
  PURCHASE_PRICE: 'PURCHASE_PRICE',
  TRANSACTION_COSTS: 'TRANSACTION_COSTS',
  INITIAL_TENANT_IMPROVEMENTS: 'INITIAL_TENANT_IMPROVEMENTS',
  INITIAL_LEASING_COSTS: 'INITIAL_LEASING_COSTS',
  INITIAL_RESERVES: 'INITIAL_RESERVES',
  INITIAL_DEBT_PROCEEDS: 'INITIAL_DEBT_PROCEEDS',
});

const ACQUISITION_BASIS_INPUT_DEFINITION = Object.freeze({
  [ACQUISITION_BASIS_INPUT_TYPE.PURCHASE_PRICE]: Object.freeze({ field: 'acquisition.purchasePrice', unit: 'SAR' }),
  [ACQUISITION_BASIS_INPUT_TYPE.TRANSACTION_COSTS]: Object.freeze({ field: 'acquisition.transactionCosts', unit: 'SAR' }),
  [ACQUISITION_BASIS_INPUT_TYPE.INITIAL_TENANT_IMPROVEMENTS]: Object.freeze({ field: 'acquisition.initialTenantImprovements', unit: 'SAR' }),
  [ACQUISITION_BASIS_INPUT_TYPE.INITIAL_LEASING_COSTS]: Object.freeze({ field: 'acquisition.initialLeasingCosts', unit: 'SAR' }),
  [ACQUISITION_BASIS_INPUT_TYPE.INITIAL_RESERVES]: Object.freeze({ field: 'acquisition.initialReserves', unit: 'SAR' }),
  [ACQUISITION_BASIS_INPUT_TYPE.INITIAL_DEBT_PROCEEDS]: Object.freeze({ field: 'acquisition.initialDebtProceeds', unit: 'SAR' }),
});

const ADOPTABLE_STATUSES = new Set([
  OPERATING_INPUT_STATUS.VERIFIED_FACT,
  OPERATING_INPUT_STATUS.ASSUMED,
]);

function createAcquisitionBasisInput({
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
  const definition = ACQUISITION_BASIS_INPUT_DEFINITION[type];
  if (!definition) throw new TypeError(`type is invalid: ${type}`);
  return createEvidenceAwareValue({
    field: definition.field,
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

function addIssue(issues, code, field, refId = null) {
  if (!issues.some((item) => item.code === code && item.field === field && item.refId === refId)) {
    issues.push({ code, field, refId });
  }
}

function adoptedFiniteNumber(input) {
  return Boolean(
    input
    && input.adoptedForUnderwriting === true
    && ADOPTABLE_STATUSES.has(input.verificationStatus)
    && typeof input.value === 'number'
    && Number.isFinite(input.value),
  );
}

function findAndValidateInput(operatingCase, type, asOfDate, issues) {
  const definition = ACQUISITION_BASIS_INPUT_DEFINITION[type];
  const matches = operatingCase.additionalOperatingInputs.filter((input) => input.field === definition.field);
  if (matches.length === 0) {
    addIssue(issues, 'ADOPTED_ACQUISITION_INPUT_REQUIRED', definition.field);
    return null;
  }
  if (matches.length > 1) {
    addIssue(issues, 'DUPLICATE_ACQUISITION_INPUT', definition.field);
    return null;
  }
  const input = matches[0];
  if (input.unit !== definition.unit) {
    addIssue(issues, 'ACQUISITION_INPUT_UNIT_MISMATCH', definition.field, input.sourceRef);
    return null;
  }
  if (!adoptedFiniteNumber(input)) {
    addIssue(
      issues,
      input.verificationStatus === OPERATING_INPUT_STATUS.NOT_AVAILABLE
        ? 'ACQUISITION_INPUT_NOT_AVAILABLE'
        : 'ADOPTED_ACQUISITION_INPUT_REQUIRED',
      definition.field,
      input.sourceRef,
    );
    return null;
  }
  if (input.value < 0) {
    addIssue(issues, 'ACQUISITION_INPUT_MUST_BE_NON_NEGATIVE', definition.field, input.sourceRef);
    return null;
  }
  if (type === ACQUISITION_BASIS_INPUT_TYPE.PURCHASE_PRICE && input.value === 0) {
    addIssue(issues, 'PURCHASE_PRICE_MUST_BE_POSITIVE', definition.field, input.sourceRef);
    return null;
  }
  if (input.effectiveDate && new Date(input.effectiveDate).getTime() > asOfDate.getTime()) {
    addIssue(issues, 'FUTURE_EFFECTIVE_ACQUISITION_INPUT', definition.field, input.sourceRef);
    return null;
  }
  return input;
}

function emptyResult(operatingCase, issues, readinessStatus) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status: ACQUISITION_BASIS_STATUS.NOT_CALCULABLE,
    readinessStatus,
    issues,
    components: null,
    bases: null,
    financialCalculationExecuted: false,
    acquisitionBasisCalculated: false,
    acquisitionPriceCalculated: false,
    valuationCalculated: false,
    investmentDecision: null,
    semantics: 'Acquisition bases were not calculated because adopted transaction inputs, complete immediate CAPEX, or operating-readiness gates did not pass.',
  });
}

function calculateAcquisitionBasis(
  operatingCase,
  suppliedPropertyCosts = null,
  suppliedReadiness = null,
) {
  if (!operatingCase || operatingCase.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new TypeError('operatingCase must be created by createResidentialIncomeOperatingCase');
  }

  const issues = [];
  const asOfDate = new Date(operatingCase.asOfDate);
  const readiness = suppliedReadiness || assessOperatingUnderwritingReadiness(operatingCase);
  const propertyCosts = suppliedPropertyCosts || calculatePropertyCosts(operatingCase, calculateOperatingMetrics(operatingCase));
  if ([
    OPERATING_UNDERWRITING_STATUS.DECISION_BLOCKED,
    OPERATING_UNDERWRITING_STATUS.INSUFFICIENT_EVIDENCE,
  ].includes(readiness.status)) {
    addIssue(issues, 'OPERATING_READINESS_GATE_NOT_PASSED', 'operatingUnderwritingReadiness');
  }

  const inputs = {};
  for (const type of Object.values(ACQUISITION_BASIS_INPUT_TYPE)) {
    const input = findAndValidateInput(operatingCase, type, asOfDate, issues);
    if (input) inputs[type] = input;
  }

  const immediateCapex = propertyCosts.capex.acquisitionBasisAdjustment;
  if (propertyCosts.capex.status !== PROPERTY_COST_STATUS.CALCULATED || immediateCapex === null) {
    addIssue(issues, 'COMPLETE_IMMEDIATE_CAPEX_ASSESSMENT_REQUIRED', 'propertyCosts.capex.acquisitionBasisAdjustment');
  }
  if (issues.length) return emptyResult(operatingCase, issues, readiness.status);

  const purchasePrice = inputs[ACQUISITION_BASIS_INPUT_TYPE.PURCHASE_PRICE].value;
  const transactionCosts = inputs[ACQUISITION_BASIS_INPUT_TYPE.TRANSACTION_COSTS].value;
  const initialTenantImprovements = inputs[ACQUISITION_BASIS_INPUT_TYPE.INITIAL_TENANT_IMPROVEMENTS].value;
  const initialLeasingCosts = inputs[ACQUISITION_BASIS_INPUT_TYPE.INITIAL_LEASING_COSTS].value;
  const initialReserves = inputs[ACQUISITION_BASIS_INPUT_TYPE.INITIAL_RESERVES].value;
  const initialDebtProceeds = inputs[ACQUISITION_BASIS_INPUT_TYPE.INITIAL_DEBT_PROCEEDS].value;
  const nonPriceBasis = transactionCosts
    + immediateCapex
    + initialTenantImprovements
    + initialLeasingCosts
    + initialReserves;
  const allInBasis = purchasePrice + nonPriceBasis;
  if (initialDebtProceeds > allInBasis) {
    addIssue(issues, 'INITIAL_DEBT_EXCEEDS_ALL_IN_BASIS', 'acquisition.initialDebtProceeds', inputs[ACQUISITION_BASIS_INPUT_TYPE.INITIAL_DEBT_PROCEEDS].sourceRef);
    return emptyResult(operatingCase, issues, readiness.status);
  }
  const equityBasis = allInBasis - initialDebtProceeds;
  const assumedInputCount = Object.values(inputs)
    .filter((input) => input.verificationStatus === OPERATING_INPUT_STATUS.ASSUMED).length;
  const status = assumedInputCount > 0
    ? ACQUISITION_BASIS_STATUS.CALCULATED_WITH_ASSUMPTIONS
    : ACQUISITION_BASIS_STATUS.CALCULATED;

  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status,
    readinessStatus: readiness.status,
    issues: [],
    assumedInputCount,
    components: {
      purchasePrice,
      transactionCosts,
      immediateCapex,
      initialTenantImprovements,
      initialLeasingCosts,
      initialReserves,
      initialDebtProceeds,
      nonPriceBasis,
    },
    bases: {
      priceOnlyBasis: purchasePrice,
      allInBasis,
      equityBasis,
      nonPricePremiumRatio: nonPriceBasis / purchasePrice,
      initialDebtToCostRatio: allInBasis > 0 ? initialDebtProceeds / allInBasis : null,
    },
    financialCalculationExecuted: true,
    acquisitionBasisCalculated: true,
    acquisitionPriceCalculated: false,
    valuationCalculated: false,
    investmentDecision: null,
    semantics: 'Evidence-gated acquisition bases only. Purchase price is an adopted input, not a calculated value. The result does not calculate value, maximum price, returns, financing approval, a legal conclusion, an investment decision, or transaction authorization.',
  });
}

module.exports = {
  ACQUISITION_BASIS_STATUS,
  ACQUISITION_BASIS_INPUT_TYPE,
  ACQUISITION_BASIS_INPUT_DEFINITION,
  createAcquisitionBasisInput,
  calculateAcquisitionBasis,
};
