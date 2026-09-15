'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { computeNPV } = require('../../src/engines/financial');
const { RATE_INPUT_TYPE, createProfessionalRateInput } = require('../../src/valuation/professional-method-input-provenance');
const { PROFESSIONAL_NOI_MODEL_VERSION, PROFESSIONAL_NOI_RESULT_STATUS } = require('../../src/engines/valuation/professional-income-noi');
const {
  DCF_TIMING_CONVENTION,
  TERMINAL_NOI_SOURCE,
  DISPOSITION_COST_METHOD,
  buildProfessionalDcfInputPacket,
  createTerminalNoiInput,
  createDispositionCostInput,
} = require('../../src/valuation/professional-dcf-input');
const { PROFESSIONAL_DCF_RESULT_STATUS, calculateProfessionalDcfIndication } = require('../../src/engines/valuation/professional-dcf');
const {
  INVESTMENT_BASIS_TYPE,
  COLLATERAL_VALUE_BASIS_TYPE,
  ANALYSIS_SOURCE,
  DSCR_NUMERATOR_BASIS,
  INVESTMENT_FINANCING_INPUT_STATUS,
  createInvestmentBasisInput,
  createCollateralValueBasisInput,
  createReturnAnalysisRateInput,
  createDebtTermsInput,
  buildInvestmentFinancingMetricsInputPacket,
  verifyInvestmentFinancingMetricsInputIntegrity,
} = require('../../src/investment/investment-financing-input');
const { INVESTMENT_FINANCING_RESULT_STATUS, calculateInvestmentFinancingMetrics } = require('../../src/engines/financial/investment-financing-metrics');

let checks = 0;
function check(v, m) { assert.ok(v, m); checks += 1; }
function equal(a, e, m) { assert.strictEqual(a, e, m); checks += 1; }
function close(a, e, m, eps = 1e-6) { assert.ok(Math.abs(a - e) < eps, `${m}: ${a} vs ${e}`); checks += 1; }
function throws(fn, re, m) { assert.throws(fn, re, m); checks += 1; }
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }

const caseId = 'CASE-12D-001';
const propertyRef = 'PROPERTY-12D-001';
const valuationDate = '2026-09-01T00:00:00.000Z';
const packetPreparedAt = '2026-09-02T12:00:00.000Z';

function makeNoiResult(nois = [600000, 700000, 800000], tag = 'A') {
  const periodResults = nois.map((selectedNoiSar, i) => ({
    periodId: `P${i + 1}-${tag}`,
    periodIndex: i + 1,
    label: `Year ${i + 1}`,
    startDate: new Date(Date.UTC(2026 + i, 8, 1)).toISOString(),
    endDate: new Date(Date.UTC(2027 + i, 8, 1)).toISOString(),
    isStabilized: i === nois.length - 1,
    potentialGrossIncomeSar: selectedNoiSar + 300000,
    vacancyCollectionLossSar: 50000,
    effectiveGrossIncomeSar: selectedNoiSar + 250000,
    operatingExpensesBeforeReserveSar: 250000,
    replacementReserveSar: 20000,
    noiBeforeReplacementReserveSar: selectedNoiSar,
    noiAfterReplacementReserveSar: selectedNoiSar - 20000,
    selectedNoiConvention: 'BEFORE_REPLACEMENT_RESERVE',
    selectedNoiSar,
    incomeTrace: [],
    vacancyCollectionLossTrace: {},
    operatingExpenseTrace: [],
    reviewFlags: [],
    annualizedAmounts: true,
    automaticLeaseOptionExercise: false,
    automaticMarketRentApplied: false,
  }));
  const core = {
    schemaVersion: 1,
    modelVersion: PROFESSIONAL_NOI_MODEL_VERSION,
    caseId,
    propertyRef,
    valuationDate,
    inputPacketHashSha256: tag.charCodeAt(0).toString(16).padStart(2, '0').repeat(32),
    incomeEvidencePacketHashSha256: 'b'.repeat(64),
    noiConvention: 'BEFORE_REPLACEMENT_RESERVE',
    baselineAnnualContractRentSar: 700000,
    baselineOccupiedAreaSqm: 1000,
    baselineActiveLeaseCount: 3,
    periodResults,
    firstForecastPeriodNoiSar: periodResults[0].selectedNoiSar,
    stabilizedPeriodIndex: periodResults.length,
    stabilizedNoiSar: periodResults[periodResults.length - 1].selectedNoiSar,
  };
  return {
    ...core,
    calculationHashSha256: sha256(core),
    status: PROFESSIONAL_NOI_RESULT_STATUS.PROFESSIONAL_NOI_READY,
    canonicalCalculationEngine: true,
    finalValuationConclusionEstablished: false,
    certifiedValuationEstablished: false,
    transactionAuthorized: false,
  };
}

