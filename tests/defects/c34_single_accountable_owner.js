'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildSingleOwnerGovernance,
  validateSingleOwnerRegister,
  PROGRAM_STATE,
} = require('../../tools/c34-single-accountable-owner');

const ROOT = path.join(__dirname, '..', '..');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'release', 'evidence', 'c32-evidence-acquisition-map.json'), 'utf8'));
const c33 = JSON.parse(fs.readFileSync(path.join(ROOT, 'release', 'evidence', 'c33-evidence-outreach-register.json'), 'utf8'));
const c34 = JSON.parse(fs.readFileSync(path.join(ROOT, 'release', 'evidence', 'c34-single-accountable-owner-register.json'), 'utf8'));

const current = buildSingleOwnerGovernance({ acquisitionMap: map, c33Register: c33, c34Register: c34 });
assert.strictEqual(current.totalRequiredItems, 13);
assert.strictEqual(current.singleAccountableOwner, true);
assert.strictEqual(current.accountableOwnerAssignedCount, 13);
assert.strictEqual(current.accountableOwnerAcknowledgedCount, 13);
assert.strictEqual(current.requestPacketReadyCount, 13);
assert.strictEqual(current.evidenceProviderAssignedCount, 0);
assert.strictEqual(current.independentReviewerAssignedCount, 0);
assert.strictEqual(current.sentCount, 0);
assert.strictEqual(current.responseReceivedCount, 0);
assert.strictEqual(current.evidenceSatisfiedCount, 0);
assert.strictEqual(current.realEvidenceWorkOutstandingCount, 13);
assert.strictEqual(current.programState, PROGRAM_STATE.OWNER_ASSIGNED_EVIDENCE_REQUIRED);
assert.strictEqual(current.accountabilityAssignmentIsEvidence, false);
assert.strictEqual(current.accountabilityAssignmentEstablishesIndependence, false);
for (const key of [
  'readyForReleaseDecision',
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]) assert.strictEqual(current[key], false, `${key} must remain false`);

const conflict = JSON.parse(JSON.stringify(c34));
conflict.items[0].accountableOwnerRef = 'repository-owner:@someone-else';
assert.throws(() => validateSingleOwnerRegister(conflict, map, c33), /C34_MULTI_OWNER_CONFLICT/);

const falseSatisfied = JSON.parse(JSON.stringify(c34));
falseSatisfied.items[1].evidenceSatisfied = true;
assert.throws(() => validateSingleOwnerRegister(falseSatisfied, map, c33), /C34_EVIDENCE_CANNOT_BE_SATISFIED_BY_ACCOUNTABILITY_ASSIGNMENT/);

const responseWithoutSend = JSON.parse(JSON.stringify(c34));
responseWithoutSend.items[2].responseReceivedAt = '2026-10-02T17:00:00Z';
assert.throws(() => validateSingleOwnerRegister(responseWithoutSend, map, c33), /C34_RESPONSE_WITHOUT_SEND/);

const notAcknowledged = JSON.parse(JSON.stringify(c34));
notAcknowledged.ownerAcknowledged = false;
assert.throws(() => validateSingleOwnerRegister(notAcknowledged, map, c33), /C34_OWNER_ACKNOWLEDGEMENT_REQUIRED/);

console.log('C34_SINGLE_ACCOUNTABLE_OWNER=PASS');
console.log(`C34_ACCOUNTABLE_OWNER_ASSIGNED=${current.accountableOwnerAssignedCount}`);
console.log(`C34_REAL_EVIDENCE_OUTSTANDING=${current.realEvidenceWorkOutstandingCount}`);
console.log(`C34_PROGRAM_STATE=${current.programState}`);
console.log('C34_AUTHORITY_SEPARATION=PASS');
