'use strict';
// Independent public catalog discovery; do not log in, bypass restrictions or assume licensing.
const fs=require('node:fs/promises'),crypto=require('node:crypto');
const config=require('../docs/reporting/official-market-source-catalog.json');
const OUT='runtime-evidence/official-market-discovery';
const allowed=(raw,s,base=s.catalog)=>{try{const u=new URL(raw,base);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&s.hosts.includes(u.hostname)?u:null;}catch{return null;}};
const decode=s=>s.replace(/&amp;/gi,'&').replace(/&#38;/g,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'");
function findFiles(html,s){
 const links=new Set(s.seeds||[]),match=new RegExp(s.match,'i');
 for(const m of html.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi)){
  const h=m[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);if(!h)continue;
  const u=allowed(decode(h[1]??h[2]),s);if(!u)continue;
  let p;try{p=decodeURIComponent(u.pathname);}catch{continue;}
  const type=s.format.find(ext=>new RegExp('\\.'+ext+'(?:_|/|$)','i').test(p));
  if(type&&match.test(p+' '+m[2].replace(/<[^>]*>/g,' ')))links.add(u.href);
 }
 return [...links].map(x=>allowed(x,s)).filter(Boolean).map(u=>u.href).slice(0,30);
}
async function get(url,s,limit){
 let u=allowed(url,s);if(!u)throw Error('SOURCE_HOST_DENIED');
 for(let n=0;n<4;n++){
  const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'Startak-Research-Catalog/1.0'}});
  if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');await r.body?.cancel();if(!location||(u=allowed(location,s,u.href))===null)throw Error('SOURCE_REDIRECT_DENIED');continue;}
  if(!r.ok||!r.body)throw Error('HTTP_'+r.status);
  let len=0;const chunks=[];for await(const chunk of r.body){len+=chunk.length;if(len>limit)throw Error('SOURCE_SIZE');chunks.push(Buffer.from(chunk));}
  return {bytes:Buffer.concat(chunks),url:u.href,type:r.headers.get('content-type')||''};
 }
 throw Error('SOURCE_REDIRECT_LIMIT');
}
function identify(buf){
 if(buf.subarray(0,5).toString()==='%PDF-')return 'PDF';
 if(buf.subarray(0,4).equals(Buffer.from([80,75,3,4])))return 'ZIP_CONTAINER_UNVERIFIED';
 if(buf.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225])))return 'OLE_CONTAINER_UNVERIFIED';
 const t=buf.subarray(0,4096).toString('utf8');
 if(/^\s*(?:<!doctype|<html|<\?xml|<script|{)/i.test(t))return null;
 if(t.includes(',')&&t.includes('\n')&&!t.includes('\0'))return 'CSV_CANDIDATE';
 return null;
}
async function inspect(s){
 const result={id:s.id,publisher:s.publisher,scope:s.scope,catalog:s.catalog,observedAt:new Date().toISOString(),catalogStatus:'UNAVAILABLE',links:[],files:[],errors:[],normalizedRecords:0,propertyEstimateEligible:false};
 let html='';
 try{const r=await get(s.catalog,s,4*1024*1024);html=r.bytes.toString('utf8');result.catalogStatus='RETRIEVED';}catch(e){result.errors.push({stage:'catalog',error:e.message});}
 result.links=findFiles(html,s);
 // Probe only two official linked files per source each run, with strict byte bounds.
 for(const url of result.links.slice(0,2)){
  try{const r=await get(url,s,20*1024*1024),kind=identify(r.bytes);if(!kind)throw Error('FILE_SIGNATURE_UNKNOWN');
   result.files.push({url:r.url,kind,bytes:r.bytes.length,sha256:crypto.createHash('sha256').update(r.bytes).digest('hex'),status:'RETRIEVED_NOT_NORMALIZED',rights:'NOT_INFERRED',financialInputEligible:false});
  }catch(e){result.errors.push({stage:'file',url,error:e.message});}
 }
 return result;
}
async function main(){
 await fs.mkdir(OUT,{recursive:true});
 const results=await Promise.all(config.sources.map(inspect));
 const report={version:1,observedAt:new Date().toISOString(),results,sourceCount:results.length,reachableCatalogs:results.filter(x=>x.catalogStatus==='RETRIEVED').length,retrievedFiles:results.reduce((n,x)=>n+x.files.length,0),normalizedRecords:0,ownerApprovalRequired:false};
 await fs.writeFile(OUT+'/manifest.json',JSON.stringify(report,null,2)+'\n');
 console.log('OFFICIAL_MARKET_DISCOVERY '+JSON.stringify(report));
 if(!report.reachableCatalogs&&!report.retrievedFiles)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={allowed,findFiles,identify};
