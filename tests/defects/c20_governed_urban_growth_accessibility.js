'use strict';

const assert = require('assert');
const {
  POLICY_VERSION,
  REVIEW_STATUS,
  SIGNAL_CLASS,
  OBSERVATION_STATE,
  METRIC_TYPE,
  ANALYSIS_TYPE,
  SOURCE_TIER,
  createUrbanGrowthAccessibilityEvidence,
  computeEvidenceHash,
  verifyEvidenceIntegrity,
  createProfessionalUrbanGrowthAccessibilityPair,
  computePairHash,
  verifyComparisonPairIntegrity,
  createUrbanGrowthAccessibilityReviewPolicy,
  computePolicyHash,
  verifyReviewPolicyIntegrity,
  evaluateGovernedUrbanGrowthAccessibility,
} = require('../../src/market/governed-urban-growth-accessibility');

const AS_OF = '2026-10-01T12:00:00Z';
const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const H3 = '3'.repeat(64);
const H4 = '4'.repeat(64);
const H5 = '5'.repeat(64);

function makeEvidence(suffix, signalKey, signalClass, metricType, metricUnit, metricValue, referenceAt, overrides = {}) {
  return createUrbanGrowthAccessibilityEvidence({
    evidenceId: `EVID-${suffix}`,
    caseId: 'CASE-20',
    propertyRef: 'PROP-20',
    marketScopeRef: 'MARKET-20',
    signalKey,
    signalClass,
    observationState: OBSERVATION_STATE.OBSERVED_EXISTING,
    metricType,
    metricUnit,
    metricValue,
    sourceCapability: `UPSTREAM-${suffix}`,
    sourceProvider: `SOURCE-${suffix}`,
    sourceTier: SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE,
    sourceRecordId: `RECORD-${suffix}`,
    sourceRecordHashSha256: H1,
    sourceStatus: 'GOVERNED_REVIEW_READY',
    sourceReference: `REF-${suffix}`,
    provenanceVerified: true,
    knownAt: '2026-09-29T08:00:00Z',
    referenceAt,
    reviewedByRef: `REVIEWER-${suffix}`,
    reviewEvidenceRef: `REVIEW-${suffix}`,
    reviewedAt: '2026-09-29T10:00:00Z',
    validUntil: '2026-10-15T00:00:00Z',
    ...overrides,
  });
}

function makePair(id, analysisType, signalKey, baseline, current, overrides = {}) {
  return createProfessionalUrbanGrowthAccessibilityPair({
    pairId: id,
    caseId: 'CASE-20',
    propertyRef: 'PROP-20',
    marketScopeRef: 'MARKET-20',
    signalKey,
    analysisType,
    baselineEvidenceHashSha256: baseline.evidenceHashSha256,
    currentEvidenceHashSha256: current.evidenceHashSha256,
    rationaleRef: `RATIONALE-${id}`,
    preparedByRef: `PREPARER-${id}`,
    preparedAt: '2026-09-29T10:30:00Z',
    reviewedByRef: `PAIR-REVIEWER-${id}`,
    reviewEvidenceRef: `PAIR-REVIEW-${id}`,
    reviewedAt: '2026-09-29T11:00:00Z',
    validUntil: '2026-10-15T00:00:00Z',
    ...overrides,
  });
}

