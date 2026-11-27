'use strict';
// Diagnostic only. Targeted runs never replace the complete release gate.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {SUITES,discoverRegressionTests}=require('./regression-test-discovery');
const {REGRESSION_TIMEOUT_MS}=require('./regression-process-boundary');
const root=path.resolve(__dirname,'..');
const norm=x=>x.split(path.sep).join('/');
function selectTargetedTests(files,selectors){
 if(!Array.isArray(files)||!files.length||!Array.isArray(selectors)||!selectors.length||selectors.length>100)throw Error('TARGETED_SELECTION_REQUIRED');
 const allowed=new Map(files.map(x=>[norm(x),x])),selected=new Set();
 if(allowed.size!==files.length)throw Error('TARGETED_DISCOVERY_DUPLICATE');
 for(const selector of selectors){
  if(typeof selector!=='string')throw Error('TARGETED_SELECTOR_INVALID');
  if(selector.startsWith('suite:')){
   const suite=selector.slice(6);if(!SUITES.some(([n])=>n===suite))throw Error('TARGETED_SUITE_UNKNOWN');
   const matched=[...allowed.keys()].filter(x=>x.startsWith('tests/'+suite+'/'));if(!matched.length)throw Error('TARGETED_SUITE_EMPTY');for(const x of matched)selected.add(x);
  }else{
   if(!allowed.has(selector))throw Error('TARGETED_TEST_NOT_DISCOVERED');
   selected.add(selector);
  }
 }
 return files.filter(x=>selected.has(norm(x)));
}
function censusWorkflowTexts(entries){
 if(!Array.isArray(entries)||!entries.length||entries.length>1000)throw Error('WORKFLOW_CENSUS_INVALID');
 const seen=new Set(),rows=[];
 for(const e of entries){
  if(!e||typeof e.name!=='string'||! /^[A-Za-z0-9_.-]+\.ya?ml$/.test(e.name)||typeof e.text!=='string'||seen.has(e.name))throw Error('WORKFLOW_CENSUS_ENTRY_INVALID');
  seen.add(e.name);
  const active=e.text.split(/\r?\n/).filter(l=>!/^\s*#/.test(l)).join('\n');
  const count=re=>[...active.matchAll(re)].length;
  rows.push({name:e.name,releaseCalls:count(/(?:npm\s+run\s+release:verify|node\s+tools\/release-verify\.js)\b/g),packageCalls:count(/(?:npm\s+run\s+verify:package|node\s+tests\/verify_package\.js)\b/g),allStagesCalls:count(/node\s+tools\/verify-all-stages\.mjs\b/g),buildCalls:count(/npm\s+run\s+build\b/g)});
 }
 return {workflowFiles:rows.length,releaseCalls:rows.reduce((n,x)=>n+x.releaseCalls,0),packageCalls:rows.reduce((n,x)=>n+x.packageCalls,0),allStagesCalls:rows.reduce((n,x)=>n+x.allStagesCalls,0),explicitBuildCalls:rows.reduce((n,x)=>n+x.buildCalls,0),rows,method:'STATIC_LITERAL_COMMAND_CENSUS_NOT_RUNTIME_EQUIVALENCE',productionAuthorized:false};
}
function execute(args){
 if(args.length===1&&args[0]==='--workflow-census'){
  const dir=path.join(root,'.github','workflows');
  const entries=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&/\.ya?ml$/.test(x.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(x=>({name:x.name,text:fs.readFileSync(path.join(dir,x.name),'utf8')}));
  const result=censusWorkflowTexts(entries);
  // Names and counts only, never print workflow content or environment.
  console.log('V7_WORKFLOW_CENSUS='+JSON.stringify(result));
  return 0;
 }
 if(args[0]!=='--targeted'&&args[0]!=='--list-targeted')throw Error('USE_TARGETED_OR_WORKFLOW_CENSUS');
 const files=discoverRegressionTests(root),selected=selectTargetedTests(files,args.slice(1));
 console.log('V7_TARGETED_SCOPE='+JSON.stringify({discovered:files.length,selected:selected.length,fullReleaseQualification:false}));
 if(args[0]==='--list-targeted'){for(const file of selected)console.log(norm(file));return 0;}
 let passed=0;const started=Date.now();
 for(const file of selected){
  const result=spawnSync(process.execPath,[path.join(root,file)],{cwd:root,stdio:'ignore',timeout:REGRESSION_TIMEOUT_MS,killSignal:'SIGKILL'});
  if(result.status===0&&!result.error&&!result.signal){passed++;console.log('TARGETED_PASS '+norm(file));}else console.log('TARGETED_FAIL '+norm(file));
 }
 console.log('V7_TARGETED_RESULT='+ (passed===selected.length?'PASS':'FAIL')+' selected='+selected.length+' passed='+passed+' elapsed_ms='+(Date.now()-started)+' release_authorized=false');
 return passed===selected.length?0:1;
}
if(require.main===module){try{process.exitCode=execute(process.argv.slice(2));}catch(e){console.error('V7_DIAGNOSTIC_FAILED');process.exitCode=1;}}
module.exports={selectTargetedTests,censusWorkflowTexts};
