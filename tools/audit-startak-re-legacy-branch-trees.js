#!/usr/bin/env node
'use strict';
// Read-only file-tree inventory of STARTAK REAL ESTATE historical refs.
// Does NOT execute legacy code, assume functional equivalence or export source bytes.
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const FILE='docs/recovery/STARTAK_RE_BRANCH_CENSUS_20261112.json';
const outPath='artifacts/startak-re-legacy-path-parity.json';
const census=JSON.parse(fs.readFileSync(FILE,'utf8'));
if(census.repository!=='turkialeid2030/startak-real-estate'||census.scope!=='STARTAK_REAL_ESTATE_ONLY')
 throw Error('REPOSITORY_SCOPE_MISMATCH');
function git(...args){return cp.execFileSync('git',args,{encoding:'buffer',maxBuffer:96*1024*1024,timeout:90000});}
const HEAD=git('rev-parse','HEAD').toString('utf8').trim();
function tree(ref){
 const raw=git('ls-tree','-r','-z',ref);
 const map=new Map();
 for(const item of raw.toString('utf8').split('\0')){
  if(!item)continue;
  const m=/^[0-7]{6} blob ([0-9a-f]{40})\t(.+)$/.exec(item);
  if(m)map.set(m[2],m[1]);
 }
 return map;
}
const current=tree('HEAD');
const byPath=new Map(),byBranch=[];
const classify=p=>{
 if(/^src\/components\//.test(p))return 'UI_COMPONENTS_FORMS_ICONS';
 if(/^src\/(?:ai|decision-intelligence)\//.test(p))return 'AI_INTELLIGENCE';
 if(/^src\/(?:operator|orchestration|simulation)\//.test(p))return 'OPERATIONS_SIMULATION';
 if(/^src\/(?:engines|scenario-risk|valuation-intelligence|assumptions|uncertainty)\//.test(p))return 'FINANCIAL_VALUATION';
 if(/^src\/(?:market|location|geospatial|zakat)\//.test(p))return 'MARKET_AND_LOCATION';
 if(/^src\/(?:storage|validation|contracts|evidence|documents)\//.test(p))return 'DATA_EVIDENCE_AND_STORAGE';
 if(/^functions\/api\//.test(p))return 'SERVER_APIS';
 if(/^public\//.test(p))return 'PUBLIC_ASSETS';
 if(/^tests\//.test(p))return 'TESTS';
 if(/^\.github\/workflows\//.test(p))return 'CI';
 return 'OTHER';
};
let reachable=0,missingRefs=0;
for(const {name} of census.branches){
 if(!/^[a-zA-Z0-9._\/-]+$/.test(name)||name.includes('..'))throw Error('INVALID_BRANCH_NAME_IN_CENSUS');
 const ref='refs/remotes/origin/'+name;
 let old,oldHead;
 try{oldHead=git('rev-parse','--verify',ref).toString('utf8').trim();old=tree(ref);}
 catch(e){missingRefs++;byBranch.push({name,state:'BRANCH_TREE_NOT_FETCHED',errorCode:'GIT_REF_UNAVAILABLE'});continue;}
 reachable++;
 const oldOnly=[],changed=[];let identical=0;
 for(const [p,sha] of old){
  const present=current.get(p);
  if(present===undefined){
   oldOnly.push(p);
   if(!byPath.has(p))byPath.set(p,{path:p,category:classify(p),sourceBranchNames:[],blobVariations:[]});
   const x=byPath.get(p);
   x.sourceBranchNames.push(name);
   if(!x.blobVariations.includes(sha))x.blobVariations.push(sha);
  }else if(present!==sha)changed.push(p);
  else identical++;
 }
 const kinds={};for(const p of oldOnly){const cat=classify(p);kinds[cat]=(kinds[cat]||0)+1;}
 byBranch.push({name,sourceHead:oldHead,sourcePaths:old.size,oldOnlyPathCount:oldOnly.length,sharedChangedPathCount:changed.length,sharedIdenticalPathCount:identical,oldOnlyCategories:kinds,comparisonState:'PATH_ONLY_REQUIRES_BEHAVIORAL_REVIEW'});
}
const candidates=[...byPath.values()].sort((a,b)=>b.sourceBranchNames.length-a.sourceBranchNames.length||a.path.localeCompare(b.path));
const sums={};
for(const c of candidates)sums[c.category]=(sums[c.category]||0)+1;
const result={
 schema:'STARTAK_RE_PATH_LEVEL_LEGACY_AUDIT_V1',repository:census.repository,
 currentSha:HEAD,runDate:new Date().toISOString(),
 totalCensusBranches:census.branches.length,branchesWithFetchedTrees:reachable,missingBranchTrees:missingRefs,
 currentPaths:current.size,legacyOnlyUniquePathCandidates:candidates.length,
 legacyOnlyPathCategoryCounts:sums,
 warnings:[
  'This is a comprehensive path-level inventory ONLY, NOT function, API, UI, model or tested parity.',
  'A file absent from current HEAD may have been renamed/reimplemented elsewhere; never equate with missing behavior.',
  'No source contents, credentials or real property documents are exported.',
  'Any 404/unfetched refs remain open and are never silently marked checked.',
  'Do not merge, publish, or activate anything based on file similarity.'
 ],
 byBranch,oldOnlyPathCandidates:candidates
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,JSON.stringify(result,null,2));
console.log('STARTAK_RE_LEGACY_TREE_AUDIT=COMPLETE');
console.log('CENSUS_BRANCHES='+census.branches.length);
console.log('FETCHED_BRANCH_TREES='+reachable);
console.log('UNFETCHED_BRANCH_TREES='+missingRefs);
console.log('LEGACY_ONLY_PATH_CANDIDATES='+candidates.length);
console.log('CURRENT_PATHS='+current.size);
console.log('ALL_BRANCH_FUNCTIONAL_PARITY=NOT_PROVEN');
if(missingRefs>0)process.exitCode=2;
