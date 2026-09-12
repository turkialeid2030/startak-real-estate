'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  IC_EVIDENCE_CLASS,
  IC_SUBJECT_TYPE,
  IC_PACKET_STATUS,
  IC_MEETING_STATUS,
  IC_VOTE,
  IC_RESOLUTION,
  CONFLICT_DISCLOSURE,
  createIcEvidenceItem,
  verifyIcEvidenceItem,
  createIcEvidencePacket,
  verifyIcEvidencePacket,
  createCommitteeMeeting,
  verifyCommitteeMeeting,
  createCommitteeVote,
  verifyCommitteeVote,
  recordCommitteeResolution,
  verifyCommitteeResolution,
} = require('../../src/investment-committee');

let checks = 0;
function check(fn) { fn(); checks += 1; }
function sha(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }

function evidence(id, evidenceClass, overrides = {}) {
  return createIcEvidenceItem({
    evidenceItemId: `EVID-${id}`,
    evidenceClass,
    subjectType: IC_SUBJECT_TYPE.PORTFOLIO,
    subjectId: 'PORT-16D',
    sourceArtifactId: `ART-${id}`,
    sourceArtifactHashSha256: sha(`artifact-${id}`),
    sourceAsOfDate: '2026-09-01',
    rationale: 'Synthetic IC evidence fixture.',
    evidenceRefs: [`SRC-${id}`],
    preparedBy: 'ANALYST-1',
    reviewedBy: 'REVIEWER-1',
    preparedAt: '2026-09-07T08:00:00Z',
    reviewedAt: '2026-09-07T09:00:00Z',
    ...overrides,
  });
}

const valuation = evidence('VAL', IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT);
const investment = evidence('INV', IC_EVIDENCE_CLASS.INVESTMENT_ANALYSIS);
const uncertainty = evidence('UNC', IC_EVIDENCE_CLASS.UNCERTAINTY_ANALYSIS);
const portfolio = evidence('PORT', IC_EVIDENCE_CLASS.PORTFOLIO_ANALYSIS);

check(() => assert.strictEqual(verifyIcEvidenceItem(valuation).valid, true));
check(() => assert.strictEqual(valuation.subjectType, IC_SUBJECT_TYPE.PORTFOLIO));
check(() => assert.ok(Object.isFrozen(valuation)));
check(() => assert.ok(Object.isFrozen(valuation.evidenceRefs)));

const packet = createIcEvidencePacket({
  packetId: 'IC-PACKET-1',
  subjectType: IC_SUBJECT_TYPE.PORTFOLIO,
  subjectId: 'PORT-16D',
  asOfDate: '2026-09-08',
  maximumSourceAgeDays: 30,
  requiredEvidenceClasses: [
    IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT,
    IC_EVIDENCE_CLASS.INVESTMENT_ANALYSIS,
    IC_EVIDENCE_CLASS.UNCERTAINTY_ANALYSIS,
    IC_EVIDENCE_CLASS.PORTFOLIO_ANALYSIS,
  ],
  items: [valuation, investment, uncertainty, portfolio],
  createdAt: '2026-09-08T05:00:00Z',
});

check(() => assert.strictEqual(packet.status, IC_PACKET_STATUS.READY_FOR_COMMITTEE_REVIEW));
check(() => assert.deepStrictEqual(packet.blockingCodes, []));
check(() => assert.deepStrictEqual(packet.missingEvidenceClasses, []));
check(() => assert.strictEqual(packet.evidenceCompletenessDerivedOnly, true));
check(() => assert.strictEqual(packet.investmentRecommendationGenerated, false));
check(() => assert.strictEqual(packet.professionalValuationConclusionModified, false));
check(() => assert.strictEqual(packet.transactionAuthorized, false));
check(() => assert.strictEqual(packet.operatingMode, 'UNLICENSED_DECISION_SUPPORT'));
check(() => assert.strictEqual(verifyIcEvidencePacket(packet).valid, true));
check(() => assert.ok(Object.isFrozen(packet)));

