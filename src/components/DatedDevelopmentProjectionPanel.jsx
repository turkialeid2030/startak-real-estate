import React,{useState} from 'react';
const {projectDatedDevelopment}=require('../valuation-intelligence/dated-development-projection');
export default function DatedDevelopmentProjectionPanel({locale='ar-SA',financialInputs=null,assumptionModelVersion}){
 const en=locale==='en',tr=(ar,english)=>en?english:ar;
 const [startDate,setStartDate]=useState(''),[source,setSource]=useState('');
 const [timing,setTiming]=useState(''),[confirmed,setConfirmed]=useState(false),[result,setResult]=useState(null);
 const context=JSON.stringify([financialInputs,assumptionModelVersion]);
 const projection=result?.context===context?result.projection:null;
 const change=(setter,value)=>{setter(value);setResult(null)};
 const money=n=>Number.isFinite(n)?new Intl.NumberFormat(en?'en-US':'ar-SA',{maximumFractionDigits:2}).format(n):'—';
 const rate=n=>Number.isFinite(n)?new Intl.NumberFormat(en?'en-US':'ar-SA',{style:'percent',maximumFractionDigits:4}).format(n):'—';
 const inputClass='mt-1 block w-full rounded border border-slate-600 bg-[#101c30] p-2';
 function exportProjection(){
  if(projection?.status!=='ILLUSTRATIVE_DATED_DEVELOPMENT_CALCULATED')return;
  const payload={kind:'STARTAK_ILLUSTRATIVE_DATED_DEVELOPMENT',inputs:financialInputs,
   assumptionModelVersion,projection};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='STARTAK_Dated_Development_Illustration.json';
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
 }
 return <details data-testid="dated-development-projection" dir={en?'ltr':'rtl'}
  className="mt-4 rounded border border-sky-700 bg-[#101c30] p-3 text-slate-100">
  <summary className="cursor-pointer text-sm font-semibold">
   {tr('تقويم الإنشاء والتمويل الشهري — محاكاة مؤرخة','Construction and monthly financing calendar — dated illustration')}
  </summary>
  <p className="my-3 text-xs leading-6 text-amber-200">
   {tr('يعيد هذا المسار الحساب من مدخلات المشروع الحالية. يوزع تكلفة الإنشاء بالتساوي على بدايات الفترات الشهرية من تاريخ البداية، ويربط السحب ورسملة الفائدة وجدول السداد بالتقويم نفسه. يثبت رقم يوم البداية أو يستخدم آخر يوم في الشهر الأقصر. اختر توقيت تحصيل صافي الدخل صراحة. التواريخ محاكاة، وليست إثباتًا لدفعات فعلية أو شروط عقد تمويل. لا يستبدل المسار السنوي الحالي.',
    'This path recomputes from current inputs. Construction cost is allocated equally to monthly period starts anchored to your start date, aligning draws, capitalized interest and repayments to one calendar. The original day is retained or clamped to the end of a shorter month. Select NOI receipt timing explicitly. Dates are illustrative, not verified payments or financing terms. Canonical annual returns remain unchanged.')}
  </p>
  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
   <label>{tr('تاريخ بداية المحاكاة','Illustration start date')}
    <input aria-label={tr('تاريخ بداية المحاكاة','Illustration start date')} data-testid="dated-projection-start" type="date" value={startDate} onChange={e=>change(setStartDate,e.target.value)} className={inputClass}/>
   </label>
   <label>{tr('مرجع افتراض التاريخ وخطة التنفيذ','Timeline assumption / execution plan reference')}
    <input aria-label={tr('مرجع افتراض التاريخ وخطة التنفيذ','Timeline assumption / execution plan reference')} data-testid="dated-projection-source" value={source} maxLength={240} onChange={e=>change(setSource,e.target.value)} className={inputClass}/>
   </label>
   <label>{tr('توقيت تحصيل صافي الدخل التشغيلي','NOI receipt timing')}
    <select aria-label={tr('توقيت تحصيل صافي الدخل التشغيلي','NOI receipt timing')} data-testid="dated-projection-income-timing" value={timing} onChange={e=>change(setTiming,e.target.value)} className={inputClass}>
     <option value="">{tr('اختر افتراض التحصيل صراحة','Explicitly choose receipt timing')}</option>
     <option value="ANNUAL_END">{tr('نهاية كل سنة تشغيل','End of each operating year')}</option>
     <option value="UNIFORM_MONTHLY">{tr('توزيع شهري متساوٍ — افتراض تصوري','Uniform monthly allocation — illustrative assumption')}</option>
    </select>
   </label>
  </div>
  <label className="my-3 flex items-center gap-2 text-xs">
   <input data-testid="dated-projection-confirm" type="checkbox" checked={confirmed} onChange={e=>change(setConfirmed,e.target.checked)}/>
   {tr('أوافق على قواعد التوزيع والتقويم المختارة لأغراض المحاكاة؛ لا أعتبرها تواريخ متحققًا منها أو اعتمادًا تمويليًا.',
    'I confirm the selected calendar and allocation assumptions for illustration; they are not verified dates or financing approval.')}
  </label>
  {!financialInputs&&<p className="mb-2 text-xs text-rose-200">{tr('صحح مدخلات المشروع الحالية قبل تشغيل المحاكاة.','Correct the current financial inputs before calculating.')}</p>}
  <button type="button" data-testid="dated-projection-calculate" disabled={!financialInputs}
   onClick={()=>setResult({context,projection:projectDatedDevelopment({inputs:financialInputs,startDate,sourceReference:source,
    incomeTiming:timing,assumptionsConfirmed:confirmed,assumptionModelVersion})})}
   className="rounded border border-sky-600 px-3 py-2 text-xs disabled:opacity-50">
   {tr('احسب المحاكاة المؤرخة مع التمويل الشهري','Calculate dated illustration with monthly financing')}
  </button>
  {projection&&<div data-testid="dated-projection-result" role="status" className="mt-3 text-xs">
   {projection.status!=='ILLUSTRATIVE_DATED_DEVELOPMENT_CALCULATED'?<code data-testid="dated-projection-blockers">{projection.blockers.join(' / ')}</code>:<>
    <p data-testid="dated-projection-calendar">{tr('مدة الإنشاء: ','Construction duration: ')}{projection.constructionMonths} {tr('شهرًا؛ نموذج المحرك السنوي: ','months; canonical annual model: ')}{projection.canonicalRoundedConstructionYears} {tr('سنة.','years.')}
     {' '}{tr('الإكمال: ','Completion: ')}{projection.completionDate} | {tr('التخارج: ','Exit: ')}{projection.exitDate}
    </p>
    {projection.constructionMonthRoundingApplied&&<p className="mt-2 text-amber-200">
     {tr('تتضمن مدة الإنشاء جزءًا من شهر؛ طُبّقت قاعدة التمويل الحالية بالتقريب إلى أقرب شهر. لا تمثل المحاكاة الجزء الأقل من شهر بدقة يومية.',
      'The construction duration includes a partial month. The current financing convention rounds it to the nearest month; the sub-month portion is not modeled day by day.')}
    </p>}
    <p className="mt-2 text-amber-200">{tr('الفروق أدناه أثر لتوقيت التدفقات وقواعد المحاكاة؛ لا تعني تحقق السعر أو صلاحية الشراء. أساس الأيام الفعلية: ',
     'Differences below reflect cash-flow timing and illustration conventions, not verified value or purchase authority. Actual-day convention: ')}<code dir="ltr">ACT/365.2425</code>.</p>
    <div className="mt-2 max-w-full overflow-x-auto"><table className="w-full min-w-[520px] text-start">
     <thead><tr><th>{tr('المؤشر','Metric')}</th><th>{tr('المحاكاة المؤرخة','Dated illustration')}</th><th>{tr('المحرك السنوي الحالي','Current annual model')}</th></tr></thead>
     <tbody>
      <tr><td>{tr('العائد الداخلي للمشروع','Project IRR')}</td><td>{rate(projection.project.xirr)}</td><td>{rate(projection.canonicalComparison.projectIrr)}</td></tr>
      <tr><td>{tr('القيمة الحالية للمشروع — ريال','Project NPV — SAR')}</td><td>{money(projection.project.xnpvSar)}</td><td>{money(projection.canonicalComparison.projectNpvSar)}</td></tr>
      <tr><td>{tr('العائد الداخلي لحقوق الملكية','Equity IRR')}</td><td>{rate(projection.equity.xirr)}</td><td>{rate(projection.canonicalComparison.equityIrr)}</td></tr>
      <tr><td>{tr('القيمة الحالية لحقوق الملكية — ريال','Equity NPV — SAR')}</td><td>{money(projection.equity.xnpvSar)}</td><td>{money(projection.canonicalComparison.equityNpvSar)}</td></tr>
     </tbody>
    </table></div>
    {[projection.project,projection.equity].some(x=>x.xirrStatus!=='QUALIFIED')&&<p data-testid="dated-projection-irr-hold" className="mt-2 text-amber-200">
     {tr('حُجب العائد الداخلي لمسار لا يملك حلًا وحيدًا مؤهلًا؛ راجع نمط التدفقات وتوقيتها.','IRR is withheld for a path without a qualified unique solution; review cash-flow signs and timing.')}
     <code>{[...projection.project.xirrBlockers,...projection.equity.xirrBlockers].join(' / ')}</code>
    </p>}
    <p data-testid="dated-projection-reconciliation" className="mt-2">
     {tr('تطابقت مجاميع التكلفة والدخل والسحب والسداد حسابيًا. رصيد الدين عند الإكمال: ','Cost, income, draw and repayment totals reconcile arithmetically. Debt at completion: ')}{money(projection.accounting.completionDebtSar)} |
     {tr('الدين المتبقي عند التخارج: ','Debt remaining at exit: ')}{money(projection.accounting.remainingDebtAtExitSar)}
    </p>
    <details className="mt-2"><summary className="cursor-pointer">{tr('عرض جدول الإنشاء الشهري','View monthly construction schedule')}</summary>
     <div className="max-w-full overflow-x-auto"><table className="min-w-[650px] w-full text-start"><thead><tr>
      {[tr('الشهر','Month'),tr('تاريخ السحب','Draw date'),tr('تكلفة الإنشاء','Construction cost'),tr('سحب الدين','Debt draw'),tr('حقوق الملكية','Equity draw'),tr('الفائدة المرسملة','Capitalized interest')].map(x=><th key={x}>{x}</th>)}
     </tr></thead><tbody>{projection.constructionRows.slice(0,120).map(row=><tr key={row.month}>
      <td>{row.month}</td><td>{row.drawDate}</td><td>{money(row.constructionCostSar)}</td><td>{money(row.debtDrawSar)}</td><td>{money(row.equityDrawSar)}</td><td>{money(row.capitalizedInterestSar)}</td>
     </tr>)}</tbody></table></div>
     <p>{tr('المعروض: ','Showing: ')}{Math.min(120,projection.constructionRows.length)} / {projection.constructionRows.length}. {tr('يتضمن ملف التصدير الجدول الكامل.','Export includes the full schedule.')}</p>
    </details>
    <button type="button" data-testid="dated-projection-export" onClick={exportProjection} className="mt-3 rounded border border-slate-500 px-3 py-2">{tr('تصدير المحاكاة ومدخلاتها والجداول','Export illustration, inputs and schedules')}</button>
    <p className="mt-2 text-amber-200">{tr('النتائج بحثية غير معتمدة. تتطلب المراجعة المالية المستقلة ومطابقة عقد التمويل والدفعات الفعلية؛ لا اعتماد مهني أو صلاحية معاملة.',
     'Uncertified research results. Independent financial review and reconciliation to the financing contract and actual payments remain required; no professional approval or transaction authority.')}</p>
   </>}
  </div>}
 </details>;
}
