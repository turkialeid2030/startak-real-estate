'use strict';
// Fetch public files only, without tokens or provider API. No writes to source tree.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {parsePublicRentCsv}=require('../src/reporting/public-rent-reference');
const ROOT='https://raw.githubusercontent.com/civillizard/Saudi-Real-Estate-Data/main/';
const OUT='runtime-evidence/rental-public-refresh';
const LIMIT=4*1024*1024;
const REGION='(?:AlBaha|AlJawf|AlQassim|Aseer|EP|Hail|Jazan|Madinah|Makkah|NB|Najran|Riyadh|Tabuk)';
const FILE_PATTERN='rega/quarterlies/rental/Rental-indicators-in-('+REGION+')(?:-region)?-([1-4])(?:st|nd|rd|th)-?Q-(20[0-9]{2})(?:E)?\\.csv';
const allowed=new RegExp('^'+FILE_PATTERN+'
async function get(relative){
 if(relative!=='data/registry_files.csv'&&!allowed.test(relative))throw Error('UNAPPROVED_PATH');
 const url=ROOT+relative,r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok||!r.body)throw Error('HTTP_'+r.status);
 let bytes=0;const chunks=[];
 for await(const chunk of r.body){bytes+=chunk.length;if(bytes>LIMIT)throw Error('SIZE_LIMIT');chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks);
}
async function main(){
 await fs.mkdir(OUT,{recursive:true});
 const registry=await get('data/registry_files.csv');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(registry);
 const re=new RegExp(FILE_PATTERN,'g');
 const latest=new Map(), periods=new Map();
 for(const m of text.matchAll(re)){
  const [,region,q,y]=m,key=region.toLowerCase(),rank=Number(y)*4+Number(q);
  const entry={file:m[0],rank,year:Number(y),quarter:Number(q)};
  if(!latest.has(key)||latest.get(key).rank<rank)latest.set(key,entry);
  const id=key+':'+y+':'+q;if(periods.has(id)&&periods.get(id).file!==entry.file)throw Error('DUPLICATE_PERIOD_PATH');periods.set(id,entry);
 }
 if(latest.size!==13||periods.size>260)throw Error('REGISTRY_SCOPE');
 const manifest={version:1,observedAt:new Date().toISOString(),publisher:'REGA (community mirror, not independently authenticated)',mirror:'https://github.com/civillizard/Saudi-Real-Estate-Data',licenseNotice:'https://github.com/civillizard/Saudi-Real-Estate-Data/blob/main/LICENSE-DATA-AR.md',status:'RESEARCH_ONLY',files:[],errors:[]};
 for(const [periodKey,entry] of periods){
  const region=periodKey.split(':')[0];
  try{
   const raw=await get(entry.file),rows=parsePublicRentCsv(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   if(!rows.every(r=>r.year===entry.year&&r.quarter===entry.quarter))throw Error('PERIOD_MISMATCH');
   const name=path.basename(entry.file);
   await fs.writeFile(path.join(OUT,name),raw);
   manifest.files.push({region,filename:name,url:ROOT+entry.file,sha256:crypto.createHash('sha256').update(raw).digest('hex'),rows:rows.length,year:entry.year,quarter:entry.quarter,vatBasis:'UNKNOWN'});
  }catch(e){manifest.errors.push({region,file:entry.file,error:e.message});}
 }
 await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('PUBLIC_RENT_REFRESH files='+manifest.files.length+' failures='+manifest.errors.length+' rows='+manifest.files.reduce((n,f)=>n+f.rows,0));
 if(!manifest.files.length||manifest.errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
);
async function get(relative){
 if(relative!=='data/registry_files.csv'&&!/^rega\/quarterlies\/rental\/Rental-indicators-in-[A-Za-z0-9-]+-region-[1-4](?:st|nd|rd|th)-Q-20\d{2}\.csv$/.test(relative))throw Error('UNAPPROVED_PATH');
 const url=ROOT+relative,r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok||!r.body)throw Error('HTTP_'+r.status);
 let bytes=0;const chunks=[];
 for await(const chunk of r.body){bytes+=chunk.length;if(bytes>LIMIT)throw Error('SIZE_LIMIT');chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks);
}
async function main(){
 await fs.mkdir(OUT,{recursive:true});
 const registry=await get('data/registry_files.csv');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(registry);
 const re=/rega\/quarterlies\/rental\/Rental-indicators-in-([A-Za-z0-9-]+)-region-([1-4])(?:st|nd|rd|th)-Q-(20\d{2})\.csv/g;
 const latest=new Map();
 for(const m of text.matchAll(re)){
  const [,region,q,y]=m,key=region.toLowerCase(),rank=Number(y)*4+Number(q);
  if(!latest.has(key)||latest.get(key).rank<rank)latest.set(key,{file:m[0],rank,year:Number(y),quarter:Number(q)});
 }
 if(!latest.size||latest.size>30)throw Error('REGISTRY_SCOPE');
 const manifest={version:1,observedAt:new Date().toISOString(),publisher:'REGA (community mirror, not independently authenticated)',mirror:'https://github.com/civillizard/Saudi-Real-Estate-Data',licenseNotice:'https://github.com/civillizard/Saudi-Real-Estate-Data/blob/main/LICENSE-DATA-AR.md',status:'RESEARCH_ONLY',files:[],errors:[]};
 for(const [region,entry] of latest){
  try{
   const raw=await get(entry.file),rows=parsePublicRentCsv(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   if(!rows.every(r=>r.year===entry.year&&r.quarter===entry.quarter))throw Error('PERIOD_MISMATCH');
   const name=path.basename(entry.file);
   await fs.writeFile(path.join(OUT,name),raw);
   manifest.files.push({region,filename:name,url:ROOT+entry.file,sha256:crypto.createHash('sha256').update(raw).digest('hex'),rows:rows.length,year:entry.year,quarter:entry.quarter,vatBasis:'UNKNOWN'});
  }catch(e){manifest.errors.push({region,file:entry.file,error:e.message});}
 }
 await fs.writeFile(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('PUBLIC_RENT_REFRESH files='+manifest.files.length+' failures='+manifest.errors.length+' rows='+manifest.files.reduce((n,f)=>n+f.rows,0));
 if(!manifest.files.length||manifest.errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