function professionalRate(id, type, value) {
  return createProfessionalRateInput({
    rateId: id, caseId, propertyRef, type, value,
    source: 'VERIFIED_MARKET_ANALYSIS', sourceLabel: null,
    rationale: `Reviewed ${type}`,
    evidenceRefs: [`EVID-${id}`], asOfDate: '2026-08-20T00:00:00.000Z',
    preparedByRef: 'VALUER-001', preparedAt: '2026-08-25T09:00:00.000Z',
    reviewedByRef: 'REVIEWER-001', reviewedAt: '2026-08-26T10:00:00.000Z',
    reviewEvidenceRef: `REVIEW-${id}`, confidence: 'HIGH',
  });
}

const noi = makeNoiResult();
const dcfInput = buildProfessionalDcfInputPacket({
  packetId: 'DCF-12D', caseId, propertyRef, valuationDate,
  professionalNoiResult: noi, periodAdjustments: [],
  discountRateInput: professionalRate('DISC', RATE_INPUT_TYPE.DISCOUNT_RATE, 0.10),
  exitCapRateInput: professionalRate('EXIT', RATE_INPUT_TYPE.EXIT_CAP_RATE, 0.08),
  maximumDiscountRateAgeDays: 20, maximumExitCapRateAgeDays: 20,
  terminalNoiInput: createTerminalNoiInput({
    terminalNoiId: 'TERMINAL', caseId, propertyRef, amountSar: 840000,
    source: TERMINAL_NOI_SOURCE.EXPLICIT_FORECAST,
    rationale: 'Reviewed terminal NOI', evidenceRefs: ['EVID-TERMINAL'],
    asOfDate: '2026-08-25T00:00:00.000Z', preparedByRef: 'VALUER-001', preparedAt: '2026-08-27T09:00:00.000Z',
    reviewedByRef: 'REVIEWER-001', reviewedAt: '2026-08-28T10:00:00.000Z', reviewEvidenceRef: 'REVIEW-TERMINAL',
  }),
  dispositionCostInput: createDispositionCostInput({
    dispositionCostId: 'DISPOSITION', caseId, propertyRef,
    method: DISPOSITION_COST_METHOD.PERCENT_OF_GROSS_TERMINAL_VALUE, value: 0.02,
    rationale: 'Reviewed disposition cost', evidenceRefs: ['EVID-DISPOSITION'],
    preparedByRef: 'VALUER-001', preparedAt: '2026-08-27T09:00:00.000Z',
    reviewedByRef: 'REVIEWER-001', reviewedAt: '2026-08-28T10:00:00.000Z', reviewEvidenceRef: 'REVIEW-DISPOSITION',
  }),
  timingConvention: DCF_TIMING_CONVENTION.END_OF_PERIOD,
  preparedByRef: 'VALUATION-TEAM', preparedAt: packetPreparedAt, evidenceRef: 'EVID-DCF-12D',
});
const dcf = calculateProfessionalDcfIndication(dcfInput);
equal(dcf.status, PROFESSIONAL_DCF_RESULT_STATUS.DCF_VALUE_INDICATION_READY, 'qualified DCF prerequisite');

