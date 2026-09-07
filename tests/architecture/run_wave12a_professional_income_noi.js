'use strict';

const assert = require('assert');
const {
  LEASE_EVIDENCE_SOURCE, LEASE_VERIFICATION_STATUS, ESCALATION_TYPE, RECOVERY_TYPE,
  createLeaseEvidenceRecord, createVerifiedRentRollSnapshot, reconcileLeaseIncomeEvidence,
} = require('../../src/market/lease-income-evidence');
const {
  INCOME_FORECAST_LINE_TYPE, INCOME_FORECAST_SOURCE, NOI_CALCULATION_METHOD,
  NOI_EXPENSE_CATEGORY, NOI_CONVENTION, PROFESSIONAL_INCOME_FORECAST_STATUS,
  createIncomeForecastLine, createVacancyCollectionLossAssumption,
  createOperatingExpenseForecastLine, createIncomeForecastPeriod,
  buildProfessionalIncomeForecastInput, verifyProfessionalIncomeForecastInputIntegrity,
} = require('../../src/income/professional-income-forecast');
const { PROFESSIONAL_NOI_RESULT_STATUS, calculateProfessionalNoi } = require('../../src/engines/valuation/professional-income-noi');

let checks = 0;
function check(v, m) { assert.ok(v, m); checks += 1; }
function equal(a, e, m) { assert.strictEqual(a, e, m); checks += 1; }
function close(a, e, m) { assert.ok(Math.abs(a - e) < 1e-6, `${m}: ${a} vs ${e}`); checks += 1; }
function throws(fn, re, m) { assert.throws(fn, re, m); checks += 1; }

const caseId = 'CASE-12A-001';
const propertyRef = 'PROPERTY-12A-001';
const valuationDate = '2026-09-01T00:00:00.000Z';
const sourceAsOfDate = '2026-08-31T00:00:00.000Z';
const preparedAt = '2026-09-02T09:00:00.000Z';
const reviewedAt = '2026-09-02T10:00:00.000Z';
const periodPreparedAt = '2026-09-03T09:00:00.000Z';
const periodReviewedAt = '2026-09-03T10:00:00.000Z';
const packetPreparedAt = '2026-09-04T09:00:00.000Z';

