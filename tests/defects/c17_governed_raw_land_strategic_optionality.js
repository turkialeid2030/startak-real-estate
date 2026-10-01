'use strict';

const assert = require('assert');
const {
  POLICY_VERSION,
  RAW_LAND_REVIEW_STATUS,
  RAW_LAND_OPTION_TYPE,
  RAW_LAND_EVIDENCE_CLASS,
  EVIDENCE_STATE,
  createGovernedRawLandEvidenceReference,
  computeRawLandEvidenceReferenceHash,
  verifyRawLandEvidenceReferenceIntegrity,
  createGovernedRawLandStrategicOption,
  verifyRawLandOptionIntegrity,
  createGovernedRawLandReviewPolicy,
  computeRawLandReviewPolicyHash,
  verifyRawLandReviewPolicyIntegrity,
  evaluateGovernedRawLandStrategicOptionality,
} = require('../../src/strategy/governed-raw-land-strategic-optionality');

const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const H3 = '3'.repeat(64);
const AS_OF = '2026-10-01T12:00:00Z';
const EC = RAW_LAND_EVIDENCE_CLASS;
const OT = RAW_LAND_OPTION_TYPE;

function makeEvidence(evidenceClass, suffix, overrides = {}) {
  return createGovernedRawLandEvidenceReference({
    evidenceReferenceId: `EVID-${suffix}`,
    caseId: 'CASE-17',
    propertyRef: 'PROP-17',
    evidenceClass,
    evidenceState: EVIDENCE_STATE.SATISFIED,
    sourceCapability: `UPSTREAM-${suffix}`,
    sourceRecordId: `RECORD-${suffix}`,
    sourceRecordHashSha256: H1,
    sourceStatus: 'GOVERNED_REVIEW_READY',
    sourceReference: `SOURCE-REF-${suffix}`,
    reviewedByRef: `REVIEWER-${suffix}`,
    reviewEvidenceRef: `REVIEW-EVIDENCE-${suffix}`,
    reviewedAt: '2026-10-01T09:00:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    ...overrides,
  });
}