function prov(source = ANALYSIS_SOURCE.PROFESSIONAL_JUDGMENT, asOfDate = '2026-08-20T00:00:00.000Z') {
  return {
    source,
    rationale: 'Explicit reviewed investment-analysis input', evidenceRefs: ['EVID-INV'], asOfDate,
    preparedByRef: 'ANALYST-001', preparedAt: '2026-08-25T09:00:00.000Z',
    reviewedByRef: 'REVIEWER-001', reviewedAt: '2026-08-26T10:00:00.000Z', reviewEvidenceRef: 'REVIEW-INV',
  };
}
function basis(amountSar = 8000000, asOfDate = '2026-08-20T00:00:00.000Z') {
  return createInvestmentBasisInput({ basisId: `BASIS-${amountSar}-${asOfDate}`, caseId, propertyRef, type: INVESTMENT_BASIS_TYPE.ACQUISITION_COST, amountSar, ...prov(ANALYSIS_SOURCE.VERIFIED_TRANSACTION_DOCUMENT, asOfDate) });
}
function returnRates(asOfDate = '2026-08-20T00:00:00.000Z') {
  return createReturnAnalysisRateInput({ rateSetId: `RET-${asOfDate}`, caseId, propertyRef, npvDiscountRate: 0.12, mirrFinanceRate: 0.06, mirrReinvestmentRate: 0.08, ...prov(ANALYSIS_SOURCE.PROFESSIONAL_JUDGMENT, asOfDate) });
}
function debt({ principalSar = 4000000, annualRate = 0.06, tenorYears = 10, fees = 50000, label = 'Generic amortizing loan', gracePeriodMonths = 0 } = {}) {
  return createDebtTermsInput({
    debtId: `DEBT-${principalSar}-${annualRate}-${gracePeriodMonths}`, caseId, propertyRef,
    principalSar, annualRate, tenorYears, gracePeriodMonths, graceType: 'INTEREST_ONLY', balloonPct: 0,
    financingFeesSar: fees, financingModelLabel: label,
    ...prov(ANALYSIS_SOURCE.VERIFIED_LENDER_DOCUMENT),
  });
}
function dcfCollateral(amountSar = dcf.valueIndicationSar, hash = dcf.calculationHashSha256) {
  return createCollateralValueBasisInput({
    valueBasisId: `COLL-DCF-${amountSar}`, caseId, propertyRef,
    type: COLLATERAL_VALUE_BASIS_TYPE.PROFESSIONAL_DCF_METHOD_INDICATION,
    amountSar, professionalDcfCalculationHashSha256: hash,
    ...prov(ANALYSIS_SOURCE.PROFESSIONAL_METHOD_INDICATION),
  });
}
function externalCollateral(amountSar) {
  return createCollateralValueBasisInput({ valueBasisId: `COLL-EXT-${amountSar}`, caseId, propertyRef, type: COLLATERAL_VALUE_BASIS_TYPE.EXTERNAL_APPRAISED_VALUE, amountSar, ...prov(ANALYSIS_SOURCE.EXTERNAL_PROFESSIONAL_REPORT) });
}
function build({
  id = 'INV', noiResult = noi, dcfResult = dcf, investmentBasis = basis(), rates = returnRates(),
  financingEnabled = false, debtTerms = null, collateral = null, dscrBasis = null,
  maxBasisAge = 20, maxReturnAge = 20, maxDebtAge = null, maxCollateralAge = null,
} = {}) {
  return buildInvestmentFinancingMetricsInputPacket({
    packetId: id, caseId, propertyRef, valuationDate,
    professionalDcfResult: dcfResult, professionalNoiResult: noiResult,
    investmentBasisInput: investmentBasis, returnAnalysisRateInput: rates,
    financingEnabled, debtTermsInput: debtTerms, collateralValueBasisInput: collateral, dscrNumeratorBasis: dscrBasis,
    maximumInvestmentBasisAgeDays: maxBasisAge, maximumReturnRateAgeDays: maxReturnAge,
    maximumDebtTermsAgeDays: maxDebtAge, maximumCollateralValueAgeDays: maxCollateralAge,
    preparedByRef: 'INVESTMENT-TEAM', preparedAt: packetPreparedAt, evidenceRef: `EVID-${id}`,
  });
}