function verification(ref) {
  return { status: LEASE_VERIFICATION_STATUS.VERIFIED, verifiedByRef: 'LEASE-REVIEWER', verifiedAt: '2026-08-30T10:00:00.000Z', evidenceRef: `VERIFY-${ref}` };
}
function makeIncomeEvidencePacket() {
  const lease = createLeaseEvidenceRecord({
    leaseId: 'LEASE-001', caseId, propertyRef, unitRef: 'UNIT-001', tenantRef: 'TENANT-001', leaseInterestRef: 'LEASE-INTEREST-001',
    areaSqm: 1000, baseAnnualRentSar: 1000000, contractedAnnualRentSarAsOfDate: 1000000,
    startDate: '2025-01-01T00:00:00.000Z', expiryDate: '2029-12-31T00:00:00.000Z',
    escalation: { type: ESCALATION_TYPE.NONE }, breakOptions: [], renewalOptions: [], incentives: [], recoveries: { type: RECOVERY_TYPE.NONE },
    sourceClass: LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE, sourceRef: 'LEASE-DOC-001', sourceDocumentHashSha256: 'a'.repeat(64),
    verification: verification('LEASE'), capturedAt: '2026-08-30T09:00:00.000Z',
  });
  const rentRoll = createVerifiedRentRollSnapshot({
    snapshotId: 'RR-001', caseId, propertyRef, asOfDate: valuationDate, totalLettableAreaSqm: 1200, occupiedAreaSqm: 1000,
    annualContractRentSar: 1000000, activeLeaseCount: 1, sourceRef: 'RR-DOC-001', sourceDocumentHashSha256: 'b'.repeat(64),
    verification: verification('RR'), capturedAt: '2026-08-30T09:00:00.000Z',
  });
  return reconcileLeaseIncomeEvidence({ caseId, propertyRef, leaseRecords: [lease], rentRollSnapshot: rentRoll, asOfDate: valuationDate });
}
function prov(source, ref, asOfDate = sourceAsOfDate) {
  return { source, sourceRef: `SRC-${ref}`, rationale: `Explicit professional basis ${ref}`, evidenceRefs: [`EVID-${ref}`], asOfDate,
    preparedByRef: 'ANALYST-001', preparedAt, reviewedByRef: 'REVIEWER-001', reviewedAt, reviewEvidenceRef: `REVIEW-${ref}` };
}
function incomeLine(id, periodIndex, type, amountSar, source = INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT, asOfDate = sourceAsOfDate) {
  return createIncomeForecastLine({ lineId: id, caseId, propertyRef, periodIndex, type, amountSar, ...prov(source, id, asOfDate) });
}
function vacancy(id, periodIndex, method, value, asOfDate = sourceAsOfDate) {
  return createVacancyCollectionLossAssumption({ assumptionId: id, caseId, propertyRef, periodIndex, method, value, ...prov(INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT, id, asOfDate) });
}
function expense(id, periodIndex, category, method, value, asOfDate = sourceAsOfDate) {
  return createOperatingExpenseForecastLine({ expenseId: id, caseId, propertyRef, periodIndex, category, method, value, ...prov(INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT, id, asOfDate) });
}
function makePeriod({ id, index, startDate, endDate, stabilized, rent, recoveries, vacancyRate, maintenance, reserve }) {
  return createIncomeForecastPeriod({
    periodId: id, caseId, propertyRef, periodIndex: index, label: id, startDate, endDate, isStabilized: stabilized,
    incomeLines: [
      incomeLine(`RENT-${index}`, index, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, rent, INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE),
      incomeLine(`REC-${index}`, index, INCOME_FORECAST_LINE_TYPE.RECOVERIES, recoveries),
    ],
    vacancyCollectionLoss: vacancy(`VAC-${index}`, index, NOI_CALCULATION_METHOD.PERCENT_OF_PGI, vacancyRate),
    operatingExpenseLines: [
      expense(`MGMT-${index}`, index, NOI_EXPENSE_CATEGORY.PROPERTY_MANAGEMENT, NOI_CALCULATION_METHOD.PERCENT_OF_EGI, 0.03),
      expense(`MAINT-${index}`, index, NOI_EXPENSE_CATEGORY.REPAIRS_MAINTENANCE, NOI_CALCULATION_METHOD.AMOUNT_SAR, maintenance),
      expense(`RESERVE-${index}`, index, NOI_EXPENSE_CATEGORY.REPLACEMENT_RESERVE, NOI_CALCULATION_METHOD.AMOUNT_SAR, reserve),
    ],
    periodRationale: `Reviewed annualized period ${index}`, preparedByRef: 'VALUER-001', preparedAt: periodPreparedAt,
    reviewedByRef: 'REVIEWER-002', reviewedAt: periodReviewedAt, reviewEvidenceRef: `PERIOD-REVIEW-${index}`,
  });
}
function buildPacket(evidence, periods, convention = NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, id = 'INCOME-FORECAST-001') {
  return buildProfessionalIncomeForecastInput({ packetId: id, caseId, propertyRef, valuationDate, incomeEvidencePacket: evidence, forecastPeriods: periods,
    noiConvention: convention, preparedByRef: 'VALUATION-TEAM', preparedAt: packetPreparedAt, packetEvidenceRef: `PACKET-EVID-${id}` });
}

const evidence = makeIncomeEvidencePacket();
equal(evidence.readyForIncomeAnalysisHandoff, true, 'upstream lease-income evidence ready');
equal(evidence.noiCalculated, false, 'upstream evidence gate performs no NOI');

