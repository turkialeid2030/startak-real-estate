'use strict';
// Evidence gate, not a recurring owner approval. No license claims inferred from a mirror.
const fs=require('node:fs');
const path=require('node:path');
const catalog='docs/reporting/public-rental-source-rights.json';
const candidate='runtime-evidence/rental-candidate/rental-manifest.json';
function assess(manifest,registry){
 const decisions=new Map((registry.datasets||[]).map(x=>[x.sourcePath,x]));
 const files=manifest.files||[];
 const missing=files.filter(f=>{const e=decisions.get(f.sourcePath);return !e||e.status!=='VERIFIED_OPEN_DATA'||e.sourceGitBlobSha!==(f.derivation?.sourceGitBlobSha||f.gitBlobSha)||typeof e.officialDatasetUrl!=='string'||!/^https:\/\/(?:[a-z0-9-]+\.)*gov\.sa\//i.test(e.officialDatasetUrl)||typeof e.licenseUrl!=='string'||!/^https:\/\/(?:[a-z0-9-]+\.)*gov\.sa\//i.test(e.licenseUrl)||!e.evidenceRef;});
 return {publishable:files.length>0&&missing.length===0,checked:files.length,unverified:missing.map(f=>f.sourcePath)};
}
if(require.main===module){try{const r=assess(JSON.parse(fs.readFileSync(candidate,'utf8')),JSON.parse(fs.readFileSync(catalog,'utf8')));console.log('PUBLIC_RENTAL_REUSE '+JSON.stringify(r));if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'publishable='+r.publishable+'\n');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={assess};