function baseFixture() {
  const populationBase = makeEvidence('POP-BASE', 'POPULATION-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.COUNT, 'persons', 1000, '2025-09-01T00:00:00Z', { sourceRecordHashSha256: H1 });
  const populationCurrent = makeEvidence('POP-CURRENT', 'POPULATION-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.COUNT, 'persons', 1150, '2026-09-01T00:00:00Z', { sourceRecordHashSha256: H2 });
  const travelBase = makeEvidence('TRAVEL-BASE', 'CBD-TRAVEL-TIME', SIGNAL_CLASS.EMPLOYMENT_OR_ACTIVITY_CENTER_ACCESS, METRIC_TYPE.TRAVEL_TIME_MINUTES, 'minutes', 35, '2025-09-01T00:00:00Z', { sourceRecordHashSha256: H3 });
  const travelCurrent = makeEvidence('TRAVEL-CURRENT', 'CBD-TRAVEL-TIME', SIGNAL_CLASS.EMPLOYMENT_OR_ACTIVITY_CENTER_ACCESS, METRIC_TYPE.TRAVEL_TIME_MINUTES, 'minutes', 28, '2026-09-01T00:00:00Z', { sourceRecordHashSha256: H4 });
  const planned = makeEvidence('PLANNED-CORRIDOR', 'CORRIDOR-PLAN', SIGNAL_CLASS.PLANNED_INFRASTRUCTURE_OR_CORRIDOR, METRIC_TYPE.DISTANCE_METERS, 'meters', 2500, '2028-01-01T00:00:00Z', {
    observationState: OBSERVATION_STATE.PLANNED_COMMITTED_NOT_DELIVERED,
    nonExistingStateRationaleRef: 'OFFICIAL-PLAN-NOT-DELIVERED-20',
    knownAt: '2026-09-20T00:00:00Z',
    reviewedAt: '2026-09-29T10:00:00Z',
    sourceRecordHashSha256: H5,
  });
  const growthPair = makePair('PAIR-POPULATION', ANALYSIS_TYPE.GROWTH_DELTA, 'POPULATION-SIGNAL', populationBase, populationCurrent);
  const accessPair = makePair('PAIR-TRAVEL', ANALYSIS_TYPE.ACCESSIBILITY_DELTA, 'CBD-TRAVEL-TIME', travelBase, travelCurrent);
  const evidence = [populationBase, populationCurrent, travelBase, travelCurrent, planned];
  const pairs = [growthPair, accessPair];
  const policy = createUrbanGrowthAccessibilityReviewPolicy({
    policyId: 'POLICY-20',
    caseId: 'CASE-20',
    propertyRef: 'PROP-20',
    marketScopeRef: 'MARKET-20',
    allowedSignalClasses: Object.values(SIGNAL_CLASS),
    requiredSignalClasses: [
      SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH,
      SIGNAL_CLASS.EMPLOYMENT_OR_ACTIVITY_CENTER_ACCESS,
      SIGNAL_CLASS.PLANNED_INFRASTRUCTURE_OR_CORRIDOR,
    ],
    allowedAnalysisTypes: Object.values(ANALYSIS_TYPE),
    allowedMetricTypes: Object.values(METRIC_TYPE),
    allowedSourceTiers: [SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE, SOURCE_TIER.B_COMMERCIAL_CORROBORATION, SOURCE_TIER.D_LICENSED_PROFESSIONAL],
    allowNonObservedContextEvidence: true,
    evidenceHashesSha256: evidence.map((e) => e.evidenceHashSha256),
    pairHashesSha256: pairs.map((p) => p.pairHashSha256),
    reviewedByRef: 'GOVERNANCE-20',
    reviewEvidenceRef: 'POLICY-REVIEW-20',
    reviewedAt: '2026-09-29T11:30:00Z',
    validUntil: '2026-10-15T00:00:00Z',
  });
  return { evidence, pairs, policy, populationBase, populationCurrent, travelBase, travelCurrent, planned, growthPair, accessPair };
}

function makePolicy(fixture, overrides = {}) {
  return createUrbanGrowthAccessibilityReviewPolicy({
    policyId: overrides.policyId || 'POLICY-20-X',
    caseId: 'CASE-20',
    propertyRef: 'PROP-20',
    marketScopeRef: 'MARKET-20',
    allowedSignalClasses: overrides.allowedSignalClasses || Object.values(SIGNAL_CLASS),
    requiredSignalClasses: overrides.requiredSignalClasses || [SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH],
    allowedAnalysisTypes: overrides.allowedAnalysisTypes || Object.values(ANALYSIS_TYPE),
    allowedMetricTypes: overrides.allowedMetricTypes || Object.values(METRIC_TYPE),
    allowedSourceTiers: overrides.allowedSourceTiers || [SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE, SOURCE_TIER.B_COMMERCIAL_CORROBORATION, SOURCE_TIER.D_LICENSED_PROFESSIONAL],
    allowNonObservedContextEvidence: overrides.allowNonObservedContextEvidence == null ? true : overrides.allowNonObservedContextEvidence,
    evidenceHashesSha256: fixture.evidence.map((e) => e.evidenceHashSha256),
    pairHashesSha256: fixture.pairs.map((p) => p.pairHashSha256),
    reviewedByRef: 'GOVERNANCE-20-X',
    reviewEvidenceRef: 'POLICY-REVIEW-20-X',
    reviewedAt: overrides.reviewedAt || '2026-09-29T11:30:00Z',
    validUntil: overrides.validUntil || '2026-10-15T00:00:00Z',
  });
}

function evaluate(f = baseFixture(), asOf = AS_OF) {
  return evaluateGovernedUrbanGrowthAccessibility({ evidence: f.evidence, pairs: f.pairs, reviewPolicy: f.policy, asOf });
}

const f = baseFixture();
for (const e of f.evidence) assert(verifyEvidenceIntegrity(e));
for (const p of f.pairs) assert(verifyComparisonPairIntegrity(p));
assert(verifyReviewPolicyIntegrity(f.policy));
assert.strictEqual(computeEvidenceHash(f.populationBase), f.populationBase.evidenceHashSha256);
assert.strictEqual(computePairHash(f.growthPair), f.growthPair.pairHashSha256);
assert.strictEqual(computePolicyHash(f.policy), f.policy.policyHashSha256);
assert.strictEqual(f.policy.version, POLICY_VERSION);

const ready = evaluate(f);
assert.strictEqual(ready.status, REVIEW_STATUS.READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW);
assert.strictEqual(ready.professionalUrbanGrowthAccessibilityReviewReady, true);
assert.strictEqual(ready.review.comparisons.length, 2);
const populationReview = ready.review.comparisons.find((r) => r.pairId === 'PAIR-POPULATION');
assert.strictEqual(populationReview.baselineValue, 1000);
assert.strictEqual(populationReview.currentValue, 1150);
assert.strictEqual(populationReview.absoluteDelta, 150);
assert.strictEqual(populationReview.percentageDelta, 15);
const travelReview = ready.review.comparisons.find((r) => r.pairId === 'PAIR-TRAVEL');
assert.strictEqual(travelReview.absoluteDelta, -7);
assert.strictEqual(travelReview.percentageDelta, -20);
assert.strictEqual(travelReview.benefitDeterminedBySoftware, false);
assert.strictEqual(travelReview.adverseImpactDeterminedBySoftware, false);
assert.strictEqual(travelReview.recommendation, null);
assert.strictEqual(ready.review.reviewOnlyNonExistingContext.length, 1);
assert.strictEqual(ready.review.reviewOnlyNonExistingContext[0].observationState, OBSERVATION_STATE.PLANNED_COMMITTED_NOT_DELIVERED);
assert.strictEqual(ready.review.reviewOnlyNonExistingContext[0].treatedAsExisting, false);
assert(ready.riskFlags.includes('C20_REVIEW_ONLY_NON_EXISTING_CONTEXT:EVID-PLANNED-CORRIDOR:PLANNED_COMMITTED_NOT_DELIVERED'));
assert.strictEqual(ready.recommendation, null);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.approvalAuthorized, false);
assert.strictEqual(ready.productionAuthorized, false);
assert.strictEqual(ready.publicAiAuthorized, false);
assert.strictEqual(ready.commercialGoLive, 'HOLD');
assert.strictEqual(ready.canonicalBaselineActivationAuthorized, false);
assert.strictEqual(ready.geospatialFactInferredBySoftware, false);
assert.strictEqual(ready.routeCalculatedBySoftware, false);
assert.strictEqual(ready.serviceAvailabilityDeterminedBySoftware, false);
assert.strictEqual(ready.infrastructureDeliveredBySoftware, false);
assert.strictEqual(ready.causalUpliftEstimatedBySoftware, false);
assert.strictEqual(ready.valuationImpactEstimatedBySoftware, false);
assert.strictEqual(ready.automaticAccessibilityScore, false);
assert.strictEqual(ready.automaticGrowthScore, false);
assert.strictEqual(ready.automaticInvestmentRanking, false);
assert.strictEqual(ready.valuationCalculated, false);
assert.strictEqual(ready.avmCalculated, false);
assert.strictEqual(ready.residualLandValueCalculated, false);
assert.strictEqual(ready.npvCalculated, false);
assert.strictEqual(ready.irrCalculated, false);
assert.deepStrictEqual(evaluate(f), ready);

const zeroBase = makeEvidence('ZERO-BASE', 'ZERO-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.COUNT, 'persons', 0, '2025-09-01T00:00:00Z');
const zeroCurrent = makeEvidence('ZERO-CURRENT', 'ZERO-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.COUNT, 'persons', 5, '2026-09-01T00:00:00Z', { sourceRecordHashSha256: H2 });
const zeroPair = makePair('PAIR-ZERO', ANALYSIS_TYPE.GROWTH_DELTA, 'ZERO-SIGNAL', zeroBase, zeroCurrent);
const zeroFixture = { evidence: [zeroBase, zeroCurrent], pairs: [zeroPair] };
zeroFixture.policy = makePolicy(zeroFixture);
const zero = evaluate(zeroFixture);
assert.strictEqual(zero.status, REVIEW_STATUS.READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW);
assert.strictEqual(zero.review.comparisons[0].percentageDelta, null);
assert(zero.riskFlags.includes('C20_BASELINE_ZERO_PERCENT_DELTA_NOT_CALCULATED:PAIR-ZERO'));

const tamperedEvidence = f.evidence.map((e, i) => i === 0 ? { ...e, metricValue: 9999 } : e);
const tamperedEvidenceResult = evaluate({ evidence: tamperedEvidence, pairs: f.pairs, policy: f.policy });
assert.strictEqual(tamperedEvidenceResult.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(tamperedEvidenceResult.blockers.some((b) => b.startsWith('C20_INTEGRITY_EVIDENCE')));

const tamperedPairs = [{ ...f.growthPair, signalKey: 'TAMPERED' }, f.accessPair];
const tamperedPairResult = evaluate({ evidence: f.evidence, pairs: tamperedPairs, policy: f.policy });
assert.strictEqual(tamperedPairResult.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(tamperedPairResult.blockers.some((b) => b.startsWith('C20_INTEGRITY_PAIR')));

const duplicateEvidence = evaluate({ evidence: [...f.evidence, f.populationBase], pairs: f.pairs, policy: f.policy });
assert.strictEqual(duplicateEvidence.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(duplicateEvidence.blockers.includes('C20_INTEGRITY_DUPLICATE_EVIDENCE_ID:EVID-POP-BASE'));
assert(duplicateEvidence.blockers.includes('C20_INTEGRITY_DUPLICATE_EVIDENCE_HASH'));

const duplicatePair = evaluate({ evidence: f.evidence, pairs: [...f.pairs, f.growthPair], policy: f.policy });
assert.strictEqual(duplicatePair.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(duplicatePair.blockers.includes('C20_INTEGRITY_DUPLICATE_PAIR_ID:PAIR-POPULATION'));
assert(duplicatePair.blockers.includes('C20_INTEGRITY_DUPLICATE_PAIR_HASH'));
assert(duplicatePair.blockers.some((b) => b.startsWith('C20_INTEGRITY_DUPLICATE_SIGNAL_ROLE_BINDING')));

const unresolvedCurrent = makeEvidence('UNRESOLVED', 'POPULATION-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.COUNT, 'persons', 1150, '2026-09-01T00:00:00Z', {
  observationState: OBSERVATION_STATE.UNRESOLVED,
  unresolvedReasonRef: 'SOURCE-CONFLICT-20',
  sourceRecordHashSha256: H2,
});
const unresolvedPair = makePair('PAIR-UNRESOLVED', ANALYSIS_TYPE.GROWTH_DELTA, 'POPULATION-SIGNAL', f.populationBase, unresolvedCurrent);
const unresolvedFixture = { evidence: [f.populationBase, unresolvedCurrent], pairs: [unresolvedPair] };
unresolvedFixture.policy = makePolicy(unresolvedFixture);
const unresolved = evaluate(unresolvedFixture);
assert.strictEqual(unresolved.status, REVIEW_STATUS.HOLD_EVIDENCE);
assert(unresolved.blockers.includes('C20_EVIDENCE_UNRESOLVED:EVID-UNRESOLVED'));
assert.strictEqual(unresolved.review, null);

const plannedOnly = makeEvidence('PLANNED-DISALLOWED', 'PLAN-SIGNAL', SIGNAL_CLASS.PLANNED_INFRASTRUCTURE_OR_CORRIDOR, METRIC_TYPE.DISTANCE_METERS, 'meters', 1000, '2028-01-01T00:00:00Z', {
  observationState: OBSERVATION_STATE.PROPOSED_UNCERTAIN,
  nonExistingStateRationaleRef: 'PROPOSED-ONLY-20',
});
const plannedContextFixture = { evidence: [f.populationBase, f.populationCurrent, plannedOnly], pairs: [f.growthPair] };
plannedContextFixture.policy = makePolicy(plannedContextFixture, { allowNonObservedContextEvidence: false });
const plannedContext = evaluate(plannedContextFixture);
assert.strictEqual(plannedContext.status, REVIEW_STATUS.HOLD_POLICY);
assert(plannedContext.blockers.includes('C20_POLICY_NON_OBSERVED_CONTEXT_NOT_ALLOWED:EVID-PLANNED-DISALLOWED'));

const plannedCurrent = makeEvidence('PLANNED-CURRENT', 'POPULATION-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.COUNT, 'persons', 1200, '2027-09-01T00:00:00Z', {
  observationState: OBSERVATION_STATE.PLANNED_COMMITTED_NOT_DELIVERED,
  nonExistingStateRationaleRef: 'PROJECTION-NOT-OBSERVED-20',
  sourceRecordHashSha256: H2,
});
const plannedPair = makePair('PAIR-PLANNED-CURRENT', ANALYSIS_TYPE.GROWTH_DELTA, 'POPULATION-SIGNAL', f.populationBase, plannedCurrent);
const plannedPairFixture = { evidence: [f.populationBase, plannedCurrent], pairs: [plannedPair] };
plannedPairFixture.policy = makePolicy(plannedPairFixture);
const plannedPairResult = evaluate(plannedPairFixture);
assert.strictEqual(plannedPairResult.status, REVIEW_STATUS.HOLD_EVIDENCE);
assert(plannedPairResult.blockers.includes('C20_EVIDENCE_PAIR_REQUIRES_OBSERVED_EXISTING:PAIR-PLANNED-CURRENT'));

const futureKnown = makeEvidence('FUTURE-KNOWN', 'ROAD-SIGNAL', SIGNAL_CLASS.ROAD_OR_TRANSIT_ACCESSIBILITY, METRIC_TYPE.DISTANCE_METERS, 'meters', 500, '2026-10-05T00:00:00Z', {
  knownAt: '2026-10-02T00:00:00Z',
  reviewedAt: '2026-10-02T01:00:00Z',
  validUntil: '2026-10-15T00:00:00Z',
});
const futureKnownFixture = { evidence: [...f.evidence, futureKnown], pairs: f.pairs };
futureKnownFixture.policy = makePolicy(futureKnownFixture);
const futureKnownResult = evaluate(futureKnownFixture);
assert.strictEqual(futureKnownResult.status, REVIEW_STATUS.HOLD_WINDOW);
assert(futureKnownResult.blockers.includes('C20_WINDOW_EVIDENCE_KNOWN_IN_FUTURE:EVID-FUTURE-KNOWN'));

const futureObserved = makeEvidence('FUTURE-OBSERVED', 'ROAD-SIGNAL-2', SIGNAL_CLASS.ROAD_OR_TRANSIT_ACCESSIBILITY, METRIC_TYPE.DISTANCE_METERS, 'meters', 500, '2026-10-05T00:00:00Z');
const futureObservedFixture = { evidence: [...f.evidence, futureObserved], pairs: f.pairs };
futureObservedFixture.policy = makePolicy(futureObservedFixture);
const futureObservedResult = evaluate(futureObservedFixture);
assert.strictEqual(futureObservedResult.status, REVIEW_STATUS.HOLD_WINDOW);
assert(futureObservedResult.blockers.includes('C20_WINDOW_OBSERVED_REFERENCE_IN_FUTURE:EVID-FUTURE-OBSERVED'));

const stale = makeEvidence('STALE', 'ROAD-SIGNAL-3', SIGNAL_CLASS.ROAD_OR_TRANSIT_ACCESSIBILITY, METRIC_TYPE.DISTANCE_METERS, 'meters', 500, '2026-09-01T00:00:00Z', {
  knownAt: '2026-09-10T00:00:00Z', reviewedAt: '2026-09-20T00:00:00Z', validUntil: '2026-09-30T00:00:00Z',
});
const staleFixture = { evidence: [...f.evidence, stale], pairs: f.pairs };
staleFixture.policy = makePolicy(staleFixture);
const staleResult = evaluate(staleFixture);
assert.strictEqual(staleResult.status, REVIEW_STATUS.HOLD_WINDOW);
assert(staleResult.blockers.includes('C20_WINDOW_EVIDENCE_STALE:EVID-STALE'));

const otherProperty = makeEvidence('OTHER-PROP', 'ROAD-SIGNAL-4', SIGNAL_CLASS.ROAD_OR_TRANSIT_ACCESSIBILITY, METRIC_TYPE.DISTANCE_METERS, 'meters', 500, '2026-09-01T00:00:00Z', { propertyRef: 'PROP-OTHER' });
const contextFixture = { evidence: [...f.evidence, otherProperty], pairs: f.pairs };
contextFixture.policy = makePolicy(contextFixture);
const contextResult = evaluate(contextFixture);
assert.strictEqual(contextResult.status, REVIEW_STATUS.HOLD_CONTEXT);
assert(contextResult.blockers.includes('C20_CONTEXT_EVIDENCE:EVID-OTHER-PROP'));

const wrongUnitCurrent = makeEvidence('POP-WRONG-UNIT', 'POPULATION-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.COUNT, 'households', 1150, '2026-09-01T00:00:00Z', { sourceRecordHashSha256: H2 });
const wrongUnitPair = makePair('PAIR-WRONG-UNIT', ANALYSIS_TYPE.GROWTH_DELTA, 'POPULATION-SIGNAL', f.populationBase, wrongUnitCurrent);
const wrongUnitFixture = { evidence: [f.populationBase, wrongUnitCurrent], pairs: [wrongUnitPair] };
wrongUnitFixture.policy = makePolicy(wrongUnitFixture, { requiredSignalClasses: [SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH] });
const wrongUnit = evaluate(wrongUnitFixture);
assert.strictEqual(wrongUnit.status, REVIEW_STATUS.HOLD_CONTEXT);
assert(wrongUnit.blockers.includes('C20_CONTEXT_PAIR_METRIC_UNIT_MISMATCH:PAIR-WRONG-UNIT'));

const wrongMetricCurrent = makeEvidence('POP-WRONG-METRIC', 'POPULATION-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.INDEX_VALUE, 'persons', 1150, '2026-09-01T00:00:00Z', { sourceRecordHashSha256: H2 });
const wrongMetricPair = makePair('PAIR-WRONG-METRIC', ANALYSIS_TYPE.GROWTH_DELTA, 'POPULATION-SIGNAL', f.populationBase, wrongMetricCurrent);
const wrongMetricFixture = { evidence: [f.populationBase, wrongMetricCurrent], pairs: [wrongMetricPair] };
wrongMetricFixture.policy = makePolicy(wrongMetricFixture);
const wrongMetric = evaluate(wrongMetricFixture);
assert.strictEqual(wrongMetric.status, REVIEW_STATUS.HOLD_CONTEXT);
assert(wrongMetric.blockers.includes('C20_CONTEXT_PAIR_METRIC_TYPE_MISMATCH:PAIR-WRONG-METRIC'));

const wrongSignalCurrent = makeEvidence('WRONG-SIGNAL', 'OTHER-SIGNAL', SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, METRIC_TYPE.COUNT, 'persons', 1150, '2026-09-01T00:00:00Z', { sourceRecordHashSha256: H2 });
const wrongSignalPair = makePair('PAIR-WRONG-SIGNAL', ANALYSIS_TYPE.GROWTH_DELTA, 'POPULATION-SIGNAL', f.populationBase, wrongSignalCurrent);
const wrongSignalFixture = { evidence: [f.populationBase, wrongSignalCurrent], pairs: [wrongSignalPair] };
wrongSignalFixture.policy = makePolicy(wrongSignalFixture);
const wrongSignal = evaluate(wrongSignalFixture);
assert.strictEqual(wrongSignal.status, REVIEW_STATUS.HOLD_CONTEXT);
assert(wrongSignal.blockers.includes('C20_CONTEXT_PAIR_SIGNAL_KEY_MISMATCH:PAIR-WRONG-SIGNAL'));

const accessAsGrowthPair = makePair('PAIR-ACCESS-AS-GROWTH', ANALYSIS_TYPE.GROWTH_DELTA, 'CBD-TRAVEL-TIME', f.travelBase, f.travelCurrent);
const accessAsGrowthFixture = { evidence: [f.travelBase, f.travelCurrent], pairs: [accessAsGrowthPair] };
accessAsGrowthFixture.policy = makePolicy(accessAsGrowthFixture, { requiredSignalClasses: [SIGNAL_CLASS.EMPLOYMENT_OR_ACTIVITY_CENTER_ACCESS] });
const semantic = evaluate(accessAsGrowthFixture);
assert.strictEqual(semantic.status, REVIEW_STATUS.HOLD_POLICY);
assert(semantic.blockers.includes('C20_POLICY_GROWTH_ANALYSIS_SIGNAL_CLASS_MISMATCH:PAIR-ACCESS-AS-GROWTH'));

const reversedPair = makePair('PAIR-REVERSED', ANALYSIS_TYPE.GROWTH_DELTA, 'POPULATION-SIGNAL', f.populationCurrent, f.populationBase);
const reversedFixture = { evidence: [f.populationBase, f.populationCurrent], pairs: [reversedPair] };
reversedFixture.policy = makePolicy(reversedFixture);
const reversed = evaluate(reversedFixture);
assert.strictEqual(reversed.status, REVIEW_STATUS.HOLD_WINDOW);
assert(reversed.blockers.includes('C20_WINDOW_PAIR_CURRENT_NOT_AFTER_BASELINE:PAIR-REVERSED'));

const coverageFixture = { evidence: [f.populationBase, f.populationCurrent], pairs: [f.growthPair] };
coverageFixture.policy = makePolicy(coverageFixture, { requiredSignalClasses: [SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH, SIGNAL_CLASS.ESSENTIAL_SERVICES_ACCESS] });
const coverage = evaluate(coverageFixture);
assert.strictEqual(coverage.status, REVIEW_STATUS.HOLD_COVERAGE);
assert(coverage.blockers.includes('C20_COVERAGE_REQUIRED_SIGNAL_CLASS_MISSING:ESSENTIAL_SERVICES_ACCESS'));

const bindingMismatch = evaluate({ evidence: f.evidence.slice(0, 4), pairs: f.pairs, policy: f.policy });
assert.strictEqual(bindingMismatch.status, REVIEW_STATUS.HOLD_POLICY);
assert(bindingMismatch.blockers.includes('C20_POLICY_EVIDENCE_BINDING_MISMATCH'));

assert.throws(() => makeEvidence('AVM', 'AVM-SIGNAL', SIGNAL_CLASS.ROAD_OR_TRANSIT_ACCESSIBILITY, METRIC_TYPE.INDEX_VALUE, 'index', 50, '2026-09-01T00:00:00Z', { sourceTier: SOURCE_TIER.C_INDICATIVE_AVM }), /C20_AVM_NOT_URBAN_GROWTH_ACCESSIBILITY_EVIDENCE/);
assert.throws(() => makePolicy({ evidence: [f.populationBase, f.populationCurrent], pairs: [f.growthPair] }, { allowedSourceTiers: [SOURCE_TIER.A_OFFICIAL_AUTHORITATIVE, SOURCE_TIER.C_INDICATIVE_AVM] }), /C20_POLICY_AVM_TIER_NOT_ALLOWED/);
assert.throws(() => makeEvidence('NO-PROV', 'NO-PROV-SIGNAL', SIGNAL_CLASS.ROAD_OR_TRANSIT_ACCESSIBILITY, METRIC_TYPE.INDEX_VALUE, 'index', 50, '2026-09-01T00:00:00Z', { provenanceVerified: false }), /C20_PROVENANCE_VERIFICATION_REQUIRED/);
assert.throws(() => makeEvidence('PLAN-NO-RATIONALE', 'PLAN-NO-RATIONALE', SIGNAL_CLASS.PLANNED_INFRASTRUCTURE_OR_CORRIDOR, METRIC_TYPE.DISTANCE_METERS, 'meters', 1000, '2028-01-01T00:00:00Z', { observationState: OBSERVATION_STATE.PLANNED_COMMITTED_NOT_DELIVERED }), /C20_NON_EXISTING_STATE_RATIONALE_REQUIRED/);

const authorityCore = { ...f.populationBase, serviceAvailabilityDeterminedBySoftware: true };
delete authorityCore.evidenceHashSha256;
const authorityInjected = { ...authorityCore, evidenceHashSha256: computeEvidenceHash(authorityCore) };
assert(verifyEvidenceIntegrity(authorityInjected));
const authorityEvidence = f.evidence.map((e) => e.evidenceId === f.populationBase.evidenceId ? authorityInjected : e);
const authorityFixture = { evidence: authorityEvidence, pairs: f.pairs };
authorityFixture.policy = makePolicy(authorityFixture, {
  requiredSignalClasses: [
    SIGNAL_CLASS.POPULATION_OR_HOUSEHOLD_GROWTH,
    SIGNAL_CLASS.EMPLOYMENT_OR_ACTIVITY_CENTER_ACCESS,
    SIGNAL_CLASS.PLANNED_INFRASTRUCTURE_OR_CORRIDOR,
  ],
});
const authority = evaluate(authorityFixture);
assert.strictEqual(authority.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(authority.blockers.includes(`C20_AUTHORITY_INJECTION:EVIDENCE:${authorityInjected.evidenceId}`));

console.log('C20_GOVERNED_URBAN_GROWTH_ACCESSIBILITY=PASS');
