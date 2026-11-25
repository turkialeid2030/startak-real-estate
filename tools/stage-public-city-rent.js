'use strict';
const fs=require('node:fs/promises'),crypto=require('node:crypto');
const {parseCityRent}=require('../src/reporting/public-city-rent');
const config=require('../docs/reporting/public-city-rent-source-manifest.json');
const root='https://raw.githubusercontent.com/civillizard/Saudi-Real-Estate-Data/main/';
const out='runtime-evidence/public-city-rent';
async function get(f){
 if(!/^rega\/Rental-indicators-for-[A-Za-z-]+\.csv$/i.test(f.sourcePath)||!/^[a-f0-9]{40}$/.test(f.gitBlobSha))throw Error('CITY_SOURCE_PATH');
 const response=await fetch(root+f.sourcePath,{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok||!response.body)throw Error('HTTP_'+response.status);
 let bytes=0;const chunks=[];for await(const c of response.body){bytes+=c.length;if(bytes>4*1024*1024)throw Error('CITY_SOURCE_SIZE');chunks.push(Buffer.from(c));}
 const raw=Buffer.concat(chunks),sha=crypto.createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
 if(sha!==f.gitBlobSha)throw Error('CITY_SOURCE_REVISION_REVIEW');
 const rows=parseCityRent(new TextDecoder('utf-8',{fatal:true}).decode(raw),f.region);
 if(rows.length!==f.expectedRows)throw Error('CITY_SOURCE_COUNT');
 return {rows,sha256:crypto.createHash('sha256').update(raw).digest('hex')};
}
async function main(){
 if(config.files.length!==13||new Set(config.files.map(f=>f.region)).size!==13)throw Error('CITY_CATALOG');
 await fs.mkdir(out,{recursive:true});
 const files=[],errors=[],observations=[];
 for(const f of config.files){try{const r=await get(f);files.push({...f,rows:r.rows.length,sha256:r.sha256});observations.push(...r.rows.map(x=>({...x,sourcePath:f.sourcePath,sourceGitBlobSha:f.gitBlobSha})));}catch(e){errors.push({sourcePath:f.sourcePath,error:e.message});}}
 const manifest={version:1,scope:'CITY_AGGREGATE',status:errors.length?'INCOMPLETE':'RESEARCH_ONLY',observedAt:new Date().toISOString(),sourceSpecificRightsVerified:false,files,errors,rows:observations.length,ownerApprovalRequired:false,financialInputEligible:false};
 await fs.writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 // Keep the staged normalized observations outside the application public tree.
 if(!errors.length)await fs.writeFile(out+'/observations.json',JSON.stringify(observations)+'\n');
 console.log('PUBLIC_CITY_RENT '+JSON.stringify({files:files.length,errors,rows:observations.length}));
 if(errors.length||observations.length!==19954)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
