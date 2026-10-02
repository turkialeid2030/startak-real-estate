'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildFinalExternalEvidenceHandoff,
  HANDOFF_STATE,
} = require('./c30-external-evidence-final-handoff');
const {
  evaluateCanonicalEvidenceReadiness,
  READINESS_STATE,
} = require('./c31-canonical-evidence-readiness');
const { readManifest } = require('./c30-external-evidence-intake');

const ROOT = path.join(__dirname, '..');
const DEFAULT_PATHS = Object.freeze({
  manifest: path.join(ROOT, 'release', 'evidence', 'c30-external-evidence-manifest.template.json'),
  artifactIndex: path.join(ROOT, 'release', 'evidence', 'c30-external-artifact-index.template.json'),
  ownerMap: path.join(ROOT, 'release', 'evidence', 'c30-external-evidence-handoff-map.json'),
  acquisitionMap: path.join(ROOT, 'release', 'evidence', 'c32-evidence-acquisition-map.json'),
});

const PROGRAM_STATE = Object.freeze({
  WAITING: 'WAITING_FOR_REAL_EXTERNAL_EVIDENCE',
  REMEDIATION: 'BLOCKED_REMEDIATION_REQUIRED',
  COMPLETE: 'EVIDENCE_COMPLETE_AWAITING_INDEPENDENT_DECISIONS',
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function validateAcquisitionMap(map, c30, c31) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('C32_ACQUISITION_MAP_REQUIRED');
  if (map.schemaVersion !== 1) throw new Error('C32_ACQUISITION_MAP_SCHEMA_UNSUPPORTED');
  if (map.scope !== 'C32_RELEASE_EVIDENCE_ACQUISITION') throw new Error('C32_ACQUISITION_MAP_SCOPE_INVALID');
  if (!Array.isArray(map.requests) || map.requests.length !== 13) throw new Error('C32_ACQUISITION_REQUEST_COUNT_INVALID');

  const expectedKeys = [
    ...c30.gates.map((gate) => `C30:${gate.evidenceId}`),
    ...c31.gates.map((gate) => `C31:${gate.gateId}`),
  ];
  const keys = map.requests.map((request) => request && request.requestKey);
  if (new Set(keys).size !== 13) throw new Error('C32_ACQUISITION_REQUEST_KEYS_DUPLICATE');
  for (const key of expectedKeys) {
    if (!keys.includes(key)) throw new Error(`C32_ACQUISITION_REQUEST_MISSING:${key}`);
  }

  const issueNumbers = new Set();
  const requests = map.requests.map((request) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('C32_ACQUISITION_REQUEST_INVALID');
    if (!Number.isInteger(request.issueNumber) || request.issueNumber <= 0) throw new Error(`C32_ACQUISITION_ISSUE_INVALID:${request.requestKey}`);
    if (issueNumbers.has(request.issueNumber)) throw new Error('C32_ACQUISITION_ISSUE_DUPLICATE');
    issueNumbers.add(request.issueNumber);
    for (const field of ['ownerRole', 'requestPackage', 'acceptanceBoundary']) {
      if (typeof request[field] !== 'string' || request[field].trim() === '') throw new Error(`C32_ACQUISITION_FIELD_REQUIRED:${request.requestKey}:${field}`);
    }
    if (request.syntheticSubstituteAllowed !== false) throw new Error(`C32_SYNTHETIC_SUBSTITUTE_MUST_BE_FALSE:${request.requestKey}`);
    return Object.freeze({
      requestKey: request.requestKey,
      issueNumber: request.issueNumber,
      ownerRole: request.ownerRole.trim(),
      requestPackage: request.requestPackage.trim(),
      acceptanceBoundary: request.acceptanceBoundary.trim(),
      syntheticSubstituteAllowed: false,
    });
  });

  return Object.freeze({ trackerIssues: Object.freeze([541, 558]), requests: Object.freeze(requests) });
}