const missingPacket = createIcEvidencePacket({
  packetId: 'IC-PACKET-MISSING', subjectType: IC_SUBJECT_TYPE.PORTFOLIO, subjectId: 'PORT-16D',
  asOfDate: '2026-09-08', maximumSourceAgeDays: 30,
  requiredEvidenceClasses: [IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT, IC_EVIDENCE_CLASS.LEGAL_DUE_DILIGENCE],
  items: [valuation],
});
check(() => assert.ok(missingPacket.blockingCodes.includes(IC_PACKET_STATUS.HOLD_MISSING_EVIDENCE)));
check(() => assert.ok(missingPacket.missingEvidenceClasses.includes(IC_EVIDENCE_CLASS.LEGAL_DUE_DILIGENCE)));

const stalePacket = createIcEvidencePacket({
  packetId: 'IC-PACKET-STALE', subjectType: IC_SUBJECT_TYPE.PORTFOLIO, subjectId: 'PORT-16D',
  asOfDate: '2026-09-08', maximumSourceAgeDays: 3,
  requiredEvidenceClasses: [IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT], items: [valuation],
});
check(() => assert.ok(stalePacket.blockingCodes.includes(IC_PACKET_STATUS.HOLD_SOURCE_FRESHNESS)));

const futureEvidence = evidence('FUT', IC_EVIDENCE_CLASS.PORTFOLIO_ANALYSIS, { sourceAsOfDate: '2026-09-09' });
const futurePacket = createIcEvidencePacket({
  packetId: 'IC-PACKET-FUT', subjectType: IC_SUBJECT_TYPE.PORTFOLIO, subjectId: 'PORT-16D',
  asOfDate: '2026-09-08', maximumSourceAgeDays: 30,
  requiredEvidenceClasses: [IC_EVIDENCE_CLASS.PORTFOLIO_ANALYSIS], items: [futureEvidence],
});
check(() => assert.ok(futurePacket.blockingCodes.includes(IC_PACKET_STATUS.HOLD_TEMPORAL_VALIDITY)));

const tamperedEvidence = { ...valuation, sourceArtifactId: 'TAMPERED' };
check(() => assert.strictEqual(verifyIcEvidenceItem(tamperedEvidence).valid, false));
check(() => assert.throws(() => createIcEvidencePacket({
  packetId: 'BAD', subjectType: IC_SUBJECT_TYPE.PORTFOLIO, subjectId: 'PORT-16D', asOfDate: '2026-09-08',
  maximumSourceAgeDays: 30, requiredEvidenceClasses: [IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT], items: [tamperedEvidence],
}), /IC_EVIDENCE_ITEM_INTEGRITY_FAILURE/));
check(() => assert.throws(() => createIcEvidencePacket({
  packetId: 'DUP', subjectType: IC_SUBJECT_TYPE.PORTFOLIO, subjectId: 'PORT-16D', asOfDate: '2026-09-08',
  maximumSourceAgeDays: 30, requiredEvidenceClasses: [IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT], items: [valuation, valuation],
}), /DUPLICATE_IC_EVIDENCE_ITEM/));
check(() => assert.throws(() => createIcEvidencePacket({
  packetId: 'SUBJ', subjectType: IC_SUBJECT_TYPE.PORTFOLIO, subjectId: 'OTHER', asOfDate: '2026-09-08',
  maximumSourceAgeDays: 30, requiredEvidenceClasses: [IC_EVIDENCE_CLASS.PROFESSIONAL_VALUATION_OUTPUT], items: [valuation],
}), /IC_EVIDENCE_SUBJECT_MISMATCH/));
check(() => assert.throws(() => evidence('NOREF', IC_EVIDENCE_CLASS.OTHER, { evidenceRefs: [] }), /IC_EVIDENCE_REFS_REQUIRED/));
check(() => assert.throws(() => evidence('REVIEW', IC_EVIDENCE_CLASS.OTHER, { reviewedAt: '2026-09-07T07:00:00Z' }), /REVIEW_BEFORE_PREPARATION/));

