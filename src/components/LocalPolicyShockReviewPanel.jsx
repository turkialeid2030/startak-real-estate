import React,{useState,useRef,useEffect,useLayoutEffect} from 'react';
import {usePersonalCaseSession} from './PersonalCaseSessionContext.jsx';
const {useLocale}=require('../i18n/LocaleContext.js');
const {reviewLocalPolicyShock,MAX_BYTES}=require('../market/local-policy-shock-review');
const READY='READY_FOR_PROFESSIONAL_POLICY_SHOCK_REVIEW';
export default function LocalPolicyShockReviewPanel(){
 const {locale}=useLocale(),en=locale==='en',t=(ar,english)=>en?english:ar;
 const {linkedCase}=usePersonalCaseSession();
 const [caseId,setCase]=useState(''),[scope,setScope]=useState(''),[asset,setAsset]=useState(''),[city,setCity]=useState(''),[transaction,setTransaction]=useState(''),[date,setDate]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
 const epoch=useRef(0),fileRef=useRef(null);
 const clear=()=>{epoch.current++;setResult(null);setBusy(false);if(fileRef.current)fileRef.current.value='';};
 useEffect(()=>()=>{epoch.current++;},[]);
 useLayoutEffect(()=>{clear();setCase(linkedCase?.caseId||'');setScope('');setAsset('');setCity('');setTransaction('');setDate('');},[linkedCase?.caseId,linkedCase?.name,linkedCase?.mode]);
 const ready=!!(caseId.trim()&&scope.trim()&&asset.trim()&&city.trim()&&transaction&&date);
 async function load(file){
  const token=++epoch.current;setResult(null);setBusy(false);if(!file)return;
  const held=code=>({status:'HOLD_LOCAL_POLICY_SHOCK_REVIEW',blockers:[code],warnings:[],scenarioImpacts:[]});
  if(file.size>MAX_BYTES){setResult(held('C19_FILE_LIMIT'));return;}
  setBusy(true);
  try{const next=await reviewLocalPolicyShock({text:await file.text(),expectedCaseId:caseId.trim(),expectedMarketScopeRef:scope.trim(),expectedAssetType:asset.trim(),expectedCity:city.trim(),expectedTransactionType:transaction,asOfDate:date});if(epoch.current===token)setResult(next);}
  catch{if(epoch.current===token)setResult(held('C19_LOCAL_REVIEW_FAILED'));}
  finally{if(epoch.current===token)setBusy(false);}
 }
 const ok=result?.status===READY;
 const money=v=>Number.isFinite(v)?new Intl.NumberFormat(en?'en-SA':'ar-SA',{style:'currency',currency:'SAR',maximumFractionDigits:2}).format(v):'—';
 const download=()=>{if(!ok)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...result,kind:'LOCAL_RESEARCH_DRAFT'},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='policy-shock-research-draft.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);};
 const fields=[[t('معرف الحالة','Case ID'),caseId,setCase,'policy-shock-case'],[t('مرجع النطاق السوقي','Market scope reference'),scope,setScope,'policy-shock-scope'],[t('نوع الأصل','Asset type'),asset,setAsset,'policy-shock-asset'],[t('المدينة','City'),city,setCity,'policy-shock-city'],[t('تاريخ التحليل','Analysis date'),date,setDate,'policy-shock-date']];
 return <section data-testid="local-policy-shock-review" dir={en?'ltr':'rtl'} className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-slate-100">
 <h3 className="text-sm font-semibold">{t('تحليل أثر المتغيرات التنظيمية والاقتصادية','Regulatory and economic scenario review')}</h3>
 <p className="mt-2 text-xs text-amber-200">{t('كل صف سيناريو مستقل وفق أثر أدخله المراجع. لا تجمع السيناريوهات ولا تعدل القيمة المرجعية ولا تثبت انطباق الأنظمة أو أصالة المصادر.','Each row is a separate scenario based on a supplied professional impact. Scenarios are not combined, do not alter the baseline value and do not establish legal applicability or source authenticity.')}</p>
 <div className="mt-3 grid gap-2 md:grid-cols-3">{fields.map(([label,value,set,id])=><label key={id} className="text-xs">{label}<input data-testid={id} type={id==='policy-shock-date'?'date':'text'} maxLength={160} readOnly={id==='policy-shock-case'&&!!linkedCase} value={value} onChange={e=>{clear();set(e.target.value);}} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>)}
 <label className="text-xs">{t('نوع الصفقة','Transaction type')}<select data-testid="policy-shock-transaction" value={transaction} onChange={e=>{clear();setTransaction(e.target.value);}} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"><option value="">{t('اختر النوع','Select type')}</option><option value="SALE">{t('بيع','Sale')}</option><option value="RENT">{t('إيجار','Rent')}</option></select></label></div>
 <label className="mt-3 block text-xs">{t('استيراد المقارنات والأدلة والآثار وسياسة المراجعة','Import comparables, evidence, impacts and review policy')}<input ref={fileRef} type="file" data-testid="policy-shock-file" accept=".json,application/json" disabled={busy||!ready} onChange={e=>load(e.target.files?.[0])} className="mt-1 block w-full"/></label>
 <p className="mt-2 text-xs text-slate-400">{t('لا تحفظ الملفات تلقائيًا ولا ترفع إلى الخادم.','Files are not automatically stored or uploaded.')}</p>
 <button type="button" data-testid="policy-shock-reset" onClick={clear} className="mt-2 rounded border border-slate-700 px-3 py-2 text-xs">{t('مسح التحليل','Clear review')}</button>
 {busy&&<p role="status" className="text-xs">{t('جارٍ التحقق المحلي','Checking locally')}</p>}
 {result&&<p data-testid="policy-shock-status" data-status={result.status} className="mt-3 text-xs">{ok?t('اكتمل الحساب — المراجعة المستقلة مطلوبة','Calculation complete — independent review required'):t('معلّق — لم تعرض النتائج','HOLD — results suppressed')}</p>}
 {result&&!ok&&<ul className="text-xs text-amber-200">{result.blockers.map((code,i)=><li key={i}><code className="break-all">{code}</code></li>)}</ul>}
 {ok&&<div data-testid="policy-shock-result" className="mt-3"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-xs"><thead><tr>{[t('المقارن','Comparable'),t('المتغير','Shock'),t('الإجراء','Action'),t('الأساس للمتر','Baseline per sqm'),t('فرق السيناريو للمتر','Scenario delta per sqm'),t('قيمة السيناريو للمتر','Scenario per sqm'),t('تاريخ النفاذ','Effective date'),t('مرجع المبرر','Rationale reference')].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{result.scenarioImpacts.map(x=><tr key={x.impactId} className="border-t border-slate-800"><td data-user-content className="p-2">{x.comparableId}</td><td data-user-content className="p-2">{x.shockClass} / {x.shockEvidenceId}</td><td data-user-content className="p-2">{x.action}</td><td className="p-2">{money(x.baseUnitValueSarPerSqm)}</td><td className="p-2">{money(x.scenarioDeltaSarPerSqm)}</td><td className="p-2">{money(x.scenarioUnitValueSarPerSqm)}</td><td data-user-content className="p-2">{x.shockEffectiveAt}</td><td data-user-content className="p-2 break-all">{x.professionalRationaleRef}</td></tr>)}</tbody></table></div>
 <ul className="mt-2 text-xs text-amber-200">{result.warnings.map((x,i)=><li key={i}><code className="break-all">{x}</code></li>)}</ul>
 <button type="button" data-testid="policy-shock-report" onClick={download} className="mt-3 rounded border border-slate-700 px-3 py-2 text-xs">{t('تصدير مسودة النتائج','Export draft results')}</button></div>}
 </section>;
}
