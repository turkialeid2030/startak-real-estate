#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));

const modePath = 'governance/operator-templates/INTERNAL_USE_MODE.current.json';
const statusPath = 'governance/operator-templates/GOVERNANCE-GATE-STATUS.current.json';
const runbookPath = 'governance/operator-templates/EXTERNAL-GOVERNANCE-CLOSURE-RUNBOOK.current.md';
const ownerPath = 'governance/operator-templates/CURRENT-OWNER-AUTHORITY-DESIGNATION.md';
const cutoverPath = 'governance/operator-templates/FINAL-RC-CUTOVER-CHECKLIST.md';
const transitionPath = 'governance/operator-templates/CONTROLLED_INTERNAL_BOOTSTRAP_TRANSITION.current.json';
const trustedWorkflowPath = '.github/workflows/trusted-main-production-governance.yml';
const temporaryBootstrapPath = '.github/workflows/trusted-main-internal-bootstrap.yml';

const mode = readJson(modePath);
const status = readJson(statusPath);
const transition = readJson(transitionPath);
const runbook = read(runbookPath);
const owner = read(ownerPath);
const cutover = read(cutoverPath);
const trustedWorkflow = read(trustedWorkflowPath);

assert.strictEqual(mode.operatingMode, 'INTERNAL_EVALUATION_AND_CONTINUOUS_DEVELOPMENT');
assert.strictEqual(mode.externalReviewRequiredForCurrentMode, false);
assert.strictEqual(mode.e2bDispositionForCurrentMode, 'NOT_APPLICABLE_INTERNAL_USE');
assert.strictEqual(mode.e2cDispositionForCurrentMode, 'NOT_APPLICABLE_INTERNAL_USE');
assert.strictEqual(mode.internalEngineeringContinuation, true);
assert.strictEqual(mode.internalTestingAllowed, true);
assert.strictEqual(mode.internalEvaluationAllowed, true);
assert.strictEqual(mode.continuousDevelopmentAllowed, true);
assert.strictEqual(mode.externalProfessionalCertification, false);
assert.strictEqual(mode.transactionAuthority, false);
assert.strictEqual(mode.externalCommercialGoLive, false);

assert.strictEqual(status.operatingMode, mode.operatingMode);
assert.strictEqual(status.currentMode.externalReviewRequiredForCurrentMode, false);
assert.strictEqual(status.currentMode.e2bDispositionForCurrentMode, mode.e2bDispositionForCurrentMode);
assert.strictEqual(status.currentMode.e2cDispositionForCurrentMode, mode.e2cDispositionForCurrentMode);
assert.strictEqual(status.currentMode.internalEngineeringContinuation, true);
assert.strictEqual(status.currentMode.internalTestingAllowed, true);
assert.strictEqual(status.currentMode.internalEvaluationAllowed, true);
assert.strictEqual(status.currentMode.continuousDevelopmentAllowed, true);
assert.strictEqual(status.currentMode.externalProfessionalCertification, false);
assert.strictEqual(status.currentMode.transactionAuthority, false);
assert.strictEqual(status.currentMode.externalCommercialGoLive, false);
assert.strictEqual(status.externalGovernanceReentry.issue371, 'CLOSED_NOT_PLANNED_FOR_CURRENT_INTERNAL_MODE');
assert.strictEqual(status.externalGovernanceReentry.issue371ClosedAsExternalReviewPass, false);
assert.strictEqual(status.externalGovernanceReentry.currentBlockingEffect, 'NONE_FOR_INTERNAL_EVALUATION_TESTING_AND_DEVELOPMENT');
assert.strictEqual(status.externalGovernanceReentry.reentryBehavior, 'FAIL_CLOSED_TO_EXTERNAL_PRODUCTION_GOVERNANCE_CHAIN');
assert.strictEqual(status.mainIntegration.internalUseModeMerged, true);
assert.strictEqual(status.mainIntegration.bootstrapCleanupComplete, true);
assert.deepStrictEqual(status.mainIntegration.requiredStatusChecks, [
  'release-verify',
  'trusted-main-production-governance',
]);

assert.strictEqual(transition.cleanupRequired, false);
assert.strictEqual(transition.cleanup.bootstrapOnlyWorkflowRemoved, true);
assert.strictEqual(transition.cleanup.canonicalTrustedMainWorkflowRetained, true);

assert.ok(runbook.includes('INTERNAL_EVALUATION_AND_CONTINUOUS_DEVELOPMENT'));
assert.ok(runbook.includes('#371=CLOSED_NOT_PLANNED_FOR_CURRENT_INTERNAL_MODE'));
assert.ok(runbook.includes('EXTERNAL_PRODUCTION_GOVERNANCE_CHAIN=DORMANT_UNTIL_REENTRY_TRIGGER'));
assert.ok(!runbook.includes('#371=OPEN_ATTESTATIONS_AND_GENUINE_E2B_INPUTS_REQUIRED'));
assert.ok(!runbook.includes('FINAL_RC_TO_MAIN_PR=HOLD'));

assert.ok(owner.includes('OPERATING_MODE=INTERNAL_EVALUATION_AND_CONTINUOUS_DEVELOPMENT'));
assert.ok(owner.includes('INTERNAL_ENGINEERING_CONTINUATION=true'));
assert.ok(!owner.includes('`MERGE=HOLD`'));

assert.ok(cutover.includes('## Current applicability'));
assert.ok(cutover.includes('INTERNAL_EVALUATION_AND_CONTINUOUS_DEVELOPMENT'));
assert.ok(cutover.includes('not an active blocking checklist'));

assert.ok(trustedWorkflow.includes('Classify operating mode as inert data from exact PR head'));
assert.ok(trustedWorkflow.includes("if: steps.mode.outputs.mode != 'internal'"));
assert.ok(trustedWorkflow.includes('STARTAK_E2E_PACKET_B64'));
assert.ok(trustedWorkflow.includes('STARTAK_E2F_PACKET_B64'));
assert.ok(trustedWorkflow.includes('STARTAK_E2G_PACKET_B64'));
assert.strictEqual(fs.existsSync(path.join(ROOT, temporaryBootstrapPath)), false);

console.log('INTERNAL_GOVERNANCE_CONSISTENCY=PASS');
console.log('OPERATING_MODE=INTERNAL_EVALUATION_AND_CONTINUOUS_DEVELOPMENT');
console.log('EXTERNAL_PROFESSIONAL_CERTIFICATION=false');
console.log('TRANSACTION_AUTHORITY=false');
console.log('EXTERNAL_COMMERCIAL_GO_LIVE=false');
