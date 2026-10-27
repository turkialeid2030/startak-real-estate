#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {board}=require('../src/production-readiness/qualification-execution-board');
const root=path.join(__dirname,'..');
const program=JSON.parse(fs.readFileSync(path.join(root,'governance/qualification-90-day-program-20261027.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'governance/qcr-issue-registry-20261027.json'),'utf8'));
const args=process.argv.slice(2);
if(args.some(x=>!x.startsWith('--as-of=')&&!['--json','--markdown'].includes(x))||args.filter(x=>x.startsWith('--as-of=')).length>1||args.includes('--json')&&args.includes('--markdown')){
 console.error('Usage: node tools/qcr-execution-board.js [--as-of=YYYY-MM-DD] [--json|--markdown]');
 process.exit(2);
}
const today=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const part=x=>today.find(y=>y.type===x)?.value;
const asOf=args.find(x=>x.startsWith('--as-of='))?.slice(8)||`${part('year')}-${part('month')}-${part('day')}`;
const result=board(program,registry,{asOf});
if(result.status!=='HOLD_NOT_AUTHORIZED'){console.error('QCR_BOARD_INVALID: '+result.errors.join(','));process.exit(2)}
if(args.includes('--markdown')){
 console.log(`# ستارتك — متابعة التأهيل Q01–Q12 (${result.asOf})\n\n**القرار: HOLD / NOT_AUTHORIZED**. ترتيب المهام لا يمثل اعتمادًا مهنيًا ولا إذن بيانات.\n`);
 console.log('| المهمة | المسؤول بالدور | الاستحقاق المستهدف | وصف الأدلة غير المحققة | الإغلاق |\n|---|---|---|---:|---:|');
 for(const r of result.rows)console.log(`| [${r.id}](${r.issueUrl}) ${r.titleAr} | ${r.responsibleRole} | ${r.targetDate} | ${r.evidenceSlots-r.independentlyVerified}/${r.evidenceSlots} | 0% |`);
 console.log(`\n**الخلاصة:** ${result.totals.streamsClosed}/${result.totals.streams} مسارات مغلقة، ${result.totals.independentApprovals}/${result.totals.requiredEvidence} أدلة معتمدة، ${result.totals.targetDatePassed} هدفًا تخطيطيًا مر عليه التاريخ.\n`);
 console.log('**التنبيه:** قد تكون أعمال تقنية منجزة؛ هذا الجدول يتتبع التصديق الخارجي فقط.');
}else console.log(JSON.stringify(result,null,2));
