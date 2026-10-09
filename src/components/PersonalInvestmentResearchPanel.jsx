import React, {useMemo, useState} from 'react';
const {
  buildPersonalResearchReport,
  htmlReport,
}=require('../app/personal-investment-research-report');

function locallyDownload(content,mime,name){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  try{
    const link=document.createElement('a');
    link.href=url;
    link.download=name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }finally{
    URL.revokeObjectURL(url);
  }
}
const STATUS_LABEL=Object.freeze({
 PRELIMINARY_VALUE_CALCULATED:{ar:'مؤشر قيمة أولي محسوب',en:'Preliminary value calculated'},
 METHOD_INDICATIONS_ONLY:{ar:'مؤشرات مناهج متاحة للمراجعة',en:'Method indications available'},
 SPECIALIST_INPUTS_ONLY:{ar:'مسودة بيانات عقار متخصص',en:'Specialist asset input draft'},
 INPUTS_REQUIRED:{ar:'المدخلات غير مكتملة',en:'More inputs required'},
});
function humanStatus(status,locale){
 const label=STATUS_LABEL[status];
 return label?(locale==='en'?label.en:label.ar):(locale==='en'?'Draft under review':'مسودة قيد المراجعة');
}
function smallName(s){
  return String(s||'property').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,65);
}
function amount(n,currency,locale){
  if(typeof n!=='number'||!Number.isFinite(n))return '—';
  return n.toLocaleString(locale==='en'?'en-US':'ar-SA',{maximumFractionDigits:2})+' '+(currency||'SAR');
}
export default function PersonalInvestmentResearchPanel({
  locale='ar-SA',valuationCase=null,runtime=null,
}){
  const [message,setMessage]=useState('');
  const ar=locale!=='en';
  const draft=useMemo(()=>{
    try{return buildPersonalResearchReport({valuationCase,runtime,generatedAt:new Date()});}
    catch{return null;}
  },[valuationCase,runtime]);
  if(!draft)return null;
  const save=(format)=>{
    setMessage('');
    try{
      // Regenerate using current in-memory inputs so no stale governance
      // snapshot or external P0 licence is required for private study exports.
      const current=buildPersonalResearchReport({valuationCase,runtime,generatedAt:new Date()});
      const prefix='startak-personal-'+smallName(current.caseId||current.projectId)+
        '-'+current.generatedAt.slice(0,10);
      if(format==='html')locallyDownload(htmlReport(current,{locale}),
        'text/html;charset=utf-8',prefix+'.html');
      else locallyDownload(JSON.stringify(current,null,2),'application/json;charset=utf-8',
        prefix+'.json');
      setMessage(ar?'تم تجهيز نسخة محلية من الدراسة الشخصية.':'Personal study saved locally.');
    }catch(error){
      setMessage((ar?'تعذر تصدير المسودة: ':'Draft export failed: ')+(error.code||'INVALID_REPORT'));
    }
  };
  const indicatorAvailable=draft.preliminaryValue!==null;
  return (
    <section dir={ar?'rtl':'ltr'} data-testid="c75-personal-research-workspace"
      className="mx-auto mt-5 w-full max-w-7xl px-4">
      <div className="rounded-2xl border border-slate-700 bg-[#101d33] p-4 md:p-5">
        <div className="text-[11px] tracking-wide text-slate-400">C75 · PERSONAL RESEARCH</div>
        <h2 className="mt-1 text-base font-semibold text-slate-100">
          {ar?'دراسة الاستثمار العقاري الشخصية':'Personal real estate investment study'}
        </h2>
        <p className="mt-2 text-xs leading-6 text-slate-300">
          {ar?'يمكنك تحليل الفرصة وتصدير مسودة شخصية حتى عند نقص بعض الأدلة. لا تُحوَّل القيم غير المحسوبة إلى أرقام مفترضة، وتُعرض الفجوات بوضوح. هذا المسار مستقل عن بوابات الإطلاق التجاري.':
            'Analyze and export your private draft despite missing external approvals. Uncalculated values are never invented, and missing inputs are reported. Commercial release gates do not control personal drafts.'}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-700 p-3">
            <div className="text-[11px] text-slate-400">{ar?'حالة المسودة':'Draft status'}</div>
            <div data-testid="c75-personal-status" className="mt-1 text-sm text-slate-100">
              {humanStatus(draft.reportStatus,locale)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 p-3">
            <div className="text-[11px] text-slate-400">{ar?'القيمة الحسابية الأولية':'Preliminary computed value'}</div>
            <div data-testid="c75-personal-value" className="mt-1 text-sm text-slate-100">
              {amount(draft.preliminaryValue,draft.currency,locale)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-700 p-3">
            <div className="text-[11px] text-slate-400">{ar?'الفجوات والملاحظات':'Outstanding inputs and warnings'}</div>
            <div className="mt-1 text-sm text-slate-100">{draft.warnings.length}</div>
          </div>
        </div>
        {!indicatorAvailable&&(
          <p data-testid="c75-personal-no-invented-value" className="mt-3 text-xs text-amber-200">
            {ar?'لا توجد قيمة نهائية محسوبة وفق المدخلات المتاحة؛ تستطيع تصدير المسودة، ثم استكمال البيانات لاحقًا.':
              'No final value can be computed from the current inputs. You may export the draft and complete the analysis later.'}
          </p>
        )}
        {draft.methods.length>0&&(
          <div className="mt-4 overflow-auto">
            <table className="w-full text-xs text-slate-200">
              <thead><tr className="border-b border-slate-700 text-slate-400">
                <th className="py-2 text-start">{ar?'المنهج':'Method'}</th>
                <th className="py-2 text-start">{ar?'الحالة':'Status'}</th>
                <th className="py-2 text-start">{ar?'مؤشر القيمة':'Value indication'}</th>
              </tr></thead>
              <tbody>{draft.methods.map((m,i)=><tr key={m.method+'-'+i} className="border-b border-slate-800">
                <td className="py-2">{m.method}</td>
                <td className="py-2">{m.state}</td>
                <td className="py-2">{amount(m.diagnosticValue,draft.currency,locale)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        {draft.warnings.length>0&&(
          <details className="mt-4 text-xs text-slate-300">
            <summary className="cursor-pointer">
              {ar?'عرض المدخلات الناقصة وملاحظات الأدلة':'Review missing inputs and evidence notes'}
            </summary>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {draft.warnings.map(w=><li key={w}>{w}</li>)}
            </ul>
          </details>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" data-testid="c75-export-personal-html"
            onClick={()=>save('html')}
            className="rounded-lg border border-slate-500 px-4 py-2 text-xs font-semibold text-slate-100">
            {ar?'تصدير دراسة شخصية بالعربية / HTML':'Export personal study / HTML'}
          </button>
          <button type="button" data-testid="c75-export-personal-json"
            onClick={()=>save('json')}
            className="rounded-lg border border-slate-500 px-4 py-2 text-xs font-semibold text-slate-100">
            {ar?'تصدير بيانات الدراسة JSON':'Export study data JSON'}
          </button>
        </div>
        <div className="mt-3 text-[11px] leading-5 text-slate-400">
          {ar?'الملف يُنشأ على جهازك مباشرة. المخرج دراسة شخصية أولية، وليس تقرير تقييم عقاري مهنيًا معتمدًا.':
            'File is generated on your device. This is an initial personal study, not a certified professional appraisal.'}
        </div>
        {message&&<div role="status" className="mt-2 text-xs text-slate-200">{message}</div>}
      </div>
    </section>
  );
}
