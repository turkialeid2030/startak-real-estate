'use strict';

const assert = require('assert');
const crypto = require('crypto');
const uncertainty = require('../../src/uncertainty');
const portfolio = require('../../src/portfolio');
const ic = require('../../src/investment-committee');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

// Wave 16A/B surface must coexist on the closeout head.
[
  'createQualifiedDistribution', 'verifyQualifiedDistribution',
  'createMonteCarloGovernancePlan', 'verifyMonteCarloGovernancePlan',
  'executeGovernedMonteCarlo', 'verifyGovernedMonteCarloResult',
  'createQualifiedDecisionThreshold', 'verifyQualifiedDecisionThreshold',
  'createThresholdAnalyticsPlan', 'verifyThresholdAnalyticsPlan',
  'executeThresholdAnalytics', 'verifyThresholdAnalyticsResult',
].forEach((name) => check(() => assert.strictEqual(typeof uncertainty[name], 'function', `${name} missing`)));

// Wave 16C surface.
[
  'createPortfolioMember', 'verifyPortfolioMember',
  'createPortfolioSnapshot', 'verifyPortfolioSnapshot',
].forEach((name) => check(() => assert.strictEqual(typeof portfolio[name], 'function', `${name} missing`)));

// Existing IC API must remain intact alongside Wave 16D.
[
  'createCommitteePolicy', 'createCommitteeCase', 'validateAttendance', 'recordHumanCommitteeDecision',
  'createIcEvidenceItem', 'verifyIcEvidenceItem', 'createIcEvidencePacket', 'verifyIcEvidencePacket',
  'createCommitteeMeeting', 'verifyCommitteeMeeting', 'createCommitteeVote', 'verifyCommitteeVote',
  'recordCommitteeResolution', 'verifyCommitteeResolution',
].forEach((name) => check(() => assert.strictEqual(typeof ic[name], 'function', `${name} missing`)));

function portfolioMember(id, weight, amount) {
  return portfolio.createPortfolioMember({
    memberId: `M-${id}`,
    assetId: `A-${id}`,
    caseId: `CASE-${id}`,
    propertyRef: `PROPERTY-${id}`,
    assetClass: id === '1' ? 'OFFICE' : 'LOGISTICS',
    geography: 'RIYADH',
    sector: id === '1' ? 'COMMERCIAL' : 'INDUSTRIAL',
    exposureAmount: amount,
    currency: 'SAR',
    exposureBasis: portfolio.EXPOSURE_BASIS.INVESTED_EQUITY,
    allocationWeight: weight,
    sourceArtifactId: `INVESTMENT-ART-${id}`,
    sourceArtifactHashSha256: sha(`source-${id}`),
    sourceArtifactClassification: 'QUALIFIED_INVESTMENT_ANALYSIS',
    sourceAsOfDate: '2026-09-01',
    membershipRationale: 'Explicit Wave 16 closeout portfolio membership.',
    evidenceRefs: [`PORT-E-${id}`],
    riskEvidenceRefs: [`RISK-E-${id}`],
    preparedBy: 'PORT-ANALYST',
    reviewedBy: 'PORT-REVIEWER',
    preparedAt: '2026-09-07T08:00:00Z',
    reviewedAt: '2026-09-07T09:00:00Z',
  });
}

const member1 = portfolioMember('1', 0.6, 600);
const member2 = portfolioMember('2', 0.4, 400);
const snapshot = portfolio.createPortfolioSnapshot({
  snapshotId: 'SNAP-W16E-1',
  portfolioId: 'PORT-W16E-1',
  portfolioName: 'Wave 16 Closeout Portfolio',
  asOfDate: '2026-09-08',
  currency: 'SAR',
  weightBasis: portfolio.WEIGHT_BASIS.CURRENT_EXPOSURE,
  maximumSourceAgeDays: 30,
  members: [member1, member2],
  createdAt: '2026-09-08T05:00:00Z',
});

