'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  RATE_INPUT_TYPE,
  createProfessionalRateInput,
} = require('../../src/valuation/professional-method-input-provenance');
const {
  PROFESSIONAL_NOI_MODEL_VERSION,
  PROFESSIONAL_NOI_RESULT_STATUS,
} = require('../../src/engines/valuation/professional-income-noi');
const {
  DCF_TIMING_CONVENTION,
  TERMINAL_NOI_SOURCE,
  DISPOSITION_COST_METHOD,
  DCF_PERIOD_ADJUSTMENT_TYPE,
  DCF_CASH_FLOW_DIRECTION,
  DCF_ADJUSTMENT_SOURCE,
  PROFESSIONAL_DCF_INPUT_STATUS,
  createTerminalNoiInput,
  createDispositionCostInput,
  createDcfPeriodAdjustment,
  buildProfessionalDcfInputPacket,
  verifyProfessionalDcfInputIntegrity,
} = require('../../src/valuation/professional-dcf-input');
const {
  PROFESSIONAL_DCF_RESULT_STATUS,
  calculateProfessionalDcfIndication,
} = require('../../src/engines/valuation/professional-dcf');

let checks = 0;
function check(v, m) { assert.ok(v, m); checks += 1; }
function equal(a, e, m) { assert.strictEqual(a, e, m); checks += 1; }
function close(a, e, m) { assert.ok(Math.abs(a - e) < 1e-6, `${m}: ${a} vs ${e}`); checks += 1; }
function throws(fn, re, m) { assert.throws(fn, re, m); checks += 1; }
function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stableClone(value[key]); return out; }, {});
}
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stableClone(value))).digest('hex'); }

const caseId = 'CASE-12C-001';
const propertyRef = 'PROPERTY-12C-001';
const valuationDate = '2026-09-01T00:00:00.000Z';
const packetPreparedAt = '2026-09-02T12:00:00.000Z';

