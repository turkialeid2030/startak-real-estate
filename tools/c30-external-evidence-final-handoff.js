'use strict';

const fs = require('fs');
const path = require('path');
const {
  EXTERNAL_STATUS,
  REQUIRED_EXTERNAL_EVIDENCE,
} = require('../src/release/governed-release-candidate');
const {
  validateExternalEvidenceManifest,
  readManifest,
} = require('./c30-external-evidence-intake');
const {
  validateArtifactIndex,
} = require('./c30-external-evidence-artifact-verify');

const HANDOFF_SCOPE = 'C30_EXTERNAL_EVIDENCE_HANDOFF_OWNERS';
const HANDOFF_STATE = Object.freeze({
  HOLD: 'HOLD_EXTERNAL_EVIDENCE_REQUIRED',
  NO_GO: 'NO_GO_EXTERNAL_REMEDIATION_REQUIRED',
  COMPLETE: 'EVIDENCE_COMPLETE_AWAITING_INDEPENDENT_RELEASE_DECISION',
});

function requireObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value;
}

function requireText(value, code) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function validateHandoffOwnerMap(input, manifestResult) {
  const map = requireObject(input, 'C30_EXTERNAL_HANDOFF_MAP_REQUIRED');
  if (map.schemaVersion !== 1) throw new Error('C30_EXTERNAL_HANDOFF_MAP_SCHEMA_UNSUPPORTED');
  if (map.collectionScope !== HANDOFF_SCOPE) throw new Error('C30_EXTERNAL_HANDOFF_MAP_SCOPE_INVALID');
  if (map.candidateHeadSha !== manifestResult.candidateHeadSha) {
    throw new Error('C30_EXTERNAL_HANDOFF_MAP_HEAD_MISMATCH');
  }
  if (!Number.isInteger(map.trackerIssue) || map.trackerIssue <= 0) {
    throw new Error('C30_EXTERNAL_HANDOFF_TRACKER_ISSUE_INVALID');
  }
  if (!Array.isArray(map.gates)) throw new Error('C30_EXTERNAL_HANDOFF_GATES_REQUIRED');

  const ids = map.gates.map((gate) => gate && gate.evidenceId).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error('C30_EXTERNAL_HANDOFF_DUPLICATE_EVIDENCE_ID');
  if (map.gates.length !== REQUIRED_EXTERNAL_EVIDENCE.length) {
    throw new Error('C30_EXTERNAL_HANDOFF_GATE_COUNT_INVALID');
  }

  for (const requiredId of REQUIRED_EXTERNAL_EVIDENCE) {
    if (!ids.includes(requiredId)) throw new Error(`C30_EXTERNAL_HANDOFF_REQUIRED_GATE_MISSING:${requiredId}`);
  }

  const issueNumbers = [];
  const normalized = map.gates.map((gate) => {
    requireObject(gate, 'C30_EXTERNAL_HANDOFF_GATE_INVALID');
    if (!REQUIRED_EXTERNAL_EVIDENCE.includes(gate.evidenceId)) {
      throw new Error(`C30_EXTERNAL_HANDOFF_UNKNOWN_GATE:${gate.evidenceId}`);
    }
    if (!Number.isInteger(gate.issueNumber) || gate.issueNumber <= 0) {
      throw new Error(`C30_EXTERNAL_HANDOFF_ISSUE_INVALID:${gate.evidenceId}`);
    }
    issueNumbers.push(gate.issueNumber);
    if (gate.engineeringMaySelfApprove !== false) {
      throw new Error(`C30_EXTERNAL_HANDOFF_SELF_APPROVAL_PROHIBITED:${gate.evidenceId}`);
    }
    if (gate.requiredExternalStatus !== EXTERNAL_STATUS.SUPPLIED_VERIFIED) {
      throw new Error(`C30_EXTERNAL_HANDOFF_REQUIRED_STATUS_INVALID:${gate.evidenceId}`);
    }
    return Object.freeze({
      evidenceId: gate.evidenceId,
      issueNumber: gate.issueNumber,
      independentOwnerRole: requireText(gate.independentOwnerRole, `C30_EXTERNAL_HANDOFF_OWNER_REQUIRED:${gate.evidenceId}`),
      engineeringMaySelfApprove: false,
      requiredExternalStatus: EXTERNAL_STATUS.SUPPLIED_VERIFIED,
      acceptanceBoundary: requireText(gate.acceptanceBoundary, `C30_EXTERNAL_HANDOFF_BOUNDARY_REQUIRED:${gate.evidenceId}`),
    });
  });

  if (new Set(issueNumbers).size !== issueNumbers.length) {
    throw new Error('C30_EXTERNAL_HANDOFF_DUPLICATE_ISSUE_NUMBER');
  }

  return Object.freeze({
    schemaVersion: 1,
    collectionScope: HANDOFF_SCOPE,
    candidateHeadSha: map.candidateHeadSha,
    trackerIssue: map.trackerIssue,
    gates: Object.freeze(normalized),
  });
}

