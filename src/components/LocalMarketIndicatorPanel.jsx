import React,{useState,useRef,useEffect,useLayoutEffect} from 'react';
const {useLocale}=require('../i18n/LocaleContext.js');
const {reviewLocalMarketIndicators,MAX_BYTES}=require('../market/local-market-indicator-review');
import {usePersonalCaseSession} from './PersonalCaseSessionContext.jsx';
const browserStorage=require('../storage/browser-local-storage-provider');
const {saveEncryptedMarketIndicatorDraft,loadEncryptedMarketIndicatorDraft}=require('../market/encrypted-market-indicator-draft');
const READY='READY_FOR_PROFESSIONAL_MARKET_REVIEW';
export default function LocalMarketIndicatorPanel(){
 const {locale}=useLocale(),en=locale==='en',t=(ar,english)=>en?english:ar;
 const [context,setContext]=useState(''),[geography,setGeography]=useState(''),[asset,setAsset]=useState(''),[date,setDate]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
 const {linkedCase}=usePersonalCaseSession();
 const [source,setSource]=useState(null),[passphrase,setPassphrase]=useState(''),[confirmed,setConfirmed]=useState(false),[overwrite,setOverwrite]=useState(false),[notice,setNotice]=useState('');
 const epoch=useRef(0),fileRef=useRef(null);
 const clear=()=>{epoch.current++;setResult(null);setSource(null);setBusy(false);setPassphrase('');setConfirmed(false);setOverwrite(false);setNotice('');if(fileRef.current)fileRef.current.value='';};
 useEffect(()=>()=>{epoch.current++;},[]);
 useLayoutEffect(()=>{clear();setContext('');setGeography('');setAsset('');setDate('');},[linkedCase?.caseId,linkedCase?.name,linkedCase?.mode]);
 const ready=!!(context.trim()&&geography.trim()&&asset.trim()&&date);
 async function load(file){
  const token=++epoch.current;setResult(null);setSource(null);setNotice('');setBusy(false);if(!file)return;
  const held=code=>({status:'HOLD_LOCAL_MARKET_REVIEW',blockers:[code],interpretations:[]});
  if(file.size>MAX_BYTES){setResult(held('C10_FILE_LIMIT'));return;}
  setBusy(true);
  try{const raw=await file.text();const next=await reviewLocalMarketIndicators({text:raw,expectedMarketContextId:context.trim(),expectedGeographyKey:geography.trim(),expectedAssetType:asset.trim(),asOfDate:date});if(epoch.current===token){setResult(next);if(next.status===READY)setSource(raw);}}
  catch{if(epoch.current===token)setResult(held('C10_LOCAL_REVIEW_FAILED'));}
  finally{if(epoch.current===token)setBusy(false);}
 }
 const ok=result?.status===READY;
 const linked=!!linkedCase?.caseId;
 async function persist(action){
  if(!linked||!ready||passphrase.length<12)return;
  if(!browserStorage.isAvailable()){setNotice('failed');return;}
  const token=++epoch.current;setBusy(true);setNotice('');
  if(action==='load'){setResult(null);setSource(null);}
  try{
   const opts={storage:browserStorage,dealId:linkedCase.caseId,marketContextId:context.trim(),geographyKey:geography.trim(),assetType:asset.trim(),asOfDate:date,passphrase,isCurrent:()=>epoch.current===token};
   if(action==='save'){await saveEncryptedMarketIndicatorDraft({...opts,text:source,confirmed,overwrite});if(epoch.current===token)setNotice('saved');}
   else{const restored=await loadEncryptedMarketIndicatorDraft(opts);if(epoch.current!==token)return;if(restored.found){setResult(restored.result);setSource(restored.text);setNotice('loaded');}else setNotice('missing');}
  }catch(e){if(epoch.current===token)setNotice(e?.message==='C10_EXISTING_DRAFT_CONFIRM_OVERWRITE'?'exists':'failed');}
  finally{if(epoch.current===token){setBusy(false);setPassphrase('');setConfirmed(false);setOverwrite(false);}}
 }
 const number=v=>new Intl.NumberFormat(en?'en-SA':'ar-SA',{maximumSignificantDigits:12}).format(v);
 const download=()=>{if(!ok)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...result,kind:'LOCAL_RESEARCH_DRAFT'},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='market-indicator-research-draft.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);};
 const fields=[[t('معرف السياق السوقي','Market context ID'),context,setContext,'market-indicator-context'],[t('معرف النطاق الجغرافي','Geography key'),geography,setGeography,'market-indicator-geography'],[t('نوع الأصل','Asset type'),asset,setAsset,'market-indicator-asset'],[t('تاريخ التحليل','Analysis date'),date,setDate,'market-indicator-date']];
 return <section data-testid="local-market-indicator-review" dir={en?'ltr':'rtl'} className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-slate-100">
 <h3 className="text-sm font-semibold">{t('تفسير مؤشرات السوق والسيولة','Market indicator and liquidity interpretation')}</h3>
 <p className="mt-2 text-xs text-amber-200">{t('مراجعة بحثية لبيانات مستوردة وفق سياسة تصنيف مدخلة. لا تُجلب بيانات حية ولا تثبت أصالة المصادر أو صلاحية الحدود التصنيفية. لا يُنتج التحليل توقعًا أو تقييمًا أو توصية بالشراء.','Research review of imported evidence under a supplied classification policy. No live data retrieval, source authentication or threshold validation. No forecast, valuation or purchase recommendation.')}</p>
 <div className="mt-3 grid gap-2 md:grid-cols-4">{fields.map(([label,value,set,id])=><label key={id} className="text-xs">{label}<input data-testid={id} type={id==='market-indicator-date'?'date':'text'} maxLength={160} value={value} onChange={e=>{clear();set(e.target.value);}} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>)}</div>
 <label className="mt-3 block text-xs">{t('استيراد حزمة الأدلة السوقية وسياسة التصنيف','Import market evidence and classification policy')}<input ref={fileRef} type="file" data-testid="market-indicator-file" accept=".json,application/json" disabled={busy||!ready} onChange={e=>load(e.target.files?.[0])} className="mt-1 block w-full"/></label>
 <p className="mt-2 text-xs text-slate-400">{t('تُستبعد أسعار العرض من التصنيف المبني على الأدلة الرسمية. لا تحفظ الملفات تلقائيًا ولا تُرفع إلى الخادم.','Asking prices are excluded from authoritative classifications. Files are not automatically stored or uploaded.')}</p>
 <button type="button" data-testid="market-indicator-reset" onClick={clear} className="mt-2 rounded border border-slate-700 px-3 py-2 text-xs">{t('مسح التحليل','Clear review')}</button>
 {busy&&<p role="status" className="text-xs">{t('جارٍ التحقق المحلي','Checking locally')}</p>}
 {result&&<p data-testid="market-indicator-status" data-status={result.status} className="mt-3 text-xs">{ok?t('اكتمل التصنيف الحسابي — مراجعة مستقلة مطلوبة','Classification complete — independent review required'):t('معلّق — لم تعرض النتائج','HOLD — results suppressed')}</p>}
 {result&&!ok&&<ul className="text-xs text-amber-200">{result.blockers.map(code=><li key={code}><code className="break-all">{code}</code></li>)}</ul>}
 {linked&&<div data-testid="market-indicator-local-custody" className="mt-3 rounded border border-slate-700 p-3 text-xs">
 <h4 className="font-semibold">{t('حفظ تحليل السوق المشفر للصفقة النشطة','Encrypted market review for active deal')}</h4>
 <p data-testid="market-indicator-linked-deal" data-user-content>{linkedCase.name}</p>
 <p className="mt-2 text-amber-200">{t('الحفظ محلي فقط. للاستعادة يلزم نفس الصفقة والسياق والنطاق ونوع الأصل والتاريخ وعبارة المرور. لا مزامنة ولا استعادة لعبارة المرور.','Local storage only. Restore requires the same deal, context, geography, asset type, date and passphrase. No synchronization or passphrase recovery.')}</p>
 <label className="mt-2 block">{t('عبارة مرور خاصة لا تقل عن ١٢ حرفًا','Private passphrase, at least 12 characters')}<input data-testid="market-indicator-passphrase" type="password" autoComplete="new-password" maxLength={256} disabled={busy} value={passphrase} onChange={e=>setPassphrase(e.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>
 <label className="mt-2 block"><input type="checkbox" data-testid="market-indicator-consent" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> {t('أقر بملاءمة نطاق السوق للصفقة وأوافق على الحفظ المشفر محليًا','I attest the market scope applies to this deal and consent to encrypted local storage')}</label>
 <label className="mt-2 block"><input type="checkbox" data-testid="market-indicator-overwrite" checked={overwrite} disabled={busy} onChange={e=>setOverwrite(e.target.checked)}/> {t('أوافق على استبدال المسودة الموجودة إن وجدت','Replace existing draft if present')}</label>
 <div className="mt-2 flex flex-wrap gap-2"><button type="button" data-testid="market-indicator-encrypted-save" disabled={busy||!ok||!source||!confirmed||passphrase.length<12} onClick={()=>persist('save')} className="rounded border border-slate-700 px-3 py-2">{t('حفظ مشفر','Encrypt and save')}</button><button type="button" data-testid="market-indicator-encrypted-load" disabled={busy||!ready||passphrase.length<12} onClick={()=>persist('load')} className="rounded border border-slate-700 px-3 py-2">{t('فتح وإعادة احتساب','Unlock and recalculate')}</button></div>
 <p role="status" data-testid="market-indicator-storage-notice">{({saved:t('تم التحقق من الحفظ المحلي المشفر','Encrypted local save verified'),loaded:t('استعيدت المدخلات وأعيد الحساب','Inputs restored and recalculated'),missing:t('لا توجد مسودة محفوظة','No saved draft'),exists:t('توجد مسودة؛ يلزم إقرار الاستبدال','Existing draft requires overwrite consent'),failed:t('تعذر الحفظ أو فتح المسودة؛ تحقق من النطاق والتاريخ والعبارة ومساحة التخزين','Save or unlock failed; check scope, date, passphrase and storage')})[notice]||''}</p>
 </div>}
 {ok&&<div data-testid="market-indicator-result" className="mt-3">
 <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-xs"><thead><tr>{[t('البعد','Dimension'),t('المؤشر','Metric'),t('القيمة','Value'),t('الوحدة','Unit'),t('التصنيف وفق السياسة','Policy classification'),t('مرجع المصدر','Source reference'),t('الفترة','Period')].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{result.interpretations.map(x=><tr key={x.ruleId} className="border-t border-slate-800"><td data-user-content className="p-2">{x.dimension}</td><td data-user-content className="p-2">{x.metricField}</td><td className="p-2">{number(x.value)}</td><td data-user-content className="p-2">{x.unit}</td><td data-user-content className="p-2">{x.classification}</td><td data-user-content className="p-2 break-all">{x.lineage.sourceReference}</td><td data-user-content className="p-2">{x.lineage.periodKey}</td></tr>)}</tbody></table></div>
 <ul className="mt-2 text-xs text-amber-200">{result.warnings.map(x=><li key={x}><code className="break-all">{x}</code></li>)}</ul>
 <button type="button" data-testid="market-indicator-report" onClick={download} className="mt-3 rounded border border-slate-700 px-3 py-2 text-xs">{t('تصدير مسودة النتائج','Export draft results')}</button></div>}
 </section>;
}