function makeBaseEvidence() {
  return [
    makeEvidence(EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE'),
    makeEvidence(EC.SURVEY_AND_AREA, 'SURVEY', { sourceRecordHashSha256: H2 }),
    makeEvidence(EC.URBAN_CODE_AND_PLOT_FEASIBILITY, 'URBAN', { sourceRecordHashSha256: H3 }),
    makeEvidence(EC.MARKET_AND_LIQUIDITY, 'MARKET'),
    makeEvidence(EC.REGULATORY_CARRY_COST, 'CARRY'),
    makeEvidence(EC.ACCESS_AND_SERVICES, 'ACCESS'),
    makeEvidence(EC.EXTERNAL_STRATEGY_INSTRUCTION, 'INSTRUCTION'),
  ];
}

function makeOption(evidence, overrides = {}) {
  return createGovernedRawLandStrategicOption({
    optionId: 'OPTION-DEV-17',
    caseId: 'CASE-17',
    propertyRef: 'PROP-17',
    optionType: OT.PREPARE_DEVELOPMENT_CONCEPT_REVIEW,
    rationaleRef: 'RATIONALE-17',
    evidenceReferenceHashesSha256: evidence.map((e) => e.evidenceReferenceHashSha256),
    authoredByRef: 'ASSET-MANAGER-17',
    reviewedByRef: 'STRATEGY-REVIEWER-17',
    reviewEvidenceRef: 'OPTION-REVIEW-EVIDENCE-17',
    reviewedAt: '2026-10-01T10:00:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    ...overrides,
  });
}

function requiredMap() {
  return {
    [OT.PREPARE_DEVELOPMENT_CONCEPT_REVIEW]: [
      EC.TITLE_AND_PARCEL_IDENTITY,
      EC.SURVEY_AND_AREA,
      EC.URBAN_CODE_AND_PLOT_FEASIBILITY,
      EC.MARKET_AND_LIQUIDITY,
      EC.ACCESS_AND_SERVICES,
      EC.EXTERNAL_STRATEGY_INSTRUCTION,
    ],
  };
}

function makePolicy(evidence, options, overrides = {}) {
  return createGovernedRawLandReviewPolicy({
    policyId: 'POLICY-17',
    caseId: 'CASE-17',
    propertyRef: 'PROP-17',
    allowedOptionTypes: [OT.PREPARE_DEVELOPMENT_CONCEPT_REVIEW],
    allowedEvidenceClasses: Object.values(EC),
    requiredEvidenceClassesByOptionType: requiredMap(),
    evidenceReferenceHashesSha256: evidence.map((e) => e.evidenceReferenceHashSha256),
    optionHashesSha256: options.map((o) => o.optionHashSha256),
    reviewedByRef: 'GOVERNANCE-17',
    reviewEvidenceRef: 'POLICY-REVIEW-EVIDENCE-17',
    reviewedAt: '2026-10-01T10:30:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    ...overrides,
  });
}

function fixture() {
  const evidence = makeBaseEvidence();
  const option = makeOption(evidence);
  const policy = makePolicy(evidence, [option]);
  return { evidence, options: [option], policy };
}

function evaluate(f = fixture(), asOf = AS_OF) {
  return evaluateGovernedRawLandStrategicOptionality({ evidenceReferences: f.evidence, options: f.options, reviewPolicy: f.policy, asOf });
}

const f = fixture();
for (const e of f.evidence) assert(verifyRawLandEvidenceReferenceIntegrity(e));
assert(verifyRawLandOptionIntegrity(f.options[0]));
assert(verifyRawLandReviewPolicyIntegrity(f.policy));
assert.strictEqual(computeRawLandEvidenceReferenceHash(f.evidence[0]), f.evidence[0].evidenceReferenceHashSha256);
assert.strictEqual(computeRawLandReviewPolicyHash(f.policy), f.policy.policyHashSha256);
assert.strictEqual(f.policy.version, POLICY_VERSION);

const ready = evaluate(f);
assert.strictEqual(ready.status, RAW_LAND_REVIEW_STATUS.READY_FOR_PROFESSIONAL_STRATEGY_REVIEW);
assert.strictEqual(ready.professionalStrategyReviewReady, true);
assert.strictEqual(ready.review.length, 1);
assert.strictEqual(ready.review[0].optionType, OT.PREPARE_DEVELOPMENT_CONCEPT_REVIEW);
assert.strictEqual(ready.review[0].rank, null);
assert.strictEqual(ready.review[0].score, null);
assert.strictEqual(ready.recommendedOption, null);
assert.strictEqual(ready.rankedOptions, null);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.approvalAuthorized, false);
assert.strictEqual(ready.productionAuthorized, false);
assert.strictEqual(ready.publicAiAuthorized, false);
assert.strictEqual(ready.commercialGoLive, 'HOLD');
assert.strictEqual(ready.canonicalBaselineActivationAuthorized, false);
assert.strictEqual(ready.automaticStrategicRecommendation, false);
assert.strictEqual(ready.zoningDeterminedBySoftware, false);
assert.strictEqual(ready.serviceAvailabilityDeterminedBySoftware, false);
assert.strictEqual(ready.subdivisionMergeFeasibilityDeterminedBySoftware, false);
assert.strictEqual(ready.valuationCalculated, false);
assert.strictEqual(ready.residualLandValueCalculated, false);
assert.strictEqual(ready.npvCalculated, false);
assert.strictEqual(ready.irrCalculated, false);
assert.deepStrictEqual(evaluate(f), ready);

const unresolvedAccess = makeEvidence(EC.ACCESS_AND_SERVICES, 'ACCESS-U', { evidenceState: EVIDENCE_STATE.UNRESOLVED, unresolvedReasonRef: 'SERVICES-UNRESOLVED-17' });
const unresolvedEvidence = f.evidence.map((e) => e.evidenceClass === EC.ACCESS_AND_SERVICES ? unresolvedAccess : e);
const unresolvedOption = makeOption(unresolvedEvidence, { optionId: 'OPTION-UNRESOLVED-17' });
const unresolvedPolicy = makePolicy(unresolvedEvidence, [unresolvedOption], { policyId: 'POLICY-UNRESOLVED-17' });
const unresolved = evaluate({ evidence: unresolvedEvidence, options: [unresolvedOption], policy: unresolvedPolicy });
assert.strictEqual(unresolved.status, RAW_LAND_REVIEW_STATUS.HOLD_EVIDENCE);
assert(unresolved.blockers.some((b) => b.includes('C17_EVIDENCE_UNRESOLVED')));
assert.strictEqual(unresolved.review, null);