function members() {
  return [
    { memberId: 'M1', role: 'CHAIR', votingMember: true, attended: true, conflictDisclosure: CONFLICT_DISCLOSURE.NONE, recused: false },
    { memberId: 'M2', role: 'MEMBER', votingMember: true, attended: true, conflictDisclosure: CONFLICT_DISCLOSURE.NONE, recused: false },
    { memberId: 'M3', role: 'MEMBER', votingMember: true, attended: true, conflictDisclosure: CONFLICT_DISCLOSURE.DECLARED, recused: true, conflictEvidenceRefs: ['CONFLICT-M3'] },
    { memberId: 'M4', role: 'SECRETARY', votingMember: false, attended: true, conflictDisclosure: CONFLICT_DISCLOSURE.NONE, recused: false },
  ];
}

const meeting = createCommitteeMeeting({
  meetingId: 'MEETING-16D-1', committeeId: 'IC-1', packet,
  meetingAt: '2026-09-08T06:00:00Z', members: members(),
  quorumPolicy: { policyRef: 'IC-POLICY-QUORUM-1', minimumAttendingVotingMembers: 2 },
});
check(() => assert.strictEqual(meeting.meetingStatus, IC_MEETING_STATUS.READY_FOR_VOTE));
check(() => assert.strictEqual(meeting.eligibleAttendingVotingMembers, 2));
check(() => assert.strictEqual(meeting.quorumSatisfied, true));
check(() => assert.strictEqual(meeting.committeeAuthorityValidated, false));
check(() => assert.strictEqual(meeting.transactionAuthorized, false));
check(() => assert.strictEqual(meeting.aiMemberPermitted, false));
check(() => assert.strictEqual(verifyCommitteeMeeting(meeting).valid, true));
check(() => assert.ok(Object.isFrozen(meeting)));

const holdMeeting = createCommitteeMeeting({
  meetingId: 'MEETING-HOLD', committeeId: 'IC-1', packet: missingPacket,
  meetingAt: '2026-09-08T06:00:00Z', members: members(),
  quorumPolicy: { policyRef: 'IC-POLICY-QUORUM-1', minimumAttendingVotingMembers: 2 },
});
check(() => assert.strictEqual(holdMeeting.meetingStatus, IC_MEETING_STATUS.HOLD_PACKET));

const quorumHold = createCommitteeMeeting({
  meetingId: 'MEETING-Q', committeeId: 'IC-1', packet,
  meetingAt: '2026-09-08T06:00:00Z', members: members(),
  quorumPolicy: { policyRef: 'IC-POLICY-QUORUM-2', minimumAttendingVotingMembers: 3 },
});
check(() => assert.strictEqual(quorumHold.meetingStatus, IC_MEETING_STATUS.HOLD_QUORUM));
check(() => assert.throws(() => createCommitteeMeeting({
  meetingId: 'MEETING-CONFLICT', committeeId: 'IC-1', packet, meetingAt: '2026-09-08T06:00:00Z',
  members: [{ memberId:'X', role:'MEMBER', votingMember:true, attended:true, conflictDisclosure:CONFLICT_DISCLOSURE.DECLARED, recused:true }],
  quorumPolicy:{ policyRef:'P', minimumAttendingVotingMembers:1 },
}), /IC_CONFLICT_EVIDENCE_REQUIRED/));

function vote(memberId, voteValue, id) {
  return createCommitteeVote({
    meeting, voteId: id, memberId, vote: voteValue,
    rationale: 'Human committee vote recorded for synthetic fixture.',
    evidenceRefs: [`VOTE-E-${id}`], castAt: '2026-09-08T06:10:00Z',
  });
}
const v1 = vote('M1', IC_VOTE.SUPPORT_PROCEED, 'V1');
const v2 = vote('M2', IC_VOTE.SUPPORT_PROCEED, 'V2');
check(() => assert.strictEqual(verifyCommitteeVote(v1).valid, true));
check(() => assert.strictEqual(v1.aiGeneratedVote, false));
check(() => assert.strictEqual(v1.meetingHashSha256, meeting.meetingHashSha256));
check(() => assert.throws(() => vote('M3', IC_VOTE.ABSTAIN, 'V3'), /RECUSED_MEMBER_CANNOT_VOTE/));
check(() => assert.throws(() => vote('M4', IC_VOTE.ABSTAIN, 'V4'), /IC_VOTER_NOT_ELIGIBLE/));
check(() => assert.throws(() => createCommitteeVote({ meeting: holdMeeting, voteId:'BAD', memberId:'M1', vote:IC_VOTE.ABSTAIN, rationale:'x' }), /MEETING_NOT_READY_FOR_VOTE/));
check(() => assert.throws(() => createCommitteeVote({ meeting, voteId:'EARLY', memberId:'M1', vote:IC_VOTE.ABSTAIN, rationale:'x', castAt:'2026-09-08T05:59:00Z' }), /IC_VOTE_BEFORE_MEETING/));
const tamperedVote = { ...v1, rationale: 'tampered' };
check(() => assert.strictEqual(verifyCommitteeVote(tamperedVote).valid, false));

