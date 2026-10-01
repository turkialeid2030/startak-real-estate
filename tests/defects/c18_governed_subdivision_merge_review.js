'use strict';

const assert = require('assert');
const {
  POLICY_VERSION,
  REVIEW_STATUS,
  OPERATION_TYPE,
  EVIDENCE_CLASS,
  EVIDENCE_STATE,
  createGovernedParcelOperationEvidence,
  computeEvidenceHash,
  verifyEvidenceIntegrity,
  createGovernedSubdivisionMergeProposal,
  computeProposalHash,
  verifyProposalIntegrity,
  createGovernedSubdivisionMergeReviewPolicy,
  computePolicyHash,
  verifyPolicyIntegrity,
  evaluateGovernedSubdivisionMergeReview,
} = require('../../src/strategy/governed-subdivision-merge-review');

const AS_OF = '2026-10-01T12:00:00Z';
const H1 = '1'.repeat(64);
const H2 = '2'.repeat(64);
const EC = EVIDENCE_CLASS;
const OT = OPERATION_TYPE;

const REQUIRED = [
  EC.TITLE_AND_PARCEL_IDENTITY,
  EC.SURVEY_AND_AREA,
  EC.URBAN_CODE_AND_PLOT_FEASIBILITY,
  EC.ACCESS_AND_SERVICES,
  EC.MUNICIPAL_OR_CADASTRAL_REQUIREMENTS,
  EC.EXTERNAL_PROFESSIONAL_INSTRUCTION,
];

function makeEvidence(parcelRef, evidenceClass, suffix, overrides = {}) {
  return createGovernedParcelOperationEvidence({
    evidenceId: `EVID-${parcelRef}-${suffix}`,
    caseId: 'CASE-18',
    propertyRef: 'PROP-18',
    parcelRef,
    evidenceClass,
    evidenceState: EVIDENCE_STATE.SATISFIED,
    sourceCapability: `UPSTREAM-${suffix}`,
    sourceRecordId: `RECORD-${parcelRef}-${suffix}`,
    sourceRecordHashSha256: H1,
    sourceStatus: 'GOVERNED_REVIEW_READY',
    sourceReference: `SOURCE-${parcelRef}-${suffix}`,
    surveyedAreaSqm: evidenceClass === EC.SURVEY_AND_AREA ? (parcelRef === 'PARCEL-A' ? 600 : 400) : null,
    reviewedByRef: `REVIEWER-${suffix}`,
    reviewEvidenceRef: `REVIEW-${parcelRef}-${suffix}`,
    reviewedAt: '2026-10-01T09:00:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    ...overrides,
  });
}