const nrAccess = makeEvidence(EC.ACCESS_AND_SERVICES, 'ACCESS-NR', { evidenceState: EVIDENCE_STATE.NOT_REQUIRED, notRequiredRationaleRef: 'EXTERNAL-NOT-REQUIRED-17' });
const nrEvidence = f.evidence.map((e) => e.evidenceClass === EC.ACCESS_AND_SERVICES ? nrAccess : e);
const nrOption = makeOption(nrEvidence, { optionId: 'OPTION-NR-17' });
const nrPolicy = makePolicy(nrEvidence, [nrOption], { policyId: 'POLICY-NR-17' });
const notRequired = evaluate({ evidence: nrEvidence, options: [nrOption], policy: nrPolicy });
assert(notRequired.blockers.some((b) => b.includes('C17_EVIDENCE_REQUIRED_CLASS_NOT_SATISFIED')));

const noSurvey = f.evidence.filter((e) => e.evidenceClass !== EC.SURVEY_AND_AREA);
const noSurveyOption = makeOption(noSurvey, { optionId: 'OPTION-NO-SURVEY-17' });
const noSurveyPolicy = makePolicy(noSurvey, [noSurveyOption], { policyId: 'POLICY-NO-SURVEY-17' });
const missing = evaluate({ evidence: noSurvey, options: [noSurveyOption], policy: noSurveyPolicy });
assert(missing.blockers.includes(`C17_EVIDENCE_REQUIRED_CLASS_MISSING:${noSurveyOption.optionId}:${EC.SURVEY_AND_AREA}`));

const tamperedEvidence = f.evidence.map((e, i) => i === 0 ? { ...e, sourceStatus: 'TAMPERED' } : e);
const tampered = evaluate({ evidence: tamperedEvidence, options: f.options, policy: f.policy });
assert.strictEqual(tampered.status, RAW_LAND_REVIEW_STATUS.HOLD_INTEGRITY);
assert(tampered.blockers.some((b) => b.startsWith('C17_INTEGRITY_EVIDENCE')));
assert.strictEqual(tampered.review, null);

const mismatchedPolicy = makePolicy(f.evidence, f.options, { policyId: 'POLICY-MISMATCH-17', evidenceReferenceHashesSha256: f.evidence.slice(0, -1).map((e) => e.evidenceReferenceHashSha256) });
const mismatch = evaluate({ evidence: f.evidence, options: f.options, policy: mismatchedPolicy });
assert.strictEqual(mismatch.status, RAW_LAND_REVIEW_STATUS.HOLD_POLICY);
assert(mismatch.blockers.includes('C17_POLICY_EVIDENCE_BINDING_MISMATCH'));

const ghostOption = makeOption(f.evidence, { optionId: 'OPTION-GHOST-17', evidenceReferenceHashesSha256: [...f.evidence.map((e) => e.evidenceReferenceHashSha256), 'f'.repeat(64)] });
const ghostPolicy = makePolicy(f.evidence, [ghostOption], { policyId: 'POLICY-GHOST-17' });
const ghost = evaluate({ evidence: f.evidence, options: [ghostOption], policy: ghostPolicy });
assert(ghost.blockers.some((b) => b.startsWith('C17_EVIDENCE_OPTION_REFERENCE_MISSING')));

