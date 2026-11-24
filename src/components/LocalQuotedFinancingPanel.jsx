import React,{useState,useRef,useLayoutEffect,useEffect} from 'react';
import {usePersonalCaseSession} from './PersonalCaseSessionContext.jsx';
const {useLocale}=require('../i18n/LocaleContext.js');
const {reviewLocalQuotedFinancing,MAX_BYTES}=require('../financing/local-quoted-financing-review.js');
const browserStorage=require('../storage/browser-local-storage-provider');
const {saveEncryptedFinancingDraft,loadEncryptedFinancingDraft}=require('../financing/encrypted-financing-draft');
const READY='READY_FOR_PROFESSIONAL_FINANCING_REVIEW';
export default function LocalQuotedFinancingPanel(){
 const {locale}=useLocale(),en=locale==='en',t=(ar,english)=>en?english:ar;
 const {linkedCase}=usePersonalCaseSession();
 const [caseId,setCase]=useState(''),[property,setProperty]=useState(''),[date,setDate]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
 const [source,setSource]=useState(null),[passphrase,setPassphrase]=useState(''),[confirmed,setConfirmed]=useState(false),[overwrite,setOverwrite]=useState(false),[notice,setNotice]=useState('');
 const epoch=useRef(0),fileRef=useRef(null);
 const clear=()=>{epoch.current++;setResult(null);setSource(null);setBusy(false);setPassphrase('');setConfirmed(false);setOverwrite(false);setNotice('');if(fileRef.current)fileRef.current.value='';};
 useEffect(()=>()=>{epoch.current++;},[]);
 useLayoutEffect(()=>{clear();setCase(linkedCase?.caseId||'');setProperty('');setDate('');},[linkedCase?.caseId,linkedCase?.name,linkedCase?.mode]);
 async function load(file){
  const token=++epoch.current;setResult(null);setSource(null);setNotice('');setBusy(false);if(!file)return;
  if(file.size>MAX_BYTES){setResult({status:'HOLD_LOCAL_FINANCING_REVIEW',blockers:['C14_FILE_LIMIT']});return;}
  setBusy(true);
  try{
   const raw=await file.text();
   const next=await reviewLocalQuotedFinancing({text:raw,expectedCaseId:caseId.trim(),expectedPropertyRef:property.trim(),asOfDate:date});
   if(epoch.current===token){setResult(next);if(next.status===READY)setSource(raw);}
  }catch{if(epoch.current===token)setResult({status:'HOLD_LOCAL_FINANCING_REVIEW',blockers:['C14_LOCAL_REVIEW_FAILED']});}
  finally{if(epoch.current===token)setBusy(false);}
 }
 const ok=result?.status===READY;
 const linked=!!linkedCase&&caseId===linkedCase.caseId;
 async function persist(action){
  if(!linked||!property.trim()||!date||passphrase.length<12)return;
  if(!browserStorage.isAvailable()){setNotice('failed');return;}
  const token=++epoch.current;setBusy(true);setNotice('');
  if(action==='load'){setResult(null);setSource(null);}
  try{
   const opts={storage:browserStorage,dealId:caseId,propertyRef:property.trim(),asOfDate:date,passphrase,isCurrent:()=>epoch.current===token};
   if(action==='save'){await saveEncryptedFinancingDraft({...opts,text:source,confirmed,overwrite});if(epoch.current===token)setNotice('saved');}
   else{const restored=await loadEncryptedFinancingDraft(opts);if(epoch.current!==token)return;if(restored.found){setResult(restored.result);setSource(restored.text);setNotice('loaded');}else setNotice('missing');}
  }catch(e){if(epoch.current===token)setNotice(e?.message==='C14_EXISTING_DRAFT_CONFIRM_OVERWRITE'?'exists':'failed');}
  finally{if(epoch.current===token){setBusy(false);setPassphrase('');setConfirmed(false);setOverwrite(false);}}
 }
 const money=n=>new Intl.NumberFormat(en?'en-SA':'ar-SA',{style:'currency',currency:'SAR',maximumFractionDigits:2}).format(n);
 const num=n=>new Intl.NumberFormat(en?'en-SA':'ar-SA',{maximumFractionDigits:2}).format(n);
 function download(){
  if(!ok)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify({...result,kind:'LOCAL_RESEARCH_DRAFT'},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='local-financing-review-draft.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 }
 const fields=[[t('معرف الحالة المتوقع','Expected case ID'),caseId,setCase,'financing-case'],[t('مرجع العقار المتوقع','Expected property reference'),property,setProperty,'financing-property'],[t('تاريخ المقارنة','Comparison date'),date,setDate,'financing-date']];
 return <section data-testid="local-financing-review" dir={en?'ltr':'rtl'} className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-slate-100">
 <h3 className="text-sm font-semibold">{t('مقارنة عروض التمويل','Quoted financing comparison')}</h3>
 <p className="mt-2 text-xs text-amber-200">{t('مقارنة بحثية محلية غير ملزمة في التاريخ المختار، وليست إثباتًا لصلاحية العروض اليوم. التكلفة الاسمية ليست معدل النسبة السنوي، ولا تمثل اعتمادًا ائتمانيًا أو توصية باختيار الممول. لا تعدل الصفقة.','Nonbinding local research at the selected date, not proof of current quote validity. Nominal cost is not APR or a credit approval or lender recommendation. No deal changes.')}</p>
 <div className="mt-3 grid gap-2 md:grid-cols-3">{fields.map(([label,value,set,id])=><label key={id} className="text-xs">{label}<input data-testid={id} type={id==='financing-date'?'date':'text'} maxLength={160} value={value} readOnly={id==='financing-case'&&!!linkedCase} onChange={e=>{clear();set(e.target.value);}} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>)}</div>
 <label className="mt-3 block text-xs">{t('استيراد ملف عروض التمويل وسياسة المقارنة','Import quotes and comparison policy file')}<input ref={fileRef} type="file" data-testid="financing-file" accept=".json,application/json" disabled={busy||!caseId.trim()||!property.trim()||!date} onChange={e=>load(e.target.files?.[0])} className="mt-1 block w-full"/></label>
 <p className="mt-2 text-xs text-slate-400">{t('يُتحقق من اتساق بصمات العروض والسياسة محليًا، ولا يثبت ذلك أصالة المصدر. لا تُرفع الملفات أو تُحفظ تلقائيًا.','Offer and policy digest consistency is checked locally, not source authenticity. Files are not uploaded or automatically stored.')}</p>
 <button type="button" data-testid="financing-reset" onClick={clear} className="mt-2 rounded border border-slate-700 px-3 py-2 text-xs">{t('مسح المقارنة','Clear comparison')}</button>
 {busy&&<p role="status" className="mt-2 text-xs">{t('جارٍ التحقق المحلي','Checking locally')}</p>}
 {result&&<div data-testid="financing-status" data-status={result.status} className="mt-3 text-xs">{ok?t('اكتملت المقارنة الحسابية — مراجعة مستقلة مطلوبة','Arithmetic comparison complete — independent review required'):t('معلّق — لم تُعرض نتائج المقارنة','HOLD — comparison results suppressed')}</div>}
 {result&&!ok&&<ul className="mt-2 text-xs text-amber-200">{result.blockers.map(code=><li key={code} className="break-all"><code>{code}</code></li>)}</ul>}
 {linked&&<div data-testid="financing-local-custody" className="mt-3 rounded border border-slate-700 p-3 text-xs">
 <h4 className="font-semibold">{t('حفظ مقارنة مشفرة مرتبطة بالصفقة النشطة','Encrypted comparison linked to active deal')}</h4>
 <p className="mt-2" data-user-content>{linkedCase.name}</p>
 <p className="mt-2 text-amber-200">{t('الحفظ على هذا المتصفح فقط. يلزم نفس مرجع العقار وتاريخ المقارنة وعبارة المرور للاستعادة. لا استعادة للعبارة ولا مزامنة أو نسخ احتياطي.','Local browser only. Restore requires the same property reference, comparison date and passphrase. No password recovery, synchronization or backup.')}</p>
 <label className="mt-2 block">{t('عبارة مرور خاصة لا تقل عن ١٢ حرفًا','Private passphrase, at least 12 characters')}<input data-testid="financing-passphrase" type="password" autoComplete="new-password" maxLength={256} disabled={busy} value={passphrase} onChange={e=>setPassphrase(e.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>
 <label className="mt-2 block"><input type="checkbox" data-testid="financing-consent" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> {t('أقر بارتباط مرجع العقار بالصفقة وأوافق على الحفظ المشفر محليًا','I attest the property reference belongs to this deal and consent to encrypted local storage')}</label>
 <label className="mt-2 block"><input type="checkbox" data-testid="financing-overwrite" checked={overwrite} disabled={busy} onChange={e=>setOverwrite(e.target.checked)}/> {t('أوافق على استبدال المسودة الموجودة إن وجدت','Replace existing draft if present')}</label>
 <div className="mt-2 flex flex-wrap gap-2"><button type="button" data-testid="financing-encrypted-save" disabled={busy||!ok||!source||!confirmed||passphrase.length<12} onClick={()=>persist('save')} className="rounded border border-slate-700 px-3 py-2">{t('حفظ مشفر','Encrypt and save')}</button><button type="button" data-testid="financing-encrypted-load" disabled={busy||!property.trim()||!date||passphrase.length<12} onClick={()=>persist('load')} className="rounded border border-slate-700 px-3 py-2">{t('فتح وإعادة احتساب','Unlock and recalculate')}</button></div>
 <p role="status" data-testid="financing-storage-notice">{({saved:t('تم التحقق من الحفظ المحلي المشفر','Encrypted local save verified'),loaded:t('استعيدت المدخلات وأعيد الحساب','Inputs restored and recalculated'),missing:t('لا توجد مسودة محفوظة','No saved draft'),exists:t('توجد مسودة؛ يلزم إقرار الاستبدال','Existing draft requires overwrite consent'),failed:t('تعذر الحفظ أو فتح المسودة؛ تحقق من الهوية والتاريخ والعبارة ومساحة التخزين','Save or unlock failed; check scope, date, passphrase and storage')})[notice]||''}</p>
 </div>}
 {ok&&<div data-testid="financing-result" className="mt-3">
 <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead><tr>{[t('العرض','Offer'),t('الترتيب التحليلي','Analytical rank'),t('أصل التمويل','Principal'),t('الرسوم','Fees'),t('المدفوعات المجدولة','Scheduled payments'),t('التكلفة الاسمية','Nominal cost'),t('نسبة التكلفة لكامل المدة','Whole-term cost ratio'),t('أقصى خدمة دين سنوية','Peak annual debt service'),t('الدفعة النهائية','Balloon'),t('المدة بالأيام','Tenor days')].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{result.analyticalOrdering.map(rank=>{const o=result.offers.find(x=>x.offerId===rank.offerId),m=o.metrics;return <tr key={o.offerId} className="border-t border-slate-800"><td data-user-content className="p-2 break-all">{o.offerId}</td><td className="p-2">{num(rank.rank)}</td>{[o.comparisonPrincipalSar,m.upfrontFeesSar,m.totalScheduledPaymentsSar,m.nominalFinancingCostSar].map((v,i)=><td key={i} className="p-2">{money(v)}</td>)}<td className="p-2">{num(m.nominalFinancingCostRatio*100)}%</td><td className="p-2">{money(m.maxCalendarYearDebtServiceSar)}</td><td className="p-2">{money(m.balloonTotalSar)}</td><td className="p-2">{num(m.tenorDays)}</td></tr>;})}</tbody></table></div>
 <h4 className="mt-3 text-xs font-semibold">{t('تنبيهات حدود المخاطر','Risk threshold flags')}</h4>
 <ul className="mt-1 text-xs text-amber-200" data-testid="financing-risk-flags">{result.riskFlags.map(code=><li key={code} className="break-all"><code>{code}</code></li>)}</ul>
 <button type="button" data-testid="financing-report" onClick={download} className="mt-3 rounded border border-slate-700 px-3 py-2 text-xs">{t('تصدير مسودة المقارنة','Export comparison draft')}</button>
 </div>}
 </section>;
}
