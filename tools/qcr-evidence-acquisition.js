#!/usr/bin/env node
'use strict';
// Read-only release-external evidence request preparation. Does not dispatch requests.
const fs=require('node:fs');
const path=require('node:path');
const {makeAcquisitionPack}=require('../src/production-readiness/qcr-evidence-acquisition');
const root=path.join(__dirname,'..');
const program=JSON.parse(fs.readFileSync(path.join(root,'governance/qualification-90-day-program-20261027.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'governance/qcr-issue-registry-20261027.json'),'utf8'));
function execute(argv){
 if(!Array.isArray(argv)||argv.some(a=>!/^--as-of=\d{4}-\d{2}-\d{2}$/.test(a)&&a!=='--json'&&a!=='--markdown')
  ||argv.filter(a=>a.startsWith('--as-of=')).length>1
  ||argv.filter(a=>a==='--json'||a==='--markdown').length>1)
  throw Error('USAGE: node tools/qcr-evidence-acquisition.js [--as-of=YYYY-MM-DD] [--json|--markdown]');
 const today=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=type=>today.find(x=>x.type===type)?.value;
 const asOf=argv.find(a=>a.startsWith('--as-of='))?.slice(8)||
    [part('year'),part('month'),part('day')].join('-');
 return makeAcquisitionPack(program,registry,{asOf});
}
function markdown(pack){
 if(pack.status!=='REQUEST_PACK_READY_NOT_SENT')throw Error('INVALID_QCR_REQUESTS');
 const lines=[
  '# STARTAK — طلبات الأدلة الخارجية Q01–Q12 ('+pack.asOf+')',
  '',
  '**الحالة: HOLD / NOT_AUTHORIZED.** جرى إعداد نماذج الطلبات فقط؛ لم يتم إرسالها أو استلام أدلة أو إقرار مراجعين.',
  '',
  '| المسار | الدليل المطلوب | الدور المسؤول | الموعد المستهدف | التذكرة |',
  '|---|---|---|---|---|'
 ];
 for(const r of pack.requests)lines.push('| '+r.streamId+' | `'+r.evidenceType+'` | '+
  r.requestedFromRole+' | '+r.targetReviewDate+' | [المتابعة]('+r.issueUrl+') |');
 lines.push('','**الإجمالي:** '+pack.requestCount+' طلبات من '+pack.streamCount+
  ' مسارًا، المعتمد مستقلاً 0، المرسل فعليًا 0.','',
  'لا تضع مستندات العملاء أو الصكوك أو أسرار الوصول في GitHub. يجب إثبات المصدر والحقوق والتوقيع خارج هذه الحزمة.');
 return lines.join('\n')+'\n';
}
if(require.main===module){
 try{
  const pack=execute(process.argv.slice(2));
  if(pack.status!=='REQUEST_PACK_READY_NOT_SENT')throw Error((pack.errors||[]).join(','));
  process.stdout.write(process.argv.includes('--markdown')?markdown(pack):JSON.stringify(pack,null,2)+'\n');
 }catch(e){console.error('QCR_ACQUISITION=FAIL '+e.message);process.exitCode=2;}
}
module.exports={execute,markdown};
