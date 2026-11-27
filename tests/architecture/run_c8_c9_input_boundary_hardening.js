'use strict';
const assert=require('node:assert/strict');
const t=require('../../src/title-intelligence/cross-document-consistency');
const p=require('../../src/planning/guarded-plot-envelope');
const crypto=require('node:crypto');
let reads=0;
const accessor=Object.defineProperty({},'caseId',{enumerable:true,get(){reads++;return 'SYNTH';}});
assert.throws(()=>t.assessTitleCrossDocumentConsistency(accessor),/TITLE_INPUT_JSON_INVALID/);
assert.equal(p.assessGuardedPlotEnvelope(accessor).status,p.STATUS.HOLD_BINDING);
assert.equal(reads,0);
for(const malformed of [null,[],new Date(),{nested:{toJSON(){reads++;return {};}}}]){
 assert.throws(()=>t.assessTitleCrossDocumentConsistency(malformed),/TITLE_INPUT_JSON_INVALID/);
 const o=p.assessGuardedPlotEnvelope(malformed);assert.equal(o.status,p.STATUS.HOLD_BINDING);assert.equal(o.transactionAuthorized,false);
}
assert.equal(reads,0);
const asOf='2026-09-10T12:00:00Z';
assert.throws(()=>t.assessTitleCrossDocumentConsistency({caseId:'C',propertyId:'P',facts:[],asOf,maxAgeDaysBySourceType:{DEED:Number.MAX_VALUE,SURVEY:30}}),/TITLE_INPUT_JSON_INVALID|SOURCE_FRESHNESS_DAYS_INVALID/);
const base={caseId:'C',propertyRef:'P',evaluatedAt:asOf,maxAreaDifferenceSqm:0,geometryMaxAgeDays:Number.MAX_VALUE};
assert.equal(p.assessGuardedPlotEnvelope(base).status,p.STATUS.HOLD_BINDING);
const s={caseId:'C',propertyRef:'P',status:'READY_FOR_HBU_LEGAL_REVIEW',readyForHbuLegalReview:true,valuationDate:asOf,requiredConstraintTypes:{}};
s.planningEvidenceSetHashSha256=crypto.createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(s).sort().map(k=>[k,s[k]])))).digest('hex');
const result=p.assessGuardedPlotEnvelope({...base,geometryMaxAgeDays:30,planningEvidenceSet:s});
assert.equal(result.status,p.STATUS.HOLD_CONSTRAINTS);assert.equal(result.officialPlanningApproval,false);
console.log('C8_C9_INPUT_BOUNDARY_HARDENING=PASS synthetic=true legalAuthority=false');
