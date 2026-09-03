'use strict';
const assert = require('assert');
const path = require('path');
class FakeKV { constructor(){ this.map=new Map(); } async get(k){ return this.map.get(k) ?? null; } async put(k,v){ this.map.set(k,v); } }
(async () => {
  const g = await import(path.join(__dirname, '..', '..', 'functions/api/riai/_guardrails.mjs'));
  const valid = { schemaVersion:1, capability:'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST', governance:{ rawOperatingCaseIncluded:false, tenantNamesIncluded:false, evidenceDocumentTextIncluded:false, automaticInvestmentRecommendationAllowed:false, legalConclusionAllowed:false, transactionAuthorizationAllowed:false } };
  assert.equal(g.enforceSnapshotDataDiscipline(valid).ok, true);
  const spoof = JSON.parse(JSON.stringify(valid)); spoof.note = 'Tenant: Ahmed Al-Otaibi';
  assert.equal(g.enforceSnapshotDataDiscipline(spoof).code, 'SNAPSHOT_FREE_TEXT_NOT_PERMITTED');
  const noKv = await g.checkAndConsumeRateLimit({ store:null, subjectKey:'u' });
  assert.equal(noKv.code, 'AI_RATE_LIMIT_STORE_UNAVAILABLE');
  const kv = new FakeKV(); const cfg={perSubjectPerMinute:2,perSubjectPerDay:10,globalPerDay:100,ttlSeconds:90000}; const now=Date.now();
  assert.equal((await g.checkAndConsumeRateLimit({store:kv,subjectKey:'u',now,config:cfg})).allowed,true);
  assert.equal((await g.checkAndConsumeRateLimit({store:kv,subjectKey:'u',now,config:cfg})).allowed,true);
  assert.equal((await g.checkAndConsumeRateLimit({store:kv,subjectKey:'u',now,config:cfg})).code,'AI_RATE_LIMIT_EXCEEDED_PER_MINUTE');
  const record = await g.buildAuditRecord({subjectKey:'user-1',subjectSalt:'pepper',snapshot:valid,outcome:'SUCCESS'});
  assert.equal(record.payloadStored,false); assert.ok(!JSON.stringify(record).includes('user-1')); assert.match(record.subjectHash,/^[0-9a-f]{64}$/);
  console.log('RIAI_GUARDRAILS_UNIT=PASS');
})().catch((e)=>{ console.error(e); process.exit(1); });
