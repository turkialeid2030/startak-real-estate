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
  DIRECT_CAP_NOI_BASIS,
  DIRECT_CAP_INPUT_STATUS,
  verifyProfessionalNoiResultIntegrity,
  buildDirectCapitalizationInputPacket,
  verifyDirectCapitalizationInputIntegrity,
} = require('../../src/valuation/direct-capitalization-input');
const {
  DIRECT_CAPITALIZATION_RESULT_STATUS,
  calculateDirectCapitalizationIndication,
} = require('../../src/engines/valuation/direct-capitalization');

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

const caseId = 'CASE-12B-001';
const propertyRef = 'PROPERTY-12B-001';
const valuationDate = '2026-09-01T00:00:00.000Z';
const inputPreparedAt = '2026-09-02T12:00:00.000Z';

function makeNoiResult(stabilizedNoiSar = 800000, overrides = {}) {
  const periodResults = [{
    periodId: 'STABILIZED', periodIndex: 1, label: 'Stabilized', startDate: valuationDate,
    endDate: '2027-09-01T00:00:00.000Z', isStabilized: true,
    potentialGrossIncomeSar: 1000000, vacancyCollectionLossSar: 50000, effectiveGrossIncomeSar: 950000,
    operatingExpensesBeforeReserveSar: 150000, replacementReserveSar: 20000,
    noiBeforeReplacementReserveSar: stabilizedNoiSar, noiAfterReplacementReserveSar: stabilizedNoiSar - 20000,
    selectedNoiConvention: 'BEFORE_REPLACEMENT_RESERVE', selectedNoiSar: stabilizedNoiSar,
    incomeTrace: [], vacancyCollectionLossTrace: {}, operatingExpenseTrace: [], reviewFlags: [], annualizedAmounts: true,
    automaticLeaseOptionExercise: false, automaticMarketRentApplied: false,
  }];
  const core = {
    schemaVersion: 1,
    modelVersion: PROFESSIONAL_NOI_MODEL_VERSION,
    caseId,
    propertyRef,
    valuationDate,
    inputPacketHashSha256: 'a'.repeat(64),
    incomeEvidencePacketHashSha256: 'b'.repeat(64),
    noiConvention: 'BEFORE_REPLACEMENT_RESERVE',
    baselineAnnualContractRentSar: 900000,
    baselineOccupiedAreaSqm: 1000,
    baselineActiveLeaseCount: 3,
    periodResults,
    firstForecastPeriodNoiSar: stabilizedNoiSar,
    stabilizedPeriodIndex: 1,
    stabilizedNoiSar,
    ...overrides,
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

function makeRate({ id = 'CAP-001', type = RATE_INPUT_TYPE.MARKET_CAP_RATE, value = 0.08, asOfDate = '2026-08-20T00:00:00.000Z', preparedAt = '2026-08-25T09:00:00.000Z', reviewedAt = '2026-08-26T10:00:00.000Z' } = {}) {
  return createProfessionalRateInput({
    rateId: id, caseId, propertyRef, type, value,
    source: 'VERIFIED_MARKET_ANALYSIS', sourceLabel: null,
    rationale: `Reviewed market capitalization rate ${id}`,
    evidenceRefs: [`EVID-${id}`], asOfDate,
    preparedByRef: 'VALUER-001', preparedAt,
    reviewedByRef: 'REVIEWER-001', reviewedAt,
    reviewEvidenceRef: `REVIEW-${id}`, confidence: 'HIGH',
  });
}

function build(noi, rate, maxAge = 20, preparedAt = inputPreparedAt, id = 'DIRECT-CAP-INPUT-001') {
  return buildDirectCapitalizationInputPacket({
    packetId: id, caseId, propertyRef, valuationDate,
    professionalNoiResult: noi, marketCapRateInput: rate,
    maximumRateAgeDays: maxAge, selectedNoiBasis: DIRECT_CAP_NOI_BASIS.STABILIZED_NOI,
    preparedByRef: 'VALUATION-TEAM', preparedAt, evidenceRef: `EVID-${id}`,
  });
}

const noi = makeNoiResult();
const capRate = makeRate();
check(verifyProfessionalNoiResultIntegrity(noi), 'qualified NOI result integrity');

const input = build(noi, capRate);
equal(input.status, DIRECT_CAP_INPUT_STATUS.READY_FOR_CANONICAL_DIRECT_CAPITALIZATION, 'direct capitalization input ready');
check(verifyDirectCapitalizationInputIntegrity(input), 'direct capitalization packet integrity');
equal(input.selectedNoiBasis, DIRECT_CAP_NOI_BASIS.STABILIZED_NOI, 'stabilized NOI basis explicit');
close(input.selectedNoiSar, 800000, 'selected stabilized NOI retained');
close(input.marketCapRate, 0.08, 'market cap rate retained');
equal(input.marketCapRateProvenance.ageDays, 12, 'rate age calculated explicitly');
equal(input.automaticMethodSelection, false, 'method not selected automatically');
equal(input.automaticRateDerivation, false, 'rate not derived automatically');
equal(input.capitalizationPerformed, false, 'input packet performs no arithmetic');

const result = calculateDirectCapitalizationIndication(input);
equal(result.status, DIRECT_CAPITALIZATION_RESULT_STATUS.DIRECT_CAPITALIZATION_VALUE_INDICATION_READY, 'direct capitalization indication ready');
close(result.valueIndicationSar, 10000000, 'NOI / cap rate = 10m');
equal(result.indicationType, 'DIRECT_CAPITALIZATION_VALUE_INDICATION', 'method indication type explicit');
equal(result.canonicalCalculationEngine, true, 'canonical engine only');
equal(result.automaticMethodSelection, false, 'engine does not select method');
equal(result.automaticRateDerivation, false, 'engine does not derive cap rate');
equal(result.reconciliationPerformed, false, 'engine does not reconcile methods');
equal(result.finalValuationConclusionEstablished, false, 'method indication is not final valuation');
equal(result.certifiedValuationEstablished, false, 'no certified valuation');
equal(result.transactionAuthorized, false, 'no transaction authority');
check(/^[a-f0-9]{64}$/.test(result.calculationHashSha256), 'direct cap calculation hash');

const stale = build(noi, capRate, 5, inputPreparedAt, 'STALE');
equal(stale.status, DIRECT_CAP_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'stale market cap rate blocked');
check(stale.blockers.some((x) => x.startsWith('MARKET_CAP_RATE_STALE:')), 'stale rate reason explicit');

const futureRate = makeRate({ id: 'FUTURE', asOfDate: '2026-09-02T00:00:00.000Z', preparedAt: '2026-09-02T09:00:00.000Z', reviewedAt: '2026-09-02T10:00:00.000Z' });
const future = build(noi, futureRate, 20, '2026-09-03T12:00:00.000Z', 'FUTURE');
equal(future.status, DIRECT_CAP_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'post-valuation-date rate blocked');
check(future.blockers.includes('MARKET_CAP_RATE_AS_OF_AFTER_VALUATION_DATE'), 'future rate blocker explicit');

const wrongType = makeRate({ id: 'EXIT', type: RATE_INPUT_TYPE.EXIT_CAP_RATE });
equal(build(noi, wrongType, 20, inputPreparedAt, 'WRONG-TYPE').status, DIRECT_CAP_INPUT_STATUS.HOLD_RATE_PROVENANCE, 'exit cap cannot substitute market cap');

const tamperedRate = { ...capRate, value: 0.09 };
equal(build(noi, tamperedRate, 20, inputPreparedAt, 'TAMPER-RATE').status, DIRECT_CAP_INPUT_STATUS.HOLD_INTEGRITY, 'tampered rate fails integrity');

const tamperedNoi = { ...noi, stabilizedNoiSar: 900000 };
equal(build(tamperedNoi, capRate, 20, inputPreparedAt, 'TAMPER-NOI').status, DIRECT_CAP_INPUT_STATUS.HOLD_INTEGRITY, 'tampered NOI fails integrity');

const negativeNoi = makeNoiResult(-100000);
check(verifyProfessionalNoiResultIntegrity(negativeNoi), 'negative NOI can remain an integrity-valid Wave 12A result');
equal(build(negativeNoi, capRate, 20, inputPreparedAt, 'NEGATIVE-NOI').status, DIRECT_CAP_INPUT_STATUS.HOLD_NOI, 'direct cap requires positive stabilized NOI');

const zeroNoi = makeNoiResult(0);
equal(build(zeroNoi, capRate, 20, inputPreparedAt, 'ZERO-NOI').status, DIRECT_CAP_INPUT_STATUS.HOLD_NOI, 'zero stabilized NOI blocked for direct cap');

const tamperedPacket = { ...input, marketCapRate: 0.5 };
equal(calculateDirectCapitalizationIndication(tamperedPacket).status, DIRECT_CAPITALIZATION_RESULT_STATUS.INVALID_INPUT_PACKET, 'tampered direct cap input rejected by canonical engine');

throws(() => buildDirectCapitalizationInputPacket({ packetId: 'BAD-BASIS', caseId, propertyRef, valuationDate, professionalNoiResult: noi, marketCapRateInput: capRate, maximumRateAgeDays: 20, selectedNoiBasis: 'TRAILING_NOI', preparedByRef: 'X', preparedAt: inputPreparedAt, evidenceRef: 'X' }), /selectedNoiBasis is invalid/, 'unsupported NOI basis rejected');
throws(() => buildDirectCapitalizationInputPacket({ packetId: 'NO-FRESHNESS', caseId, propertyRef, valuationDate, professionalNoiResult: noi, marketCapRateInput: capRate, selectedNoiBasis: DIRECT_CAP_NOI_BASIS.STABILIZED_NOI, preparedByRef: 'X', preparedAt: inputPreparedAt, evidenceRef: 'X' }), /maximumRateAgeDays/, 'explicit freshness policy required');

console.log(`WAVE_12B_DIRECT_CAPITALIZATION=PASS checks=${checks}`);