check(() => assert.strictEqual(portfolio.verifyPortfolioSnapshot(snapshot).valid, true));
check(() => assert.strictEqual(snapshot.status, portfolio.PORTFOLIO_STATUS.READY_FOR_IC_EVIDENCE_ASSEMBLY));
check(() => assert.strictEqual(snapshot.portfolioProbabilisticAggregationPerformed, false));
check(() => assert.strictEqual(snapshot.crossAssetCorrelationModel, 'NOT_MODELED'));
check(() => assert.strictEqual(snapshot.jointDistributionEstablished, false));
check(() => assert.strictEqual(snapshot.portfolioVaRCalculated, false));
check(() => assert.strictEqual(snapshot.diversificationBenefitCalculated, false));
check(() => assert.strictEqual(snapshot.concentrationLimitComplianceDerived, false));
check(() => assert.strictEqual(snapshot.decisionStateDerived, false));
check(() => assert.strictEqual(snapshot.automaticInvestmentDecisionAuthorized, false));
check(() => assert.strictEqual(snapshot.humanCommitteeDecisionRequired, true));
check(() => assert.strictEqual(snapshot.professionalValuationConclusionModified, false));
check(() => assert.strictEqual(snapshot.transactionAuthorized, false));

function icEvidence(id, evidenceClass, sourceHash) {
  return ic.createIcEvidenceItem({
    evidenceItemId: `IC-E-${id}`,
    evidenceClass,
    subjectType: ic.IC_SUBJECT_TYPE.PORTFOLIO,
    subjectId: snapshot.portfolioId,
    sourceArtifactId: `IC-SOURCE-${id}`,
    sourceArtifactHashSha256: sourceHash,
    sourceAsOfDate: '2026-09-08',
    rationale: 'Wave 16 closeout cross-layer evidence binding.',
    evidenceRefs: [`IC-REF-${id}`],
    preparedBy: 'IC-ANALYST',
    reviewedBy: 'IC-REVIEWER',
    preparedAt: '2026-09-08T05:10:00Z',
    reviewedAt: '2026-09-08T05:20:00Z',
  });
}

const portfolioEvidence = icEvidence('PORT', ic.IC_EVIDENCE_CLASS.PORTFOLIO_ANALYSIS, snapshot.snapshotHashSha256);
const uncertaintyEvidence = icEvidence('UNC', ic.IC_EVIDENCE_CLASS.UNCERTAINTY_ANALYSIS, sha('qualified-wave16b-threshold-output'));
const investmentEvidence = icEvidence('INV', ic.IC_EVIDENCE_CLASS.INVESTMENT_ANALYSIS, sha('qualified-investment-output'));
const valuationEvidence = icEvidence('VAL', ic.IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT, sha('professional-method-output-reference'));

const packet = ic.createIcEvidencePacket({
  packetId: 'IC-PACKET-W16E',
  subjectType: ic.IC_SUBJECT_TYPE.PORTFOLIO,
  subjectId: snapshot.portfolioId,
  asOfDate: '2026-09-08',
  maximumSourceAgeDays: 30,
  requiredEvidenceClasses: [
    ic.IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT,
    ic.IC_EVIDENCE_CLASS.INVESTMENT_ANALYSIS,
    ic.IC_EVIDENCE_CLASS.UNCERTAINTY_ANALYSIS,
    ic.IC_EVIDENCE_CLASS.PORTFOLIO_ANALYSIS,
  ],
  items: [valuationEvidence, investmentEvidence, uncertaintyEvidence, portfolioEvidence],
  createdAt: '2026-09-08T05:30:00Z',
});

check(() => assert.strictEqual(ic.verifyIcEvidencePacket(packet).valid, true));
check(() => assert.strictEqual(packet.status, ic.IC_PACKET_STATUS.READY_FOR_COMMITTEE_REVIEW));
check(() => assert.strictEqual(packet.investmentRecommendationGenerated, false));
check(() => assert.strictEqual(packet.transactionAuthorized, false));
check(() => assert.strictEqual(portfolioEvidence.sourceArtifactHashSha256, snapshot.snapshotHashSha256));

