'use strict';

const assert = require('assert');
const {
  LEASE_EVIDENCE_SOURCE,
  LEASE_VERIFICATION_STATUS,
  ESCALATION_TYPE,
  RECOVERY_TYPE,
  createLeaseEvidenceRecord,
  createVerifiedRentRollSnapshot,
  reconcileLeaseIncomeEvidence,
} = require('../../src/market/lease-income-evidence');
const {
  INCOME_FORECAST_LINE_TYPE,
  INCOME_FORECAST_SOURCE,
  NOI_CALCULATION_METHOD,
  NOI_EXPENSE_CATEGORY,
  NOI_CONVENTION,
  PROFESSIONAL_INCOME_FORECAST_STATUS,
  createIncomeForecastLine,
  createVacancyCollectionLossAssumption,
  createOperatingExpenseForecastLine,
  createIncomeForecastPeriod,
  buildProfessionalIncomeForecastInput,
  verifyProfessionalIncomeForecastInputIntegrity,
} = require('../../src/income/professional-income-forecast');
const {
  PROFESSIONAL_NOI_RESULT_STATUS,
  calculateProfessionalNoi,
} = require('../../src/engines/valuation/professional-income-noi');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function equal(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
function close(actual, expected, message) { assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`); checks += 1; }
function throws(fn, matcher, message) { assert.throws(fn, matcher, message); checks += 1; }

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
  return {
    status: LEASE_VERIFICATION_STATUS.VERIFIED,
    verifiedByRef: 'LEASE-REVIEWER',
    verifiedAt: '2026-08-30T10:00:00.000Z',
    evidenceRef: `VERIFY-${ref}`,
  };
}

function incomeEvidencePacket() {
  const lease = createLeaseEvidenceRecord({
    leaseId: 'LEASE-001', caseId, propertyRef, unitRef: 'UNIT-001', tenantRef: 'TENANT-001', leaseInterestRef: 'LEASE-INTEREST-001',
    areaSqm: 1000, baseAnnualRentSar: 1000000, contractedAnnualRentSarAsOfDate: 1000000,
    startDate: '2025-01-01T00:00:00.000Z', expiryDate: '2029-12-31T00:00:00.000Z',
    escalation: { type: ESCALATION_TYPE.NONE }, breakOptions: [], renewalOptions: [], incentives: [], recoveries: { type: RECOVERY_TYPE.NONE },
    sourceClass: LEASE_EVIDENCE_SOURCE.VERIFIED_EXECUTED_LEASE, sourceRef: 'LEASE-DOC-001', sourceDocumentHashSha256: 'a'.repeat(64),
    verification: verification('LEASE'), capturedAt: '2026-08-30T09:00:00.000Z',
  });
  const rentRoll = createVerifiedRentRollSnapshot({
    snapshotId: 'RR-001', caseId, propertyRef, asOfDate: valuationDate,
    totalLettableAreaSqm: 1200, occupiedAreaSqm: 1000, annualContractRentSar: 1000000, activeLeaseCount: 1,
    sourceRef: 'RR-DOC-001', sourceDocumentHashSha256: 'b'.repeat(64), verification: verification('RR'), capturedAt: '2026-08-30T09:00:00.000Z',
  });
  return reconcileLeaseIncomeEvidence({ caseId, propertyRef, leaseRecords: [lease], rentRollSnapshot: rentRoll, asOfDate: valuationDate });
}

function provenance(source = INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT, ref = 'GEN') {
  return {
    source,
    sourceRef: `SRC-${ref}`,
    rationale: `Explicit professional basis ${ref}`,
    evidenceRefs: [`EVID-${ref}`],
    asOfDate: sourceAsOfDate,
    preparedByRef: 'ANALYST-001', preparedAt,
    reviewedByRef: 'REVIEWER-001', reviewedAt,
    reviewEvidenceRef: `REVIEW-${ref}`,
  };
}

function incomeLine(id, periodIndex, type, amountSar, source = INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT, asOfDate = sourceAsOfDate) {
  return createIncomeForecastLine({
    lineId: id, caseId, propertyRef, periodIndex, type, amountSar,
    ...provenance(source, id), asOfDate,
  });
}
function vacancy(id, periodIndex, method, value, asOfDate = sourceAsOfDate) {
  return createVacancyCollectionLossAssumption({
    assumptionId: id, caseId, propertyRef, periodIndex, method, value,
    ...provenance(INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT, id), asOfDate,
  });
}
function expense(id, periodIndex, category, method, value, asOfDate = sourceAsOfDate) {
  return createOperatingExpenseForecastLine({
    expenseId: id, caseId, propertyRef, periodIndex, category, method, value,
    ...provenance(INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT, id), asOfDate,
  });
}
function period({ id, index, startDate, endDate, stabilized, contractRent, recoveries, vacancyRate, maintenance, reserve }) {
  return createIncomeForecastPeriod({
    periodId: id, caseId, propertyRef, periodIndex: index, label: id,
    startDate, endDate, isStabilized: stabilized,
    incomeLines: [
      incomeLine(`RENT-${index}`, index, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, contractRent, INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE),
      incomeLine(`REC-${index}`, index, INCOME_FORECAST_LINE_TYPE.RECOVERIES, recoveries, INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT),
    ],
    vacancyCollectionLoss: vacancy(`VAC-${index}`, index, NOI_CALCULATION_METHOD.PERCENT_OF_PGI, vacancyRate),
    operatingExpenseLines: [
      expense(`MGMT-${index}`, index, NOI_EXPENSE_CATEGORY.PROPERTY_MANAGEMENT, NOI_CALCULATION_METHOD.PERCENT_OF_EGI, 0.03),
      expense(`MAINT-${index}`, index, NOI_EXPENSE_CATEGORY.REPAIRS_MAINTENANCE, NOI_CALCULATION_METHOD.AMOUNT_SAR, maintenance),
      expense(`RESERVE-${index}`, index, NOI_EXPENSE_CATEGORY.REPLACEMENT_RESERVE, NOI_CALCULATION_METHOD.AMOUNT_SAR, reserve),
    ],
    periodRationale: `Reviewed annualized period ${index}`,
    preparedByRef: 'VALUER-001', preparedAt: periodPreparedAt,
    reviewedByRef: 'REVIEWER-002', reviewedAt: periodReviewedAt, reviewEvidenceRef: `PERIOD-REVIEW-${index}`,
  });
}

const evidence = incomeEvidencePacket();
equal(evidence.readyForIncomeAnalysisHandoff, true, 'upstream lease-income evidence should be ready');
equal(evidence.noiCalculated, false, 'upstream evidence gate must not calculate NOI');

const period1 = period({ id: 'YEAR-1', index: 1, startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', stabilized: false, contractRent: 1000000, recoveries: 50000, vacancyRate: 0.05, maintenance: 150000, reserve: 20000 });
const period2 = period({ id: 'STABILIZED', index: 2, startDate: '2027-09-01T00:00:00.000Z', endDate: '2028-09-01T00:00:00.000Z', stabilized: true, contractRent: 1050000, recoveries: 60000, vacancyRate: 0.04, maintenance: 155000, reserve: 25000 });

const packet = buildProfessionalIncomeForecastInput({
  packetId: 'INCOME-FORECAST-001', caseId, propertyRef, valuationDate, incomeEvidencePacket: evidence,
  forecastPeriods: [period1, period2], noiConvention: NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE,
  preparedByRef: 'VALUATION-TEAM', preparedAt: packetPreparedAt, packetEvidenceRef: 'INCOME-FORECAST-PACKET-EVIDENCE',
});
equal(packet.status, PROFESSIONAL_INCOME_FORECAST_STATUS.READY_FOR_CANONICAL_NOI, 'professional income forecast input ready');
check(verifyProfessionalIncomeForecastInputIntegrity(packet), 'professional income packet integrity');
equal(packet.baselineAnnualContractRentSar, 1000000, 'lease evidence baseline retained');
equal(packet.stabilizedPeriodIndex, 2, 'explicit stabilized period retained');
equal(packet.implicitVacancyAssumptionUsed, false, 'vacancy cannot be silently assumed');
equal(packet.capitalizationPerformed, false, 'input packet performs no capitalization');

const result = calculateProfessionalNoi(packet);
equal(result.status, PROFESSIONAL_NOI_RESULT_STATUS.PROFESSIONAL_NOI_READY, 'canonical professional NOI ready');
equal(result.periodResults.length, 2, 'two forecast periods calculated');
close(result.periodResults[0].potentialGrossIncomeSar, 1050000, 'year 1 PGI');
close(result.periodResults[0].vacancyCollectionLossSar, 52500, 'year 1 vacancy/collection loss');
close(result.periodResults[0].effectiveGrossIncomeSar, 997500, 'year 1 EGI');
close(result.periodResults[0].operatingExpensesBeforeReserveSar, 179925, 'year 1 operating expense before reserve');
close(result.periodResults[0].replacementReserveSar, 20000, 'year 1 replacement reserve');
close(result.periodResults[0].noiBeforeReplacementReserveSar, 817575, 'year 1 NOI before reserve');
close(result.periodResults[0].noiAfterReplacementReserveSar, 797575, 'year 1 NOI after reserve');
close(result.firstForecastPeriodNoiSar, 817575, 'selected first period NOI follows explicit convention');
close(result.stabilizedNoiSar, 878632, 'stabilized selected NOI');
equal(result.capitalizationPerformed, false, 'NOI engine must not capitalize');
equal(result.dcfPerformed, false, 'NOI engine must not perform DCF');
equal(result.debtServiceIncluded, false, 'NOI must remain unlevered');
equal(result.incomeTaxCalculated, false, 'NOI engine must not calculate tax');
equal(result.finalValuationConclusionEstablished, false, 'NOI output is not final valuation');
equal(result.transactionAuthorized, false, 'NOI output has no transaction authority');
check(/^[a-f0-9]{64}$/.test(result.calculationHashSha256), 'NOI result has deterministic calculation hash');

throws(() => incomeLine('BAD-CONTRACT', 1, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, 1, INCOME_FORECAST_SOURCE.PROFESSIONAL_JUDGMENT), /CONTRACTUAL_RENT_REQUIRES_VERIFIED_LEASE_EVIDENCE/, 'contractual rent requires verified lease evidence');
throws(() => vacancy('BAD-VAC', 1, NOI_CALCULATION_METHOD.PERCENT_OF_PGI, 1.01), /decimal <= 1/, 'vacancy percentage >100% rejected');
throws(() => expense('BAD-EXP', 1, NOI_EXPENSE_CATEGORY.PROPERTY_MANAGEMENT, NOI_CALCULATION_METHOD.PERCENT_OF_PGI, 0.1), /AMOUNT_SAR or PERCENT_OF_EGI/, 'expense cannot use unsupported percent basis');
throws(() => createIncomeForecastPeriod({ periodId: 'NO-OPEX', caseId, propertyRef, periodIndex: 1, label: 'NO OPEX', startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', isStabilized: true, incomeLines: [incomeLine('ONE', 1, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, 1, INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE)], vacancyCollectionLoss: vacancy('V', 1, NOI_CALCULATION_METHOD.AMOUNT_SAR, 0), operatingExpenseLines: [], periodRationale: 'x', preparedByRef: 'x', preparedAt: periodPreparedAt, reviewedByRef: 'y', reviewedAt: periodReviewedAt, reviewEvidenceRef: 'z' }), /operatingExpenseLines must contain/, 'implicit zero operating expense is rejected');

const noStabilized = buildProfessionalIncomeForecastInput({ packetId: 'NO-STAB', caseId, propertyRef, valuationDate, incomeEvidencePacket: evidence, forecastPeriods: [{ ...period1, isStabilized: false, incomeForecastPeriodHashSha256: period1.incomeForecastPeriodHashSha256 }], noiConvention: NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, preparedByRef: 'X', preparedAt: packetPreparedAt, packetEvidenceRef: 'X' });
equal(noStabilized.status, PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INTEGRITY, 'tampering stabilized flag without rehash fails integrity first');

const validNoStabilized = createIncomeForecastPeriod({ ...period1, isStabilized: false });
const noStabilizedValidHash = buildProfessionalIncomeForecastInput({ packetId: 'NO-STAB-VALID', caseId, propertyRef, valuationDate, incomeEvidencePacket: evidence, forecastPeriods: [validNoStabilized], noiConvention: NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, preparedByRef: 'X', preparedAt: packetPreparedAt, packetEvidenceRef: 'X' });
equal(noStabilizedValidHash.status, PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_FORECAST_STRUCTURE, 'exactly one stabilized period required');

const tamperedLine = { ...period1.incomeLines[0], amountSar: 999999999 };
const tamperedPeriod = { ...period1, incomeLines: [tamperedLine, ...period1.incomeLines.slice(1)] };
const tamperedInput = buildProfessionalIncomeForecastInput({ packetId: 'TAMPER', caseId, propertyRef, valuationDate, incomeEvidencePacket: evidence, forecastPeriods: [tamperedPeriod, period2], noiConvention: NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, preparedByRef: 'X', preparedAt: packetPreparedAt, packetEvidenceRef: 'X' });
equal(tamperedInput.status, PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_INTEGRITY, 'tampered nested forecast line fails integrity');

const futureLine = incomeLine('FUTURE', 1, INCOME_FORECAST_LINE_TYPE.MARKET_RENT, 100, INCOME_FORECAST_SOURCE.VERIFIED_MARKET_EVIDENCE, '2026-09-02T00:00:00.000Z');
const futurePeriod = createIncomeForecastPeriod({ ...period1, periodId: 'FUTURE-PERIOD', incomeLines: [futureLine], periodRationale: 'future evidence test' });
const futurePacket = buildProfessionalIncomeForecastInput({ packetId: 'FUTURE', caseId, propertyRef, valuationDate, incomeEvidencePacket: evidence, forecastPeriods: [futurePeriod], noiConvention: NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, preparedByRef: 'X', preparedAt: packetPreparedAt, packetEvidenceRef: 'X' });
equal(futurePacket.status, PROFESSIONAL_INCOME_FORECAST_STATUS.HOLD_PROVENANCE, 'future-as-of evidence cannot support valuation date');

const excessiveLossPeriod = createIncomeForecastPeriod({
  periodId: 'EXCESSIVE-LOSS', caseId, propertyRef, periodIndex: 1, label: 'EXCESSIVE LOSS', startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', isStabilized: true,
  incomeLines: [incomeLine('SMALL-INCOME', 1, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, 100, INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE)],
  vacancyCollectionLoss: vacancy('LOSS-AMOUNT', 1, NOI_CALCULATION_METHOD.AMOUNT_SAR, 101),
  operatingExpenseLines: [expense('ZERO-OPEX', 1, NOI_EXPENSE_CATEGORY.OTHER_OPERATING_EXPENSE, NOI_CALCULATION_METHOD.AMOUNT_SAR, 0)],
  periodRationale: 'explicit excessive loss case', preparedByRef: 'V', preparedAt: periodPreparedAt, reviewedByRef: 'R', reviewedAt: periodReviewedAt, reviewEvidenceRef: 'REV',
});
const excessiveLossPacket = buildProfessionalIncomeForecastInput({ packetId: 'EXCESSIVE-LOSS', caseId, propertyRef, valuationDate, incomeEvidencePacket: evidence, forecastPeriods: [excessiveLossPeriod], noiConvention: NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, preparedByRef: 'X', preparedAt: packetPreparedAt, packetEvidenceRef: 'X' });
equal(excessiveLossPacket.status, PROFESSIONAL_INCOME_FORECAST_STATUS.READY_FOR_CANONICAL_NOI, 'explicit economic assumptions may reach canonical engine');
equal(calculateProfessionalNoi(excessiveLossPacket).status, PROFESSIONAL_NOI_RESULT_STATUS.INVALID_ECONOMIC_CASE, 'loss above PGI fails closed in canonical engine');

const negativeNoiPeriod = createIncomeForecastPeriod({
  periodId: 'NEGATIVE-NOI', caseId, propertyRef, periodIndex: 1, label: 'NEGATIVE NOI', startDate: valuationDate, endDate: '2027-09-01T00:00:00.000Z', isStabilized: true,
  incomeLines: [incomeLine('NEG-RENT', 1, INCOME_FORECAST_LINE_TYPE.CONTRACTUAL_RENT, 100, INCOME_FORECAST_SOURCE.VERIFIED_LEASE_EVIDENCE)],
  vacancyCollectionLoss: vacancy('NEG-VAC', 1, NOI_CALCULATION_METHOD.AMOUNT_SAR, 0),
  operatingExpenseLines: [expense('NEG-OPEX', 1, NOI_EXPENSE_CATEGORY.REPAIRS_MAINTENANCE, NOI_CALCULATION_METHOD.AMOUNT_SAR, 150)],
  periodRationale: 'negative NOI is economically meaningful', preparedByRef: 'V', preparedAt: periodPreparedAt, reviewedByRef: 'R', reviewedAt: periodReviewedAt, reviewEvidenceRef: 'REV',
});
const negativeNoiPacket = buildProfessionalIncomeForecastInput({ packetId: 'NEGATIVE-NOI', caseId, propertyRef, valuationDate, incomeEvidencePacket: evidence, forecastPeriods: [negativeNoiPeriod], noiConvention: NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE, preparedByRef: 'X', preparedAt: packetPreparedAt, packetEvidenceRef: 'X' });
const negativeNoiResult = calculateProfessionalNoi(negativeNoiPacket);
equal(negativeNoiResult.status, PROFESSIONAL_NOI_RESULT_STATUS.PROFESSIONAL_NOI_READY, 'negative NOI is retained, not fabricated away');
close(negativeNoiResult.stabilizedNoiSar, -50, 'negative stabilized NOI retained');
check(negativeNoiResult.periodResults[0].reviewFlags.includes('NON_POSITIVE_NOI_REVIEW_REQUIRED'), 'negative NOI carries professional review flag');

const tamperedPacket = { ...packet, noiConvention: NOI_CONVENTION.AFTER_REPLACEMENT_RESERVE };
equal(calculateProfessionalNoi(tamperedPacket).status, PROFESSIONAL_NOI_RESULT_STATUS.INVALID_INPUT_PACKET, 'tampered canonical input packet rejected');

console.log(`WAVE_12A_PROFESSIONAL_INCOME_NOI=PASS checks=${checks}`);
