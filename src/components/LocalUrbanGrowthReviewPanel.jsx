import React,{useState,useRef,useEffect,useLayoutEffect} from 'react';
import {usePersonalCaseSession} from './PersonalCaseSessionContext.jsx';
const {useLocale}=require('../i18n/LocaleContext.js');
const {reviewLocalUrbanGrowth,MAX_BYTES}=require('../geospatial/local-urban-growth-review');
const READY='READY_FOR_PROFESSIONAL_URBAN_GROWTH_ACCESSIBILITY_REVIEW';
export default function LocalUrbanGrowthReviewPanel(){
 const {locale}=useLocale(),en=locale==='en',t=(ar,english)=>en?english:ar;
 const {linkedCase}=usePersonalCaseSession();
 const [caseId,setCase]=useState(''),[property,setProperty]=useState(''),[scope,setScope]=useState(''),[date,setDate]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
 const epoch=useRef(0),fileRef=useRef(null);
 const clear=()=>{epoch.current++;setResult(null);setBusy(false);if(fileRef.current)fileRef.current.value='';};
 useEffect(()=>()=>{epoch.current++;},[]);
 useLayoutEffect(()=>{clear();setCase(linkedCase?.caseId||'');setProperty('');setScope('');setDate('');},[linkedCase?.caseId,linkedCase?.name,linkedCase?.mode]);
 const ready=!!(caseId.trim()&&property.trim()&&scope.trim()&&date);
 async function load(file){
  const token=++epoch.current;setResult(null);setBusy(false);if(!file)return;
  const held=code=>({status:'HOLD_LOCAL_URBAN_GROWTH_REVIEW',blockers:[code],riskFlags:[],review:null});
  if(file.size>MAX_BYTES){setResult(held('C20_FILE_LIMIT'));return;}
  setBusy(true);
  try{const next=await reviewLocalUrbanGrowth({text:await file.text(),expectedCaseId:caseId.trim(),expectedPropertyRef:property.trim(),expectedMarketScopeRef:scope.trim(),asOfDate:date});if(epoch.current===token)setResult(next);}
  catch{if(epoch.current===token)setResult(held('C20_LOCAL_REVIEW_FAILED'));}
  finally{if(epoch.current===token)setBusy(false);}
 }
 const ok=result?.status===READY,number=v=>Number.isFinite(v)?new Intl.NumberFormat(en?'en-SA':'ar-SA',{maximumSignificantDigits:12}).format(v):'—';
 const download=()=>{if(!ok)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...result,kind:'LOCAL_RESEARCH_DRAFT'},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='urban-growth-research-draft.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);};
 const fields=[[t('معرف الحالة','Case ID'),caseId,setCase,'urban-growth-case'],[t('مرجع العقار','Property reference'),property,setProperty,'urban-growth-property'],[t('مرجع النطاق السوقي','Market scope reference'),scope,setScope,'urban-growth-scope'],[t('تاريخ التحليل','Analysis date'),date,setDate,'urban-growth-date']];
 return <section data-testid="local-urban-growth-review" dir={en?'ltr':'rtl'} className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-slate-100">
 <h3 className="text-sm font-semibold">{t('النمو العمراني وتغير الوصول إلى الخدمات','Urban growth and accessibility change')}</h3>
 <p className="mt-2 text-xs text-amber-200">{t('مقارنة بحثية بين قياسات مستوردة متجانسة. لا تحسب المسارات أو تقدر القيمة أو تثبت أصالة المصدر. المشروعات المستقبلية سياق مستقل ولا تعامل كخدمات قائمة.','Research comparison of imported like-for-like observations. No route calculation, valuation or source authentication. Future projects are separate context, not existing services.')}</p>
 <div className="mt-3 grid gap-2 md:grid-cols-4">{fields.map(([label,value,set,id])=><label key={id} className="text-xs">{label}<input data-testid={id} type={id==='urban-growth-date'?'date':'text'} maxLength={160} readOnly={id==='urban-growth-case'&&!!linkedCase} value={value} onChange={e=>{clear();set(e.target.value);}} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>)}</div>
 <label className="mt-3 block text-xs">{t('استيراد القياسات وأزواج المقارنة والسياسة','Import observations, comparison pairs and policy')}<input ref={fileRef} type="file" data-testid="urban-growth-file" accept=".json,application/json" disabled={busy||!ready} onChange={e=>load(e.target.files?.[0])} className="mt-1 block w-full"/></label>
 <p className="mt-2 text-xs text-slate-400">{t('لا تحفظ الملفات تلقائيًا ولا ترفع إلى الخادم.','Files are not automatically stored or uploaded.')}</p>
 <button type="button" data-testid="urban-growth-reset" onClick={clear} className="mt-2 rounded border border-slate-700 px-3 py-2 text-xs">{t('مسح التحليل','Clear review')}</button>
 {busy&&<p role="status" className="text-xs">{t('جارٍ التحقق المحلي','Checking locally')}</p>}
 {result&&<p data-testid="urban-growth-status" data-status={result.status} className="mt-3 text-xs">{ok?t('اكتمل الحساب — المراجعة المستقلة مطلوبة','Calculation complete — independent review required'):t('معلّق — لم تعرض النتائج','HOLD — results suppressed')}</p>}
 {result&&!ok&&<ul className="text-xs text-amber-200">{result.blockers.map((code,i)=><li key={i}><code className="break-all">{code}</code></li>)}</ul>}
 {ok&&<div data-testid="urban-growth-result" className="mt-3"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead><tr>{[t('المؤشر','Signal'),t('الأساس','Baseline'),t('الحالي','Current'),t('الوحدة','Unit'),t('الفرق','Change'),t('التغير %','Change %'),t('الفترة','Period'),t('مراجع المصادر','Source references')].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{result.review.comparisons.map(x=><tr key={x.pairId} className="border-t border-slate-800"><td data-user-content className="p-2">{x.signalClass} / {x.signalKey}</td><td className="p-2">{number(x.baselineValue)}</td><td className="p-2">{number(x.currentValue)}</td><td data-user-content className="p-2">{x.metricUnit}</td><td className="p-2">{number(x.absoluteDelta)}</td><td className="p-2">{number(x.percentageDelta)}</td><td data-user-content className="p-2">{x.baselineReferenceAt} / {x.currentReferenceAt}</td><td data-user-content className="p-2 break-all">{x.baselineSourceReference} / {x.currentSourceReference}</td></tr>)}</tbody></table></div>
 <h4 className="mt-3 text-xs font-semibold">{t('سياق المشروعات غير القائمة','Non-existing project context')}</h4><ul data-testid="urban-growth-planned" className="mt-2 text-xs">{result.review.reviewOnlyNonExistingContext.map(x=><li key={x.evidenceId} data-user-content>{x.signalKey} — {x.observationState} — {number(x.metricValue)} {x.metricUnit} — {x.referenceAt}</li>)}</ul>
 <ul className="mt-2 text-xs text-amber-200">{result.riskFlags.map((x,i)=><li key={i}><code className="break-all">{x}</code></li>)}</ul>
 <button type="button" data-testid="urban-growth-report" onClick={download} className="mt-3 rounded border border-slate-700 px-3 py-2 text-xs">{t('تصدير مسودة النتائج','Export draft results')}</button></div>}
 </section>;
}
