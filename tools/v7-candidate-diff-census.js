'use strict';
// Exact tree-to-tree diff, not a capped REST compare or a history/secret scan.
// No filename or source content is printed; digest binds raw NUL-delimited diff.
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {TextDecoder}=require('node:util');
const SHA=/^[a-f0-9]{40}$/;
function parseNameStatus(raw){
 if(!Buffer.isBuffer(raw)||raw.length>64*1024*1024)throw Error('DIFF_BUFFER_INVALID');
 if(raw.length===0)return [];
 if(raw.at(-1)!==0)throw Error('DIFF_NOT_NUL_TERMINATED');
 const parts=new TextDecoder('utf-8',{fatal:true}).decode(raw).split('\0');parts.pop();
 if(parts.length%2!==0)throw Error('DIFF_RECORD_SHAPE_INVALID');
 const seen=new Set(),rows=[];
 for(let i=0;i<parts.length;i+=2){
  const [status,path]=parts.slice(i,i+2);
  if(!['A','D','M','T'].includes(status)||!path||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..')||seen.has(path))throw Error('DIFF_RECORD_INVALID');
  seen.add(path);rows.push({status,path});
 }
 return rows;
}
function category(p){
 if(p.startsWith('.github/'))return 'automation';
 if(p.startsWith('tests/'))return 'tests';
 if(p.startsWith('tools/'))return 'tools';
 if(p.startsWith('docs/')||p.startsWith('governance/'))return 'governance_docs';
 if(p.startsWith('src/'))return 'source';
 return 'other';
}
function summarize(raw,base,head){
 if(!SHA.test(base)||!SHA.test(head))throw Error('EXACT_COMMIT_REQUIRED');
 const rows=parseNameStatus(raw),byStatus={A:0,D:0,M:0,T:0},byCategory={automation:0,tests:0,tools:0,governance_docs:0,source:0,other:0};
 for(const x of rows){byStatus[x.status]++;byCategory[category(x.path)]++;}
 return {base,head,changedPaths:rows.length,byStatus,byCategory,diffSha256:createHash('sha256').update(raw).digest('hex'),scope:'EXACT_TREE_PATH_DIFF_NO_RENAMES',ancestryVerified:false,contentReviewed:false,secretScanVerified:false,releaseAuthorized:false};
}
function census(base,head,cwd=process.cwd()){
 if(!SHA.test(base)||!SHA.test(head))throw Error('EXACT_COMMIT_REQUIRED');
 const git=args=>execFileSync('git',args,{cwd,maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
 for(const sha of [base,head])if(git(['rev-parse','--verify',sha+'^{commit}']).toString().trim()!==sha)throw Error('COMMIT_MISMATCH');
 const raw=git(['-c','core.quotePath=false','diff','--no-ext-diff','--no-textconv','--no-renames','--name-status','-z',base,head,'--']);
 return summarize(raw,base,head);
}
if(require.main===module){try{if(process.argv.length!==4)throw Error('EXACT_COMMIT_REQUIRED');console.log('V7_CANDIDATE_DIFF_CENSUS='+JSON.stringify(census(process.argv[2],process.argv[3])));}catch{console.error('V7_CANDIDATE_DIFF_CENSUS=FAIL');process.exitCode=1;}}
module.exports={parseNameStatus,summarize,census};