const allEquityInput = build({ id: 'ALL-EQUITY' });
equal(allEquityInput.status, INVESTMENT_FINANCING_INPUT_STATUS.READY_FOR_CANONICAL_INVESTMENT_FINANCING_METRICS, 'all-equity input ready');
check(verifyInvestmentFinancingMetricsInputIntegrity(allEquityInput), 'all-equity packet integrity');
equal(allEquityInput.financingEnabled, false, 'financing disabled explicitly');
equal(allEquityInput.debtTermsInput, null, 'no debt terms when financing disabled');
equal(allEquityInput.professionalValueUsedAsInvestmentBasisAutomatically, false, 'professional value not auto-adopted as cost basis');

const allEquity = calculateInvestmentFinancingMetrics(allEquityInput);
equal(allEquity.status, INVESTMENT_FINANCING_RESULT_STATUS.INVESTMENT_FINANCING_METRICS_READY, 'all-equity metrics ready');
equal(allEquity.debtMetrics, null, 'all-equity has no debt metrics');
equal(allEquity.equityMetrics.allEquityCase, true, 'all-equity case explicit');
close(allEquity.unleveredMetrics.yieldOnCost, 0.10, 'yield on cost');
close(allEquity.equityMetrics.initialEquitySar, 8000000, 'all-equity initial equity');
close(allEquity.equityMetrics.irr, allEquity.unleveredMetrics.irr, 'all-equity IRR equals unlevered IRR');
close(allEquity.equityMetrics.mirr, allEquity.unleveredMetrics.mirr, 'all-equity MIRR equals unlevered MIRR');
close(allEquity.equityMetrics.npvSar, allEquity.unleveredMetrics.npvSar, 'all-equity NPV equals unlevered NPV');
close(allEquity.unleveredMetrics.npvSar, computeNPV(0.12, allEquity.unleveredMetrics.cashflows), 'canonical NPV primitive');
equal(allEquity.professionalDcfValueIndicationSar, dcf.valueIndicationSar, 'professional DCF indication retained');
equal(allEquity.valuationChangedByFinancing, false, 'valuation not changed by investment engine');
equal(allEquity.creditDecisionMade, false, 'no credit decision');
equal(allEquity.transactionAuthorized, false, 'no transaction authority');

const debtTerms = debt();
const collateral = dcfCollateral();
const financedInput = build({ id: 'FINANCED', financingEnabled: true, debtTerms, collateral, dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 });
equal(financedInput.status, INVESTMENT_FINANCING_INPUT_STATUS.READY_FOR_CANONICAL_INVESTMENT_FINANCING_METRICS, 'financed input ready');
check(verifyInvestmentFinancingMetricsInputIntegrity(financedInput), 'financed packet integrity');
equal(financedInput.collateralValueBasisInput.type, COLLATERAL_VALUE_BASIS_TYPE.PROFESSIONAL_DCF_METHOD_INDICATION, 'explicit DCF indication LTV basis');

const financed = calculateInvestmentFinancingMetrics(financedInput);
equal(financed.status, INVESTMENT_FINANCING_RESULT_STATUS.INVESTMENT_FINANCING_METRICS_READY, 'financed metrics ready');
close(financed.debtMetrics.principalSar, 4000000, 'debt principal retained');
close(financed.debtMetrics.ltc, 0.5, 'LTC');
close(financed.debtMetrics.ltv, 4000000 / dcf.valueIndicationSar, 'LTV');
close(financed.debtMetrics.debtYield, 0.2, 'debt yield');
close(financed.equityMetrics.initialEquitySar, 4050000, 'initial equity');
check(financed.debtMetrics.minimumDscr > 1, 'minimum DSCR > 1x fixture');
check(financed.debtMetrics.minimumIcr > 1, 'minimum ICR > 1x fixture');
equal(financed.debtMetrics.automaticDebtSizing, false, 'no automatic debt sizing');
equal(financed.debtMetrics.creditDecisionMade, false, 'no credit decision from debt metrics');
equal(financed.debtMetrics.financingClassification.exactContractModel, false, 'generic debt remains analytical proxy');
check(financed.equityMetrics.irr !== null, 'equity IRR calculated');
check(financed.equityMetrics.equityMultiple > 0, 'equity multiple calculated');
equal(financed.professionalDcfValueIndicationSar, dcf.valueIndicationSar, 'financing does not alter professional DCF indication');

