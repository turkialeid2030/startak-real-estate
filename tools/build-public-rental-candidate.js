'use strict';
// Build an append-only candidate from retrieved, validated public files.
// No changes to the deployed bundle; a separate controlled PR promotes it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parsePublicRentCsv}=require('../src/reporting/public-rent-reference');
const {splitKnownMixed}=require('./split-public-rental-period');
const REGIONS={albaha:'الباحة',aljawf:'الجوف',alqassim:'القصيم',aseer:'عسير',ep:'المنطقة الشرقية',hail:'حائل',jazan:'جازان',madinah:'المدينة المنورة',makkah:'مكة المكرمة',nb:'الحدود الشمالية',najran:'نجران',riyadh:'الرياض',tabuk:'تبوك'};
const norm=s=>s.trim().replace(/[أإآٱ]/g,'ا').replace(/ه$/,'ة').replace(/\s+/g,' ');
const key=f=>f.region.toLowerCase()+':'+f.year+':'+f.quarter;
const blob=b=>crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const fileName=/^[A-Za-z0-9-]+\.csv$/;
function evidencePaths(dir,f){
 const d=f.derivation;if(!d)return null;
 if(d.method!=='EXACT_PERIOD_ROW_FILTER_V1'||!/^rega\/quarterlies\/rental\/Rental-indicators-in-[A-Za-z0-9-]+\.csv$/.test(d.overlapSourcePath))throw Error('CANDIDATE_DERIVATION_INVALID');
 const original='raw-'+path.basename(f.sourcePath),reference='reference-'+path.basename(d.overlapSourcePath);
 const resolve=(name,source)=>fs.existsSync(path.join(dir,name))?path.join(dir,name):path.join(dir,'originals',path.basename(source));
 return {original,reference,originalPath:resolve(original,f.sourcePath),referencePath:resolve(reference,d.overlapSourcePath)};
}
function validate(dir,manifest,complete=false){
 if(manifest.version!==1||!Array.isArray(manifest.files)||manifest.files.length<1||manifest.files.length>260||manifest.errors?.length)throw Error('CANDIDATE_MANIFEST_INVALID');
 const ids=new Set(),names=new Set(),regions=new Set();
 for(const f of manifest.files){
  if(!f||typeof f.region!=='string'||!Object.hasOwn(REGIONS,f.region.toLowerCase())||!fileName.test(f.filename)||!/^rega\/quarterlies\/rental\/Rental-indicators-in-[A-Za-z0-9-]+\.csv$/.test(f.sourcePath)||!Number.isInteger(f.year)||f.year<2000||f.year>2099||![1,2,3,4].includes(f.quarter)||!Number.isSafeInteger(f.rows)||f.rows<1||!/^[a-f0-9]{40}$/.test(f.gitBlobSha)||ids.has(key(f))||names.has(f.filename))throw Error('CANDIDATE_ENTRY_INVALID');
  const raw=fs.readFileSync(path.join(dir,f.filename));
  if(raw.length>4*1024*1024||blob(raw)!==f.gitBlobSha)throw Error('CANDIDATE_DIGEST_MISMATCH');
  if(f.sha256&&crypto.createHash('sha256').update(raw).digest('hex')!==f.sha256)throw Error('CANDIDATE_DIGEST_MISMATCH');
  if(f.derivation){
   const ep=evidencePaths(dir,f),original=fs.readFileSync(ep.originalPath),reference=fs.readFileSync(ep.referencePath);
   if(original.length>4*1024*1024||reference.length>4*1024*1024)throw Error('CANDIDATE_DERIVATION_SIZE');
   const replay=splitKnownMixed(original,reference,f.region.toLowerCase(),f.year,f.quarter);
   if(!replay.derived.equals(raw)||Object.entries(replay.provenance).some(([k,v])=>f.derivation[k]!==v))throw Error('CANDIDATE_DERIVATION_MISMATCH');
  }
  const rows=parsePublicRentCsv(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(rows.length!==f.rows||!rows.every(r=>r.year===f.year&&r.quarter===f.quarter&&norm(r.region)===norm(REGIONS[f.region.toLowerCase()])))throw Error('CANDIDATE_SCOPE_MISMATCH');
  ids.add(key(f));names.add(f.filename);regions.add(f.region.toLowerCase());
 }
 if(complete&&regions.size!==13)throw Error('CANDIDATE_COVERAGE_INCOMPLETE');
 return manifest;
}
function plan(existing,retrieved){
 const merged=new Map(existing.files.map(f=>[key(f),{entry:f,origin:'existing'}]));
 let added=0;
 for(const f of retrieved.files){
  const old=merged.get(key(f));
  if(old){if(old.entry.gitBlobSha!==f.gitBlobSha)throw Error('CANDIDATE_REVISED_PERIOD_REVIEW:'+key(f));continue;}
  merged.set(key(f),{entry:f,origin:'retrieved'});added++;
 }
 const result=[...merged.values()].sort((a,b)=>key(a.entry).localeCompare(key(b.entry)));
 if(new Set(result.map(r=>r.entry.filename)).size!==result.length||result.length>260)throw Error('CANDIDATE_FILENAME_COLLISION');
 return {result,added};
}
function build(existingDir,retrievedDir,out){
 const read=dir=>JSON.parse(fs.readFileSync(path.join(dir,'rental-manifest.json'),'utf8'));
 const existing=validate(existingDir,read(existingDir)),retrieved=validate(retrievedDir,read(retrievedDir),true);
 const {result,added}=plan(existing,retrieved);
 if(fs.existsSync(out))throw Error('CANDIDATE_OUTPUT_EXISTS');
 fs.mkdirSync(out,{recursive:true});
 for(const {entry,origin} of result){
  const dir=origin==='existing'?existingDir:retrievedDir;
  fs.copyFileSync(path.join(dir,entry.filename),path.join(out,entry.filename),fs.constants.COPYFILE_EXCL);
  if(entry.derivation){const ep=evidencePaths(dir,entry);fs.copyFileSync(ep.originalPath,path.join(out,ep.original),fs.constants.COPYFILE_EXCL);fs.copyFileSync(ep.referencePath,path.join(out,ep.reference),fs.constants.COPYFILE_EXCL);}
 }
 const manifest={version:1,observedDate:added?retrieved.observedDate:existing.observedDate,publisher:existing.publisher,mirror:existing.mirror,licenseNotice:existing.licenseNotice,files:result.map(r=>r.entry)};
 fs.writeFileSync(path.join(out,'rental-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 validate(out,manifest,true);
 return {added,files:manifest.files.length,rows:manifest.files.reduce((n,f)=>n+f.rows,0)};
}
if(require.main===module){try{const r=build('public/market-data','runtime-evidence/rental-public-refresh','runtime-evidence/rental-candidate');console.log('PUBLIC_RENT_CANDIDATE=PASS '+JSON.stringify(r));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={validate,plan,build};
