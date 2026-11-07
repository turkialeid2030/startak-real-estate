#!/usr/bin/env node
/**
 * Private, source-bound STARTAK owner acceptance gate.
 *
 * This deliberately does NOT bundle golden-cases-17.json, user documents,
 * report-derived source values, or synthetic substitutions in a public repo.
 * RUN ONLY with an authorized private fixture and an independently generated
 * STARTAK engine-output artifact, both supplied explicitly at execution time.
 *
 * Reference math is a scoped characterization of the supplied intake fixture.
 * It must never be called independently verified market valuation.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const REQUIRED_IRR = '0.1444715207802304';
const NONNEGATIVE_INTEGER = value => Number.isSafeInteger(value) && value >= 0;
const fail = code => { throw new Error(code); };
const mark = (code, detail = '') => console.log('STARTAK_PRIVATE_GOLDEN_'+code+(detail?' '+detail:''));
const args = process.argv.slice(2);
const opts = new Map();
for(const arg of args){
  const match=/^--(fixture|engine-results|irr-provenance)=(.+)$/.exec(arg);
  if(!match || opts.has(match[1])) fail('ARGUMENTS_INVALID');
  opts.set(match[1],match[2]);
}
if(!opts.has('fixture')) {
  mark('SOURCE=BLOCKED_NOT_SUPPLIED');
  process.exit(2);
}
const load = async(name) => JSON.parse(await readFile(opts.get(name),'utf8'));
const ensureFinite = (v,code) => {if(typeof v!=='number'||!Number.isFinite(v))fail(code);return v;};
function evaluateReference(c){
  const landArea=ensureFinite(c.landArea,'LAND_AREA_INVALID');
  if(landArea<=0 || !Number.isFinite(c.roundStep) || c.roundStep<=0) fail('LAND_INPUTS_INVALID');
  let landRate;
  if(c.adoptedLandRate !== null && c.adoptedLandRate !== undefined){
    landRate=ensureFinite(c.adoptedLandRate,'ADOPTED_LAND_RATE_INVALID');
  }else{
    if(!Array.isArray(c.landComparables)||!c.landComparables.length)fail('SOURCE_COMPARABLES_MISSING');
    let totalWeight=0,adjustedWeightedSum=0;
    for(const cmp of c.landComparables){
      const p=ensureFinite(cmp.price,'COMPARABLE_INVALID');
      const a=ensureFinite(cmp.netAdjPct,'COMPARABLE_INVALID');
      const w=ensureFinite(cmp.weightPct,'COMPARABLE_INVALID');
      if(p<0||w<0)fail('COMPARABLE_INVALID');
      totalWeight+=w;adjustedWeightedSum+=p*(1+a/100)*(w/100);
    }
    if(Math.abs(totalWeight-100)>1e-8)fail('COMPARABLE_WEIGHTS_INVALID');
    landRate=Math.round(adjustedWeightedSum/c.roundStep)*c.roundStep;
  }
  if(landRate<0||!Number.isFinite(landRate)) fail('LAND_RATE_INVALID');
  if(!Array.isArray(c.components))fail('COST_COMPONENTS_INVALID');
  const componentCost=c.components.reduce((acc,x)=>{
    const area=ensureFinite(x.area,'COST_COMPONENT_INVALID'),rate=ensureFinite(x.rate,'COST_COMPONENT_INVALID');
    if(area<0||rate<0)fail('COST_COMPONENT_INVALID');
    return acc+area*rate;
  },0);
  const pct=c.softCostsPct;
  if(!pct||typeof pct!=='object'||Array.isArray(pct))fail('SOFT_COSTS_INVALID');
  const costKeys=['professional','utilities','management','finance','contractorProfit'];
  const surcharge=costKeys.reduce((acc,key)=>{
    if(!Object.prototype.hasOwnProperty.call(pct,key))fail('SOFT_COSTS_MISSING');
    const value=ensureFinite(pct[key],'SOFT_COSTS_INVALID');
    if(value<0)fail('SOFT_COSTS_INVALID');
    return acc+value;
  },0);
  const life=ensureFinite(c.usefulLife,'LIFE_INVALID'),age=ensureFinite(c.effectiveAge,'AGE_INVALID');
  const yieldPct=ensureFinite(c.rentalYieldPct,'RENTAL_YIELD_INVALID');
  if(life<=0||age<0||age>life||yieldPct<0)fail('AGE_OR_YIELD_OUT_OF_SCOPE');
  const value=Math.round((landRate*landArea+componentCost*(1+surcharge/100)*(1-age/life))/1000)*1000;
  const rent=value*yieldPct/100;
  if(!NONNEGATIVE_INTEGER(value)||!Number.isFinite(rent))fail('CALCULATION_INVALID');
  return {marketValue:value,marketRent:rent};
}
function same(a,b){return Object.is(a.marketValue,b.marketValue)&&Object.is(a.marketRent,b.marketRent);}
function validateCases(fixture){
  if(!fixture||typeof fixture!=='object'||!Array.isArray(fixture.cases)||fixture.cases.length!==17)fail('SOURCE_COUNT_NOT_17');
  const ids=new Set();
  for(const c of fixture.cases){
    if(typeof c.id!=='string'||!c.id.trim()||ids.has(c.id))fail('SOURCE_IDS_INVALID');
    ids.add(c.id);
    const expected=c.expected;
    if(!expected||!NONNEGATIVE_INTEGER(expected.marketValue)||!NONNEGATIVE_INTEGER(expected.marketRent))fail('SOURCE_EXPECTED_INVALID');
    if(!same(evaluateReference(c),expected))fail('REFERENCE_FORMULA_MISMATCH');
  }
  return ids;
}
try {
  const fixture=await load('fixture');
  const ids=validateCases(fixture);
  mark('REFERENCE_FORMULA=PASS','cases=17 fixture_self_consistency=true source_authenticity_unverified=true independent_market_verified=false');
  if(!opts.has('engine-results')){
    mark('ENGINE_PARITY=BLOCKED_NOT_SUPPLIED');
    process.exit(2);
  }
  const actual=await load('engine-results');
  if(!actual||typeof actual!=='object'||!Array.isArray(actual.cases)||actual.cases.length!==17)fail('ENGINE_OUTPUT_COUNT_NOT_17');
  const actuals=new Map();
  for(const row of actual.cases){
    if(!ids.has(row.id)||actuals.has(row.id))fail('ENGINE_OUTPUT_IDS_INVALID');
    actuals.set(row.id,row);
  }
  for(const c of fixture.cases){
    const row=actuals.get(c.id);
    if(!row||!same(row,c.expected))fail('ENGINE_OUTPUT_MISMATCH');
  }
  mark('ENGINE_OUTPUT_ARTIFACT_CONSISTENCY=PASS','cases=17 exact_value_and_rent=true untrusted_input=true');
  // A supplied JSON file can be hand-authored: matching numbers cannot prove
  // it was produced by executing STARTAK engines. Never mark engine parity PASS
  // until an independent executor binds source hash, exact engine SHA and logs.
  mark('ENGINE_PARITY=BLOCKED_TRUSTED_EXECUTION_PROOF_REQUIRED');
  if(!opts.has('irr-provenance')){
    mark('IRR_BASELINE=BLOCKED_SOURCE_MAPPING_REQUIRED');
    process.exit(2);
  }
  const irr=await load('irr-provenance');
  // A bare number alone does not establish which cashflows generated it.
  // The source path, source digest and period/unit basis are mandatory.
  const required=['sourceArtifact','sourceSha256','cashflowMapping','periodBasis','unitBasis','engineOutput'];
  if(!irr||required.some(key=>typeof irr[key]!=='string'||!irr[key].trim())){
    mark('IRR_BASELINE=BLOCKED_INCOMPLETE_SOURCE_MAPPING');
    process.exit(2);
  }
  if(!/^[a-f0-9]{64}$/i.test(irr.sourceSha256))fail('IRR_SOURCE_DIGEST_INVALID');
  // A syntactically valid digest is not provenance. Hash the exact, private
  // on-disk source bytes and compare; never log their content or absolute path.
  let originalBytes;
  try{originalBytes=await readFile(irr.sourceArtifact);}
  catch{
    mark('IRR_BASELINE=BLOCKED_SOURCE_ARTIFACT_UNAVAILABLE');
    process.exit(2);
  }
  const observedSha256=createHash('sha256').update(originalBytes).digest('hex');
  if(observedSha256!==irr.sourceSha256.toLowerCase())fail('IRR_SOURCE_DIGEST_MISMATCH');
  mark('IRR_SOURCE_BYTES=PASS','sha256_matches=true independent_authenticity_unverified=true');
  if(irr.engineOutput!==REQUIRED_IRR)fail('IRR_BASELINE_MISMATCH');
  mark('IRR_BASELINE=PROVISIONAL_MATCH','exact_value=true provenance_requires_independent_review=true');
  mark('OVERALL=HOLD','external_and_professional_authority_not_established');
  process.exit(2);
} catch(error){
  mark('OVERALL=FAIL','reason='+String(error.message||'UNKNOWN').replace(/[^A-Z0-9_]/g,'').slice(0,60));
  process.exit(1);
}
