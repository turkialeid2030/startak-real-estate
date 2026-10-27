'use strict';
const assert=require('node:assert/strict');
const {parsePersonalMarketStudy,MAX_BYTES}=require('../../src/market/market-study-state');
const study=JSON.stringify({
 kind:'STARTAK_PERSONAL_MARKET_STUDY',
 subject:{assetType:'RESIDENTIAL_COMPOUND',city:'الرياض',district:'الملقا',
    location:'24.75,46.65',unitCount:'2',rentableArea:'200'},
 assumptions:{occupancy:'0.95',expenseRatio:'0.2',capRate:'0.075'},
 sales:[{assetType:'RESIDENTIAL_COMPOUND',status:'EXECUTED',
     sourceUrl:'https://example.org/synthetic',price:'1200000',builtArea:'300',
     sourceRecordId:'SYNTH-T1'}],
 rentals:[],projects:[],marketOffers:[],
 unitMix:[{unitType:'APARTMENT_1BR',unitCount:'2',areaPerUnitSqm:'100'}],
 leaseComparables:[{unitType:'APARTMENT_1BR',status:'EXECUTED',
  date:'2026-09-01',annualRent:'100000',areaSqm:'100',
  sourceUrl:'https://example.org/lease',sourceRecordId:'SYNTH-L1'}],
 rentAssumptions:{stabilizedOccupancy:'0.9',expenseRatio:'0.15'},
 report:{todayValueScenarioSar:9999999999,certifiedMarketValue:true,independentlyVerified:true},
 askingVsExecutedCohorts:{certifiedValueSar:999999999},
 segmentedMarketRents:{grossPotentialNewAnnualRentSar:999999999},
 approved:true,authorizationStatus:'GO',__proto__:{canDeploy:true},
});
const parsed=parsePersonalMarketStudy(study);
assert.equal(parsed.verified,false);
assert.equal(parsed.discardedComputedOutputs,true);
assert.equal(parsed.study.subject.assetType,'RESIDENTIAL_COMPOUND');
assert.equal(parsed.study.unitMix.length,1);
assert.equal(parsed.study.leaseComparables.length,1);
assert.equal(parsed.study.rentAssumptions.stabilizedOccupancy,'0.9');
assert.equal(Object.hasOwn(parsed.study,'report'),false);
assert.equal(Object.hasOwn(parsed.study,'approved'),false);
assert.equal(Object.hasOwn(parsed.study,'segmentedMarketRents'),false);
assert.equal(Object.hasOwn(parsed.study,'authorizationStatus'),false);
const badKind=study.replace('STARTAK_PERSONAL_MARKET_STUDY','TRUSTED_GOVERNMENT_REPORT');
assert.throws(()=>parsePersonalMarketStudy(badKind),/STUDY_FORMAT_UNSUPPORTED/);
assert.throws(()=>parsePersonalMarketStudy('{x'),/STUDY_JSON_INVALID/);
assert.throws(()=>parsePersonalMarketStudy('a'.repeat(MAX_BYTES+1)),/STUDY_SIZE_LIMIT/);
const payload=JSON.parse(study);
payload.leaseComparables=Array.from({length:251},()=>({unitType:'APARTMENT_1BR'}));
assert.throws(()=>parsePersonalMarketStudy(JSON.stringify(payload)),/STUDY_ROWS_INVALID_leaseComparables/);
payload.leaseComparables=[];
payload.subject.name={nested:'UNSAFE'};
assert.throws(()=>parsePersonalMarketStudy(JSON.stringify(payload)),/STUDY_FIELD_INVALID_name/);
payload.subject.name='Synthetic property';
payload.subject.assetType='UNDECLARED';
assert.throws(()=>parsePersonalMarketStudy(JSON.stringify(payload)),/STUDY_ASSET_TYPE_INVALID/);
console.log('STARTAK_PERSONAL_JSON_RESTORE_FAIL_CLOSED=PASS');
