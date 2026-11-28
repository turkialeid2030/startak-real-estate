import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {REQUIRED,command,summarize,markdown} from './verify-all-stages.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const LANES=Object.freeze({
 'cross-browser':Object.freeze({script:'run_audit_20261010_remaining_browser.js',file:'acceptance.json',rows:'browsers',count:'checksCompleted'}),
 'ocr-browser':Object.freeze({script:'run_audit_20261020_local_ocr_browser.js',file:'local-ocr-acceptance.json',rows:'browsers',count:'checksCompleted'}),
 'document-tables-browser':Object.freeze({script:'run_audit_20261021_document_tables_browser.js',file:'document-tables-acceptance.json',rows:'contexts',count:'checks'})
});
const laneIds=Object.keys(LANES);
const coreIds=REQUIRED.filter(id=>!laneIds.includes(id));
const expectedMatrix=['chromium','firefox','webkit'].flatMap(engine=>[390,1366].map(width=>engine+':'+width)).sort();
const positive=n=>Number.isSafeInteger(n)&&n>0;
const duration=n=>Number.isSafeInteger(n)&&n>=0;
function exactSet(actual,expected){
 return Array.isArray(actual)&&actual.length===expected.length&&new Set(actual).size===actual.length&&expected.every(id=>actual.includes(id));
}
function requireCheck(check,id){
 if(!check||check.id!==id||check.status!=='PASS'||check.exitCode!==0||check.outputLimitExceeded!==false||check.timedOut!==false||check.logFile!==id+'.log'||!duration(check.durationMs))throw Error('SPLIT_CHECK_NOT_QUALIFIED');
}
function identity(){
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const runId=process.env.GITHUB_RUN_ID,runAttempt=process.env.GITHUB_RUN_ATTEMPT;
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.STARTAK_SOURCE_COMMIT!==sourceCommit||!/^\d+$/.test(runId||'')||!/^\d+$/.test(runAttempt||'')||!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('SPLIT_CI_IDENTITY_REQUIRED');
 return {sourceCommit,runId,runAttempt};
}
function requireIdentity(report,expected,kind){
 if(!report||report.schemaVersion!==1||report.kind!==kind||report.sourceCommit!==expected.sourceCommit||report.runId!==expected.runId||report.runAttempt!==expected.runAttempt||report.engineeringStatus!=='NOT_EVALUATED'||report.productionAuthorized!==false||!duration(report.durationMs))throw Error('SPLIT_EVIDENCE_IDENTITY_INVALID');
}
export function validateBrowserMatrix(id,e,sha){
 if(!Object.hasOwn(LANES,id)||!e||e.sourceCommit!==sha||!positive(e.checks))throw Error('SPLIT_BROWSER_SOURCE_INVALID');
 const config=LANES[id],rows=e[config.rows];
 if(!Array.isArray(rows)||!exactSet(rows.map(b=>b?.engine+':'+(b?.width??b?.viewport?.width)),expectedMatrix)||!rows.every(b=>positive(b?.[config.count])&&b.physicalDevice===false))throw Error('SPLIT_BROWSER_MATRIX_INVALID');
 if(id==='document-tables-browser'&&(e.independentExtractionAccuracyQualified!==false||e.sourceAuthenticationQualified!==false||e.financialAdoptionAuthorized!==false))throw Error('SPLIT_BROWSER_AUTHORITY_INVALID');
 return {totalChecks:e.checks,contexts:rows.map(b=>({engine:b.engine,width:b.width??b.viewport?.width,checks:b[config.count],physicalDevice:false}))};
}
export function aggregateSplit(core,lanes,expected){
 if(!expected||!/^[a-f0-9]{40}$/.test(expected.sourceCommit||'')||!/^\d+$/.test(expected.runId||'')||!/^\d+$/.test(expected.runAttempt||''))throw Error('SPLIT_EXPECTED_IDENTITY_INVALID');
 requireIdentity(core,expected,'core');
 if(core.requestCount!==36||!exactSet(core.checks?.map(c=>c?.id),coreIds)||!exactSet(core.observations?.map(o=>o?.id),['preview','ai-config','ai-assist-method-guard']))throw Error('SPLIT_CORE_INCOMPLETE');
 core.checks.forEach(c=>requireCheck(c,c.id));
 for(const o of core.observations){
  if(!['PASS','BLOCKED'].includes(o.status)||(o.id!=='preview'&&o.status!=='BLOCKED')||(o.status==='PASS'&&o.reason!=='EXACT_SOURCE_AND_ASSET_HASHES_VERIFIED'))throw Error('SPLIT_OBSERVATION_INVALID');
 }
 if(!Array.isArray(lanes)||!exactSet(lanes.map(l=>l?.kind),laneIds))throw Error('SPLIT_LANES_INCOMPLETE');
 for(const lane of lanes){
  requireIdentity(lane,expected,lane.kind);requireCheck(lane.check,lane.kind);
  const rows=lane.matrix?.contexts;
  if(!positive(lane.matrix?.totalChecks)||!Array.isArray(rows)||!exactSet(rows.map(b=>b?.engine+':'+b?.width),expectedMatrix)||!rows.every(b=>positive(b?.checks)&&b.physicalDevice===false))throw Error('SPLIT_LANE_MATRIX_INVALID');
 }
 const byId=new Map([...core.checks,...lanes.map(l=>l.check)].map(c=>[c.id,c]));
 const report=summarize({sha:expected.sourceCommit,checks:REQUIRED.map(id=>byId.get(id)),observations:core.observations,requestCount:core.requestCount});
 return {...report,executionMode:'ISOLATED_CI_CANDIDATE',runId:expected.runId,runAttempt:expected.runAttempt,coreDurationMs:core.durationMs,isolatedLanes:lanes.map(l=>({id:l.kind,durationMs:l.durationMs,totalChecks:l.matrix.totalChecks})),productionAuthorized:false};
}
async function heavy(id,outDir){
 if(!Object.hasOwn(LANES,id))throw Error('SPLIT_LANE_INVALID');
 const expected=identity(),started=performance.now(),config=LANES[id];
 await fs.mkdir(outDir,{recursive:true});
 const build=await command('isolated-build','npm',['run','build'],outDir);
 requireCheck(build,'isolated-build');
 const evidencePath=path.join(root,'runtime-evidence/remaining-audit',config.file);
 await fs.rm(evidencePath,{force:true});
 const {preview}=await import('vite');
 const server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:true}});
 let check;
 try{
  process.env.STARTAK_E2E_URL='http://127.0.0.1:4173/?ownerView=advanced';
  check=await command(id,'node',['tests/e2e/'+config.script],outDir);
 }finally{await new Promise(resolve=>server.httpServer.close(resolve));}
 requireCheck(check,id);
 const evidence=JSON.parse(await fs.readFile(evidencePath,'utf8'));
 const matrix=validateBrowserMatrix(id,evidence,expected.sourceCommit);
 const report={schemaVersion:1,...expected,kind:id,check,matrix,durationMs:Math.round(performance.now()-started),engineeringStatus:'NOT_EVALUATED',productionAuthorized:false};
 await fs.writeFile(path.join(outDir,'lane-evidence.json'),JSON.stringify(report,null,2)+'\n');
 console.log('SPLIT_LANE='+id+' PASS; OVERALL_NOT_EVALUATED');
}
async function join(inputDir,outDir){
 const expected=identity();
 if(process.env.SPLIT_DEPENDENCIES_OK!=='true')throw Error('SPLIT_DEPENDENCIES_FAILED');
 const prefix='split-'+expected.runId+'-'+expected.runAttempt+'-';
 const read=async(kind,file)=>JSON.parse(await fs.readFile(path.join(inputDir,prefix+kind,file),'utf8'));
 const core=await read('core','core-evidence.json');
 const pack=await read('core','external-evidence-requests.json');
 if(pack.status!=='REQUEST_PACK_READY_NOT_SENT'||pack.requestCount!==36||pack.independentlyApprovedCount!==0||pack.releaseAuthorized!==false||!Array.isArray(pack.requests)||pack.requests.length!==36||pack.requests.some(r=>r.requestSent!==false||r.independentlyApproved!==false))throw Error('SPLIT_REQUEST_PACK_INVALID');
 const lanes=await Promise.all(laneIds.map(id=>read(id,'lane-evidence.json')));
 const report=aggregateSplit(core,lanes,expected);
 await fs.mkdir(outDir,{recursive:true});
 await fs.writeFile(path.join(outDir,'all-stages.json'),JSON.stringify(report,null,2)+'\n');
 await fs.writeFile(path.join(outDir,'external-evidence-requests.json'),JSON.stringify(pack,null,2)+'\n');
 const md=markdown(report);
 await fs.writeFile(path.join(outDir,'all-stages.md'),md);
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,md);
 console.log('SPLIT_ALL_STAGES_ENGINEERING='+report.engineeringStatus);
 console.log('SPLIT_ALL_STAGES_DECISION=HOLD_NOT_AUTHORIZED');
 process.exitCode=report.exitCode;
}
async function execute(){
 const [mode,first,second]=process.argv.slice(2);
 if(process.argv.length!==5||!first||!second)throw Error('SPLIT_ARGUMENTS_INVALID');
 if(mode==='heavy')await heavy(first,path.resolve(second));
 else if(mode==='join')await join(path.resolve(first),path.resolve(second));
 else throw Error('SPLIT_MODE_INVALID');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)execute().catch(()=>{console.error('SPLIT_QUALIFICATION_NOT_QUALIFIED');process.exitCode=1;});
