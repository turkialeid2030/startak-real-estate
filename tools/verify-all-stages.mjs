import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {verifyDeployedAssets} from './verify-deployed-assets.mjs';
import {validatedProtectedPreviewUrl} from './verify-protected-preview.mjs';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const REQUIRED=Object.freeze(['release','reference','reference-clean','market-browser','appraisal-browser','identity-browser','dated-browser','sectors-browser','owner-browser','export-browser','cross-browser','ocr-browser','document-tables-browser','locale-browser']);

export function summarize({sha,checks,observations,requestCount}){
 if(!/^[a-f0-9]{40}$/.test(sha)||!Array.isArray(checks)||requestCount!==36)throw Error('BATCH_EVIDENCE_INVALID');
 const ids=new Set(checks.map(x=>x.id));
 if(ids.size!==checks.length||checks.some(x=>!REQUIRED.includes(x.id)||!['PASS','FAIL'].includes(x.status)))throw Error('BATCH_CHECK_INVALID');
 const engineering=REQUIRED.every(id=>checks.find(x=>x.id===id)?.status==='PASS');
 const preview=observations.find(x=>x.id==='preview');
 const stages=[
  {id:'ENGINEERING_D01_D02_D03_D06_D07',status:engineering?'PASS':'FAIL',reason:engineering?'ALL_REQUIRED_CHECKS_PASSED':'FAILED_OR_MISSING_CHECK'},
  {id:'D04',status:'PARTIAL',reason:'REGISTERED_MATRIX_DOES_NOT_COVER_ALL_POSSIBLE_PLATFORM_STATES',registeredMatrixStatus:checks.find(x=>x.id==='locale-browser')?.status||'NOT_TESTED',coverageScope:'REGISTERED_RENDERED_UI_MATRIX_NOT_ALL_POSSIBLE_STATES'},
  {id:'D05',status:'PARTIAL',reason:'DATED_ARITHMETIC_TESTED_ACTUAL_CONTRACT_DATES_AND_INDEPENDENT_REVIEW_MISSING'},
  {id:'MARKET_DATA',status:'BLOCKED',reason:'LICENSED_EXECUTED_SALE_HOLDOUT_AND_INDEPENDENT_REVIEW_NOT_PROVIDED'},
  {id:'LIVE_AI',status:'BLOCKED',reason:'ACTUAL_PROVIDER_USAGE_RECEIPT_AND_INDEPENDENT_BENCHMARK_NOT_PROVIDED'},
  {id:'TENANT_ISOLATION',status:'BLOCKED',reason:'TWO_AUTHENTICATED_TENANTS_AND_DEPLOYED_ISOLATION_EVIDENCE_NOT_PROVIDED'},
  {id:'PROFESSIONAL_REVIEW',status:'BLOCKED',reason:'INDEPENDENT_LICENSED_FINANCIAL_SECURITY_AND_LEGAL_SIGNOFF_NOT_PROVIDED'},
  {id:'PREVIEW_DELIVERY',status:preview?.status==='PASS'?'PASS':'BLOCKED',reason:preview?.reason||'NOT_OBSERVED'},
  {id:'PRODUCTION',status:'BLOCKED',reason:'FULL_QUALIFICATION_NOT_ESTABLISHED_PR_UNMERGED'},
 ];
 return {schemaVersion:1,sourceCommit:sha,engineeringStatus:engineering?'PASS':'FAIL',decision:'HOLD / NOT_AUTHORIZED',
  exitCode:engineering?2:1,stages,checks,observations,externalEvidenceInput:'NOT_PROVIDED',requiredEvidenceCount:requestCount,
  independentlyApprovedCount:0,requestsSent:0,transactionAuthorized:false,professionalAppraisalAuthorized:false,productionAuthorized:false};
}
export async function observeEndpoint(id,url,fetchImpl=fetch){
 try{
  const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});
  const httpStatus=response.status;await response.body?.cancel();
  return {id,httpStatus,status:'BLOCKED',reason:[301,302,303,307,308,401,403].includes(httpStatus)?'ACCESS_OR_AUTHENTICATION_REQUIRED':'HTTP_RESPONSE_IS_NOT_QUALIFICATION_EVIDENCE'};
 }catch{return {id,status:'BLOCKED',reason:'ENDPOINT_NOT_OBSERVABLE'};}
}
export function markdown(report){
 return ['# STARTAK — نتيجة فحص جميع المسارات في دفعة واحدة','',`المصدر: \`${report.sourceCommit}\``,
  `النتيجة الهندسية: **${report.engineeringStatus}**. قرار الاستخدام المعتمد: **${report.decision}**.`,
  '', '| المسار | الحالة | سبب النتيجة |','|---|---|---|',
  ...report.stages.map(s=>`| ${s.id} | ${s.status} | ${s.reason} |`),
  '',`الأدلة الخارجية المطلوبة: ${report.requiredEvidenceCount}؛ المعتمد مستقلاً: 0؛ الطلبات المرسلة: 0.`,
  '', 'تُشغّل الدفعة جميع الفحوص دون توقف عند أول فشل. نجاح الحساب والمتصفح لا يثبت أصالة المصدر أو اعتمادًا مهنيًا أو تشغيل ذكاء حي أو عزل مستخدمين فعليًا.',
  '', '| الفحص المنفذ | الحالة |','|---|---|',...report.checks.map(c=>`| ${c.id} | ${c.status} |`),''].join('\n');
}
async function command(id,cmd,args,outDir){
 const file=path.join(outDir,id+'.log'),stream=createWriteStream(file);let bytes=0,overflow=false,writeFailed=false;
 stream.on('error',()=>{writeFailed=true;});
 const child=spawn(cmd,args,{cwd:root,env:process.env,stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>child.kill('SIGTERM'),20*60*1000);
 const capture=data=>{bytes+=data.length;if(bytes<=4*1024*1024)stream.write(data);else{overflow=true;child.kill('SIGTERM');}};
 child.stdout.on('data',capture);child.stderr.on('data',capture);
 const code=await new Promise(resolve=>{child.once('error',()=>resolve(-1));child.once('close',code=>resolve(code));});
 clearTimeout(timer);await new Promise(resolve=>{stream.end(resolve);if(stream.destroyed)resolve();});
 const status=code===0&&!overflow&&!writeFailed?'PASS':'FAIL';console.log(id+'='+status);
 // Keep failed synthetic CI checks inspectable through the job log as well as
 // the artifact. Bound output and prefix each line so test text cannot become
 // a GitHub workflow command. No credentials are supplied to these PR checks.
 if(status==='FAIL'){
  try{
   const tail=(await fs.readFile(file,'utf8')).slice(-16000).replace(/\x1b\[[0-9;]*m/g,'');
   for(const line of tail.split(/\r?\n/))console.log('diagnostic['+id+'] '+line.replace(/[\r\u0000]/g,' '));
  }catch{console.log('diagnostic['+id+'] LOG_UNAVAILABLE');}
 }
 return {id,status,exitCode:code,outputLimitExceeded:overflow,logFile:path.basename(file)};
}
async function execute(){
 const args=process.argv.slice(2);
 if(args.some(a=>!a.startsWith('--out-dir=')&&!a.startsWith('--preview-url='))||new Set(args.map(a=>a.split('=')[0])).size!==args.length)throw Error('BATCH_ARGUMENTS_INVALID');
 const outDir=path.resolve(args.find(a=>a.startsWith('--out-dir='))?.slice(10)||'/tmp/startak-one-batch');
 const url=validatedProtectedPreviewUrl(args.find(a=>a.startsWith('--preview-url='))?.slice(14)||'https://feature-audit-findings-d01-d.startak-real-estate.pages.dev/');
 const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(process.env.STARTAK_SOURCE_COMMIT&&process.env.STARTAK_SOURCE_COMMIT!==sha)throw Error('BATCH_SOURCE_MISMATCH');
 await fs.mkdir(outDir,{recursive:true});const checks=[];
 checks.push(await command('release','npm',['run','release:verify'],outDir));
 checks.push(await command('reference','python3',['tests/reference/build_d05_monthly_reference.py'],outDir));
 checks.push(await command('reference-clean','git',['diff','--exit-code','--','tests/reference/D05-monthly-reference.json'],outDir));
 for(const [id,file] of [['market-browser','run_location_market_study_ci.mjs'],['appraisal-browser','run_appraisal_assurance_ci.mjs'],['identity-browser','run_audit_d06_d07_ci.mjs'],['dated-browser','run_d05_dated_research_ci.mjs']])checks.push(await command(id,'node',['tests/e2e/'+file],outDir));
 const {preview}=await import('vite');let server;
 try{
  server=await preview({preview:{host:'127.0.0.1',port:4173,strictPort:true}});
  process.env.STARTAK_E2E_URL='http://127.0.0.1:4173';
  for(const [id,file] of [['sectors-browser','run_all_13_asset_classes_public_smoke.js'],['owner-browser','run_audit_20261010_f03_f07_browser.js'],['export-browser','run_c75_real_chromium_personal_study.js'],['cross-browser','run_audit_20261010_remaining_browser.js'],['ocr-browser','run_audit_20261020_local_ocr_browser.js'],['document-tables-browser','run_audit_20261021_document_tables_browser.js']])checks.push(await command(id,'node',['tests/e2e/'+file],outDir));
 }catch{for(const id of ['sectors-browser','owner-browser','export-browser','cross-browser','ocr-browser','document-tables-browser'])if(!checks.some(c=>c.id===id))checks.push({id,status:'FAIL',reason:'LOCAL_PREVIEW_UNAVAILABLE'});}
 finally{if(server)await new Promise(resolve=>server.httpServer.close(resolve));}
 checks.push(await command('locale-browser','node',['tests/e2e/run_d04_locale_matrix_ci.mjs'],outDir));
 const observations=[];
 const previewObservation=await observeEndpoint('preview',url);
 if(previewObservation.httpStatus===200){try{const assets=await verifyDeployedAssets({url,expectedSha:sha});previewObservation.status=assets.status==='PASS'?'PASS':'BLOCKED';previewObservation.reason=assets.status==='PASS'?'EXACT_SOURCE_AND_ASSET_HASHES_VERIFIED':'CDN_NOT_VERIFIED';}catch{previewObservation.reason='EXACT_SOURCE_OR_ASSET_HASHES_NOT_VERIFIED';}}
 observations.push(previewObservation);
 for(const [id,route] of [['ai-config','api/riai/public-config'],['ai-assist-method-guard','api/riai/ai-assist']])observations.push(await observeEndpoint(id,new URL(route,url).href));
 const pack=require('./qcr-evidence-acquisition.js').execute([]);
 await fs.writeFile(path.join(outDir,'external-evidence-requests.json'),JSON.stringify(pack,null,2)+'\n');
 const report=summarize({sha,checks,observations,requestCount:pack.requestCount});
 await fs.writeFile(path.join(outDir,'all-stages.json'),JSON.stringify(report,null,2)+'\n');
 const md=markdown(report);await fs.writeFile(path.join(outDir,'all-stages.md'),md);
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,md);
 console.log('ALL_STAGES_ENGINEERING='+report.engineeringStatus);console.log('ALL_STAGES_DECISION=HOLD_NOT_AUTHORIZED');process.exitCode=report.exitCode;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)execute().catch(()=>{console.error('ALL_STAGES_EXECUTION_FAILED');process.exitCode=1;});
