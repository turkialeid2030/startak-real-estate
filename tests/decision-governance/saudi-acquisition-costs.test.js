'use strict';
const assert=require('assert');const {calculateSaudiAcquisitionCosts}=require('../../src/decision-governance/saudi-acquisition-costs');
function run(){const p=1000000;
 let r=calculateSaudiAcquisitionCosts({purchasePrice:p,rettRate:.05,rettEconomicBearer:'SELLER',brokerageRate:.025,brokeragePayer:'SELLER'});assert.strictEqual(r.acquisitionBasis,p);
 r=calculateSaudiAcquisitionCosts({purchasePrice:p,rettRate:.05,rettEconomicBearer:'BUYER',brokerageRate:.025,brokeragePayer:'BUYER'});assert.strictEqual(r.acquisitionBasis,1075000);
 r=calculateSaudiAcquisitionCosts({purchasePrice:p,rettRate:.05,rettEconomicBearer:'UNKNOWN',brokerageRate:.025,brokeragePayer:'UNKNOWN'});assert.strictEqual(r.acquisitionBasis,p);assert.strictEqual(r.warnings.length,2);
 r=calculateSaudiAcquisitionCosts({purchasePrice:p,rettAmount:50000,rettEconomicBearer:'SHARED',rettBuyerShare:.4,brokerageAmount:25000,brokeragePayer:'SHARED',brokerageBuyerShare:.5});assert.strictEqual(r.acquisitionBasis,1032500);
 assert.throws(()=>calculateSaudiAcquisitionCosts({purchasePrice:p,rettRate:Infinity}),/finite/);console.log('SAUDI_ACQUISITION_COST_TESTS=PASS');}run();