const murabaha = calculateInvestmentFinancingMetrics(build({ id: 'MURABAHA', financingEnabled: true, debtTerms: debt({ label: 'Murabaha financing' }), collateral, dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }));
equal(murabaha.debtMetrics.financingClassification.modelType, 'MURABAHA_RATE_PROXY_MONTHLY', 'Murabaha remains rate proxy');
equal(murabaha.debtMetrics.financingClassification.exactContractModel, false, 'Murabaha proxy not exact executed contract');

const tamperedDcf = { ...dcf, valueIndicationSar: dcf.valueIndicationSar + 1 };
equal(build({ id: 'TAMPER-DCF', dcfResult: tamperedDcf }).status, INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INTEGRITY, 'tampered DCF blocked');
const mismatchedNoi = makeNoiResult([610000, 700000, 800000], 'C');
equal(build({ id: 'NOI-MISMATCH', noiResult: mismatchedNoi }).status, INVESTMENT_FINANCING_INPUT_STATUS.HOLD_NOI, 'NOI/DCF binding mismatch blocked');
equal(build({ id: 'STALE-BASIS', investmentBasis: basis(8000000, '2026-07-01T00:00:00.000Z'), maxBasisAge: 20 }).status, INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INVESTMENT_BASIS, 'stale investment basis blocked');
equal(build({ id: 'STALE-RATES', rates: returnRates('2026-07-01T00:00:00.000Z'), maxReturnAge: 20 }).status, INVESTMENT_FINANCING_INPUT_STATUS.HOLD_RETURN_RATES, 'stale return rates blocked');

const tamperedDebt = { ...debtTerms, principalSar: 4500000 };
equal(build({ id: 'TAMPER-DEBT', financingEnabled: true, debtTerms: tamperedDebt, collateral, dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }).status, INVESTMENT_FINANCING_INPUT_STATUS.HOLD_INTEGRITY, 'tampered debt blocked');
const badHashCollateral = dcfCollateral(dcf.valueIndicationSar, 'f'.repeat(64));
equal(build({ id: 'BAD-COLL-HASH', financingEnabled: true, debtTerms, collateral: badHashCollateral, dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }).status, INVESTMENT_FINANCING_INPUT_STATUS.HOLD_COLLATERAL_VALUE, 'DCF collateral hash mismatch blocked');
const badAmountCollateral = dcfCollateral(dcf.valueIndicationSar + 1000, dcf.calculationHashSha256);
equal(build({ id: 'BAD-COLL-AMOUNT', financingEnabled: true, debtTerms, collateral: badAmountCollateral, dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }).status, INVESTMENT_FINANCING_INPUT_STATUS.HOLD_COLLATERAL_VALUE, 'DCF collateral amount mismatch blocked');

throws(() => createCollateralValueBasisInput({ valueBasisId: 'BAD-SOURCE', caseId, propertyRef, type: COLLATERAL_VALUE_BASIS_TYPE.PROFESSIONAL_DCF_METHOD_INDICATION, amountSar: dcf.valueIndicationSar, professionalDcfCalculationHashSha256: dcf.calculationHashSha256, ...prov(ANALYSIS_SOURCE.EXTERNAL_PROFESSIONAL_REPORT) }), /REQUIRES_PROFESSIONAL_METHOD_INDICATION_SOURCE/, 'DCF method indication requires matching source classification');
throws(() => createDebtTermsInput({ debtId: 'BAD-GRACE', caseId, propertyRef, principalSar: 4000000, annualRate: 0.06, tenorYears: 1, gracePeriodMonths: 12, graceType: 'INTEREST_ONLY', balloonPct: 0, financingFeesSar: 0, financingModelLabel: 'loan', ...prov(ANALYSIS_SOURCE.VERIFIED_LENDER_DOCUMENT) }), /gracePeriodMonths must be an integer from 0 to tenorMonths-1/, 'semantic grace/tenor conflict blocked at input boundary');
throws(() => build({ id: 'FIN-OFF-HIDDEN-DEBT', financingEnabled: false, debtTerms, collateral }), /FINANCING_DISABLED_REQUIRES_NULL_DEBT_COLLATERAL_AND_DSCR_INPUTS/, 'financing-off rejects hidden debt inputs');
throws(() => build({ id: 'BAD-DSCR', financingEnabled: true, debtTerms, collateral, dscrBasis: 'EBITDA', maxDebtAge: 20, maxCollateralAge: 20 }), /dscrNumeratorBasis is invalid/, 'DSCR numerator must use governed basis');