function makeParcelEvidence(parcelRef) {
  return [
    makeEvidence(parcelRef, EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE'),
    makeEvidence(parcelRef, EC.SURVEY_AND_AREA, 'SURVEY', { sourceRecordHashSha256: H2 }),
    makeEvidence(parcelRef, EC.URBAN_CODE_AND_PLOT_FEASIBILITY, 'URBAN'),
    makeEvidence(parcelRef, EC.ACCESS_AND_SERVICES, 'ACCESS'),
    makeEvidence(parcelRef, EC.MUNICIPAL_OR_CADASTRAL_REQUIREMENTS, 'MUNICIPAL'),
    makeEvidence(parcelRef, EC.EXTERNAL_PROFESSIONAL_INSTRUCTION, 'INSTRUCTION'),
  ];
}

function baseEvidence() {
  return [...makeParcelEvidence('PARCEL-A'), ...makeParcelEvidence('PARCEL-B')];
}

function findEvidence(evidence, parcelRef, evidenceClass) {
  return evidence.find((e) => e.parcelRef === parcelRef && e.evidenceClass === evidenceClass);
}

function makeProposal(evidence, overrides = {}) {
  const aTitle = findEvidence(evidence, 'PARCEL-A', EC.TITLE_AND_PARCEL_IDENTITY);
  const aSurvey = findEvidence(evidence, 'PARCEL-A', EC.SURVEY_AND_AREA);
  const bTitle = findEvidence(evidence, 'PARCEL-B', EC.TITLE_AND_PARCEL_IDENTITY);
  const bSurvey = findEvidence(evidence, 'PARCEL-B', EC.SURVEY_AND_AREA);
  return createGovernedSubdivisionMergeProposal({
    proposalId: 'PROPOSAL-MERGE-18',
    caseId: 'CASE-18',
    propertyRef: 'PROP-18',
    operationType: OT.MERGE_REVIEW,
    parcelBindings: [
      { parcelRef: 'PARCEL-B', titleEvidenceHashSha256: bTitle.evidenceHashSha256, surveyEvidenceHashSha256: bSurvey.evidenceHashSha256, surveyedAreaSqm: bSurvey.surveyedAreaSqm },
      { parcelRef: 'PARCEL-A', titleEvidenceHashSha256: aTitle.evidenceHashSha256, surveyEvidenceHashSha256: aSurvey.evidenceHashSha256, surveyedAreaSqm: aSurvey.surveyedAreaSqm },
    ],
    proposedOutputParcelCount: 1,
    proposedTotalAreaSqm: 1000,
    areaToleranceSqm: 0,
    evidenceHashesSha256: evidence.map((e) => e.evidenceHashSha256),
    rationaleRef: 'MERGE-RATIONALE-18',
    authoredByRef: 'SURVEY-PROFESSIONAL-18',
    reviewedByRef: 'PROPERTY-REVIEWER-18',
    reviewEvidenceRef: 'PROPOSAL-REVIEW-18',
    reviewedAt: '2026-10-01T10:00:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    ...overrides,
  });
}

function requiredMap() {
  return { [OT.MERGE_REVIEW]: REQUIRED };
}

function makePolicy(evidence, proposals, overrides = {}) {
  return createGovernedSubdivisionMergeReviewPolicy({
    policyId: 'POLICY-18',
    caseId: 'CASE-18',
    propertyRef: 'PROP-18',
    allowedOperationTypes: [OT.MERGE_REVIEW],
    allowedEvidenceClasses: Object.values(EC),
    requiredEvidenceClassesByOperation: requiredMap(),
    evidenceHashesSha256: evidence.map((e) => e.evidenceHashSha256),
    proposalHashesSha256: proposals.map((p) => p.proposalHashSha256),
    reviewedByRef: 'GOVERNANCE-18',
    reviewEvidenceRef: 'POLICY-REVIEW-18',
    reviewedAt: '2026-10-01T10:30:00Z',
    validUntil: '2026-10-03T12:00:00Z',
    ...overrides,
  });
}

function fixture() {
  const evidence = baseEvidence();
  const proposal = makeProposal(evidence);
  const policy = makePolicy(evidence, [proposal]);
  return { evidence, proposals: [proposal], policy };
}

function evaluate(f = fixture(), asOf = AS_OF) {
  return evaluateGovernedSubdivisionMergeReview({ evidence: f.evidence, proposals: f.proposals, reviewPolicy: f.policy, asOf });
}

const f = fixture();
for (const e of f.evidence) assert(verifyEvidenceIntegrity(e));
assert(verifyProposalIntegrity(f.proposals[0]));
assert(verifyPolicyIntegrity(f.policy));
assert.strictEqual(computeEvidenceHash(f.evidence[0]), f.evidence[0].evidenceHashSha256);
assert.strictEqual(computePolicyHash(f.policy), f.policy.policyHashSha256);
assert.strictEqual(f.policy.version, POLICY_VERSION);

const ready = evaluate(f);
assert.strictEqual(ready.status, REVIEW_STATUS.READY_FOR_PROFESSIONAL_SUBDIVISION_MERGE_REVIEW);
assert.strictEqual(ready.professionalSubdivisionMergeReviewReady, true);
assert.strictEqual(ready.review.length, 1);
assert.strictEqual(ready.review[0].operationType, OT.MERGE_REVIEW);
assert.strictEqual(ready.review[0].inputParcelCount, 2);
assert.strictEqual(ready.review[0].proposedOutputParcelCount, 1);
assert.strictEqual(ready.review[0].inputSurveyedAreaSqm, 1000);
assert.strictEqual(ready.review[0].proposedTotalAreaSqm, 1000);
assert.strictEqual(ready.review[0].absoluteAreaDeltaSqm, 0);
assert.strictEqual(ready.review[0].feasibilityDeterminedBySoftware, false);
assert.strictEqual(ready.review[0].recommendation, null);
assert.strictEqual(ready.recommendation, null);
assert.strictEqual(ready.transactionAuthorized, false);
assert.strictEqual(ready.approvalAuthorized, false);
assert.strictEqual(ready.productionAuthorized, false);
assert.strictEqual(ready.publicAiAuthorized, false);
assert.strictEqual(ready.commercialGoLive, 'HOLD');
assert.strictEqual(ready.canonicalBaselineActivationAuthorized, false);
assert.strictEqual(ready.feasibilityDeterminedBySoftware, false);
assert.strictEqual(ready.ownershipDeterminedBySoftware, false);
assert.strictEqual(ready.geometryInferredBySoftware, false);
assert.strictEqual(ready.adjacencyInferredBySoftware, false);
assert.strictEqual(ready.registryFilingAuthorized, false);
assert.strictEqual(ready.municipalFilingAuthorized, false);
assert.strictEqual(ready.valuationCalculated, false);
assert.strictEqual(ready.residualLandValueCalculated, false);
assert.strictEqual(ready.npvCalculated, false);
assert.strictEqual(ready.irrCalculated, false);
assert.deepStrictEqual(evaluate(f), ready);

const withinProposal = makeProposal(f.evidence, { proposalId: 'PROPOSAL-WITHIN-18', proposedTotalAreaSqm: 999.5, areaToleranceSqm: 0.5 });
const withinPolicy = makePolicy(f.evidence, [withinProposal], { policyId: 'POLICY-WITHIN-18' });
const within = evaluate({ evidence: f.evidence, proposals: [withinProposal], policy: withinPolicy });
assert.strictEqual(within.status, REVIEW_STATUS.READY_FOR_PROFESSIONAL_SUBDIVISION_MERGE_REVIEW);
assert.strictEqual(within.review[0].absoluteAreaDeltaSqm, 0.5);
assert(within.riskFlags.includes(`C18_AREA_RECONCILIATION_WITHIN_EXTERNAL_TOLERANCE:${withinProposal.proposalId}`));

const outsideProposal = makeProposal(f.evidence, { proposalId: 'PROPOSAL-OUTSIDE-18', proposedTotalAreaSqm: 998, areaToleranceSqm: 1 });
const outsidePolicy = makePolicy(f.evidence, [outsideProposal], { policyId: 'POLICY-OUTSIDE-18' });
const outside = evaluate({ evidence: f.evidence, proposals: [outsideProposal], policy: outsidePolicy });
assert.strictEqual(outside.status, REVIEW_STATUS.HOLD_AREA_RECONCILIATION);
assert(outside.blockers.includes(`C18_AREA_RECONCILIATION_OUTSIDE_TOLERANCE:${outsideProposal.proposalId}`));
assert.strictEqual(outside.review, null);

const unresolvedAccess = makeEvidence('PARCEL-A', EC.ACCESS_AND_SERVICES, 'ACCESS-U', { evidenceState: EVIDENCE_STATE.UNRESOLVED, unresolvedReasonRef: 'ACCESS-UNRESOLVED-18' });
const unresolvedEvidence = f.evidence.map((e) => e.parcelRef === 'PARCEL-A' && e.evidenceClass === EC.ACCESS_AND_SERVICES ? unresolvedAccess : e);
const unresolvedProposal = makeProposal(unresolvedEvidence, { proposalId: 'PROPOSAL-UNRESOLVED-18' });
const unresolvedPolicy = makePolicy(unresolvedEvidence, [unresolvedProposal], { policyId: 'POLICY-UNRESOLVED-18' });
const unresolved = evaluate({ evidence: unresolvedEvidence, proposals: [unresolvedProposal], policy: unresolvedPolicy });
assert.strictEqual(unresolved.status, REVIEW_STATUS.HOLD_EVIDENCE);
assert(unresolved.blockers.some((b) => b.includes('C18_EVIDENCE_REQUIRED_CLASS_NOT_SATISFIED')));

const notRequiredMunicipal = makeEvidence('PARCEL-A', EC.MUNICIPAL_OR_CADASTRAL_REQUIREMENTS, 'MUNICIPAL-NR', { evidenceState: EVIDENCE_STATE.NOT_REQUIRED, notRequiredRationaleRef: 'EXTERNAL-NR-18' });
const nrEvidence = f.evidence.map((e) => e.parcelRef === 'PARCEL-A' && e.evidenceClass === EC.MUNICIPAL_OR_CADASTRAL_REQUIREMENTS ? notRequiredMunicipal : e);
const nrProposal = makeProposal(nrEvidence, { proposalId: 'PROPOSAL-NR-18' });
const nrPolicy = makePolicy(nrEvidence, [nrProposal], { policyId: 'POLICY-NR-18' });
const nr = evaluate({ evidence: nrEvidence, proposals: [nrProposal], policy: nrPolicy });
assert(nr.blockers.some((b) => b.includes('C18_EVIDENCE_REQUIRED_CLASS_NOT_SATISFIED')));

const missingUrban = f.evidence.filter((e) => !(e.parcelRef === 'PARCEL-B' && e.evidenceClass === EC.URBAN_CODE_AND_PLOT_FEASIBILITY));
const missingUrbanProposal = makeProposal(missingUrban, { proposalId: 'PROPOSAL-MISSING-URBAN-18' });
const missingUrbanPolicy = makePolicy(missingUrban, [missingUrbanProposal], { policyId: 'POLICY-MISSING-URBAN-18' });
const missing = evaluate({ evidence: missingUrban, proposals: [missingUrbanProposal], policy: missingUrbanPolicy });
assert(missing.blockers.includes(`C18_EVIDENCE_REQUIRED_CLASS_MISSING:${missingUrbanProposal.proposalId}:PARCEL-B:${EC.URBAN_CODE_AND_PLOT_FEASIBILITY}`));

const tamperedEvidence = f.evidence.map((e, i) => i === 0 ? { ...e, sourceStatus: 'TAMPERED' } : e);
const tampered = evaluate({ evidence: tamperedEvidence, proposals: f.proposals, policy: f.policy });
assert.strictEqual(tampered.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(tampered.blockers.some((b) => b.startsWith('C18_INTEGRITY_EVIDENCE')));

const staleSurvey = makeEvidence('PARCEL-A', EC.SURVEY_AND_AREA, 'SURVEY-STALE', { surveyedAreaSqm: 600, reviewedAt: '2026-09-28T09:00:00Z', validUntil: '2026-09-30T12:00:00Z' });
const staleEvidence = f.evidence.map((e) => e.parcelRef === 'PARCEL-A' && e.evidenceClass === EC.SURVEY_AND_AREA ? staleSurvey : e);
const staleProposal = makeProposal(staleEvidence, { proposalId: 'PROPOSAL-STALE-18' });
const stalePolicy = makePolicy(staleEvidence, [staleProposal], { policyId: 'POLICY-STALE-18' });
const stale = evaluate({ evidence: staleEvidence, proposals: [staleProposal], policy: stalePolicy });
assert.strictEqual(stale.status, REVIEW_STATUS.HOLD_WINDOW);
assert(stale.blockers.some((b) => b.startsWith('C18_WINDOW_EVIDENCE_STALE')));

const futureTitle = makeEvidence('PARCEL-A', EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE-FUTURE', { reviewedAt: '2026-10-02T09:00:00Z', validUntil: '2026-10-03T12:00:00Z' });
const futureEvidence = f.evidence.map((e) => e.parcelRef === 'PARCEL-A' && e.evidenceClass === EC.TITLE_AND_PARCEL_IDENTITY ? futureTitle : e);
const futureProposal = makeProposal(futureEvidence, { proposalId: 'PROPOSAL-FUTURE-18' });
const futurePolicy = makePolicy(futureEvidence, [futureProposal], { policyId: 'POLICY-FUTURE-18' });
const future = evaluate({ evidence: futureEvidence, proposals: [futureProposal], policy: futurePolicy });
assert(future.blockers.some((b) => b.startsWith('C18_WINDOW_EVIDENCE_FUTURE')));

const otherProperty = makeEvidence('PARCEL-A', EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE-OTHER', { propertyRef: 'PROP-OTHER' });
const contextEvidence = f.evidence.map((e) => e.parcelRef === 'PARCEL-A' && e.evidenceClass === EC.TITLE_AND_PARCEL_IDENTITY ? otherProperty : e);
const contextProposal = makeProposal(contextEvidence, { proposalId: 'PROPOSAL-CONTEXT-18' });
const contextPolicy = makePolicy(contextEvidence, [contextProposal], { policyId: 'POLICY-CONTEXT-18' });
const context = evaluate({ evidence: contextEvidence, proposals: [contextProposal], policy: contextPolicy });
assert.strictEqual(context.status, REVIEW_STATUS.HOLD_CONTEXT);
assert(context.blockers.some((b) => b.startsWith('C18_CONTEXT_EVIDENCE')));

const wrongParcelTitle = makeEvidence('PARCEL-X', EC.TITLE_AND_PARCEL_IDENTITY, 'TITLE-X');
const wrongParcelEvidence = f.evidence.map((e) => e.parcelRef === 'PARCEL-A' && e.evidenceClass === EC.TITLE_AND_PARCEL_IDENTITY ? wrongParcelTitle : e);
const wrongParcelProposal = createGovernedSubdivisionMergeProposal({
  proposalId: 'PROPOSAL-WRONG-PARCEL-18', caseId: 'CASE-18', propertyRef: 'PROP-18', operationType: OT.MERGE_REVIEW,
  parcelBindings: [
    { parcelRef: 'PARCEL-A', titleEvidenceHashSha256: wrongParcelTitle.evidenceHashSha256, surveyEvidenceHashSha256: findEvidence(wrongParcelEvidence, 'PARCEL-A', EC.SURVEY_AND_AREA).evidenceHashSha256, surveyedAreaSqm: 600 },
    { parcelRef: 'PARCEL-B', titleEvidenceHashSha256: findEvidence(wrongParcelEvidence, 'PARCEL-B', EC.TITLE_AND_PARCEL_IDENTITY).evidenceHashSha256, surveyEvidenceHashSha256: findEvidence(wrongParcelEvidence, 'PARCEL-B', EC.SURVEY_AND_AREA).evidenceHashSha256, surveyedAreaSqm: 400 },
  ],
  proposedOutputParcelCount: 1, proposedTotalAreaSqm: 1000, areaToleranceSqm: 0,
  evidenceHashesSha256: wrongParcelEvidence.map((e) => e.evidenceHashSha256), rationaleRef: 'R', authoredByRef: 'A', reviewedByRef: 'V', reviewEvidenceRef: 'E',
  reviewedAt: '2026-10-01T10:00:00Z', validUntil: '2026-10-03T12:00:00Z',
});
const wrongParcelPolicy = makePolicy(wrongParcelEvidence, [wrongParcelProposal], { policyId: 'POLICY-WRONG-PARCEL-18' });
const wrongParcel = evaluate({ evidence: wrongParcelEvidence, proposals: [wrongParcelProposal], policy: wrongParcelPolicy });
assert.strictEqual(wrongParcel.status, REVIEW_STATUS.HOLD_CONTEXT);
assert(wrongParcel.blockers.some((b) => b.startsWith('C18_CONTEXT_TITLE_PARCEL_MISMATCH')));

const surveyA = findEvidence(f.evidence, 'PARCEL-A', EC.SURVEY_AND_AREA);
const titleA = findEvidence(f.evidence, 'PARCEL-A', EC.TITLE_AND_PARCEL_IDENTITY);
const titleB = findEvidence(f.evidence, 'PARCEL-B', EC.TITLE_AND_PARCEL_IDENTITY);
const surveyB = findEvidence(f.evidence, 'PARCEL-B', EC.SURVEY_AND_AREA);
const wrongAreaProposal = createGovernedSubdivisionMergeProposal({
  proposalId: 'PROPOSAL-WRONG-AREA-18', caseId: 'CASE-18', propertyRef: 'PROP-18', operationType: OT.MERGE_REVIEW,
  parcelBindings: [
    { parcelRef: 'PARCEL-A', titleEvidenceHashSha256: titleA.evidenceHashSha256, surveyEvidenceHashSha256: surveyA.evidenceHashSha256, surveyedAreaSqm: 601 },
    { parcelRef: 'PARCEL-B', titleEvidenceHashSha256: titleB.evidenceHashSha256, surveyEvidenceHashSha256: surveyB.evidenceHashSha256, surveyedAreaSqm: 400 },
  ],
  proposedOutputParcelCount: 1, proposedTotalAreaSqm: 1001, areaToleranceSqm: 0,
  evidenceHashesSha256: f.evidence.map((e) => e.evidenceHashSha256), rationaleRef: 'R', authoredByRef: 'A', reviewedByRef: 'V', reviewEvidenceRef: 'E',
  reviewedAt: '2026-10-01T10:00:00Z', validUntil: '2026-10-03T12:00:00Z',
});
const wrongAreaPolicy = makePolicy(f.evidence, [wrongAreaProposal], { policyId: 'POLICY-WRONG-AREA-18' });
const wrongArea = evaluate({ evidence: f.evidence, proposals: [wrongAreaProposal], policy: wrongAreaPolicy });
assert.strictEqual(wrongArea.status, REVIEW_STATUS.HOLD_AREA_RECONCILIATION);
assert(wrongArea.blockers.some((b) => b.startsWith('C18_AREA_SURVEY_BINDING_MISMATCH')));

const duplicateEvidence = [...f.evidence, f.evidence[0]];
const duplicate = evaluate({ evidence: duplicateEvidence, proposals: f.proposals, policy: f.policy });
assert.strictEqual(duplicate.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(duplicate.blockers.some((b) => b.startsWith('C18_INTEGRITY_DUPLICATE_EVIDENCE_ID')));

const injectedCore = { ...f.proposals[0], feasibilityDeterminedBySoftware: true };
const injected = { ...injectedCore, proposalHashSha256: computeProposalHash(injectedCore) };
assert(verifyProposalIntegrity(injected));
const injectedPolicy = makePolicy(f.evidence, [injected], { policyId: 'POLICY-INJECTED-18' });
const injectedResult = evaluate({ evidence: f.evidence, proposals: [injected], policy: injectedPolicy });
assert.strictEqual(injectedResult.status, REVIEW_STATUS.HOLD_INTEGRITY);
assert(injectedResult.blockers.includes(`C18_AUTHORITY_INJECTION:PROPOSAL:${injected.proposalId}`));

const policyMismatch = makePolicy(f.evidence.slice(0, -1), f.proposals, { policyId: 'POLICY-MISMATCH-18' });
const mismatch = evaluate({ evidence: f.evidence, proposals: f.proposals, policy: policyMismatch });
assert.strictEqual(mismatch.status, REVIEW_STATUS.HOLD_POLICY);
assert(mismatch.blockers.includes('C18_POLICY_EVIDENCE_BINDING_MISMATCH'));

assert.throws(() => createGovernedSubdivisionMergeReviewPolicy({
  policyId: 'BAD-POLICY', caseId: 'CASE-18', propertyRef: 'PROP-18', allowedOperationTypes: [OT.MERGE_REVIEW],
  allowedEvidenceClasses: [EC.TITLE_AND_PARCEL_IDENTITY, EC.SURVEY_AND_AREA],
  requiredEvidenceClassesByOperation: { [OT.MERGE_REVIEW]: [EC.TITLE_AND_PARCEL_IDENTITY, EC.SURVEY_AND_AREA, EC.ACCESS_AND_SERVICES] },
  evidenceHashesSha256: [H1], proposalHashesSha256: [H2], reviewedByRef: 'R', reviewEvidenceRef: 'E', reviewedAt: '2026-10-01T10:00:00Z', validUntil: '2026-10-02T10:00:00Z',
}), /C18_POLICY_REQUIRED_CLASS_NOT_ALLOWED/);
assert.throws(() => createGovernedSubdivisionMergeReviewPolicy({
  policyId: 'BAD-HARD-GATE', caseId: 'CASE-18', propertyRef: 'PROP-18', allowedOperationTypes: [OT.MERGE_REVIEW],
  allowedEvidenceClasses: [EC.TITLE_AND_PARCEL_IDENTITY], requiredEvidenceClassesByOperation: { [OT.MERGE_REVIEW]: [EC.TITLE_AND_PARCEL_IDENTITY] },
  evidenceHashesSha256: [H1], proposalHashesSha256: [H2], reviewedByRef: 'R', reviewEvidenceRef: 'E', reviewedAt: '2026-10-01T10:00:00Z', validUntil: '2026-10-02T10:00:00Z',
}), /C18_POLICY_TITLE_SURVEY_HARD_GATES_REQUIRED/);
assert.throws(() => makeEvidence('PARCEL-A', EC.ACCESS_AND_SERVICES, 'BAD-U', { evidenceState: EVIDENCE_STATE.UNRESOLVED, unresolvedReasonRef: undefined }), /C18_UNRESOLVED_REASON_REQUIRED/);
assert.throws(() => createGovernedSubdivisionMergeProposal({
  proposalId: 'BAD-AREA-PAIR', caseId: 'CASE-18', propertyRef: 'PROP-18', operationType: OT.SUBDIVISION_REVIEW,
  parcelBindings: [{ parcelRef: 'P', titleEvidenceHashSha256: H1, surveyEvidenceHashSha256: H2, surveyedAreaSqm: 100 }],
  proposedOutputParcelCount: 2, proposedTotalAreaSqm: 100, areaToleranceSqm: null, evidenceHashesSha256: [H1, H2],
  rationaleRef: 'R', authoredByRef: 'A', reviewedByRef: 'V', reviewEvidenceRef: 'E', reviewedAt: '2026-10-01T10:00:00Z', validUntil: '2026-10-02T10:00:00Z',
}), /C18_AREA_RECONCILIATION_PAIR_REQUIRED/);
assert.throws(() => createGovernedSubdivisionMergeProposal({
  proposalId: 'BAD-DUP-PARCEL', caseId: 'CASE-18', propertyRef: 'PROP-18', operationType: OT.MERGE_REVIEW,
  parcelBindings: [
    { parcelRef: 'P', titleEvidenceHashSha256: H1, surveyEvidenceHashSha256: H2, surveyedAreaSqm: 100 },
    { parcelRef: 'P', titleEvidenceHashSha256: H1, surveyEvidenceHashSha256: H2, surveyedAreaSqm: 100 },
  ],
  proposedOutputParcelCount: 1, evidenceHashesSha256: [H1, H2], rationaleRef: 'R', authoredByRef: 'A', reviewedByRef: 'V', reviewEvidenceRef: 'E', reviewedAt: '2026-10-01T10:00:00Z', validUntil: '2026-10-02T10:00:00Z',
}), /C18_DUPLICATE_PARCEL_REF/);

console.log('C18_GOVERNED_SUBDIVISION_MERGE_REVIEW=PASS');