const resolution = recordCommitteeResolution({
  resolutionId: 'RES-16D-1', meeting, votes: [v1, v2],
  resolution: IC_RESOLUTION.PROCEED_TO_NEXT_INTERNAL_STAGE,
  rationale: 'Human committee resolution to continue internal diligence only.',
  resolutionPolicy: { policyRef: 'IC-RES-POLICY-1', minimumRecordedVotes: 2, minimumSupportVotesForProceed: 2 },
  recordedBy: 'SECRETARY-M4', minutesArtifactId: 'MINUTES-16D-1', minutesArtifactHashSha256: sha('minutes'),
  evidenceRefs: ['SIGNED-MINUTES-REF'], resolvedAt: '2026-09-08T06:30:00Z',
});
check(() => assert.strictEqual(resolution.state, 'HUMAN_IC_RESOLUTION_RECORDED'));
check(() => assert.strictEqual(resolution.resolution, IC_RESOLUTION.PROCEED_TO_NEXT_INTERNAL_STAGE));
check(() => assert.strictEqual(resolution.tally[IC_VOTE.SUPPORT_PROCEED], 2));
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
check(() => assert.strictEqual(verifyCommitteeResolution(resolution).valid, true));
check(() => assert.ok(Object.isFrozen(resolution)));

check(() => assert.throws(() => recordCommitteeResolution({
  resolutionId:'FEW', meeting, votes:[v1], resolution:IC_RESOLUTION.HOLD_FOR_INFORMATION, rationale:'hold',
  resolutionPolicy:{policyRef:'P',minimumRecordedVotes:2,minimumSupportVotesForProceed:2}, recordedBy:'S',
  minutesArtifactId:'M',minutesArtifactHashSha256:sha('m'),resolvedAt:'2026-09-08T06:30:00Z'
}), /MINIMUM_RECORDED_VOTES_NOT_MET/));
check(() => assert.throws(() => recordCommitteeResolution({
  resolutionId:'SUPPORT', meeting, votes:[v1, createCommitteeVote({meeting,voteId:'V2H',memberId:'M2',vote:IC_VOTE.HOLD_FOR_INFORMATION,rationale:'hold',castAt:'2026-09-08T06:10:00Z'})],
  resolution:IC_RESOLUTION.PROCEED_TO_NEXT_INTERNAL_STAGE,rationale:'proceed',resolutionPolicy:{policyRef:'P',minimumRecordedVotes:2,minimumSupportVotesForProceed:2},recordedBy:'S',minutesArtifactId:'M',minutesArtifactHashSha256:sha('m'),resolvedAt:'2026-09-08T06:30:00Z'
}), /PROCEED_SUPPORT_THRESHOLD_NOT_MET/));
check(() => assert.throws(() => recordCommitteeResolution({
  resolutionId:'DUPV',meeting,votes:[v1,v1],resolution:IC_RESOLUTION.HOLD_FOR_INFORMATION,rationale:'hold',resolutionPolicy:{policyRef:'P',minimumRecordedVotes:2,minimumSupportVotesForProceed:1},recordedBy:'S',minutesArtifactId:'M',minutesArtifactHashSha256:sha('m'),resolvedAt:'2026-09-08T06:30:00Z'
}), /DUPLICATE_IC_VOTE_ID/));
const tamperedResolution={...resolution,rationale:'tampered'};
check(() => assert.strictEqual(verifyCommitteeResolution(tamperedResolution).valid,false));

console.log(`WAVE_16D_INVESTMENT_COMMITTEE_GOVERNANCE=PASS checks=${checks}`);
