import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// Read-only, fail-closed check immediately before provider publication. It is
// not an atomic transaction between GitHub and the deployment provider.
export function verifyProductionTarget({repository,expectedSha,readRemote}={}){
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository||'')||repository.split('/').some(p=>p==='.'||p==='..'))throw Error('PRODUCTION_REPOSITORY_REQUIRED');
 if(!/^[a-f0-9]{40}$/.test(expectedSha||''))throw Error('PRODUCTION_EXACT_SHA_REQUIRED');
 let output;
 try{output=(readRemote||(()=>execFileSync('git',['ls-remote','https://github.com/'+repository+'.git','refs/heads/main'],{encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']})))();}
 catch{throw Error('PRODUCTION_MAIN_UNAVAILABLE');}
 const lines=String(output).trim().split(/\r?\n/);
 if(lines.length!==1||!/^([a-f0-9]{40})\s+refs\/heads\/main$/.test(lines[0]))throw Error('PRODUCTION_MAIN_RESPONSE_INVALID');
 const observed=lines[0].split(/\s+/)[0];
 if(observed!==expectedSha)throw Error('PRODUCTION_MAIN_MOVED');
 return {expectedSha,observedSha:observed,repository};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=name=>process.argv[process.argv.indexOf(name)+1];
 try{const r=verifyProductionTarget({repository:arg('--repository'),expectedSha:arg('--expected-sha')});console.log('PRODUCTION_TARGET_RECHECK=PASS sha='+r.expectedSha);}
 catch(e){console.error('PRODUCTION_TARGET_RECHECK=FAIL '+e.message);process.exitCode=1;}
}
