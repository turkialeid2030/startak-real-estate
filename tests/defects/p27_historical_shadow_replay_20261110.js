'use strict';
// P27 historical comparison is a SHADOW diagnostic. It cannot backdate
// financial conclusions, replace RE-GOLD or independently authorize a deal.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const corpus=require('../reference/p27-historical-model-corpus-v1.json');
const {calculateInvestmentCase,STUDY_TYPE}=require('../../src/engines');
const {ASSUMPTION_MODEL_VERSION}=require('../../src/assumptions/assumption-model');
const ROOT=path.resolve(__dirname,'..','..');
function blobSha(buf){
 return crypto.createHash('sha1').update(Buffer.from('blob '+buf.length+'\0')).update(buf).digest('hex');
}
function npv(rate,flows){return flows.reduce((s,f,i)=>s+f/Math.pow(1+rate,i),0)}
function delta(a,b){return Number.isFinite(a)&&Number.isFinite(b)?Number((a-b).toFixed(6)):null}
const results=[];let assertions=0;
function check(v,msg){assert.ok(v,msg);assertions++}
function equal(a,b,msg){assert.deepStrictEqual(a,b,msg);assertions++}
equal(corpus.schemaVersion,1,'historic schema fixed');
equal(corpus.referenceVersion,'CURRENT_MODEL_REFERENCE_V1','historic reference identifier fixed');
equal(corpus.authority.transactionAuthorized,false,'historic corpus never authorizes transactions');
equal(corpus.authority.canonicalBaselineActivationAuthorized,false,'historic baseline never activates');
equal(corpus.cases.length,4,'exact four historic cases');
for(const c of corpus.cases){
 check(/^tests\/characterization\/fixtures\/RE-GOLD-00[12]-[UL]\.json$/.test(c.sourceFixture),'fixture must be a pinned synthetic RE-GOLD path');
 const file=path.join(ROOT,c.sourceFixture);
 const buffer=fs.readFileSync(file);
 equal(blobSha(buffer),c.sourceFixtureGitBlobSha1,c.id+' original fixture has not changed');
 const raw=JSON.parse(buffer.toString('utf8')).input_set;
 const inputs={...raw,...c.inputOverrides};
 const studyType=c.studyType==='EXISTING_BUILDING'?STUDY_TYPE.EXISTING_BUILDING:STUDY_TYPE.LAND_DEVELOPMENT;
 const params={studyType,inputs,leverageEnabled:inputs.leverageEnabled===true};
 if(c.assumptionModelVersion)params.assumptionModelVersion=ASSUMPTION_MODEL_VERSION.V2;
 const current=calculateInvestmentCase(params);
 check(current&&typeof current==='object',c.id+' returns structured result');
 const flows=Array.isArray(current.cashflows)?current.cashflows:null;
 const finiteFlows=flows&&flows.length>1&&flows.every(Number.isFinite);
 let currentNpvFromFlows=null,irrResidual=null;
 if(finiteFlows){
  const discount=studyType===STUDY_TYPE.EXISTING_BUILDING?inputs.discountRate:inputs.hurdleRate;
  if(Number.isFinite(discount)&&discount>-1){
   currentNpvFromFlows=npv(discount,flows);
   // Independent identity, enforced only when engine declares a numerical NPV.
   // If the result is incomplete, retain it as a guarded diagnostic.
   if(Number.isFinite(current.npv)&&Number.isFinite(currentNpvFromFlows)){
    check(Math.abs(current.npv-currentNpvFromFlows)<=Math.max(.05,Math.abs(current.npv)*1e-9),
      c.id+' NPV must reconcile with output annual cashflows');
   }
  }
  if(Number.isFinite(current.irr)&&current.irr>-1){
   irrResidual=npv(current.irr,flows);
   check(Math.abs(irrResidual)<=Math.max(.1,Math.abs(flows[0])*1e-8),
     c.id+' IRR must be a root of output annual cashflows');
  }
 }
 if(c.assumptionModelVersion==='V2'){
  equal(current.assumptionModelDisclosure?.userApprovedAssumptions,false,
    c.id+' V2 default cannot fabricate user approval');
 }
 const expected=c.expected;
 const keys=['financialModelVersion','financialModelStatus','decisionStatus','verdict','cashflowLength'];
 const differences=[];
 for(const k of keys){
  const a=k==='cashflowLength'?flows?.length??null:current[k]??null;
  const b=expected[k]??null;
  if(JSON.stringify(a)!==JSON.stringify(b))differences.push(k);
 }
 const historicNpvDelta=delta(current.npv,expected.npv);
 const historicIrrDelta=delta(current.irr,expected.irr);
 if(historicNpvDelta===null||Math.abs(historicNpvDelta)>.02)differences.push('npv');
 if(historicIrrDelta===null||Math.abs(historicIrrDelta)>1e-8)differences.push('irr');
 const evidence={
  id:c.id,
  fixtureBlobSha1:c.sourceFixtureGitBlobSha1,
  historicalModelVersion:expected.financialModelVersion,
  currentModelVersion:current.financialModelVersion||null,
  currentDecisionStatus:current.decisionStatus||null,
  historicalDecisionStatus:expected.decisionStatus,
  historicalNpvSar:expected.npv,
  currentNpvSar:Number.isFinite(current.npv)?Number(current.npv.toFixed(2)):null,
  npvDeltaSar:historicNpvDelta,
  historicalIrr:expected.irr,
  currentIrr:Number.isFinite(current.irr)?Number(current.irr.toFixed(10)):null,
  irrDelta:historicIrrDelta,
  sourceCashflowLength:flows?.length||null,
  reconstructedNpvSar:Number.isFinite(currentNpvFromFlows)?Number(currentNpvFromFlows.toFixed(2)):null,
  irrResidualSar:Number.isFinite(irrResidual)?Number(irrResidual.toFixed(4)):null,
  historicalCompareStatus:differences.length?'REVIEW_DRIFT_NOT_AUTO_AUTHORIZED':'NUMERIC_SHADOW_MATCH_NOT_PROFESSIONALLY_VERIFIED',
  differences,
  provenance:'unchanged synthetic historical RE-GOLD fixture',
  professionalApproval:false,
  transactionAuthorized:false,
 };
 results.push(evidence);
 console.log('P27_SHADOW_CASE='+JSON.stringify(evidence));
}
equal(results.length,4,'four cases independently replayed');
check(results.every(r=>r.transactionAuthorized===false&&!r.professionalApproval),'no shadow case is approved');
console.log('P27_CURRENT_MODEL_SHADOW=PASS assertions='+assertions+
 ' cases='+results.length+' historic_drift_cases='+results.filter(r=>r.differences.length).length+
 ' original_17_real_assets_tested=false release_authorized=false');
