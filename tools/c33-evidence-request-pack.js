'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_ACQUISITION_MAP = path.join(ROOT, 'release', 'evidence', 'c32-evidence-acquisition-map.json');
const DEFAULT_OUTREACH_REGISTER = path.join(ROOT, 'release', 'evidence', 'c33-evidence-outreach-register.json');

const LIFECYCLE = Object.freeze({
  READY_OWNER: 'REQUEST_READY_OWNER_ASSIGNMENT_REQUIRED',
  READY_SEND: 'OWNER_ASSIGNED_READY_TO_SEND',
  SENT: 'REQUEST_SENT_AWAITING_RESPONSE',
  RECEIVED: 'RESPONSE_RECEIVED_PENDING_GOVERNED_VALIDATION',
});

const PROGRAM_STATE = Object.freeze({
  OWNER_ASSIGNMENT_REQUIRED: 'REQUEST_PACKETS_READY_OWNER_ASSIGNMENT_REQUIRED',
  OUTREACH_READY: 'OWNER_ASSIGNMENT_COMPLETE_OUTREACH_READY',
  OUTREACH_IN_PROGRESS: 'OUTREACH_IN_PROGRESS',
  RESPONSES_PENDING_VALIDATION: 'RESPONSES_RECEIVED_PENDING_GOVERNED_VALIDATION',
});

function readJson(filePath) {
  const resolved = path.resolve(filePath);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error('C33_SYMLINK_INPUT_REJECTED');
  if (!stat.isFile()) throw new Error('C33_INPUT_NOT_REGULAR_FILE');
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function requireText(value, code) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}