function buildFinalExternalEvidenceHandoff(input, options = {}) {
  const source = requireObject(input, 'C30_EXTERNAL_FINAL_HANDOFF_INPUT_REQUIRED');
  const manifestResult = validateExternalEvidenceManifest(source.manifest, {
    expectedCandidateHeadSha: options.expectedCandidateHeadSha,
  });
  const artifactResult = validateArtifactIndex(source.artifactIndex, manifestResult, {
    artifactRoot: options.artifactRoot || process.cwd(),
  });
  const ownerMap = validateHandoffOwnerMap(source.ownerMap, manifestResult);

  const artifactIds = new Set(artifactResult.artifacts.map((artifact) => artifact.evidenceId));
  const ownerById = new Map(ownerMap.gates.map((gate) => [gate.evidenceId, gate]));

  const gates = manifestResult.items.map((item) => {
    const owner = ownerById.get(item.evidenceId);
    return Object.freeze({
      evidenceId: item.evidenceId,
      issueNumber: owner.issueNumber,
      independentOwnerRole: owner.independentOwnerRole,
      status: item.status,
      artifactIntegrityVerified: artifactIds.has(item.evidenceId),
      engineeringMaySelfApprove: false,
      acceptanceBoundary: owner.acceptanceBoundary,
      actionRequired: item.status === EXTERNAL_STATUS.SUPPLIED_VERIFIED
        ? 'INDEPENDENT_RELEASE_DECISION_REVIEW'
        : item.status === EXTERNAL_STATUS.REJECTED
          ? 'REMEDIATE_AND_RESUBMIT_EXTERNAL_EVIDENCE'
          : 'OBTAIN_REAL_EXTERNAL_EVIDENCE',
    });
  });

  const counts = manifestResult.counts;
  let handoffState = HANDOFF_STATE.COMPLETE;
  if (counts.rejected > 0) handoffState = HANDOFF_STATE.NO_GO;
  else if (counts.notSupplied > 0) handoffState = HANDOFF_STATE.HOLD;

  const readyForIndependentReleaseDecision = (
    handoffState === HANDOFF_STATE.COMPLETE &&
    counts.suppliedVerified === REQUIRED_EXTERNAL_EVIDENCE.length &&
    artifactResult.artifactIntegrityVerified === true &&
    artifactResult.suppliedArtifactCount === REQUIRED_EXTERNAL_EVIDENCE.length
  );

  return Object.freeze({
    schemaVersion: 1,
    candidateHeadSha: manifestResult.candidateHeadSha,
    trackerIssue: ownerMap.trackerIssue,
    requiredExternalEvidenceCount: REQUIRED_EXTERNAL_EVIDENCE.length,
    counts,
    handoffState,
    readyForIndependentReleaseDecision,
    artifactIntegrityVerified: artifactResult.artifactIntegrityVerified,
    suppliedArtifactCount: artifactResult.suppliedArtifactCount,
    gates: Object.freeze(gates),
    // This handoff pack can prove structure and byte integrity only. It never grants authority.
    independentApprovalEstablished: false,
    releaseDecisionAuthorized: false,
    activationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    publicAiAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
  });
}

function runCli(argv = process.argv.slice(2), env = process.env) {
  if (argv.length < 3 || argv.length > 4) {
    throw new Error('USAGE: node tools/c30-external-evidence-final-handoff.js <manifest.json> <artifact-index.json> <owner-map.json> [artifact-root]');
  }
  const result = buildFinalExternalEvidenceHandoff({
    manifest: readManifest(argv[0]),
    artifactIndex: readJson(argv[1]),
    ownerMap: readJson(argv[2]),
  }, {
    expectedCandidateHeadSha: env.C30_EXTERNAL_EXPECTED_CANDIDATE_SHA || undefined,
    artifactRoot: argv[3] || process.cwd(),
  });

  const output = {
    handoffValid: true,
    candidateHeadSha: result.candidateHeadSha,
    requiredExternalEvidenceCount: result.requiredExternalEvidenceCount,
    counts: result.counts,
    handoffState: result.handoffState,
    readyForIndependentReleaseDecision: result.readyForIndependentReleaseDecision,
    artifactIntegrityVerified: result.artifactIntegrityVerified,
    suppliedArtifactCount: result.suppliedArtifactCount,
    releaseDecisionAuthorized: result.releaseDecisionAuthorized,
    deploymentAuthorized: result.deploymentAuthorized,
    publicAiAuthorized: result.publicAiAuthorized,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return result;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(`C30_EXTERNAL_FINAL_HANDOFF=FAIL ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  HANDOFF_SCOPE,
  HANDOFF_STATE,
  validateHandoffOwnerMap,
  buildFinalExternalEvidenceHandoff,
  runCli,
});
