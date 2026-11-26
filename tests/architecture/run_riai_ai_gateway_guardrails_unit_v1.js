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
  assert.equal((await g.checkAndConsumeRateLimit({store:kv,subjectKey:'u',now,config:cfg})).code,'AI_ATOMIC_QUOTA_REQUIRED');
  assert.equal(kv.map.size,0);
  const legacy=await import('../../functions/api/riai/_public-ai-security.mjs');
  assert.equal((await legacy.checkAndReserveGlobalTokenBudget({store:kv,estimatedTokens:60,config:{globalPerDay:100}})).allowed,false);
  const record = await g.buildAuditRecord({subjectKey:'user-1',subjectSalt:'pepper',snapshot:valid,outcome:'SUCCESS'});
  assert.equal(record.payloadStored,false); assert.ok(!JSON.stringify(record).includes('user-1')); assert.match(record.subjectHash,/^[0-9a-f]{64}$/);
  const auditStore=new FakeKV();
  const writes=await Promise.all(Array.from({length:20},()=>g.writeAuditRecord({store:auditStore,record})));
  assert(writes.every(item=>item.written)); assert.equal(auditStore.map.size,20);
  assert.equal((await g.writeAuditRecord({store:{put:()=>new Promise(()=>{})},record,timeoutMs:10})).code,'AI_AUDIT_WRITE_TIMEOUT');
  assert.equal((await g.writeAuditRecord({store:{put:()=>{throw new Error('test');}},record})).code,'AI_AUDIT_WRITE_FAILED');
  assert.equal((await g.writeAuditRecord({store:{put:()=>{throw null;}},record})).code,'AI_AUDIT_WRITE_FAILED');
  assert.equal(g.enforceSnapshotDataDiscipline({...valid,signals:{amount:Number.MAX_SAFE_INTEGER+1}}).code,'SNAPSHOT_UNSAFE_INTEGER');
  for(const key of ['__proto__','constructor','prototype']){
    const bad=JSON.parse('{"signals":{"'+key+'":"SYNTHETIC"}}');
    assert.equal(g.enforceSnapshotDataDiscipline(bad).code,'SNAPSHOT_KEY_NOT_PERMITTED');
  }
  console.log('RIAI_V615_SNAPSHOT_BOUNDARY=PASS cases=4');
  const schemaBase={...valid,asOfDate:'2026-09-03',summary:{unitCount:4},signals:{readinessStatus:'READY_WITH_ASSUMPTIONS',evidenceCount:3}};
  assert.equal(g.enforceSnapshotSchema(schemaBase).ok,true);
  const {buildResidentialIncomeAiDecisionSnapshot}=require('../../src/residential-income-acquisition/ai-assist-contract');
  const browser=buildResidentialIncomeAiDecisionSnapshot({apiStatus:'CASE_LOADED',asOfDate:'2026-09-03',summary:{unitCount:2,leaseCount:1,tenantCount:1,evidenceLineageCount:4},blockers:[],evidenceGaps:[],dueDiligence:[]});
  assert.equal(g.enforceSnapshotSchema(browser.decisionSnapshot).ok,true);
  for(const patch of [{tenantName:'SYNTHETIC_ID'},{summary:{tenantId:'SYNTHETIC_ID'}},{summary:{unitCount:'4'}},{summary:{unitCount:-1}},{asOfDate:'2026-02-30'},{signals:{readinessStatus:{private:'SYNTHETIC_ID'}}},{readiness:{blockers:[{code:'GAP',documentRef:'SYNTHETIC_ID'}]}},{readiness:{blockers:Array.from({length:9},()=>({code:'GAP'}))}},{subdivision:{authorityApprovalInferred:true}},{governance:{...valid.governance,deterministicScoreRemainsAuthoritative:false}},{pricing:{purchasePrice:{amount:12}}}]){
    assert.equal(g.enforceSnapshotSchema({...schemaBase,...patch}).code,'SNAPSHOT_SCHEMA_FIELD_OR_TYPE_INVALID');
  }
  console.log('RIAI_V616_SNAPSHOT_SCHEMA=PASS negative_cases=11 positive_cases=2');
  console.log('RIAI_GUARDRAILS_UNIT=PASS');
})().catch((e)=>{ console.error(e); process.exit(1); });