function makeNoiResult(nois = [600000, 700000, 800000]) {
  const periodResults = nois.map((selectedNoiSar, i) => ({
    periodId: `P${i + 1}`,
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
    reviewFlags: selectedNoiSar <= 0 ? ['NON_POSITIVE_NOI_REVIEW_REQUIRED'] : [],
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
    inputPacketHashSha256: 'a'.repeat(64),
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

function makeRate({
  id,
  type,
  value,
  asOfDate = '2026-08-20T00:00:00.000Z',
  preparedAt = '2026-08-25T09:00:00.000Z',
  reviewedAt = '2026-08-26T10:00:00.000Z',
} = {}) {
  return createProfessionalRateInput({
    rateId: id,
    caseId,
    propertyRef,
    type,
    value,
    source: 'VERIFIED_MARKET_ANALYSIS',
    sourceLabel: null,
    rationale: `Reviewed ${type} ${id}`,
    evidenceRefs: [`EVID-${id}`],
    asOfDate,
    preparedByRef: 'VALUER-001',
    preparedAt,
    reviewedByRef: 'REVIEWER-001',
    reviewedAt,
    reviewEvidenceRef: `REVIEW-${id}`,
    confidence: 'HIGH',
  });
}

function makeTerminal(overrides = {}) {
  return createTerminalNoiInput({
    terminalNoiId: overrides.terminalNoiId || 'TERMINAL-NOI-001',
    caseId,
    propertyRef,
    amountSar: overrides.amountSar ?? 840000,
    source: overrides.source || TERMINAL_NOI_SOURCE.EXPLICIT_FORECAST,
    rationale: 'Explicit reviewed forward terminal NOI',
    evidenceRefs: ['EVID-TERMINAL-NOI'],
    asOfDate: overrides.asOfDate || '2026-08-25T00:00:00.000Z',
    preparedByRef: 'VALUER-001',
    preparedAt: overrides.preparedAt || '2026-08-27T09:00:00.000Z',
    reviewedByRef: 'REVIEWER-001',
    reviewedAt: overrides.reviewedAt || '2026-08-28T10:00:00.000Z',
    reviewEvidenceRef: 'REVIEW-TERMINAL-NOI',
  });
}

function makeDisposition(overrides = {}) {
  return createDispositionCostInput({
    dispositionCostId: overrides.dispositionCostId || 'DISPOSITION-001',
    caseId,
    propertyRef,
    method: overrides.method || DISPOSITION_COST_METHOD.PERCENT_OF_GROSS_TERMINAL_VALUE,
    value: overrides.value ?? 0.02,
    rationale: 'Explicit reviewed disposition cost',
    evidenceRefs: ['EVID-DISPOSITION'],
    preparedByRef: 'VALUER-001',
    preparedAt: overrides.preparedAt || '2026-08-27T09:00:00.000Z',
    reviewedByRef: 'REVIEWER-001',
    reviewedAt: overrides.reviewedAt || '2026-08-28T10:00:00.000Z',
    reviewEvidenceRef: 'REVIEW-DISPOSITION',
  });
}

function makeAdjustment({ id, periodIndex, type, direction, amountSar, asOfDate = '2026-08-20T00:00:00.000Z' }) {
  return createDcfPeriodAdjustment({
    adjustmentId: id,
    caseId,
    propertyRef,
    periodIndex,
    type,
    direction,
    amountSar,
    source: DCF_ADJUSTMENT_SOURCE.PROFESSIONAL_JUDGMENT,
    rationale: `Explicit reviewed DCF adjustment ${id}`,
    evidenceRefs: [`EVID-${id}`],
    asOfDate,
    preparedByRef: 'VALUER-001',
    preparedAt: '2026-08-25T09:00:00.000Z',
    reviewedByRef: 'REVIEWER-001',
    reviewedAt: '2026-08-26T10:00:00.000Z',
    reviewEvidenceRef: `REVIEW-${id}`,
  });
}

const noi = makeNoiResult();
const discountRate = makeRate({ id: 'DISC-001', type: RATE_INPUT_TYPE.DISCOUNT_RATE, value: 0.10 });
const exitCapRate = makeRate({ id: 'EXIT-001', type: RATE_INPUT_TYPE.EXIT_CAP_RATE, value: 0.08 });
const terminalNoi = makeTerminal();
const disposition = makeDisposition();
const adjustments = [
  makeAdjustment({ id: 'CAPEX-P1', periodIndex: 1, type: DCF_PERIOD_ADJUSTMENT_TYPE.CAPITAL_EXPENDITURE, direction: DCF_CASH_FLOW_DIRECTION.OUTFLOW, amountSar: 100000 }),
  makeAdjustment({ id: 'OTHER-P2', periodIndex: 2, type: DCF_PERIOD_ADJUSTMENT_TYPE.OTHER_PROPERTY_CASH_FLOW, direction: DCF_CASH_FLOW_DIRECTION.INFLOW, amountSar: 50000 }),
  makeAdjustment({ id: 'LC-P3', periodIndex: 3, type: DCF_PERIOD_ADJUSTMENT_TYPE.LEASING_COMMISSION, direction: DCF_CASH_FLOW_DIRECTION.OUTFLOW, amountSar: 20000 }),
];

function build({
  id = 'DCF-INPUT-001',
  noiResult = noi,
  periodAdjustments = adjustments,
  discount = discountRate,
  exit = exitCapRate,
  maxDiscountAge = 20,
  maxExitAge = 20,
  terminal = terminalNoi,
  dispositionCost = disposition,
  timing = DCF_TIMING_CONVENTION.END_OF_PERIOD,
  preparedAt = packetPreparedAt,
} = {}) {
  return buildProfessionalDcfInputPacket({
    packetId: id,
    caseId,
    propertyRef,
    valuationDate,
    professionalNoiResult: noiResult,
    periodAdjustments,
    discountRateInput: discount,
    exitCapRateInput: exit,
    maximumDiscountRateAgeDays: maxDiscountAge,
    maximumExitCapRateAgeDays: maxExitAge,
    terminalNoiInput: terminal,
    dispositionCostInput: dispositionCost,
    timingConvention: timing,
    preparedByRef: 'VALUATION-TEAM',
    preparedAt,
    evidenceRef: `EVID-${id}`,
  });
}

const input = build();
equal(input.status, PROFESSIONAL_DCF_INPUT_STATUS.READY_FOR_CANONICAL_DCF, 'DCF input ready');
check(verifyProfessionalDcfInputIntegrity(input), 'DCF input integrity');
equal(input.operatingNoiPeriods.length, 3, 'three NOI periods retained');
equal(input.periodAdjustments.length, 3, 'three explicit non-NOI adjustments retained');
equal(input.periodAdjustmentsExplicitlyReviewed, true, 'period adjustments explicitly reviewed');
equal(input.discountRateProvenance.ageDays, 12, 'discount rate age explicit');
equal(input.exitCapRateProvenance.ageDays, 12, 'exit cap age explicit');
equal(input.automaticRateDerivation, false, 'no automatic rate derivation');
equal(input.automaticTerminalNoiDerivation, false, 'no automatic terminal NOI derivation');
equal(input.financingIncluded, false, 'no financing in professional DCF input');
equal(input.incomeTaxCalculated, false, 'no income tax calculation in professional DCF input');
equal(input.zakatCalculated, false, 'no Zakat calculation in professional DCF input');

const result = calculateProfessionalDcfIndication(input);
equal(result.status, PROFESSIONAL_DCF_RESULT_STATUS.DCF_VALUE_INDICATION_READY, 'DCF indication ready');
const propertyCashFlows = [500000, 750000, 780000];
const expectedOperatingPv = propertyCashFlows.reduce((sum, cf, i) => sum + cf / (1.10 ** (i + 1)), 0);
const expectedGrossTerminal = 840000 / 0.08;
const expectedDisposition = expectedGrossTerminal * 0.02;
const expectedNetTerminal = expectedGrossTerminal - expectedDisposition;
const expectedTerminalPv = expectedNetTerminal / (1.10 ** 3);
const expectedValue = expectedOperatingPv + expectedTerminalPv;
close(result.operatingPresentValueSar, expectedOperatingPv, 'operating property cash-flow PV');
close(result.grossTerminalValueSar, expectedGrossTerminal, 'gross terminal value');
close(result.dispositionCostSar, expectedDisposition, 'disposition cost');
close(result.netTerminalValueSar, expectedNetTerminal, 'net terminal value');
close(result.terminalPresentValueSar, expectedTerminalPv, 'terminal PV');
close(result.valueIndicationSar, expectedValue, 'DCF value indication');
close(result.operatingPresentValueTrace[0].unleveredPropertyCashFlowSar, 500000, 'period 1 NOI less capex');
close(result.operatingPresentValueTrace[1].unleveredPropertyCashFlowSar, 750000, 'period 2 NOI plus other inflow');
close(result.operatingPresentValueTrace[2].unleveredPropertyCashFlowSar, 780000, 'period 3 NOI less leasing commission');
equal(result.terminalTimingConvention, 'END_OF_FINAL_PERIOD', 'terminal timing explicit');
equal(result.unleveredPropertyCashFlowBasis, true, 'property DCF is explicitly unlevered');
equal(result.financingIncluded, false, 'no financing in DCF result');
equal(result.debtServiceIncluded, false, 'no debt service in DCF result');
equal(result.equityReturnAnalysisPerformed, false, 'no equity return analysis');
equal(result.incomeTaxCalculated, false, 'no income tax calculation');
equal(result.zakatCalculated, false, 'no Zakat calculation');
equal(result.reconciliationPerformed, false, 'no method reconciliation');
equal(result.finalValuationConclusionEstablished, false, 'DCF indication is not final valuation');
equal(result.certifiedValuationEstablished, false, 'DCF indication is not certified valuation');
equal(result.transactionAuthorized, false, 'no transaction authority');
check(/^[a-f0-9]{64}$/.test(result.calculationHashSha256), 'DCF calculation hash');

const midYearInput = build({ id: 'DCF-MIDYEAR', timing: DCF_TIMING_CONVENTION.MID_YEAR });
const midYearResult = calculateProfessionalDcfIndication(midYearInput);
equal(midYearResult.status, PROFESSIONAL_DCF_RESULT_STATUS.DCF_VALUE_INDICATION_READY, 'mid-year DCF ready');
check(midYearResult.operatingPresentValueSar > result.operatingPresentValueSar, 'mid-year convention increases operating PV versus end-period');
close(midYearResult.terminalPresentValueSar, result.terminalPresentValueSar, 'terminal PV remains end-of-final-period under mid-year operating convention');
close(midYearResult.operatingPresentValueTrace[0].timingExponent, 0.5, 'mid-year first period exponent');

const wrongDiscount = makeRate({ id: 'WRONG-DISC', type: RATE_INPUT_TYPE.MARKET_CAP_RATE, value: 0.10 });
equal(build({ id: 'WRONG-DISC', discount: wrongDiscount }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'market cap cannot substitute discount rate');
const wrongExit = makeRate({ id: 'WRONG-EXIT', type: RATE_INPUT_TYPE.MARKET_CAP_RATE, value: 0.08 });
equal(build({ id: 'WRONG-EXIT', exit: wrongExit }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'market cap cannot substitute exit cap');
equal(build({ id: 'STALE-DISC', maxDiscountAge: 5 }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'stale discount rate blocked');
equal(build({ id: 'STALE-EXIT', maxExitAge: 5 }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'stale exit cap blocked');

const futureDiscount = makeRate({ id: 'FUTURE-DISC', type: RATE_INPUT_TYPE.DISCOUNT_RATE, value: 0.10, asOfDate: '2026-09-02T00:00:00.000Z', preparedAt: '2026-09-02T09:00:00.000Z', reviewedAt: '2026-09-02T10:00:00.000Z' });
const futureDiscountInput = build({ id: 'FUTURE-DISC', discount: futureDiscount, preparedAt: '2026-09-03T12:00:00.000Z' });
equal(futureDiscountInput.status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'post-valuation-date discount rate blocked');
check(futureDiscountInput.blockers.includes('DISCOUNT_RATE_AS_OF_AFTER_VALUATION_DATE'), 'future discount blocker explicit');

const tamperedRate = { ...discountRate, value: 0.11 };
equal(build({ id: 'TAMPER-RATE', discount: tamperedRate }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, 'tampered discount rate fails integrity');
const tamperedNoi = { ...noi, firstForecastPeriodNoiSar: 999999 };
equal(build({ id: 'TAMPER-NOI', noiResult: tamperedNoi }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, 'tampered NOI result fails integrity');
const tamperedAdjustment = { ...adjustments[0], amountSar: 999999 };
equal(build({ id: 'TAMPER-ADJ', periodAdjustments: [tamperedAdjustment, adjustments[1], adjustments[2]] }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, 'tampered DCF adjustment fails integrity');
equal(build({ id: 'DUP-ADJ', periodAdjustments: [adjustments[0], adjustments[0]] }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_PERIOD_ADJUSTMENTS, 'duplicate DCF adjustment IDs blocked');
const outsideAdjustment = makeAdjustment({ id: 'P4', periodIndex: 4, type: DCF_PERIOD_ADJUSTMENT_TYPE.CAPITAL_EXPENDITURE, direction: DCF_CASH_FLOW_DIRECTION.OUTFLOW, amountSar: 1 });
equal(build({ id: 'P4-ADJ', periodAdjustments: [outsideAdjustment] }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_PERIOD_ADJUSTMENTS, 'adjustment outside forecast period blocked');

const tamperedTerminal = { ...terminalNoi, amountSar: 900000 };
equal(build({ id: 'TAMPER-TERMINAL', terminal: tamperedTerminal }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, 'tampered terminal NOI fails integrity');
const tamperedDisposition = { ...disposition, value: 0.50 };
equal(build({ id: 'TAMPER-DISPOSITION', dispositionCost: tamperedDisposition }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_INTEGRITY, 'tampered disposition cost fails integrity');
const futureTerminal = makeTerminal({ terminalNoiId: 'FUTURE-TERMINAL', asOfDate: '2026-09-02T00:00:00.000Z', preparedAt: '2026-09-02T09:00:00.000Z', reviewedAt: '2026-09-02T10:00:00.000Z' });
equal(build({ id: 'FUTURE-TERMINAL', terminal: futureTerminal, preparedAt: '2026-09-03T12:00:00.000Z' }).status, PROFESSIONAL_DCF_INPUT_STATUS.HOLD_TERMINAL_ASSUMPTIONS, 'terminal NOI evidence after valuation date blocked');

throws(() => buildProfessionalDcfInputPacket({ packetId: 'NO-ADJ-ARRAY', caseId, propertyRef, valuationDate, professionalNoiResult: noi, discountRateInput: discountRate, exitCapRateInput: exitCapRate, maximumDiscountRateAgeDays: 20, maximumExitCapRateAgeDays: 20, terminalNoiInput: terminalNoi, dispositionCostInput: disposition, timingConvention: DCF_TIMING_CONVENTION.END_OF_PERIOD, preparedByRef: 'X', preparedAt: packetPreparedAt, evidenceRef: 'X' }), /periodAdjustments must be an explicit array/, 'DCF requires explicit period-adjustment review even when none apply');
throws(() => makeTerminal({ amountSar: 0 }), /amountSar must be finite and positive/, 'terminal NOI cannot be zero');
throws(() => createDcfPeriodAdjustment({ adjustmentId: 'NEG', caseId, propertyRef, periodIndex: 1, type: DCF_PERIOD_ADJUSTMENT_TYPE.CAPITAL_EXPENDITURE, direction: DCF_CASH_FLOW_DIRECTION.OUTFLOW, amountSar: -1, source: DCF_ADJUSTMENT_SOURCE.PROFESSIONAL_JUDGMENT, rationale: 'x', evidenceRefs: ['x'], asOfDate: '2026-08-20T00:00:00.000Z', preparedByRef: 'x', preparedAt: '2026-08-21T00:00:00.000Z', reviewedByRef: 'y', reviewedAt: '2026-08-22T00:00:00.000Z', reviewEvidenceRef: 'z' }), /amountSar must be finite and non-negative/, 'negative adjustment amount rejected; direction carries sign');
throws(() => build({ id: 'BAD-TIMING', timing: 'QUARTER_YEAR' }), /timingConvention is invalid/, 'unsupported timing convention rejected');

const tamperedPacket = { ...input, discountRate: 0.50 };
equal(calculateProfessionalDcfIndication(tamperedPacket).status, PROFESSIONAL_DCF_RESULT_STATUS.INVALID_INPUT_PACKET, 'tampered DCF packet rejected by canonical engine');

const excessiveDisposition = makeDisposition({ dispositionCostId: 'EXCESS-DISPOSITION', method: DISPOSITION_COST_METHOD.AMOUNT_SAR, value: 20000000 });
const excessiveResult = calculateProfessionalDcfIndication(build({ id: 'EXCESS-DISPOSITION', dispositionCost: excessiveDisposition }));
equal(excessiveResult.status, PROFESSIONAL_DCF_RESULT_STATUS.REVIEW_REQUIRED, 'disposition cost above terminal value requires review rather than silent repair');
check(excessiveResult.reviewFlags.includes('DISPOSITION_COST_EXCEEDS_GROSS_TERMINAL_VALUE_REVIEW_REQUIRED'), 'excessive disposition flag explicit');

const largeCapex = makeAdjustment({ id: 'LARGE-CAPEX', periodIndex: 1, type: DCF_PERIOD_ADJUSTMENT_TYPE.CAPITAL_EXPENDITURE, direction: DCF_CASH_FLOW_DIRECTION.OUTFLOW, amountSar: 2000000 });
const negativePeriodResult = calculateProfessionalDcfIndication(build({ id: 'NEGATIVE-PERIOD', periodAdjustments: [largeCapex] }));
equal(negativePeriodResult.status, PROFESSIONAL_DCF_RESULT_STATUS.REVIEW_REQUIRED, 'negative unlevered period cash flow remains visible and requires review');
check(negativePeriodResult.reviewFlags.some((flag) => flag.startsWith('NEGATIVE_UNLEVERED_PROPERTY_CASH_FLOW_REVIEW_REQUIRED:')), 'negative property cash flow review flag explicit');

console.log(`WAVE_12C_PROFESSIONAL_DCF=PASS checks=${checks}`);
