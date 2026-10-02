'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  LIFECYCLE,
  PROGRAM_STATE,
  buildRequestPack,
  validateOutreachRegister,
} = require('../../tools/c33-evidence-request-pack');

const ROOT = path.join(__dirname, '..', '..');
const acquisitionMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'release', 'evidence', 'c32-evidence-acquisition-map.json'), 'utf8'));
const outreachRegister = JSON.parse(fs.readFileSync(path.join(ROOT, 'release', 'evidence', 'c33-evidence-outreach-register.json'), 'utf8'));

const real = buildRequestPack({ acquisitionMap, outreachRegister });
assert.equal(real.totalRequiredItems, 13);
assert.equal(real.packetReadyCount, 13);
assert.equal(real.namedOwnerAssignedCount, 0);
assert.equal(real.sentCount, 0);
assert.equal(real.responseReceivedCount, 0);
assert.equal(real.programState, PROGRAM_STATE.OWNER_ASSIGNMENT_REQUIRED);
assert.equal(real.evidenceSatisfiedCount, 0);
assert.equal(real.requestPacketIsEvidence, false);
for (const key of [
  'releaseDecisionAuthorized',
  'canonicalBaselineActivationAuthorized',
  'mergeAuthorized',
  'deploymentAuthorized',
  'commercialGoLiveAuthorized',
  'transactionAuthority',
  'approvalAuthorized',
  'publicAiAuthorized',
]) assert.equal(real[key], false, `${key} must remain false`);

for (const packet of real.packets) {
  assert.match(packet.packetMarkdown, /DRAFT REQUEST — NOT EVIDENCE/);
  assert.match(packet.packetMarkdown, /Receipt is not approval/);
  assert.match(packet.packetMarkdown, /cannot grant GO, merge, deployment/);
}

const badSyntheticMap = JSON.parse(JSON.stringify(acquisitionMap));
badSyntheticMap.requests[0].syntheticSubstituteAllowed = true;
assert.throws(() => buildRequestPack({ acquisitionMap: badSyntheticMap, outreachRegister }), /C33_SYNTHETIC_SUBSTITUTE_PROHIBITION_REQUIRED/);

const falseActivity = JSON.parse(JSON.stringify(outreachRegister));
falseActivity.items[0].namedOwnerRef = 'synthetic-owner';
assert.throws(() => validateOutreachRegister(falseActivity, acquisitionMap), /C33_UNASSIGNED_OWNER_STATE_CARRIES_FALSE_ACTIVITY/);

const missingContact = JSON.parse(JSON.stringify(outreachRegister));
missingContact.items[0].lifecycleState = LIFECYCLE.READY_SEND;
missingContact.items[0].namedOwnerRef = 'test-owner-ref';
assert.throws(() => validateOutreachRegister(missingContact, acquisitionMap), /C33_REAL_OWNER_AND_CONTACT_REQUIRED/);

const sentWithoutTimestamp = JSON.parse(JSON.stringify(outreachRegister));
sentWithoutTimestamp.items[0].lifecycleState = LIFECYCLE.SENT;
sentWithoutTimestamp.items[0].namedOwnerRef = 'test-owner-ref';
sentWithoutTimestamp.items[0].contactRef = 'test-contact-ref';
assert.throws(() => validateOutreachRegister(sentWithoutTimestamp, acquisitionMap), /C33_VALID_SENT_TIMESTAMP_REQUIRED/);

const syntheticAssignmentOnly = JSON.parse(JSON.stringify(outreachRegister));
for (const item of syntheticAssignmentOnly.items) {
  item.lifecycleState = LIFECYCLE.READY_SEND;
  item.namedOwnerRef = `TEST_ONLY_OWNER:${item.requestKey}`;
  item.contactRef = `TEST_ONLY_CONTACT:${item.requestKey}`;
}
const assigned = buildRequestPack({ acquisitionMap, outreachRegister: syntheticAssignmentOnly });
assert.equal(assigned.namedOwnerAssignedCount, 13);
assert.equal(assigned.sentCount, 0);
assert.equal(assigned.responseReceivedCount, 0);
assert.equal(assigned.programState, PROGRAM_STATE.OUTREACH_READY);
assert.equal(assigned.evidenceSatisfiedCount, 0);
assert.equal(assigned.requestPacketIsEvidence, false);
assert.equal(assigned.releaseDecisionAuthorized, false);
assert.equal(assigned.canonicalBaselineActivationAuthorized, false);
assert.equal(assigned.deploymentAuthorized, false);
assert.equal(assigned.publicAiAuthorized, false);

const duplicate = JSON.parse(JSON.stringify(outreachRegister));
duplicate.items[1].requestKey = duplicate.items[0].requestKey;
assert.throws(() => validateOutreachRegister(duplicate, acquisitionMap), /C33_OUTREACH_DUPLICATE_REQUEST_KEY|C33_OUTREACH_KEY_SET_MISMATCH/);

console.log('C33_EVIDENCE_REQUEST_PACK=PASS');
console.log('C33_REQUEST_PACKET_COUNT=13');
console.log('C33_CURRENT_OWNER_ASSIGNMENT=0');
console.log('C33_CURRENT_REQUESTS_SENT=0');
console.log('C33_CURRENT_EVIDENCE_RECEIVED=0');
console.log('C33_AUTHORITY_SEPARATION=PASS');
