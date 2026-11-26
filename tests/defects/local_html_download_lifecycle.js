'use strict';
const assert=require('node:assert/strict');
const {dispatchLocalHtmlDownload,DOWNLOAD_GRACE_MS}=require('../../src/reporting/local-html-download');
function fixture(fail=''){
 const events=[],timers=[];
 const anchor={click(){events.push('click');if(fail==='click')throw Error('click');},remove(){events.push('remove');}};
 const env={Blob,URL:{createObjectURL(blob){events.push('create');assert.equal(blob.type,'text/html;charset=utf-8');return 'blob:synthetic';},revokeObjectURL(url){assert.equal(url,'blob:synthetic');events.push('revoke');}},
 document:{createElement(){if(fail==='element')throw Error('element');return anchor;},body:{appendChild(){events.push('append');if(fail==='append')throw Error('append');}}},
 setTimeout(fn,ms){if(fail==='timer')throw Error('timer');timers.push({fn,ms});}};
 return {events,timers,anchor,env};
}
let checks=0;const check=fn=>{fn();checks++;};
const f=fixture();
const result=dispatchLocalHtmlDownload('<html>synthetic</html>','startak-test.html',f.env);
check(()=>assert.deepEqual(f.events,['create','append','click']));
check(()=>assert.equal(f.anchor.href,'blob:synthetic'));
check(()=>assert.equal(f.anchor.download,'startak-test.html'));
check(()=>assert.equal(f.anchor.hidden,true));
check(()=>assert.equal(result.downloadConfirmed,false));
check(()=>assert.equal(f.timers.length,1));
check(()=>assert.equal(f.timers[0].ms,DOWNLOAD_GRACE_MS));
f.timers[0].fn();f.timers[0].fn();
check(()=>assert.deepEqual(f.events,['create','append','click','remove','revoke']));
for(const stage of ['element','append','click','timer']){
 const x=fixture(stage);
 check(()=>assert.throws(()=>dispatchLocalHtmlDownload('html','report.html',x.env),new RegExp(stage)));
 check(()=>assert.equal(x.events.filter(e=>e==='revoke').length,1));
 check(()=>assert.equal(x.timers.length,0));
}
const x=fixture();
check(()=>assert.throws(()=>dispatchLocalHtmlDownload('html','../report.html',x.env),/INVALID/));
check(()=>assert.throws(()=>dispatchLocalHtmlDownload('','report.html',x.env),/INVALID/));
check(()=>assert.deepEqual(x.events,[]));
console.log('LOCAL_HTML_DOWNLOAD_LIFECYCLE=PASS checks='+checks);
