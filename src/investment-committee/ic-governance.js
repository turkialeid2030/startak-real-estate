'use strict';

const crypto = require('crypto');

const IC_EVIDENCE_CLASS = Object.freeze({
  PROFESSIONAL_VALUATION_OUTPUT: 'PROFESSIONAL_VALUATION_OUTPUT',
  INVESTMENT_ANALYSIS: 'INVESTMENT_ANALYSIS',
  UNCERTAINTY_ANALYSIS: 'UNCERTAINTY_ANALYSIS',
  PORTFOLIO_ANALYSIS: 'PORTFOLIO_ANALYSIS',
  LEGAL_DUE_DILIGENCE: 'LEGAL_DUE_DILIGENCE',
  TAX_DUE_DILIGENCE: 'TAX_DUE_DILIGENCE',
  TECHNICAL_DUE_DILIGENCE: 'TECHNICAL_DUE_DILIGENCE',
  OTHER: 'OTHER',
});

const IC_SUBJECT_TYPE = Object.freeze({ ASSET: 'ASSET', PORTFOLIO: 'PORTFOLIO' });
const IC_PACKET_STATUS = Object.freeze({
  READY_FOR_COMMITTEE_REVIEW: 'READY_FOR_COMMITTEE_REVIEW',
  HOLD_MISSING_EVIDENCE: 'HOLD_MISSING_EVIDENCE',
  HOLD_SOURCE_FRESHNESS: 'HOLD_SOURCE_FRESHNESS',
  HOLD_TEMPORAL_VALIDITY: 'HOLD_TEMPORAL_VALIDITY',
});
const IC_MEETING_STATUS = Object.freeze({ READY_FOR_VOTE: 'READY_FOR_VOTE', HOLD_QUORUM: 'HOLD_QUORUM', HOLD_PACKET: 'HOLD_PACKET' });
const IC_VOTE = Object.freeze({
  SUPPORT_PROCEED: 'SUPPORT_PROCEED',
  HOLD_FOR_INFORMATION: 'HOLD_FOR_INFORMATION',
  RETURN_FOR_REVISION: 'RETURN_FOR_REVISION',
  DECLINE_INTERNAL_CONSIDERATION: 'DECLINE_INTERNAL_CONSIDERATION',
  ABSTAIN: 'ABSTAIN',
});
const IC_RESOLUTION = Object.freeze({
  PROCEED_TO_NEXT_INTERNAL_STAGE: 'PROCEED_TO_NEXT_INTERNAL_STAGE',
  HOLD_FOR_INFORMATION: 'HOLD_FOR_INFORMATION',
  RETURN_FOR_REVISION: 'RETURN_FOR_REVISION',
  DECLINE_INTERNAL_CONSIDERATION: 'DECLINE_INTERNAL_CONSIDERATION',
});
const CONFLICT_DISCLOSURE = Object.freeze({ NONE: 'NONE', DECLARED: 'DECLARED' });
const OPERATING_MODE = 'UNLICENSED_DECISION_SUPPORT';