const meeting = ic.createCommitteeMeeting({
  meetingId: 'IC-MEETING-W16E',
  committeeId: 'IC-W16E',
  packet,
  meetingAt: '2026-09-08T06:00:00Z',
  members: [
    { memberId: 'IC-M1', role: 'CHAIR', votingMember: true, attended: true, conflictDisclosure: ic.CONFLICT_DISCLOSURE.NONE, recused: false },
    { memberId: 'IC-M2', role: 'MEMBER', votingMember: true, attended: true, conflictDisclosure: ic.CONFLICT_DISCLOSURE.NONE, recused: false },
  ],
  quorumPolicy: { policyRef: 'IC-QUORUM-W16E', minimumAttendingVotingMembers: 2 },
});
check(() => assert.strictEqual(ic.verifyCommitteeMeeting(meeting).valid, true));
check(() => assert.strictEqual(meeting.meetingStatus, ic.IC_MEETING_STATUS.READY_FOR_VOTE));
check(() => assert.strictEqual(meeting.committeeAuthorityValidated, false));
check(() => assert.strictEqual(meeting.aiMemberPermitted, false));
check(() => assert.strictEqual(meeting.transactionAuthorized, false));

function committeeVote(memberId, voteId) {
  return ic.createCommitteeVote({
    meeting,
    voteId,
    memberId,
    vote: ic.IC_VOTE.SUPPORT_PROCEED,
    rationale: 'Human support for next internal stage only.',
    evidenceRefs: [`VOTE-E-${voteId}`],
    castAt: '2026-09-08T06:10:00Z',
  });
}
const vote1 = committeeVote('IC-M1', 'VOTE-W16E-1');
const vote2 = committeeVote('IC-M2', 'VOTE-W16E-2');
check(() => assert.strictEqual(vote1.aiGeneratedVote, false));
check(() => assert.strictEqual(vote2.aiGeneratedVote, false));

const resolution = ic.recordCommitteeResolution({
  resolutionId: 'RESOLUTION-W16E',
  meeting,
  votes: [vote1, vote2],
  resolution: ic.IC_RESOLUTION.PROCEED_TO_NEXT_INTERNAL_STAGE,
  rationale: 'Human committee resolution to advance the internal workflow only.',
  resolutionPolicy: {
    policyRef: 'IC-RESOLUTION-POLICY-W16E',
    minimumRecordedVotes: 2,
    minimumSupportVotesForProceed: 2,
  },
  recordedBy: 'IC-SECRETARY',
  minutesArtifactId: 'MINUTES-W16E',
  minutesArtifactHashSha256: sha('signed-minutes-w16e'),
  evidenceRefs: ['MINUTES-EVIDENCE-W16E'],
  resolvedAt: '2026-09-08T06:30:00Z',
});

check(() => assert.strictEqual(ic.verifyCommitteeResolution(resolution).valid, true));
check(() => assert.strictEqual(resolution.state, 'HUMAN_IC_RESOLUTION_RECORDED'));
check(() => assert.strictEqual(resolution.humanResolutionRecorded, true));
check(() => assert.strictEqual(resolution.systemDerivedResolution, false));
check(() => assert.strictEqual(resolution.aiResolutionPermitted, false));
check(() => assert.strictEqual(resolution.committeeAuthorityValidated, false));
check(() => assert.strictEqual(resolution.decisionActionAuthorized, false));
check(() => assert.strictEqual(resolution.executionActionCreated, false));
check(() => assert.strictEqual(resolution.professionalValuationConclusionModified, false));
check(() => assert.strictEqual(resolution.certifiedValuationAuthorized, false));
check(() => assert.strictEqual(resolution.externalIssuanceAuthorized, false));
check(() => assert.strictEqual(resolution.legalOpinionEstablished, false));
check(() => assert.strictEqual(resolution.transactionAuthorized, false));
check(() => assert.strictEqual(resolution.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));

// Tamper protections survive the composed chain.
check(() => assert.strictEqual(portfolio.verifyPortfolioSnapshot({ ...snapshot, portfolioName: 'tampered' }).valid, false));
check(() => assert.strictEqual(ic.verifyIcEvidencePacket({ ...packet, subjectId: 'tampered' }).valid, false));
check(() => assert.strictEqual(ic.verifyCommitteeMeeting({ ...meeting, committeeId: 'tampered' }).valid, false));
check(() => assert.strictEqual(ic.verifyCommitteeResolution({ ...resolution, rationale: 'tampered' }).valid, false));

console.log(`WAVE_16_DECISION_INTELLIGENCE_CLOSEOUT=PASS checks=${checks}`);