const period1 = makePeriod({ id: 'YEAR-1', index: 1, startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', stabilized: false, rent: 1000000, recoveries: 50000, vacancyRate: 0.05, maintenance: 150000, reserve: 20000 });
const period2 = makePeriod({ id: 'STABILIZED', index: 2, startDate: '2027-09-01T00:00:00.000Z', endDate: '2028-09-01T00:00:00.000Z', stabilized: true, rent: 1050000, recoveries: 60000, vacancyRate: 0.04, maintenance: 155000, reserve: 25000 });

const packet = buildPacket(evidence, [period1, period2]);
equal(packet.status, PROFESSIONAL_INCOME_FORECAST_STATUS.READY_FOR_CANONICAL_NOI, 'professional income forecast input ready');
check(verifyProfessionalIncomeForecastInputIntegrity(packet), 'professional income packet integrity');
equal(packet.baselineAnnualContractRentSar, 1000000, 'lease baseline retained');
equal(packet.stabilizedPeriodIndex, 2, 'stabilized period explicit');
equal(packet.implicitVacancyAssumptionUsed, false, 'no implicit vacancy assumption');
equal(packet.capitalizationPerformed, false, 'input packet performs no capitalization');

const result = calculateProfessionalNoi(packet);
equal(result.status, PROFESSIONAL_NOI_RESULT_STATUS.PROFESSIONAL_NOI_READY, 'canonical professional NOI ready');
equal(result.periodResults.length, 2, 'two periods calculated');
close(result.periodResults[0].potentialGrossIncomeSar, 1050000, 'year 1 PGI');
close(result.periodResults[0].vacancyCollectionLossSar, 52500, 'year 1 vacancy loss');
close(result.periodResults[0].effectiveGrossIncomeSar, 997500, 'year 1 EGI');
close(result.periodResults[0].operatingExpensesBeforeReserveSar, 179925, 'year 1 opex before reserve');
close(result.periodResults[0].replacementReserveSar, 20000, 'year 1 reserve');
close(result.firstForecastPeriodNoiSar, 817575, 'year 1 selected NOI');
close(result.stabilizedNoiSar, 878632, 'stabilized NOI before reserve');
equal(result.capitalizationPerformed, false, 'NOI engine performs no capitalization');
equal(result.dcfPerformed, false, 'NOI engine performs no DCF');
equal(result.debtServiceIncluded, false, 'NOI remains unlevered');
equal(result.incomeTaxCalculated, false, 'NOI engine performs no tax calculation');
equal(result.finalValuationConclusionEstablished, false, 'NOI is not final valuation');
equal(result.transactionAuthorized, false, 'NOI has no transaction authority');
check(/^[a-f0-9]{64}$/.test(result.calculationHashSha256), 'deterministic NOI calculation hash');

const afterReserve = calculateProfessionalNoi(buildPacket(evidence, [period1, period2], NOI_CONVENTION.AFTER_REPLACEMENT_RESERVE, 'AFTER-RESERVE'));
close(afterReserve.stabilizedNoiSar, 853632, 'explicit after-reserve convention applied');

throws(() => incomeLine('BAD-CONTRACT', 1, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, 1, INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT), /CONTRACTUAL_RENT_REQUIRES_VERIFIED_LEASE_EVIDENCE/, 'contractual rent requires verified lease evidence');
throws(() => vacancy('BAD-VAC', 1, NOI_CALCULATION_METHOD.PERCENT_OF_PGI, 1.01), /decimal <= 1/, 'vacancy >100% rejected');
throws(() => expense('BAD-EXP', 1, NOI_EXPENSE_CATEGORY.PROPERTY_MANAGEMENT, NOI_CALCULATION_METHOD.PERCENT_OF_PGI, 0.1), /AMOUNT_SAR or PERCENT_OF_EGI/, 'unsupported expense basis rejected');

const noStablePeriod = makePeriod({ id: 'NO-STABLE', index: 1, startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', stabilized: false, rent: 100, recoveries: 0, vacancyRate: 0, maintenance: 0, reserve: 0 });
equal(buildPacket(evidence, [noStablePeriod], NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, 'NO-STABLE').status, PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_FORECAST_STRUCTURE, 'exactly one stabilized period required');

const tamperedStable = { ...period2, isStabilized: false };
equal(buildPacket(evidence, [period1, tamperedStable], NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, 'TAMPER-STABLE').status, PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INTEGRITY, 'tampered stabilized flag fails integrity');
const tamperedLine = { ...period1.incomeLines[0], amountSar: 999999999 };
const tamperedPeriod = { ...period1, incomeLines: [tamperedLine, ...period1.incomeLines.slice(1)] };
equal(buildPacket(evidence, [tamperedPeriod, period2], NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, 'TAMPER-LINE').status, PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INTEGRITY, 'tampered nested line fails integrity');

const futureLine = incomeLine('FUTURE', 1, INCOME_FORECAST_LINE_TYPE.MARKET_RENT, 100, INCOME_FORECAST_SOURCE.VERIFIED_MARKET_EVIDENCE, '2026-09-02T00:00:00.000Z');
const futurePeriod = createIncomeForecastPeriod({ periodId: 'FUTURE-PERIOD', caseId, propertyRef, periodIndex: 1, label: 'FUTURE', startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', isStabilized: true, incomeLines: [futureLine], vacancyCollectionLoss: vacancy('FUTURE-VAC', 1, NOI_CALCULATION_METHOD.AMOUNT_SAR, 0), operatingExpenseLines: [expense('FUTURE-OPEX', 1, NOI_EXPENSE_CATEGORY.OTHER_OPERATING_EXPENSE, NOI_CALCULATION_METHOD.AMOUNT_SAR, 0)], periodRationale: 'future evidence test', preparedByRef: 'V', preparedAt: periodPreparedAt, reviewedByRef: 'R', reviewedAt: periodReviewedAt, reviewEvidenceRef: 'REV-FUTURE' });
equal(buildPacket(evidence, [futurePeriod], NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, 'FUTURE').status, PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_PROVENANCE, 'future-as-of evidence blocked');

const excessiveLossPeriod = createIncomeForecastPeriod({ periodId: 'EXCESSIVE-LOSS', caseId, propertyRef, periodIndex: 1, label: 'EXCESSIVE LOSS', startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', isStabilized: true, incomeLines: [incomeLine('SMALL-INCOME', 1, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, 100, INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE)], vacancyCollectionLoss: vacancy('LOSS-AMOUNT', 1, NOI_CALCULATION_METHOD.AMOUNT_SAR, 101), operatingExpenseLines: [expense('ZERO-OPEX', 1, NOI_EXPENSE_CATEGORY.OTHER_OPERATING_EXPENSE, NOI_CALCULATION_METHOD.AMOUNT_SAR, 0)], periodRationale: 'explicit excessive loss case', preparedByRef: 'V', preparedAt: periodPreparedAt, reviewedByRef: 'R', reviewedAt: periodReviewedAt, reviewEvidenceRef: 'REV-LOSS' });
const excessiveLossPacket = buildPacket(evidence, [excessiveLossPeriod], NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, 'EXCESSIVE-LOSS');
equal(excessiveLossPacket.status, PROFESSIONAL_INCOME_FORECAST_STATUS.READY_FOR_CANONICAL_NOI, 'explicit economics may reach canonical engine');
equal(calculateProfessionalNoi(excessiveLossPacket).status, PROFESSIONAL_NOI_RESULT_STATUS.INVALID_ECONOMIC_CASE, 'loss above PGI fails closed');

const negativeNoiPeriod = createIncomeForecastPeriod({ periodId: 'NEGATIVE-NOI', caseId, propertyRef, periodIndex: 1, label: 'NEGATIVE NOI', startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', isStabilized: true, incomeLines: [incomeLine('NEG-RENT', 1, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, 100, INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE)], vacancyCollectionLoss: vacancy('NEG-VAC', 1, NOI_CALCULATION_METHOD.AMOUNT_SAR, 0), operatingExpenseLines: [expense('NEG-OPEX', 1, NOI_EXPENSE_CATEGORY.REPAIRS_MAINTENANCE, NOI_CALCULATION_METHOD.AMOUNT_SAR, 150)], periodRationale: 'negative NOI meaningful', preparedByRef: 'V', preparedAt: periodPreparedAt, reviewedByRef: 'R', reviewedAt: periodReviewedAt, reviewEvidenceRef: 'REV-NEG' });
const negativeResult = calculateProfessionalNoi(buildPacket(evidence, [negativeNoiPeriod], NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, 'NEGATIVE'));
equal(negativeResult.status, PROFESSIONAL_NOI_RESULT_STATUS.PROFESSIONAL_NOI_READY, 'negative NOI retained');
close(negativeResult.stabilizedNoiSar, -50, 'negative stabilized NOI retained');
check(negativeResult.periodResults[0].reviewFlags.includes('NON_POSITIVE_NOI_REVIEW_REQUIRED'), 'negative NOI review flag');

const tamperedPacket = { ...packet, noiConvention: NOI_CONVENTION.AFTER_REPLACEMENT_RESERVE };
equal(calculateProfessionalNoi(tamperedPacket).status, PROFESSIONAL_NOI_RESULT_STATUS.INVALID_INPUT_PACKET, 'tampered canonical packet rejected');

console.log(`WAVE_12A_PROFESSIONAL_INCOME_NOI=PASS checks=${checks}`);