function isIsoTimestamp(value) {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function validateAcquisitionMap(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('C33_ACQUISITION_MAP_REQUIRED');
  if (map.schemaVersion !== 1 || map.scope !== 'C32_RELEASE_EVIDENCE_ACQUISITION') throw new Error('C33_ACQUISITION_MAP_SCHEMA_INVALID');
  if (!Array.isArray(map.requests) || map.requests.length !== 13) throw new Error('C33_ACQUISITION_REQUEST_COUNT_INVALID');
  const keys = map.requests.map((request) => request && request.requestKey);
  if (new Set(keys).size !== 13) throw new Error('C33_ACQUISITION_DUPLICATE_REQUEST_KEY');
  for (const request of map.requests) {
    requireText(request.requestKey, 'C33_REQUEST_KEY_REQUIRED');
    if (!Number.isInteger(request.issueNumber) || request.issueNumber <= 0) throw new Error(`C33_ISSUE_INVALID:${request.requestKey}`);
    requireText(request.ownerRole, `C33_OWNER_ROLE_REQUIRED:${request.requestKey}`);
    requireText(request.requestPackage, `C33_REQUEST_PACKAGE_REQUIRED:${request.requestKey}`);
    requireText(request.acceptanceBoundary, `C33_ACCEPTANCE_BOUNDARY_REQUIRED:${request.requestKey}`);
    if (request.syntheticSubstituteAllowed !== false) throw new Error(`C33_SYNTHETIC_SUBSTITUTE_PROHIBITION_REQUIRED:${request.requestKey}`);
  }
  return map;
}

function validateOutreachRegister(register, acquisitionMap) {
  if (!register || typeof register !== 'object' || Array.isArray(register)) throw new Error('C33_OUTREACH_REGISTER_REQUIRED');
  if (register.schemaVersion !== 1 || register.scope !== 'C33_EVIDENCE_REQUEST_OUTREACH_REGISTER') throw new Error('C33_OUTREACH_REGISTER_SCHEMA_INVALID');
  if (!Array.isArray(register.items) || register.items.length !== acquisitionMap.requests.length) throw new Error('C33_OUTREACH_REGISTER_COUNT_INVALID');
  const acquisitionKeys = new Set(acquisitionMap.requests.map((request) => request.requestKey));
  const registerKeys = register.items.map((item) => item && item.requestKey);
  if (new Set(registerKeys).size !== registerKeys.length) throw new Error('C33_OUTREACH_DUPLICATE_REQUEST_KEY');
  if (registerKeys.some((key) => !acquisitionKeys.has(key)) || [...acquisitionKeys].some((key) => !registerKeys.includes(key))) {
    throw new Error('C33_OUTREACH_KEY_SET_MISMATCH');
  }

  const allowed = new Set(Object.values(LIFECYCLE));
  const normalized = register.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('C33_OUTREACH_ITEM_INVALID');
    const requestKey = requireText(item.requestKey, 'C33_OUTREACH_REQUEST_KEY_REQUIRED');
    if (!allowed.has(item.lifecycleState)) throw new Error(`C33_LIFECYCLE_INVALID:${requestKey}`);

    const namedOwnerRef = item.namedOwnerRef == null ? null : requireText(item.namedOwnerRef, `C33_NAMED_OWNER_INVALID:${requestKey}`);
    const contactRef = item.contactRef == null ? null : requireText(item.contactRef, `C33_CONTACT_REF_INVALID:${requestKey}`);
    const sentAt = item.sentAt == null ? null : item.sentAt;
    const responseReceivedAt = item.responseReceivedAt == null ? null : item.responseReceivedAt;

    if (item.lifecycleState === LIFECYCLE.READY_OWNER) {
      if (namedOwnerRef !== null || contactRef !== null || sentAt !== null || responseReceivedAt !== null) {
        throw new Error(`C33_UNASSIGNED_OWNER_STATE_CARRIES_FALSE_ACTIVITY:${requestKey}`);
      }
    }
    if ([LIFECYCLE.READY_SEND, LIFECYCLE.SENT, LIFECYCLE.RECEIVED].includes(item.lifecycleState)) {
      if (!namedOwnerRef || !contactRef) throw new Error(`C33_REAL_OWNER_AND_CONTACT_REQUIRED:${requestKey}`);
    }
    if ([LIFECYCLE.SENT, LIFECYCLE.RECEIVED].includes(item.lifecycleState) && !isIsoTimestamp(sentAt)) {
      throw new Error(`C33_VALID_SENT_TIMESTAMP_REQUIRED:${requestKey}`);
    }
    if (item.lifecycleState === LIFECYCLE.RECEIVED && !isIsoTimestamp(responseReceivedAt)) {
      throw new Error(`C33_VALID_RESPONSE_TIMESTAMP_REQUIRED:${requestKey}`);
    }
    if (responseReceivedAt !== null && item.lifecycleState !== LIFECYCLE.RECEIVED) {
      throw new Error(`C33_RESPONSE_TIMESTAMP_STATE_MISMATCH:${requestKey}`);
    }

    return Object.freeze({ requestKey, lifecycleState: item.lifecycleState, namedOwnerRef, contactRef, sentAt, responseReceivedAt });
  });
  return Object.freeze(normalized);
}

function renderPacket(request, outreach) {
  const title = `Evidence Request — ${request.requestKey}`;
  const ownerLine = outreach.namedOwnerRef
    ? `Named accountable owner: ${outreach.namedOwnerRef}`
    : `Named accountable owner: NOT ASSIGNED — required role: ${request.ownerRole}`;
  const contactLine = outreach.contactRef ? `Contact/reference: ${outreach.contactRef}` : 'Contact/reference: NOT ASSIGNED';
  return [
    `# ${title}`,
    '',
    '> DRAFT REQUEST — NOT EVIDENCE — DOES NOT AUTHORIZE RELEASE, ACTIVATION, MERGE OR DEPLOYMENT',
    '',
    `Request key: \`${request.requestKey}\``,
    `GitHub issue: #${request.issueNumber}`,
    `Lifecycle: \`${outreach.lifecycleState}\``,
    ownerLine,
    contactLine,
    '',
    '## Required deliverable',
    request.requestPackage,
    '',
    '## Acceptance boundary',
    request.acceptanceBoundary,
    '',
    '## Submission requirements',
    '- Supply the real underlying artifact/input from the accountable independent owner or custodian.',
    '- Preserve original references, timestamps, reviewer/custodian identity and applicable scope.',
    '- Do not substitute CI output, synthetic fixtures, generated documents, copied hashes or engineering self-attestation.',
    '- Receipt is not approval; the existing governed C30/C31 validator must independently evaluate the submission.',
    '',
    '## Authority boundary',
    'This request packet is an administrative collection instrument only. It is not evidence and cannot grant GO, merge, deployment, commercial go-live, transaction, approval, Public AI or canonical-baseline activation authority.',
    '',
  ].join('\n');
}

