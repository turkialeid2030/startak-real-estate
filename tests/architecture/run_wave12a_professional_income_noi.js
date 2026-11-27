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
let originalLeaseRecords,originalRentRoll;
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
  originalLeaseRecords=[lease];originalRentRoll=rentRoll;
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

const {professionalNoiResultCore,verifyProfessionalNoiResultIntegrity}=require('../../src/valuation/direct-capitalization-input');
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const digest=v=>require('crypto').createHash('sha256').update(JSON.stringify(canon(v))).digest('hex');
equal(verifyProfessionalNoiResultIntegrity(JSON.parse(JSON.stringify(result))),true,'V633 actual engine detailed trace');
equal(verifyProfessionalNoiResultIntegrity(negativeResult),true,'V633 negative NOI trace retained');
const p=result.periodResults[0];
for(const patch of [
 {incomeTrace:[]},{incomeTrace:[{...p.incomeTrace[0],amountSar:1},...p.incomeTrace.slice(1)]},
 {incomeTrace:[p.incomeTrace[0],p.incomeTrace[0]]},{vacancyCollectionLossTrace:{}},{vacancyCollectionLossTrace:{...p.vacancyCollectionLossTrace,inputValue:0.99}},
 {operatingExpenseTrace:[]},{operatingExpenseTrace:[{...p.operatingExpenseTrace[0],calculatedAmountSar:1},...p.operatingExpenseTrace.slice(1)]},
 {operatingExpenseTrace:[{...p.operatingExpenseTrace[0],category:'REPLACEMENT_RESERVE'},...p.operatingExpenseTrace.slice(1)]},
 {reviewFlags:['UNSUPPORTED']}
]){
 const changed={...result,periodResults:[{...p,...patch},...result.periodResults.slice(1)]};
 changed.calculationHashSha256=digest(professionalNoiResultCore(changed));
 equal(verifyProfessionalNoiResultIntegrity(changed),false,'V633 rehashed trace rejected');
}
for(const patch of [{transactionAuthorized:true},{automaticMarketRentApplied:true},{stabilizedPeriodIndex:1},{forecastPeriods:[period2,period1]},{forecastPeriods:[{...period1,incomeLines:[{...period1.incomeLines[0],amountSar:1}]},period2]}]){
 const changed={...packet,...patch},core={...changed};
 for(const k of ['professionalIncomeForecastInputHashSha256','status','blockers','readyForCanonicalNoi','implicitVacancyAssumptionUsed','automaticLeaseOptionExercise','automaticMarketRentApplied','canonicalCalculationEngineRequired','capitalizationPerformed','dcfPerformed','financialAnalysisPerformed','certifiedValuationEstablished','transactionAuthorized','semantics'])delete core[k];
 changed.professionalIncomeForecastInputHashSha256=digest(core);
 equal(verifyProfessionalIncomeForecastInputIntegrity(changed),false,'V633 rehashed forecast contradiction rejected');
 equal(calculateProfessionalNoi(changed).status,PROFESSIONAL_NOI_RESULT_STATUS.INVALID_INPUT_PACKET,'V633 engine rejects invalid forecast');
}
equal(calculateProfessionalNoi(JSON.parse(JSON.stringify(packet))).calculationHashSha256,result.calculationHashSha256,'V633 forecast roundtrip');
console.log('W06_V633_DETAILED_NOI_TRACE=PASS negative_cases=14 positive_checks=3');
console.log(`WAVE_12A_PROFESSIONAL_INCOME_NOI=PASS checks=${checks}`);

 // V6.53 — end-to-end supplied-source rebuild for both income methods.
 const {evaluateSourceInputReplay}=require('../../src/valuation-reconciliation/source-input-replay');
 const {createProfessionalRateInput}=require('../../src/valuation/professional-method-input-provenance');
 const {buildDirectCapitalizationInputPacket}=require('../../src/valuation/direct-capitalization-input');
 const {calculateDirectCapitalizationIndication}=require('../../src/engines/valuation/direct-capitalization');
 const dcf=require('../../src/valuation/professional-dcf-input');
 const {calculateProfessionalDcfIndication}=require('../../src/engines/valuation/professional-dcf');
 const scope53={caseId,propertyRef,valuationDate},asOf53='2026-09-10T00:00:00Z',methodPrepared53='2026-09-05T00:00:00Z';
 const source53={leaseRecords:originalLeaseRecords,rentRollSnapshot:originalRentRoll,forecastDraft:{...scope53,packetId:'INCOME-FORECAST-001',forecastPeriods:[period1,period2],noiConvention:NOI_CONVENTION.BEFORE_REPLACEMENT_RESERVE,preparedByRef:'VALUATION-TEAM',preparedAt:packetPreparedAt,packetEvidenceRef:'PACKET-EVID-INCOME-FORECAST-001'}};
 function rate53(rateId,type,value){return createProfessionalRateInput({rateId,caseId,propertyRef,type,value,source:'VERIFIED_MARKET_ANALYSIS',sourceLabel:null,rationale:'SYNTHETIC',evidenceRefs:['EVID'],asOfDate:'2026-08-20',preparedByRef:'V',preparedAt:'2026-08-25',reviewedByRef:'R',reviewedAt:'2026-08-26',reviewEvidenceRef:'RE',confidence:'HIGH'});}
 const methodBase53={...scope53,preparedByRef:'V',preparedAt:methodPrepared53,evidenceRef:'SYNTHETIC'};
 const capDraft53={...methodBase53,packetId:'CAP53',marketCapRateInput:rate53('CAP','MARKET_CAP_RATE',0.08),maximumRateAgeDays:30};
 const capPacket53=buildDirectCapitalizationInputPacket({...capDraft53,professionalNoiResult:result});
 const capResult53=calculateDirectCapitalizationIndication(capPacket53);
 const review53={caseId,propertyRef,rationale:'SYNTHETIC',evidenceRefs:['EVID'],preparedByRef:'V',preparedAt:'2026-08-25',reviewedByRef:'R',reviewedAt:'2026-08-26',reviewEvidenceRef:'RE'};
 const dcfDraft53={...methodBase53,packetId:'DCF53',periodAdjustments:[],discountRateInput:rate53('DISC','DISCOUNT_RATE',0.1),exitCapRateInput:rate53('EXIT','EXIT_CAP_RATE',0.08),maximumDiscountRateAgeDays:30,maximumExitCapRateAgeDays:30,terminalNoiInput:dcf.createTerminalNoiInput({...review53,terminalNoiId:'T',amountSar:900000,source:'EXPLICIT_FORECAST',asOfDate:'2026-08-20'}),dispositionCostInput:dcf.createDispositionCostInput({...review53,dispositionCostId:'D',method:'PERCENT_OF_GROSS_TERMINAL_VALUE',value:0.02}),timingConvention:'END_OF_PERIOD'};
 const dcfPacket53=dcf.buildProfessionalDcfInputPacket({...dcfDraft53,professionalNoiResult:result});
 const dcfResult53=calculateProfessionalDcfIndication(dcfPacket53);
 const replay53={...scope53,asOf:asOf53,methodIndications:[{id:'CAP',sourceResult:capResult53},{id:'DCF',sourceResult:dcfResult53}],methodInputPacketsByIndicationId:{CAP:capPacket53,DCF:dcfPacket53},sourceRebuildsByIndicationId:{CAP:{methodInputDraft:capDraft53,incomeSource:source53},DCF:{methodInputDraft:dcfDraft53,incomeSource:source53}}};
 const ok53=evaluateSourceInputReplay(replay53);equal(ok53.status,'READY_FOR_SOURCE_INPUT_REPLAY_REVIEW',JSON.stringify(ok53.blockers));equal(ok53.traces.length,2,'two source rebuilt methods');equal(ok53.traces[0].noiResultHashSha256,ok53.traces[1].noiResultHashSha256,'common NOI result');equal(ok53.originalSourceInputsIndependentlyRebuilt,false,'no independent evidence claim');
 equal(evaluateSourceInputReplay(JSON.parse(JSON.stringify(replay53))).status,'READY_FOR_SOURCE_INPUT_REPLAY_REVIEW','JSON roundtrip');
 function reject53(source,methodDraft=capDraft53){const o=evaluateSourceInputReplay({...replay53,sourceRebuildsByIndicationId:{...replay53.sourceRebuildsByIndicationId,CAP:{methodInputDraft:methodDraft,incomeSource:source}}});equal(o.status,'HOLD_SOURCE_INPUT_REPLAY',JSON.stringify(o.blockers));equal(o.traces.length,0,'no partial source trace');}
 reject53({...source53,leaseRecords:[]});reject53({...source53,leaseRecords:[{...originalLeaseRecords[0],contractedAnnualRentSarAsOfDate:1}]});reject53({...source53,rentRollSnapshot:{...originalRentRoll,annualContractRentSar:1}});reject53({...source53,forecastDraft:{...source53.forecastDraft,forecastPeriods:[period2]}});reject53(source53,{...capDraft53,professionalNoiResult:result});reject53(source53,{...capDraft53,preparedAt:'2026-09-03'});reject53(source53,{...capDraft53,marketCapRateInput:{...capDraft53.marketCapRateInput,value:0.5}});reject53({...source53,forecastDraft:{...source53.forecastDraft,incomeEvidencePacket:evidence}});
 console.log('V653_INCOME_SOURCE_REPLAY=PASS synthetic=true sourceAuthority=false');
