import React,{useState,useRef,useLayoutEffect,useEffect} from 'react';
import {usePersonalCaseSession} from './PersonalCaseSessionContext.jsx';
const {useLocale}=require('../i18n/LocaleContext.js');
const {reviewLocalIncomeAsset,MAX_BYTES}=require('../income/local-income-asset-review.js');
const READY='READY_FOR_PROFESSIONAL_INCOME_ASSET_REVIEW';
export default function LocalIncomeAssetReviewPanel(){
 const {locale}=useLocale(),en=locale==='en',t=(ar,english)=>en?english:ar;
 const {linkedCase}=usePersonalCaseSession();
 const [caseId,setCase]=useState(''),[property,setProperty]=useState(''),[date,setDate]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
 const epoch=useRef(0),fileRef=useRef(null);
 const clear=()=>{epoch.current++;setResult(null);setBusy(false);if(fileRef.current)fileRef.current.value='';};
 useEffect(()=>()=>{epoch.current++;},[]);
 useLayoutEffect(()=>{clear();setCase(linkedCase?.caseId||'');setProperty('');setDate('');},[linkedCase?.caseId,linkedCase?.name,linkedCase?.mode]);
 async function load(file){
  const token=++epoch.current;setResult(null);setBusy(false);if(!file)return;
  const held=code=>({status:'HOLD_LOCAL_INCOME_REVIEW',blockers:[code]});
  if(file.size>MAX_BYTES){setResult(held('C11_FILE_LIMIT'));return;}
  setBusy(true);
  try{const next=await reviewLocalIncomeAsset({text:await file.text(),expectedCaseId:caseId.trim(),expectedPropertyRef:property.trim(),asOfDate:date});if(epoch.current===token)setResult(next);}
  catch{if(epoch.current===token)setResult(held('C11_LOCAL_REVIEW_FAILED'));}
  finally{if(epoch.current===token)setBusy(false);}
 }
 const ok=result?.status===READY,m=result?.metrics;
 const n=v=>new Intl.NumberFormat(en?'en-SA':'ar-SA',{maximumFractionDigits:2}).format(v);
 const sar=v=>new Intl.NumberFormat(en?'en-SA':'ar-SA',{style:'currency',currency:'SAR',maximumFractionDigits:2}).format(v);
 const pct=v=>new Intl.NumberFormat(en?'en-SA':'ar-SA',{style:'percent',maximumFractionDigits:2}).format(v);
 const download=()=>{if(!ok)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...result,kind:'LOCAL_RESEARCH_DRAFT'},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='local-income-asset-review.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);};
 const fields=[[t('معرف الحالة المتوقع','Expected case ID'),caseId,setCase,'income-review-case'],[t('مرجع العقار المتوقع','Expected property reference'),property,setProperty,'income-review-property'],[t('تاريخ التحليل','Analysis date'),date,setDate,'income-review-date']];
 return <section data-testid="local-income-review" dir={en?'ltr':'rtl'} className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-slate-100">
 <h3 className="text-sm font-semibold">{t('تحليل الأصول المدرة للدخل وتركز المستأجرين','Income asset and tenant concentration review')}</h3>
 <p className="mt-2 text-xs text-amber-200">{t('تحليل تعاقدي بحثي محلي. لا يثبت أصالة المستندات أو ملاءة المستأجر، ولا يحسب صافي الدخل التشغيلي أو قيمة العقار أو يمنح اعتمادًا.','Local contractual research. It does not authenticate documents or tenant creditworthiness, calculate NOI or property value, or grant approval.')}</p>
 <div className="mt-3 grid gap-2 md:grid-cols-3">{fields.map(([label,value,set,id])=><label key={id} className="text-xs">{label}<input data-testid={id} type={id==='income-review-date'?'date':'text'} maxLength={160} readOnly={id==='income-review-case'&&!!linkedCase} value={value} onChange={e=>{clear();set(e.target.value);}} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>)}</div>
 <label className="mt-3 block text-xs">{t('استيراد ملف العقود وسجل الإيجارات والتقييمات وسياسة المراجعة','Import leases, rent roll, assessments and review policy')}<input ref={fileRef} type="file" data-testid="income-review-file" accept=".json,application/json" disabled={busy||!caseId.trim()||!property.trim()||!date} onChange={e=>load(e.target.files?.[0])} className="mt-1 block w-full"/></label>
 <p className="mt-2 text-xs text-slate-400">{t('تعاد مطابقة العقود الأصلية مع سجل الإيجارات. لا تحفظ الملفات تلقائيًا ولا ترفع إلى الخادم.','Original lease records are reconciled again to the rent roll. Files are not automatically stored or uploaded.')}</p>
 <button type="button" data-testid="income-review-reset" onClick={clear} className="mt-2 rounded border border-slate-700 px-3 py-2 text-xs">{t('مسح التحليل','Clear review')}</button>
 {busy&&<p role="status" className="text-xs">{t('جارٍ التحقق المحلي','Checking locally')}</p>}
 {result&&<p data-testid="income-review-status" data-status={result.status} className="mt-3 text-xs">{ok?t('مطابقة حسابية مكتملة — مراجعة مستقلة مطلوبة','Arithmetic reconciliation complete — independent review required'):t('معلّق — لم تعرض النتائج','HOLD — results suppressed')}</p>}
 {result&&!ok&&<ul className="text-xs text-amber-200">{result.blockers.map(code=><li key={code}><code className="break-all">{code}</code></li>)}</ul>}
 {ok&&<div data-testid="income-review-result" className="mt-3">
 <div className="grid gap-2 md:grid-cols-3 text-xs">{[[t('الإشغال','Occupancy'),pct(m.occupancyRatio)],[t('المساحة الشاغرة بالمتر المربع','Vacant area in sqm'),n(m.vacantAreaSqm)],[t('الإيجار التعاقدي السنوي','Annual contracted rent'),sar(m.annualContractRentSar)],[t('إيجار المتر المشغول','Rent per occupied sqm'),sar(m.annualRentPerOccupiedSqmSar)],[t('حصة أكبر مستأجر','Top tenant share'),pct(m.topTenantRentShare)],[t('حصة أكبر ثلاثة مستأجرين','Top three tenant share'),pct(m.topThreeTenantRentShare)],[t('مؤشر تركز الإيراد','Revenue concentration index'),n(m.tenantRentHhi)],[t('عدد المستأجرين','Tenant count'),n(m.activeTenantCount)],[t('عدد العقود النشطة','Active leases'),n(m.activeLeaseCount)]].map(([k,v])=><div key={k} className="rounded border border-slate-700 p-2">{k}<strong className="block mt-1">{v}</strong></div>)}</div>
 <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-xs"><thead><tr>{[t('مرجع المستأجر','Tenant reference'),t('الإيجار السنوي','Annual rent'),t('الحصة من الإيجارات','Rent share'),t('المساحة المشغولة','Occupied area'),t('تصنيف الملاءة المدخل','Supplied strength band')].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{result.tenants.map(x=><tr key={x.tenantRef} className="border-t border-slate-800"><td data-user-content className="p-2">{x.tenantRef}</td><td className="p-2">{sar(x.annualContractRentSar)}</td><td className="p-2">{pct(x.rentShare)}</td><td className="p-2">{n(x.occupiedAreaSqm)}</td><td data-user-content className="p-2">{x.strengthBand}</td></tr>)}</tbody></table></div>
 <h4 className="mt-3 text-xs font-semibold">{t('تركز انتهاء العقود','Lease expiry concentration')}</h4>
 <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-xs"><thead><tr>{[t('الأشهر','Months'),t('الإيجار السنوي المعرض للانتهاء','Annual rent expiring'),t('الحصة','Share'),t('الحد المراجع','Reviewed threshold')].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{result.expiryConcentration.map(x=><tr key={x.horizonMonths} className="border-t border-slate-800"><td className="p-2">{n(x.horizonMonths)}</td><td className="p-2">{sar(x.expiringAnnualRentSar)}</td><td className="p-2">{pct(x.rentShare)}</td><td className="p-2">{pct(x.maximumRentShare)}</td></tr>)}</tbody></table></div>
 <ul data-testid="income-review-risks" className="mt-2 text-xs text-amber-200">{result.riskFlags.map(x=><li key={x}><code className="break-all">{x}</code></li>)}</ul>
 <button type="button" data-testid="income-review-report" onClick={download} className="mt-3 rounded border border-slate-700 px-3 py-2 text-xs">{t('تصدير مسودة النتائج','Export draft results')}</button></div>}
 </section>;
}