function buildReleaseBlockerLedger({ c30, c31, acquisitionMap }) {
  const validated = validateAcquisitionMap(acquisitionMap, c30, c31);
  const requestByKey = new Map(validated.requests.map((request) => [request.requestKey, request]));

  const blockers = [];
  for (const gate of c30.gates) {
    const request = requestByKey.get(`C30:${gate.evidenceId}`);
    blockers.push(Object.freeze({
      family: 'C30_EXTERNAL_EVIDENCE',
      blockerId: gate.evidenceId,
      issueNumber: request.issueNumber,
      ownerRole: request.ownerRole,
      status: gate.status,
      satisfied: gate.status === 'SUPPLIED_VERIFIED' && gate.artifactIntegrityVerified === true,
      nextAction: gate.status === 'REJECTED' ? 'REMEDIATE_AND_RESUBMIT' : gate.status === 'SUPPLIED_VERIFIED' ? 'INDEPENDENT_DECISION_REVIEW' : 'REQUEST_AND_COLLECT_REAL_EVIDENCE',
      requestPackage: request.requestPackage,
      acceptanceBoundary: request.acceptanceBoundary,
      syntheticSubstituteAllowed: false,
    }));
  }

  for (const gate of c31.gates) {
    const request = requestByKey.get(`C31:${gate.gateId}`);
    blockers.push(Object.freeze({
      family: 'C31_CANONICAL_INPUT',
      blockerId: gate.gateId,
      issueNumber: request.issueNumber,
      ownerRole: request.ownerRole,
      status: gate.status,
      satisfied: gate.verified === true,
      nextAction: gate.status === 'HOLD' || gate.status === 'MISMATCH' ? 'REMEDIATE_AND_REEVALUATE' : gate.verified === true ? 'INDEPENDENT_ACTIVATION_DECISION_REVIEW' : 'REQUEST_AND_COLLECT_REAL_INPUT',
      requestPackage: request.requestPackage,
      acceptanceBoundary: request.acceptanceBoundary,
      syntheticSubstituteAllowed: false,
    }));
  }

  const satisfiedCount = blockers.filter((blocker) => blocker.satisfied).length;
  const remediationCount = blockers.filter((blocker) => blocker.nextAction.startsWith('REMEDIATE')).length;
  const waitingCount = blockers.length - satisfiedCount - remediationCount;

  let programState = PROGRAM_STATE.WAITING;
  if (remediationCount > 0) programState = PROGRAM_STATE.REMEDIATION;
  else if (satisfiedCount === 13) programState = PROGRAM_STATE.COMPLETE;

  return Object.freeze({
    schemaVersion: 1,
    scope: 'C32_RELEASE_EVIDENCE_ACQUISITION_ONLY',
    trackerIssues: validated.trackerIssues,
    totalRequiredItems: 13,
    satisfiedCount,
    waitingCount,
    remediationCount,
    programState,
    c30State: c30.handoffState,
    c31State: c31.readinessState,
    blockers: Object.freeze(blockers),
    readyForIndependentDecisions: programState === PROGRAM_STATE.COMPLETE,
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

function evaluateCurrentReleaseBlockerLedger({ env = process.env, paths = DEFAULT_PATHS, artifactRoot = ROOT } = {}) {
  const manifest = readManifest(paths.manifest);
  const c30 = buildFinalExternalEvidenceHandoff({
    manifest,
    artifactIndex: readJson(paths.artifactIndex),
    ownerMap: readJson(paths.ownerMap),
  }, {
    expectedCandidateHeadSha: env.C30_EXTERNAL_EXPECTED_CANDIDATE_SHA || manifest.candidateHeadSha,
    artifactRoot,
  });
  const c31 = evaluateCanonicalEvidenceReadiness({ env });
  const acquisitionMap = readJson(paths.acquisitionMap);
  return buildReleaseBlockerLedger({ c30, c31, acquisitionMap });
}

function runCli(env = process.env) {
  const result = evaluateCurrentReleaseBlockerLedger({ env });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try { runCli(); }
  catch (error) {
    console.error(`C32_RELEASE_BLOCKER_LEDGER=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  DEFAULT_PATHS,
  PROGRAM_STATE,
  validateAcquisitionMap,
  buildReleaseBlockerLedger,
  evaluateCurrentReleaseBlockerLedger,
  runCli,
  HANDOFF_STATE,
  READINESS_STATE,
});
