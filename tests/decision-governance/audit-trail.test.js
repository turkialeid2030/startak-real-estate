'use strict';
const assert=require('assert');
const {AUDIT_ACTION,createAuditEvent}=require('../../src/decision-governance/audit-trail');
const event=createAuditEvent({dealId:'D-1',versionId:'V-2',previousVersionId:'V-1',actorId:'U-1',timestamp:'2026-09-15T12:00:00Z',actionType:AUDIT_ACTION.DECISION_CHANGED,changedFields:['overallDecision'],previousValues:{overallDecision:'HOLD'},newValues:{overallDecision:'READY_FOR_IC'},reason:'critical gates complete',decisionBefore:'HOLD',decisionAfter:'READY_FOR_IC',modelVersion:'decision-governance-v1',assumptionVersion:'A-3'});
assert.strictEqual(event.trailType,'LOCAL_HISTORY');assert.strictEqual(event.enterpriseAuditTrail,false);assert.strictEqual(event.decisionBefore,'HOLD');assert.strictEqual(event.decisionAfter,'READY_FOR_IC');assert.strictEqual(event.previousVersionId,'V-1');assert.ok(Object.isFrozen(event));
assert.throws(()=>createAuditEvent({versionId:'V',actionType:AUDIT_ACTION.DEAL_CREATED,modelVersion:'m'}),/dealId/);
assert.throws(()=>createAuditEvent({dealId:'D',versionId:'V',actionType:'FAKE',modelVersion:'m'}),/actionType/);
console.log('AUDIT_TRAIL_TESTS=PASS');