const overDebt = debt({ principalSar: 9000000, fees: 0 });
equal(build({ id: 'OVER-DEBT', financingEnabled: true, debtTerms: overDebt, collateral: externalCollateral(10000000), dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }).status, INVESTMENT_FINANCING_INPUT_STATUS.HOLD_FINANCING, 'debt cannot exceed explicit uses');

const tamperedPacket = { ...financedInput, professionalDcfValueIndicationSar: 1 };
equal(calculateInvestmentFinancingMetrics(tamperedPacket).status, INVESTMENT_FINANCING_RESULT_STATUS.INVALID_INPUT_PACKET, 'tampered packet rejected');

const lowCoverage = calculateInvestmentFinancingMetrics(build({ id: 'LOW-COVERAGE', financingEnabled: true, debtTerms: debt({ principalSar: 7900000, annualRate: 0.20, tenorYears: 5, fees: 0 }), collateral: externalCollateral(10000000), dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }));
equal(lowCoverage.status, INVESTMENT_FINANCING_RESULT_STATUS.REVIEW_REQUIRED, 'low coverage creates review, not rejection');
check(lowCoverage.reviewFlags.includes('DSCR_BELOW_1X_REVIEW_REQUIRED'), 'low DSCR flag explicit');
equal(lowCoverage.creditDecisionMade, false, 'low DSCR is not credit decision');

const highLtv = calculateInvestmentFinancingMetrics(build({ id: 'HIGH-LTV', financingEnabled: true, debtTerms, collateral: externalCollateral(3000000), dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }));
equal(highLtv.status, INVESTMENT_FINANCING_RESULT_STATUS.REVIEW_REQUIRED, 'LTV > 100% review');
check(highLtv.reviewFlags.includes('LTV_ABOVE_100_PERCENT_REVIEW_REQUIRED'), 'high LTV flag explicit');

const highLtc = calculateInvestmentFinancingMetrics(build({ id: 'HIGH-LTC', financingEnabled: true, debtTerms: debt({ principalSar: 9000000, fees: 2000000 }), collateral: externalCollateral(12000000), dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }));
equal(highLtc.status, INVESTMENT_FINANCING_RESULT_STATUS.REVIEW_REQUIRED, 'LTC > 100% review');
check(highLtc.reviewFlags.includes('LTC_ABOVE_100_PERCENT_REVIEW_REQUIRED'), 'high LTC flag explicit');

const zeroEquity = calculateInvestmentFinancingMetrics(build({ id: 'ZERO-EQUITY', financingEnabled: true, debtTerms: debt({ principalSar: 8050000, fees: 50000 }), collateral: externalCollateral(10000000), dscrBasis: DSCR_NUMERATOR_BASIS.PROFESSIONAL_NOI, maxDebtAge: 20, maxCollateralAge: 20 }));
equal(zeroEquity.status, INVESTMENT_FINANCING_RESULT_STATUS.REVIEW_REQUIRED, 'zero initial equity review');
check(zeroEquity.reviewFlags.includes('ZERO_INITIAL_EQUITY_REVIEW_REQUIRED'), 'zero equity flag explicit');

console.log(`WAVE_12D_INVESTMENT_FINANCING_METRICS=PASS checks=${checks}`);
