'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PACK_PATH = path.join(ROOT, 'release/evidence/c43-external-review-handoff-packets.json');
const C42_PATH = path.join(ROOT, 'release/evidence/c42-external-gate-closure-control.json');
const C30_PATH = path.join(ROOT, 'release/evidence/c30-external-evidence-handoff-map.json');
const C31_PATH = path.join(ROOT, 'release/evidence/c31-canonical-evidence-input-map.json');
const EXPECTED_CANDIDATE = 'db05999e5a3c995235ac290c256251ab1592072b';
const EXPECTED_HASH = 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71';
const AUTHORITY_KEYS = Object.freeze([
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]);

function fail(code) {
  const e = new Error(code);
  e.code = code;
  throw e;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function validate(pack = readJson(PACK_PATH), c42 = readJson(C42_PATH), c30 = readJson(C30_PATH), c31 = readJson(C31_PATH)) {
  if (pack.schemaVersion !== 1 || pack.scope !== 'C43_EXTERNAL_REVIEW_HANDOFF_PACKETS') fail('C43_SCHEMA_OR_SCOPE_INVALID');
  if (pack.overlayBaseHeadSha !== EXPECTED_CANDIDATE || pack.reviewCandidateHeadSha !== EXPECTED_CANDIDATE) fail('C43_CANDIDATE_BINDING_INVALID');
  if (pack.packetRule !== 'REQUEST_PACKET_IS_NOT_APPROVAL_EVIDENCE_AND_EXTERNAL_RECEIPT_OR_ACCEPTANCE_MUST_NOT_BE_INFERRED') fail('C43_PACKET_RULE_INVALID');
  if (pack.packetCount !== 13 || !Array.isArray(pack.packets) || pack.packets.length !== 13) fail('C43_PACKET_COUNT_INVALID');

  const qualification = pack.candidateQualification || {};
  if (qualification.c42RunId !== 37180760386 || qualification.independentReleaseVerifyRunId !== 37180760364 || qualification.c40RunId !== 37180760370 || qualification.c41RunId !== 37180760358) fail('C43_QUALIFICATION_RUN_BINDING_INVALID');
  if (qualification.c42EngineeringControl !== 'PASS' || qualification.c41FinalReadiness !== 'PASS' || qualification.releaseVerify !== 'PASS') fail('C43_QUALIFICATION_STATE_INVALID');

  if (!c42 || !Array.isArray(c42.items) || c42.items.length !== 13) fail('C43_C42_SOURCE_INVALID');
  const c42ByKey = new Map(c42.items.map((x) => [x.requestKey, x]));
  const c30ByKey = new Map((c30.gates || []).map((x) => [`C30:${x.evidenceId}`, x]));
  const c31ByKey = new Map((c31.gates || []).map((x) => [`C31:${x.gateId}`, x]));
  const seen = new Set();
  const priorities = new Set();

  for (const packet of pack.packets) {
    if (!packet || typeof packet !== 'object') fail('C43_PACKET_INVALID');
    if (seen.has(packet.requestKey)) fail(`C43_DUPLICATE_PACKET:${packet.requestKey}`);
    seen.add(packet.requestKey);
    if (!Number.isInteger(packet.priority) || packet.priority < 1 || packet.priority > 13 || priorities.has(packet.priority)) fail(`C43_PRIORITY_INVALID:${packet.requestKey}`);
    priorities.add(packet.priority);

    const control = c42ByKey.get(packet.requestKey);
    if (!control) fail(`C43_UNKNOWN_REQUEST_KEY:${packet.requestKey}`);
    if (packet.issue !== control.issue) fail(`C43_ISSUE_MISMATCH:${packet.requestKey}`);
    if (packet.gateState !== control.state) fail(`C43_STATE_MISMATCH:${packet.requestKey}`);
    if (packet.externalReceiptConfirmed !== false) fail(`C43_FALSE_EXTERNAL_RECEIPT:${packet.requestKey}`);
    if (packet.evidenceSatisfied !== false) fail(`C43_FALSE_EVIDENCE_SATISFACTION:${packet.requestKey}`);
    if (typeof packet.recipientRole !== 'string' || !packet.recipientRole.trim()) fail(`C43_RECIPIENT_ROLE_MISSING:${packet.requestKey}`);
    if (typeof packet.requestState !== 'string' || !packet.requestState.trim()) fail(`C43_REQUEST_STATE_MISSING:${packet.requestKey}`);
    if (typeof packet.ingestionPath !== 'string' || !packet.ingestionPath.trim()) fail(`C43_INGESTION_PATH_MISSING:${packet.requestKey}`);

    if (Array.isArray(packet.attachments)) {
      for (const rel of packet.attachments) {
        if (!fs.existsSync(path.join(ROOT, rel))) fail(`C43_ATTACHMENT_MISSING:${packet.requestKey}:${rel}`);
      }
    }

    if (packet.requestKey.startsWith('C30:')) {
      const map = c30ByKey.get(packet.requestKey);
      if (!map) fail(`C43_C30_MAP_MISSING:${packet.requestKey}`);
      if (map.issueNumber !== packet.issue) fail(`C43_C30_ISSUE_MISMATCH:${packet.requestKey}`);
      if (map.engineeringMaySelfApprove !== false) fail(`C43_C30_SELF_APPROVAL_INVALID:${packet.requestKey}`);
    } else if (packet.requestKey.startsWith('C31:')) {
      const map = c31ByKey.get(packet.requestKey);
      if (!map) fail(`C43_C31_MAP_MISSING:${packet.requestKey}`);
      if (packet.requiredFlag !== map.requiredFlag) fail(`C43_C31_FLAG_MISMATCH:${packet.requestKey}`);
      const expected = JSON.stringify(map.requiredInputs || []);
      const actual = JSON.stringify(packet.requiredInputs || []);
      if (expected !== actual) fail(`C43_C31_INPUTS_MISMATCH:${packet.requestKey}`);
    } else {
      fail(`C43_FRAMEWORK_INVALID:${packet.requestKey}`);
    }
  }

  if (priorities.size !== 13 || Math.min(...priorities) !== 1 || Math.max(...priorities) !== 13) fail('C43_PRIORITY_COVERAGE_INVALID');

  const rollback = pack.packets.find((x) => x.requestKey === 'C30:ROLLBACK_OPERATIONAL_VERIFICATION');
  if (!rollback || rollback.designatedReviewerRef !== 'human:said' || rollback.designatedReviewerId !== 'reviewer-said-2026-09-17') fail('C43_ROLLBACK_REVIEWER_BINDING_INVALID');
  if (!Array.isArray(rollback.attachments) || rollback.attachments.length !== 6) fail('C43_ROLLBACK_ATTACHMENT_SET_INVALID');

  const canonical = pack.packets.find((x) => x.requestKey === 'C31:CANONICAL_SOURCE_HASH');
  if (!canonical || canonical.expectedSha256 !== EXPECTED_HASH) fail('C43_CANONICAL_HASH_INVALID');

  if (!pack.authority || typeof pack.authority !== 'object') fail('C43_AUTHORITY_BLOCK_MISSING');
  for (const key of AUTHORITY_KEYS) {
    if (pack.authority[key] !== false) fail(`C43_AUTHORITY_ESCALATION:${key}`);
  }

  return {
    schemaVersion: 1,
    scope: 'C43_EXTERNAL_REVIEW_HANDOFF_PACKETS_SUMMARY',
    reviewCandidateHeadSha: pack.reviewCandidateHeadSha,
    packetCount: pack.packets.length,
    c30PacketCount: pack.packets.filter((x) => x.requestKey.startsWith('C30:')).length,
    c31PacketCount: pack.packets.filter((x) => x.requestKey.startsWith('C31:')).length,
    requestReadyCount: pack.packets.filter((x) => x.requestState.startsWith('READY_')).length,
    blockedPendingExternalInputsCount: pack.packets.filter((x) => x.requestState.startsWith('BLOCKED_')).length,
    externalReceiptConfirmedCount: pack.packets.filter((x) => x.externalReceiptConfirmed === true).length,
    evidenceSatisfiedCount: pack.packets.filter((x) => x.evidenceSatisfied === true).length,
    engineeringSelfApprovalAllowedCount: 0,
    rollbackReviewerBound: true,
    packetArtifactSha256: sha256(PACK_PATH),
    releaseDecisionAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    publicAiAuthorized: false,
    decision: 'HANDOFF_PACKETS_READY_GOVERNING_GATES_REMAIN_HOLD',
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(validate(), null, 2)}\n`);
}

module.exports = { validate, AUTHORITY_KEYS };
