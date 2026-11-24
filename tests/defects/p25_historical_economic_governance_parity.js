'use strict';
// Behavioral migration of historical PR #461: do NOT restore the obsolete
// authority path. The canonical engine remains baseline-only; the separate
// research runner can calculate a documented, non-authorizing what-if.
const assert=require('node:assert/strict');
const {calculateInvestmentCase,evaluateP25FinancialWhatIf,P25_WHAT_IF_STATUS,STUDY_TYPE}=require('../../src/engines');
const {buildCriticalAssumptionOverrideGovernance}=require('../../src/assumptions/critical-assumption-override-governance');
const {V2_CANONICAL_ASSUMPTIONS}=require('../../src/assumptions/assumption-model');
const {withAssumptionRegistry,assumptionRegistryFromSavedDeal}=require('../../src/assumptions/saved-deal-assumption-registry');
const gold=require(require('../config/paths').getGoldBaselinePath());
const g=gold['RE-GOLD-002_existing_building'].inputs;
const inputs={...g,leaseYears:g.holdPeriod+1,exitCapRate:0.07,exitTransferFeeRate:0.05,leverageEnabled:false};
const terms={studyType:STUDY_TYPE.EXISTING_BUILDING,inputs,leverageEnabled:false,assumptionModelVersion:'V2'};
const asOf='2026-10-28T00:00:00.000Z';
const complete={id:'maintenanceRate',value:0.06,unit:'ratio',critical:true,override:true,
 overrideReason:'Synthetic P25 parity test',sourceType:'INTERNAL_APPROVED_EVIDENCE',
 sourceReference:'SYNTH-P25-SOURCE',sourceDate:'2026-10-20T00:00:00.000Z',
 approver:'synthetic-reviewer',approvalReference:'SYNTH-P25-APPROVAL',
 approvedAt:'2026-10-21T00:00:00.000Z',approvalStatus:'APPROVED',expiresAt:'2099-12-31T00:00:00.000Z'};
const run=registry=>calculateInvestmentCase({...terms,assumptionRegistry:registry});
const research=registry=>evaluateP25FinancialWhatIf({...terms,assumptionRegistry:registry,asOf});
const governance=registry=>buildCriticalAssumptionOverrideGovernance({assumptionModelVersion:'V2',assumptionRegistry:registry,asOf});
const baseline=run(undefined);
assert.equal(baseline.criticalAssumptionOverrideGovernance.status,'NO_OVERRIDES');
assert.equal(baseline.assumptionModelDisclosure.userApprovedAssumptions,false);
for(const metric of ['NOI','npv','irr'])assert.ok(Number.isFinite(baseline[metric]),metric);
const valid=governance([complete]);
assert.equal(valid.status,'READY');assert.equal(valid.resolvedOverrides.maintenanceRate,0.06);
assert.equal(valid.overrides[0].baselineValue,V2_CANONICAL_ASSUMPTIONS.maintenanceRate);
assert.ok(Math.abs(valid.overrides[0].absoluteDelta-0.01)<1e-12);
assert.ok(Math.abs(valid.overrides[0].percentDelta-0.2)<1e-12);
const canonical=run([complete]);
assert.equal(canonical.decisionStatus,'INCOMPLETE_INPUTS');
assert.equal(canonical.criticalAssumptionOverrideGovernance.status,'HOLD_UNSUPPORTED_OVERRIDE_PATH');
assert.equal(canonical.appliedCriticalAssumptionOverrides,false);
for(const metric of ['NOI','npv','irr','cashflows'])assert.deepEqual(canonical[metric],baseline[metric]);
const whatIf=research([complete]);
assert.equal(whatIf.status,P25_WHAT_IF_STATUS.ANALYTICAL_HOLD);
assert.equal(whatIf.baseline.NOI,baseline.NOI);
assert.ok(whatIf.whatIf.NOI<baseline.NOI);
assert.equal(whatIf.deltas.NOI,whatIf.whatIf.NOI-baseline.NOI);
assert.equal(whatIf.financialDecisionAuthorized,false);
assert.equal(whatIf.transactionAuthorized,false);
assert.equal(whatIf.productionOverrideActivated,false);
const incomplete={...complete};delete incomplete.sourceReference;
assert.equal(research([incomplete]).status,P25_WHAT_IF_STATUS.INVALID);
assert.ok(governance([incomplete]).blockers.includes('CRITICAL_OVERRIDE_SOURCE_EVIDENCE_REQUIRED:maintenanceRate'));
assert.equal(run([incomplete]).decisionStatus,'INCOMPLETE_INPUTS');
assert.equal(research([{...complete,value:'0.06'}]).status,P25_WHAT_IF_STATUS.INVALID);
assert.equal(research([complete,{...complete,value:0.07}]).status,P25_WHAT_IF_STATUS.INVALID);
assert.ok(governance([complete,{...complete,value:0.07}]).blockers.includes('DUPLICATE_CRITICAL_OVERRIDE:maintenanceRate'));
const raw=calculateInvestmentCase({...terms,inputs:{...inputs,maintenanceRate:0.5,__p25CriticalAssumptionOverrides:{maintenanceRate:0.99},p25ResearchOverrides:{maintenanceRate:0.99}}});
for(const metric of ['NOI','npv','irr'])assert.equal(raw[metric],baseline[metric]);
const legacy=calculateInvestmentCase({...terms,assumptionModelVersion:'LEGACY'});
const legacyOverride=calculateInvestmentCase({...terms,assumptionModelVersion:'LEGACY',assumptionRegistry:[complete]});
for(const metric of ['NOI','npv','irr','cashflows'])assert.deepEqual(legacyOverride[metric],legacy[metric]);
assert.equal(legacyOverride.decisionStatus,'INCOMPLETE_INPUTS');
const saved=withAssumptionRegistry({id:'p25-parity',name:'Synthetic P25',mode:'building',inputs,assumptionModelVersion:'V2'},[incomplete]);
assert.deepEqual(assumptionRegistryFromSavedDeal(saved),[incomplete]);
assert.equal(assumptionRegistryFromSavedDeal(saved)[0].sourceReference,undefined);
assert.equal(run(undefined).irr,baseline.irr);
console.log('P25_HISTORICAL_ECONOMIC_GOVERNANCE_PARITY=PASS baseline_preserved=true canonical_override=false');