function canonicalize(value) {
  if (value === null || value === undefined) return value === undefined ? null : value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((acc, key) => { acc[key] = canonicalize(value[key]); return acc; }, {});
}
function hashObject(value) { return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }
function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(deepFreeze); return value; }
function requiredString(value, field) { if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`); return value.trim(); }
function assertSha(value, field) { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) throw new TypeError(`${field} must be SHA-256`); return value.toLowerCase(); }
function isoTime(value, field) { const d = new Date(value); if (Number.isNaN(d.getTime())) throw new TypeError(`${field} must be date/time`); return d.toISOString(); }
function isoDate(value, field) { requiredString(value, field); if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError(`${field} must be YYYY-MM-DD`); const d = new Date(`${value}T00:00:00Z`); if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==value) throw new TypeError(`${field} invalid`); return value; }
function daysBetween(a,b){ return Math.floor((new Date(`${b}T00:00:00Z`)-new Date(`${a}T00:00:00Z`))/86400000); }

function createIcEvidenceItem(input) {
  const evidenceClass = requiredString(input?.evidenceClass, 'evidenceClass');
  if (!Object.values(IC_EVIDENCE_CLASS).includes(evidenceClass)) throw new TypeError('evidenceClass invalid');
  const subjectType = requiredString(input.subjectType, 'subjectType');
  if (!Object.values(IC_SUBJECT_TYPE).includes(subjectType)) throw new TypeError('subjectType invalid');
  const preparedAt = isoTime(input.preparedAt || Date.now(), 'preparedAt');
  const reviewedAt = isoTime(input.reviewedAt, 'reviewedAt');
  if (reviewedAt < preparedAt) throw new Error('IC_EVIDENCE_REVIEW_BEFORE_PREPARATION');
  const evidenceRefs = Array.isArray(input.evidenceRefs) ? input.evidenceRefs.map(v=>requiredString(v,'evidenceRef')) : [];
  if (evidenceRefs.length === 0) throw new Error('IC_EVIDENCE_REFS_REQUIRED');
  const core = {
    schemaVersion: 1,
    evidenceItemId: requiredString(input.evidenceItemId, 'evidenceItemId'),
    evidenceClass,
    subjectType,
    subjectId: requiredString(input.subjectId, 'subjectId'),
    sourceArtifactId: requiredString(input.sourceArtifactId, 'sourceArtifactId'),
    sourceArtifactHashSha256: assertSha(input.sourceArtifactHashSha256, 'sourceArtifactHashSha256'),
    sourceAsOfDate: isoDate(input.sourceAsOfDate, 'sourceAsOfDate'),
    rationale: requiredString(input.rationale, 'rationale'),
    evidenceRefs,
    preparedBy: requiredString(input.preparedBy, 'preparedBy'),
    reviewedBy: requiredString(input.reviewedBy, 'reviewedBy'),
    preparedAt,
    reviewedAt,
  };
  return deepFreeze({ ...core, evidenceItemHashSha256: hashObject(core) });
}
function verifyIcEvidenceItem(item) {
  if (!item || typeof item !== 'object') return deepFreeze({valid:false,reason:'ITEM_REQUIRED'});
  const { evidenceItemHashSha256, ...core } = item;
  try { const expected=assertSha(evidenceItemHashSha256,'evidenceItemHashSha256'); const computed=hashObject(core); return deepFreeze({valid:expected===computed,computedHash:computed}); }
  catch { return deepFreeze({valid:false,reason:'ITEM_HASH_INVALID'}); }
}

function createIcEvidencePacket(input) {
  const subjectType = requiredString(input?.subjectType,'subjectType');
  if (!Object.values(IC_SUBJECT_TYPE).includes(subjectType)) throw new TypeError('subjectType invalid');
  const subjectId = requiredString(input.subjectId,'subjectId');
  const asOfDate = isoDate(input.asOfDate,'asOfDate');
  const maxAge = Number(input.maximumSourceAgeDays);
  if (!Number.isInteger(maxAge) || maxAge < 0) throw new RangeError('maximumSourceAgeDays must be integer >= 0');
  const requiredClasses = Array.isArray(input.requiredEvidenceClasses) ? [...new Set(input.requiredEvidenceClasses)] : [];
  if (requiredClasses.length===0) throw new Error('IC_REQUIRED_EVIDENCE_CLASSES_REQUIRED');
  requiredClasses.forEach(c=>{ if(!Object.values(IC_EVIDENCE_CLASS).includes(c)) throw new TypeError(`required evidence class invalid:${c}`); });
  const items = Array.isArray(input.items) ? [...input.items] : [];
  if (items.length===0) throw new Error('IC_EVIDENCE_ITEMS_REQUIRED');
  const ids = new Set();
  const blockers = new Set();
  for (const item of items) {
    if (!verifyIcEvidenceItem(item).valid) throw new Error(`IC_EVIDENCE_ITEM_INTEGRITY_FAILURE:${item?.evidenceItemId||'UNKNOWN'}`);
    if (ids.has(item.evidenceItemId)) throw new Error(`DUPLICATE_IC_EVIDENCE_ITEM:${item.evidenceItemId}`);
    ids.add(item.evidenceItemId);
    if (item.subjectType!==subjectType || item.subjectId!==subjectId) throw new Error(`IC_EVIDENCE_SUBJECT_MISMATCH:${item.evidenceItemId}`);
    if (item.sourceAsOfDate > asOfDate) blockers.add(IC_PACKET_STATUS.HOLD_TEMPORAL_VALIDITY);
    else if (daysBetween(item.sourceAsOfDate,asOfDate)>maxAge) blockers.add(IC_PACKET_STATUS.HOLD_SOURCE_FRESHNESS);
  }
  const present = new Set(items.map(i=>i.evidenceClass));
  const missing = requiredClasses.filter(c=>!present.has(c));
  if (missing.length) blockers.add(IC_PACKET_STATUS.HOLD_MISSING_EVIDENCE);
  const blockingCodes=[...blockers].sort();
  const status=blockingCodes.length===0?IC_PACKET_STATUS.READY_FOR_COMMITTEE_REVIEW:blockingCodes[0];
  const core = {
    schemaVersion:1,
    packetId:requiredString(input.packetId,'packetId'),
    subjectType,subjectId,asOfDate,
    maximumSourceAgeDays:maxAge,
    requiredEvidenceClasses:requiredClasses,
    evidenceItems:items.map(i=>({...i})),
    missingEvidenceClasses:missing,
    blockingCodes,status,
    evidenceCompletenessDerivedOnly:true,
    investmentRecommendationGenerated:false,
    professionalValuationConclusionModified:false,
    transactionAuthorized:false,
    operatingMode:OPERATING_MODE,
    createdAt:isoTime(input.createdAt||Date.now(),'createdAt'),
  };
  return deepFreeze({...core,packetHashSha256:hashObject(core)});
}
function verifyIcEvidencePacket(packet){ if(!packet||typeof packet!=='object')return deepFreeze({valid:false,reason:'PACKET_REQUIRED'}); const {packetHashSha256,...core}=packet; try{const expected=assertSha(packetHashSha256,'packetHashSha256');const computed=hashObject(core);return deepFreeze({valid:expected===computed,computedHash:computed});}catch{return deepFreeze({valid:false,reason:'PACKET_HASH_INVALID'});} }

function createCommitteeMeeting(input) {
  const packet=input?.packet;
  if(!verifyIcEvidencePacket(packet).valid) throw new Error('IC_PACKET_INTEGRITY_FAILURE');
  const members=Array.isArray(input.members)?input.members.map((m,i)=>{
    const conflictDisclosure=requiredString(m.conflictDisclosure,`members[${i}].conflictDisclosure`);
    if(!Object.values(CONFLICT_DISCLOSURE).includes(conflictDisclosure)) throw new TypeError('conflictDisclosure invalid');
    return {
      memberId:requiredString(m.memberId,`members[${i}].memberId`),
      role:requiredString(m.role,`members[${i}].role`),
      votingMember:m.votingMember===true,
      attended:m.attended===true,
      conflictDisclosure,
      recused:m.recused===true,
      conflictEvidenceRefs:Array.isArray(m.conflictEvidenceRefs)?m.conflictEvidenceRefs.map(v=>requiredString(v,'conflictEvidenceRef')):[],
    };
  }):[];
  if(members.length===0) throw new Error('IC_MEMBERS_REQUIRED');
  const memberIds=new Set(); members.forEach(m=>{if(memberIds.has(m.memberId))throw new Error(`DUPLICATE_IC_MEMBER:${m.memberId}`);memberIds.add(m.memberId);if(m.conflictDisclosure===CONFLICT_DISCLOSURE.DECLARED&&m.conflictEvidenceRefs.length===0)throw new Error(`IC_CONFLICT_EVIDENCE_REQUIRED:${m.memberId}`);});
  const minVoting=Number(input.quorumPolicy?.minimumAttendingVotingMembers);
  if(!Number.isInteger(minVoting)||minVoting<1) throw new TypeError('minimumAttendingVotingMembers must be integer >= 1');
  const eligibleAttending=members.filter(m=>m.votingMember&&m.attended&&!m.recused).length;
  const quorumSatisfied=eligibleAttending>=minVoting;
  const status=packet.status!==IC_PACKET_STATUS.READY_FOR_COMMITTEE_REVIEW?IC_MEETING_STATUS.HOLD_PACKET:(quorumSatisfied?IC_MEETING_STATUS.READY_FOR_VOTE:IC_MEETING_STATUS.HOLD_QUORUM);
  const core={
    schemaVersion:1,
    meetingId:requiredString(input.meetingId,'meetingId'),
    committeeId:requiredString(input.committeeId,'committeeId'),
    packetId:packet.packetId,
    packetHashSha256:packet.packetHashSha256,
    subjectType:packet.subjectType,
    subjectId:packet.subjectId,
    meetingAt:isoTime(input.meetingAt,'meetingAt'),
    members,
    quorumPolicy:{policyRef:requiredString(input.quorumPolicy?.policyRef,'quorumPolicy.policyRef'),minimumAttendingVotingMembers:minVoting},
    eligibleAttendingVotingMembers:eligibleAttending,
    quorumSatisfied,
    meetingStatus:status,
    committeeAuthorityValidated:false,
    transactionAuthorized:false,
    aiMemberPermitted:false,
    operatingMode:OPERATING_MODE,
  };
  return deepFreeze({...core,meetingHashSha256:hashObject(core)});
}
function verifyCommitteeMeeting(meeting){ if(!meeting||typeof meeting!=='object')return deepFreeze({valid:false,reason:'MEETING_REQUIRED'});const{meetingHashSha256,...core}=meeting;try{const expected=assertSha(meetingHashSha256,'meetingHashSha256');const computed=hashObject(core);return deepFreeze({valid:expected===computed,computedHash:computed});}catch{return deepFreeze({valid:false,reason:'MEETING_HASH_INVALID'});} }

function createCommitteeVote(input){
  const meeting=input?.meeting;
  if(!verifyCommitteeMeeting(meeting).valid) throw new Error('IC_MEETING_INTEGRITY_FAILURE');
  if(meeting.meetingStatus!==IC_MEETING_STATUS.READY_FOR_VOTE) throw new Error('IC_MEETING_NOT_READY_FOR_VOTE');
  const memberId=requiredString(input.memberId,'memberId');
  const member=meeting.members.find(m=>m.memberId===memberId);
  if(!member)throw new Error('IC_VOTER_NOT_IN_MEETING');
  if(!member.votingMember||!member.attended)throw new Error('IC_VOTER_NOT_ELIGIBLE');
  if(member.recused)throw new Error('IC_RECUSED_MEMBER_CANNOT_VOTE');
  const vote=requiredString(input.vote,'vote');
  if(!Object.values(IC_VOTE).includes(vote))throw new TypeError('vote invalid');
  const castAt=isoTime(input.castAt||Date.now(),'castAt'); if(castAt<meeting.meetingAt)throw new Error('IC_VOTE_BEFORE_MEETING');
  const core={schemaVersion:1,voteId:requiredString(input.voteId,'voteId'),meetingId:meeting.meetingId,meetingHashSha256:meeting.meetingHashSha256,memberId,vote,rationale:requiredString(input.rationale,'rationale'),evidenceRefs:Array.isArray(input.evidenceRefs)?input.evidenceRefs.map(v=>requiredString(v,'evidenceRef')):[],castAt,aiGeneratedVote:false};
  return deepFreeze({...core,voteHashSha256:hashObject(core)});
}
function verifyCommitteeVote(vote){if(!vote||typeof vote!=='object')return deepFreeze({valid:false,reason:'VOTE_REQUIRED'});const{voteHashSha256,...core}=vote;try{const expected=assertSha(voteHashSha256,'voteHashSha256');const computed=hashObject(core);return deepFreeze({valid:expected===computed,computedHash:computed});}catch{return deepFreeze({valid:false,reason:'VOTE_HASH_INVALID'});} }

function recordCommitteeResolution(input){
  const meeting=input?.meeting;
  if(!verifyCommitteeMeeting(meeting).valid) throw new Error('IC_MEETING_INTEGRITY_FAILURE');
  if(meeting.meetingStatus!==IC_MEETING_STATUS.READY_FOR_VOTE) throw new Error('IC_MEETING_NOT_READY_FOR_RESOLUTION');
  const votes=Array.isArray(input.votes)?[...input.votes]:[];
  const voteMembers=new Set(); const voteIds=new Set();
  for(const vote of votes){if(!verifyCommitteeVote(vote).valid)throw new Error(`IC_VOTE_INTEGRITY_FAILURE:${vote?.voteId||'UNKNOWN'}`);if(vote.meetingId!==meeting.meetingId||vote.meetingHashSha256!==meeting.meetingHashSha256)throw new Error(`IC_VOTE_MEETING_MISMATCH:${vote.voteId}`);if(voteIds.has(vote.voteId))throw new Error(`DUPLICATE_IC_VOTE_ID:${vote.voteId}`);if(voteMembers.has(vote.memberId))throw new Error(`DUPLICATE_IC_MEMBER_VOTE:${vote.memberId}`);voteIds.add(vote.voteId);voteMembers.add(vote.memberId);}
  const policy=input.resolutionPolicy||{}; const minRecorded=Number(policy.minimumRecordedVotes);
  if(!Number.isInteger(minRecorded)||minRecorded<1)throw new TypeError('minimumRecordedVotes must be integer >= 1');
  if(votes.length<minRecorded)throw new Error('IC_MINIMUM_RECORDED_VOTES_NOT_MET');
  const resolution=requiredString(input.resolution,'resolution'); if(!Object.values(IC_RESOLUTION).includes(resolution))throw new TypeError('resolution invalid');
  const supportVotes=votes.filter(v=>v.vote===IC_VOTE.SUPPORT_PROCEED).length;
  const minSupport=Number(policy.minimumSupportVotesForProceed);
  if(!Number.isInteger(minSupport)||minSupport<1)throw new TypeError('minimumSupportVotesForProceed must be integer >= 1');
  if(resolution===IC_RESOLUTION.PROCEED_TO_NEXT_INTERNAL_STAGE&&supportVotes<minSupport)throw new Error('IC_PROCEED_SUPPORT_THRESHOLD_NOT_MET');
  const resolvedAt=isoTime(input.resolvedAt||Date.now(),'resolvedAt'); if(resolvedAt<meeting.meetingAt)throw new Error('IC_RESOLUTION_BEFORE_MEETING');
  const tally=Object.values(IC_VOTE).reduce((acc,v)=>{acc[v]=votes.filter(x=>x.vote===v).length;return acc;},{});
  const core={
    schemaVersion:1,
    resolutionId:requiredString(input.resolutionId,'resolutionId'),
    meetingId:meeting.meetingId,
    meetingHashSha256:meeting.meetingHashSha256,
    packetId:meeting.packetId,
    packetHashSha256:meeting.packetHashSha256,
    subjectType:meeting.subjectType,
    subjectId:meeting.subjectId,
    votes:votes.map(v=>({...v})),
    tally,
    resolution,
    rationale:requiredString(input.rationale,'rationale'),
    resolutionPolicy:{policyRef:requiredString(policy.policyRef,'resolutionPolicy.policyRef'),minimumRecordedVotes:minRecorded,minimumSupportVotesForProceed:minSupport},
    recordedBy:requiredString(input.recordedBy,'recordedBy'),
    minutesArtifactId:requiredString(input.minutesArtifactId,'minutesArtifactId'),
    minutesArtifactHashSha256:assertSha(input.minutesArtifactHashSha256,'minutesArtifactHashSha256'),
    evidenceRefs:Array.isArray(input.evidenceRefs)?input.evidenceRefs.map(v=>requiredString(v,'evidenceRef')):[],
    resolvedAt,
    humanResolutionRecorded:true,
    systemDerivedResolution:false,
    aiResolutionPermitted:false,
    committeeAuthorityValidated:false,
    decisionActionAuthorized:false,
    executionActionCreated:false,
    professionalValuationConclusionModified:false,
    certifiedValuationAuthorized:false,
    externalIssuanceAuthorized:false,
    legalOpinionEstablished:false,
    transactionAuthorized:false,
    operatingMode:OPERATING_MODE,
    state:'HUMAN_IC_RESOLUTION_RECORDED',
  };
  return deepFreeze({...core,resolutionHashSha256:hashObject(core)});
}
function verifyCommitteeResolution(resolution){if(!resolution||typeof resolution!=='object')return deepFreeze({valid:false,reason:'RESOLUTION_REQUIRED'});const{resolutionHashSha256,...core}=resolution;try{const expected=assertSha(resolutionHashSha256,'resolutionHashSha256');const computed=hashObject(core);return deepFreeze({valid:expected===computed,computedHash:computed});}catch{return deepFreeze({valid:false,reason:'RESOLUTION_HASH_INVALID'});} }

module.exports={IC_EVIDENCE_CLASS,IC_SUBJECT_TYPE,IC_PACKET_STATUS,IC_MEETING_STATUS,IC_VOTE,IC_RESOLUTION,CONFLICT_DISCLOSURE,createIcEvidenceItem,verifyIcEvidenceItem,createIcEvidencePacket,verifyIcEvidencePacket,createCommitteeMeeting,verifyCommitteeMeeting,createCommitteeVote,verifyCommitteeVote,recordCommitteeResolution,verifyCommitteeResolution};