function buildRequestPack({ acquisitionMap, outreachRegister }) {
  const map = validateAcquisitionMap(acquisitionMap);
  const outreach = validateOutreachRegister(outreachRegister, map);
  const byKey = new Map(outreach.map((item) => [item.requestKey, item]));
  const packets = map.requests.map((request) => Object.freeze({
    requestKey: request.requestKey,
    issueNumber: request.issueNumber,
    ownerRole: request.ownerRole,
    lifecycleState: byKey.get(request.requestKey).lifecycleState,
    packetMarkdown: renderPacket(request, byKey.get(request.requestKey)),
  }));

  const namedOwnerAssignedCount = outreach.filter((item) => item.namedOwnerRef !== null && item.contactRef !== null).length;
  const sentCount = outreach.filter((item) => [LIFECYCLE.SENT, LIFECYCLE.RECEIVED].includes(item.lifecycleState)).length;
  const responseReceivedCount = outreach.filter((item) => item.lifecycleState === LIFECYCLE.RECEIVED).length;
  let programState = PROGRAM_STATE.OWNER_ASSIGNMENT_REQUIRED;
  if (namedOwnerAssignedCount === outreach.length && sentCount === 0) programState = PROGRAM_STATE.OUTREACH_READY;
  else if (sentCount > 0 && responseReceivedCount < outreach.length) programState = PROGRAM_STATE.OUTREACH_IN_PROGRESS;
  else if (responseReceivedCount === outreach.length) programState = PROGRAM_STATE.RESPONSES_PENDING_VALIDATION;

  return Object.freeze({
    schemaVersion: 1,
    scope: 'C33_EVIDENCE_REQUEST_PACK_ONLY',
    totalRequiredItems: packets.length,
    packetReadyCount: packets.length,
    namedOwnerAssignedCount,
    sentCount,
    responseReceivedCount,
    programState,
    packets: Object.freeze(packets),
    evidenceSatisfiedCount: 0,
    requestPacketIsEvidence: false,
    releaseDecisionAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
  });
}

function runCli(argv = process.argv.slice(2)) {
  const acquisitionMap = readJson(DEFAULT_ACQUISITION_MAP);
  const outreachRegister = readJson(DEFAULT_OUTREACH_REGISTER);
  const result = buildRequestPack({ acquisitionMap, outreachRegister });
  const requestIndex = argv.indexOf('--request');
  if (requestIndex >= 0) {
    const key = argv[requestIndex + 1];
    if (!key) throw new Error('C33_REQUEST_KEY_ARGUMENT_REQUIRED');
    const packet = result.packets.find((item) => item.requestKey === key);
    if (!packet) throw new Error('C33_REQUEST_KEY_NOT_FOUND');
    process.stdout.write(`${packet.packetMarkdown}\n`);
    return result;
  }
  process.stdout.write(`${JSON.stringify({
    totalRequiredItems: result.totalRequiredItems,
    packetReadyCount: result.packetReadyCount,
    namedOwnerAssignedCount: result.namedOwnerAssignedCount,
    sentCount: result.sentCount,
    responseReceivedCount: result.responseReceivedCount,
    programState: result.programState,
    requestPacketIsEvidence: result.requestPacketIsEvidence,
    releaseDecisionAuthorized: result.releaseDecisionAuthorized,
    deploymentAuthorized: result.deploymentAuthorized,
    publicAiAuthorized: result.publicAiAuthorized,
  }, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try { runCli(); } catch (error) {
    console.error(`C33_EVIDENCE_REQUEST_PACK=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  LIFECYCLE,
  PROGRAM_STATE,
  validateAcquisitionMap,
  validateOutreachRegister,
  renderPacket,
  buildRequestPack,
  runCli,
});
