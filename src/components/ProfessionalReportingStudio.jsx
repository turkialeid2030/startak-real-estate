import React,{useState} from 'react';
import {useAppraisalReviewSession} from './AppraisalReviewSessionContext.jsx';
const {evaluatePersonalReportExport,assertPersonalReportExportAllowed}=require('../market/appraisal-report-export-gate');
const {renderStudio,renderExternalReview,issueLabel}=require('../reporting/reporting-studio');
export default function ProfessionalReportingStudio({runtime,valuationCase,locale='ar-SA'}){
 const ar=locale!=='en',t=(a,b)=>ar?a:b,[mode,setMode]=useState('OWNER'),[raw,setRaw]=useState(''),[review,setReview]=useState(null),[notice,setNotice]=useState('');
 const {subject,link}=useAppraisalReviewSession();
 const gate=evaluatePersonalReportExport({subject,link});
 const download=(html,name)=>{
  assertPersonalReportExportAllowed({subject,link});
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;
  try{document.body.appendChild(a);a.click();}finally{a.remove();URL.revokeObjectURL(url);}
 };
 const generate=()=>{try{download(renderStudio({runtime,valuationCase,mode,locale}).html,'startak-research-'+mode.toLowerCase()+'.html');setNotice('EXPORTED');}catch{setNotice('INVALID');}};
 const audit=()=>{setReview(null);setNotice('');try{if(new TextEncoder().encode(raw).length>65536)throw Error('SIZE');const out=renderExternalReview(JSON.parse(raw),{locale});setReview(out.report);setNotice('REVIEWED');}catch{setNotice('INVALID');}};
 const exportAudit=()=>{try{if(!review)throw Error('REVIEW_REQUIRED');const out=renderExternalReview(JSON.parse(raw),{locale});if(out.report.reviewHashSha256!==review.reviewHashSha256)throw Error('STALE');download(out.html,'startak-external-review.html');setNotice('EXPORTED');}catch{setNotice('INVALID');}};
 const style={background:'#f2f4f6',color:'#10243a'};
 const noticeText={EXPORTED:t('تم إنشاء ملف HTML محلي قابل للطباعة.','Local printable HTML created.'),INVALID:t('تعذر إنشاء التقرير؛ تحقق من بنية المدخلات والبيانات.','Report unavailable; check input structure and data.'),REVIEWED:t('اكتملت المراجعة الحسابية للبيانات المنقولة.','Arithmetic review of transcribed data complete.')};
 return <section data-testid="professional-reporting-studio" className="mt-4 p-4 rounded-xl border border-slate-600" dir={ar?'rtl':'ltr'}>
 <h3 className="font-semibold text-amber-200">{t('مركز التقارير العقارية البحثية','Real estate research reporting studio')}</h3>
 <p className="text-xs mt-2">{t('مسودات بحثية غير معتمدة. لا يتجاوز هذا المسار بوابة التقرير المحكوم، ولا يثبت صلاحية مهنية.','Uncertified research drafts. This route does not bypass governed report export or establish professional authority.')}</p>
 <label className="block text-xs mt-3">{t('قالب التقرير','Report layout')}<select data-testid="studio-mode" value={mode} onChange={e=>{setMode(e.target.value);setNotice('');}} className="block w-full rounded p-2" style={style}><option value="OWNER">{t('ملخص المالك','Owner summary')}</option><option value="TECHNICAL">{t('المراجعة الفنية','Technical review')}</option></select></label>
 <button type="button" data-testid="studio-export" disabled={gate.blocked} className="mt-2 p-2 rounded disabled:opacity-50" style={style} onClick={generate}>{t('إنشاء تقرير HTML قابل للطباعة','Create printable HTML report')}</button>
 {gate.blocked&&<p role="alert" data-testid="studio-export-hold" className="text-xs mt-2">{t("التصدير معلق بسبب تعارض تقرير التقييم المرتبط؛ راجع المصدر وهوية العقار.","Export held by linked appraisal review; reconcile source and property identity.")}</p>}
 <h4 className="mt-4 text-sm font-semibold">{t('مراجعة تقرير تقييم خارجي','External valuation report review')}</h4>
 <p className="text-xs">{t('أدخل JSON منقولًا من التقرير وفق المخطط أدناه. لا يوجد رفع PDF أو استخراج آلي في هذا المسار. البيانات محلية ولا تحفظ تلقائيًا.','Enter transcribed report JSON using the schema below. No PDF upload or automatic extraction in this route. Data stays local and is not autosaved.')}</p>
 <details className="text-xs mt-2"><summary>{t('مخطط المدخلات','Input schema')}</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify({reportRef:'SYNTH',valuationDate:'2026-01-01',landAreaSqm:1000,comparables:[{id:'C1',date:'2025-12-01',areaSqm:900,rawRateSar:1000,firstAdjustment:0,secondAdjustment:0,weight:1,transactionStatus:'EXECUTED',page:1}],adoptedLandRateSar:1000,roundingReason:'',components:[{id:'B1',kind:'FLOOR',quantity:500,unit:'SQM',unitCostSar:1000,page:2}],declaredBuildingCostSar:500000,effectiveAge:10,economicLife:50,declaredPhysicalRate:.2,declaredDepreciationSar:100000,declaredFinalValueSar:1400000,sourcePage:3,identityConflict:false,incomeEvidenceAvailable:false},null,2)}</pre></details>
 <label className="block text-xs mt-2">{t('مدخلات التقرير الخارجي','External report inputs')}<textarea data-testid="studio-external-input" value={raw} maxLength={65536} rows={7} className="block w-full p-2 rounded" style={style} onChange={e=>{setRaw(e.target.value);setReview(null);setNotice('');}}/></label>
 <div className="flex flex-wrap gap-2 mt-2"><button type="button" data-testid="studio-audit" onClick={audit} style={style} className="p-2 rounded">{t('تدقيق الحسابات','Review arithmetic')}</button><button type="button" data-testid="studio-audit-export" disabled={!review||gate.blocked} className="p-2 rounded disabled:opacity-50" style={style} onClick={exportAudit}>{t('تصدير تقرير المراجعة','Export review')}</button><button type="button" onClick={()=>{setRaw('');setReview(null);setNotice('');}} className="p-2 rounded" style={style}>{t('مسح المدخلات','Clear inputs')}</button></div>
 {review&&<div data-testid="studio-audit-result" className="mt-3 text-xs"><p>{t('سعر الأرض المرجح','Weighted land rate')}: {review.weightedRateSar}</p><p>{t('فرق القيمة الناتج عن سعر الأرض','Land rate impact')}: {review.landRateImpactSar}</p><p>{t('القيمة المعلنة المعاد احتسابها','Replayed declared value')}: {review.replayedFinalValueSar}</p><ul>{review.issues.map((i,j)=><li key={j}>{i.severity} — {issueLabel(i.code,locale)} — {i.ref}</li>)}</ul></div>}
 {notice&&<p role="status" data-testid="studio-notice" className="text-xs mt-2">{noticeText[notice]}</p>}
 </section>;
}
