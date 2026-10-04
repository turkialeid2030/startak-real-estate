'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTROL_PATH = path.join(ROOT, 'release/evidence/c42-external-gate-closure-control.json');
const C39_PATH = path.join(ROOT, 'release/evidence/c39-historical-evidence-reuse-audit.json');

const EXPECTED_BASE_HEAD = 'c09a3308ce1ce08ab468e553931a84ce056992c1';
const EXPECTED_SOURCE_HASH = 'ac0767d3f13c463259f401a5d7af06c1140ee780a9f86489eb17ad9d7c72dc71';
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
  const error = new Error(code);
  error.code = code;
  throw error;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validate(control = readJson(CONTROL_PATH), c39 = readJson(C39_PATH)) {
  if (control.schemaVersion !== 1) fail('C42_SCHEMA_INVALID');
  if (control.scope !== 'C42_EXTERNAL_GATE_CLOSURE_CONTROL') fail('C42_SCOPE_INVALID');
  if (control.baseBranch !== 'c39-historical-evidence-reuse-audit') fail('C42_BASE_BRANCH_INVALID');
  if (control.baseHeadSha !== EXPECTED_BASE_HEAD) fail('C42_BASE_HEAD_INVALID');
  if (control.sourceAudit !== 'release/evidence/c39-historical-evidence-reuse-audit.json') fail('C42_SOURCE_AUDIT_INVALID');
  if (control.controlRule !== 'ENGINEERING_MAY_PREPARE_REQUESTS_AND_VALIDATE_ARTIFACTS_BUT_MUST_NOT SELF-ASSERT_EXTERNAL_APPROVAL_OR_CANONICAL_INPUTS') fail('C42_CONTROL_RULE_INVALID');
  if (control.gateCount !== 13 || !Array.isArray(control.items) || control.items.length !== 13) fail('C42_GATE_COUNT_INVALID');
  if (control.currentSatisfied !== 0) fail('C42_FALSE_SATISFACTION_DECLARATION');
  if (control.decision !== 'HOLD_EXTERNAL_EVIDENCE_AND_CANONICAL_INPUTS_REQUIRED') fail('C42_DECISION_INVALID');

  if (!c39 || !Array.isArray(c39.gates) || c39.gates.length !== 13) fail('C42_C39_SOURCE_INVALID');

  const c39ByKey = new Map(c39.gates.map((g) => [`${g.framework}:${g.gateId}`, g]));
  const seenKeys = new Set();
  const seenIssues = new Set();

  for (const item of control.items) {
    if (!item || typeof item !== 'object') fail('C42_ITEM_INVALID');
    if (typeof item.requestKey !== 'string' || !item.requestKey.includes(':')) fail('C42_REQUEST_KEY_INVALID');
    if (seenKeys.has(item.requestKey)) fail(`C42_DUPLICATE_REQUEST_KEY:${item.requestKey}`);
    if (seenIssues.has(item.issue)) fail(`C42_DUPLICATE_ISSUE:${item.issue}`);
    seenKeys.add(item.requestKey);
    seenIssues.add(item.issue);

    const source = c39ByKey.get(item.requestKey);
    if (!source) fail(`C42_UNKNOWN_GATE:${item.requestKey}`);
    if (item.issue !== source.currentIssue) fail(`C42_ISSUE_MISMATCH:${item.requestKey}`);
    if (item.state !== source.currentGateState) fail(`C42_STATE_MISMATCH:${item.requestKey}`);
    if (item.blocking !== true) fail(`C42_GATE_MUST_REMAIN_BLOCKING:${item.requestKey}`);
    if (item.humanOrExternalActionRequired !== true) fail(`C42_EXTERNAL_ACTION_REQUIRED:${item.requestKey}`);
    if (item.engineeringMaySelfSatisfy !== false) fail(`C42_SELF_SATISFACTION_FORBIDDEN:${item.requestKey}`);
    if (typeof item.requiredActorRole !== 'string' || !item.requiredActorRole.trim()) fail(`C42_REQUIRED_ACTOR_MISSING:${item.requestKey}`);
    if (typeof item.nextAction !== 'string' || !item.nextAction.trim()) fail(`C42_NEXT_ACTION_MISSING:${item.requestKey}`);
  }

  if (!Array.isArray(control.priorityOrder) || control.priorityOrder.length !== 13) fail('C42_PRIORITY_ORDER_INVALID');
  const prioritySet = new Set(control.priorityOrder);
  if (prioritySet.size !== 13 || control.items.some((item) => !prioritySet.has(item.requestKey))) fail('C42_PRIORITY_ORDER_COVERAGE_INVALID');

  const rollback = control.items.find((x) => x.requestKey === 'C30:ROLLBACK_OPERATIONAL_VERIFICATION');
  if (!rollback) fail('C42_ROLLBACK_ITEM_MISSING');
  if (rollback.state !== 'NOT_SUPPLIED_PENDING_INDEPENDENT_REVIEW') fail('C42_ROLLBACK_STATE_INVALID');
  if (rollback.reviewerRef !== 'human:said') fail('C42_ROLLBACK_REVIEWER_INVALID');
  if (rollback.reviewerId !== 'reviewer-said-2026-09-17') fail('C42_ROLLBACK_REVIEWER_ID_INVALID');
  if (!Array.isArray(rollback.preparedArtifacts) || rollback.preparedArtifacts.length < 6) fail('C42_ROLLBACK_ARTIFACT_SET_INCOMPLETE');
  for (const rel of rollback.preparedArtifacts) {
    if (!fs.existsSync(path.join(ROOT, rel))) fail(`C42_ROLLBACK_ARTIFACT_MISSING:${rel}`);
  }

  const uat = control.items.find((x) => x.requestKey === 'C30:UAT_HUMAN_APPROVAL');
  if (!uat || uat.preparedArtifact !== 'release/evidence/c35-owner-uat-execution-pack.json') fail('C42_UAT_PACK_REFERENCE_INVALID');
  if (!fs.existsSync(path.join(ROOT, uat.preparedArtifact))) fail('C42_UAT_PACK_MISSING');

  const canonical = control.items.find((x) => x.requestKey === 'C31:CANONICAL_SOURCE_HASH');
  if (!canonical || canonical.expectedSha256 !== EXPECTED_SOURCE_HASH) fail('C42_CANONICAL_EXPECTED_HASH_INVALID');

  if (!control.authority || typeof control.authority !== 'object') fail('C42_AUTHORITY_BLOCK_MISSING');
  for (const key of AUTHORITY_KEYS) {
    if (control.authority[key] !== false) fail(`C42_AUTHORITY_ESCALATION:${key}`);
  }

  return {
    schemaVersion: 1,
    scope: 'C42_EXTERNAL_GATE_CLOSURE_CONTROL_SUMMARY',
    baseHeadSha: control.baseHeadSha,
    gateCount: control.items.length,
    currentSatisfied: 0,
    blockingGateCount: control.items.filter((x) => x.blocking === true).length,
    externalActionRequiredCount: control.items.filter((x) => x.humanOrExternalActionRequired === true).length,
    engineeringSelfSatisfiableCount: control.items.filter((x) => x.engineeringMaySelfSatisfy === true).length,
    rollbackReviewerDesignated: rollback.reviewerRef === 'human:said',
    uatPackPrepared: true,
    canonicalSourceBytesSupplied: false,
    releaseDecisionAuthorized: false,
    canonicalBaselineActivationAuthorized: false,
    mergeAuthorized: false,
    deploymentAuthorized: false,
    commercialGoLiveAuthorized: false,
    transactionAuthority: false,
    approvalAuthorized: false,
    publicAiAuthorized: false,
    decision: control.decision,
  };
}

if (require.main === module) {
  process.stdout.write(`${JSON.stringify(validate(), null, 2)}\n`);
}

module.exports = { validate, AUTHORITY_KEYS };
