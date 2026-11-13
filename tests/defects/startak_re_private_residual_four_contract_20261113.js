'use strict';
// Entirely synthetic non-client case. Private records are never committed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'startak-re-residual-'));
const cli=path.join(process.cwd(),'tools/verify-owner-private-residual-4.mjs');
const sample={
 residualCases:[
  {id:'SYNTHETIC-COMM',
   scenarios:[
    {gdv:20000,dev:1000,othPct:1,mktPct:2,contPct:10,profPct:15,weightPct:50},
    {gdv:20000,dev:1000,othPct:1,mktPct:2,contPct:10,profPct:15,weightPct:50}
   ],
   periodYears:1,discountPct:10,residualArea:2,roundStep:100,
   marketLandRate:6000,marketWeightPct:50,
   expected:{scenarioLand:[11000,11000],presentValue:10000,residualRate:5000,adoptedLandRate:5500}},
  {id:'SYNTHETIC-HOTEL-A',
   seasons:[{days:365,occPct:50}],
   roomTypes:[{count:1,adr:[100]}],
   opexPct:20,capRatePct:10,scenario:{dev:14000,othPct:0},
   periodYears:1,discountPct:10,residualArea:20,roundStep:50,
   expected:{grossIncome:18250,noi:14600,gdv:146000,presentValue:120000,residualRate:6000}},
  {id:'SYNTHETIC-HOTEL-B',
   seasons:[{days:365,occPct:100}],
   roomTypes:[{count:2,adr:[120]}],
   opexPct:25,capRatePct:10,scenario:{dev:57000,othPct:0},
   periodYears:1,discountPct:20,residualArea:100,roundStep:50,
   expected:{grossIncome:87600,gdv:657000,presentValue:500000,residualRate:5000}},
  {id:'SYNTHETIC-COMPOUND',
   units:[{count:2,annualRent:1000,occPct:100}],
   opexPct:10,capRatePct:10,
   expected:{grossIncome:2000,noi:1800,incomeValue:18000}}
 ]};
const copy=()=>JSON.parse(JSON.stringify(sample));
function run(data){
 const file=path.join(root,'synthetic-fixture.json');
 fs.writeFileSync(file,JSON.stringify(data));
 return spawnSync(process.execPath,[cli,'--fixture='+file],{encoding:'utf8',timeout:20000});
}
try {
 const missing=spawnSync(process.execPath,[cli],{encoding:'utf8',timeout:20000});
 assert.equal(missing.status,2);
 assert.match(missing.stdout,/SOURCE=BLOCKED_NOT_SUPPLIED/);
 const clean=run(sample);
 assert.equal(clean.status,2,clean.stdout+'\n'+clean.stderr);
 assert.match(clean.stdout,/SUBMETHOD_REFERENCE=PASS cases=4/);
 assert.match(clean.stdout,/COMM_SCENARIO_FORMULA=BLOCKED_NOT_SPECIFIED/);
 assert.match(clean.stdout,/OVERALL=HOLD/);
 assert(!clean.stdout.includes('SYNTHETIC-HOTEL-A'),'do not output source case identity');
 const tamper=copy();
 tamper.residualCases[1].expected.grossIncome=18251;
 const failed=run(tamper);
 assert.equal(failed.status,1);
 assert.match(failed.stdout,/HOTEL_GROSS_MISMATCH/);
 const wrongComm=copy();
 wrongComm.residualCases[0].expected.presentValue=123456;
 assert.equal(run(wrongComm).status,1);
 const wrongAnnual=copy();
 wrongAnnual.residualCases[2].seasons[0].days=360;
 assert.equal(run(wrongAnnual).status,1);
 const wrongIncome=copy();
 wrongIncome.residualCases[3].expected.incomeValue=18001;
 assert.equal(run(wrongIncome).status,1);
 const duplicate=copy();
 duplicate.residualCases[3].id=duplicate.residualCases[0].id;
 assert.equal(run(duplicate).status,1);
 const wrongLength=copy();
 wrongLength.residualCases.pop();
 assert.equal(run(wrongLength).status,1);
 const wrongWeight=copy();
 wrongWeight.residualCases[0].scenarios[0].weightPct=60;
 assert.equal(run(wrongWeight).status,1);
 console.log('STARTAK_RE_PRIVATE_RESIDUAL_FOUR_CONTRACT=PASS');
} finally {
 fs.rmSync(root,{recursive:true,force:true});
}
