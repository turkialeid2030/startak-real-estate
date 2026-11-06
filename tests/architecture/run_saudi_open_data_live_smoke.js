'use strict';
// Live public-source diagnostic (no credentials; no Suhail scraping).
// This test checks a real open-data file and its MOJ schema, not a site login.
const assert=require('node:assert/strict');
const {readOpenQuarters,deriveDistrictSnapshot}=require('../../src/market/saudi-open-data-research');
(async()=>{
 const result=await readOpenQuarters({quarters:['2026-Q1']});
 assert.equal(result.sources.length,1,JSON.stringify(result.errors));
 assert.ok(result.records.length>500,'quarterly open-data source unexpectedly empty');
 const sample=result.records[0];
 assert.ok(sample.city&&sample.date&&sample.price>0&&sample.area>0,'required government dataset fields missing');
 assert.equal(result.noLicensedRealTimeFeed,true);
 const cities=new Set(result.records.map(r=>String(r.city).trim()));
 console.log(JSON.stringify({suite:'SAUDI_OPEN_DATA_LIVE_SOURCE_SMOKE',status:'PASS',
   rows:result.records.length,distinctCities:cities.size,exampleDate:sample.date,source:result.sources[0].url,
   attribution:result.permission,governmentPublicationIsNotLive:true},null,2));
})().catch(e=>{console.error('SAUDI_OPEN_DATA_LIVE_SOURCE_SMOKE=FAIL',e.message);process.exitCode=1;});