const staleTitle = makeEvidence(EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE-STALE', { reviewedAt: '2026-09-28T09:00:00Z', validUntil: '2026-09-30T12:00:00Z' });
const staleEvidence = f.evidence.map((e) => e.evidenceClass === EC.TITLE_AND_PARCEL_IDENTITY ? staleTitle : e);
const staleOption = makeOption(staleEvidence, { optionId: 'OPTION-STALE-17' });
const stalePolicy = makePolicy(staleEvidence, [staleOption], { policyId: 'POLICY-STALE-17' });
const stale = evaluate({ evidence: staleEvidence, options: [staleOption], policy: stalePolicy });
assert.strictEqual(stale.status, RAW_LAND_REVIEW_STATUS.HOLD_WINDOW);
assert(stale.blockers.some((b) => b.startsWith('C17_WINDOW_EVIDENCE_STALE')));

const futureTitle = makeEvidence(EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE-FUTURE', { reviewedAt: '2026-10-02T09:00:00Z', validUntil: '2026-10-03T12:00:00Z' });
const futureEvidence = f.evidence.map((e) => e.evidenceClass === EC.TITLE_AND_PARCEL_IDENTITY ? futureTitle : e);
const futureOption = makeOption(futureEvidence, { optionId: 'OPTION-FUTURE-17' });
const futurePolicy = makePolicy(futureEvidence, [futureOption], { policyId: 'POLICY-FUTURE-17' });
const future = evaluate({ evidence: futureEvidence, options: [futureOption], policy: futurePolicy });
assert(future.blockers.some((b) => b.startsWith('C17_WINDOW_EVIDENCE_FUTURE')));

const otherPropertyTitle = makeEvidence(EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE-OTHER', { propertyRef: 'PROP-OTHER' });
const contextEvidence = f.evidence.map((e) => e.evidenceClass === EC.TITLE_AND_PARCEL_IDENTITY ? otherPropertyTitle : e);
const contextOption = makeOption(contextEvidence, { optionId: 'OPTION-CONTEXT-17' });
const contextPolicy = makePolicy(contextEvidence, [contextOption], { policyId: 'POLICY-CONTEXT-17' });
const context = evaluate({ evidence: contextEvidence, options: [contextOption], policy: contextPolicy });
assert.strictEqual(context.status, RAW_LAND_REVIEW_STATUS.HOLD_CONTEXT);
assert(context.blockers.some((b) => b.startsWith('C17_CONTEXT_EVIDENCE')));

const duplicateTitle = makeEvidence(EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE-DUP', { evidenceReferenceId: 'EVID-SURVEY' });
const duplicateEvidence = [...f.evidence, duplicateTitle];
const duplicateOption = makeOption(duplicateEvidence, { optionId: 'OPTION-DUP-17' });
const duplicatePolicy = makePolicy(duplicateEvidence, [duplicateOption], { policyId: 'POLICY-DUP-17' });
const duplicate = evaluate({ evidence: duplicateEvidence, options: [duplicateOption], policy: duplicatePolicy });
assert.strictEqual(duplicate.status, RAW_LAND_REVIEW_STATUS.HOLD_INTEGRITY);
assert(duplicate.blockers.some((b) => b.startsWith('C17_INTEGRITY_DUPLICATE_EVIDENCE_ID')));

const injected = { ...f.options[0], transactionAuthorized: true };
const injectedResult = evaluate({ evidence: f.evidence, options: [injected], policy: f.policy });
assert.strictEqual(injectedResult.status, RAW_LAND_REVIEW_STATUS.HOLD_INTEGRITY);
assert(injectedResult.blockers.some((b) => b.startsWith('C17_AUTHORITY_INJECTION') || b.startsWith('C17_INTEGRITY_OPTION')));

assert.throws(() => createGovernedRawLandReviewPolicy({
  policyId: 'POLICY-BAD-SUBSET', caseId: 'CASE-17', propertyRef: 'PROP-17',
  allowedOptionTypes: [OT.PREPARE_FOR_SALE], allowedEvidenceClasses: [EC.TITLE_AND_PARCEL_IDENTITY],
  requiredEvidenceClassesByOptionType: { [OT.PREPARE_FOR_SALE]: [EC.MARKET_AND_LIQUIDITY] },
  evidenceReferenceHashesSha256: [H1], optionHashesSha256: [H2], reviewedByRef: 'R', reviewEvidenceRef: 'E',
  reviewedAt: '2026-10-01T10:00:00Z', validUntil: '2026-10-02T10:00:00Z',
}), /C17_POLICY_REQUIRED_CLASS_NOT_ALLOWED/);
assert.throws(() => makeEvidence(EC.ACCESS_AND_SERVICES, 'BAD-U', { evidenceState: EVIDENCE_STATE.UNRESOLVED, unresolvedReasonRef: undefined }), /C17_UNRESOLVED_REASON_REQUIRED/);
assert.throws(() => makeEvidence(EC.ACCESS_AND_SERVICES, 'BAD-NR', { evidenceState: EVIDENCE_STATE.NOT_REQUIRED, notRequiredRationaleRef: undefined }), /C17_NOT_REQUIRED_RATIONALE_REQUIRED/);
assert.throws(() => makeOption(f.evidence, { optionId: 'BAD-HASHES', evidenceReferenceHashesSha256: [] }), /C17_OPTION_EVIDENCE_HASHES_REQUIRED/);

console.log('C17_GOVERNED_RAW_LAND_STRATEGIC_OPTIONALITY=PASS');
