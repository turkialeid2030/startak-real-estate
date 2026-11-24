import React,{useState,useRef,useEffect,useLayoutEffect} from 'react';
import {usePersonalCaseSession} from './PersonalCaseSessionContext.jsx';
const browserStorage=require('../storage/browser-local-storage-provider');
const {saveEncryptedDepreciationDraft,loadEncryptedDepreciationDraft}=require('../cost/encrypted-depreciation-draft');
const {useLocale}=require('../i18n/LocaleContext.js');
const {reviewLocalDepreciation,MAX_BYTES,STATUS}=require('../cost/local-depreciation-review.js');
function download(payload,name,type='application/json'){
 const url=URL.createObjectURL(new Blob([payload],{type}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
export default function LocalDepreciationReviewPanel(){
 const {locale}=useLocale(),en=locale==='en',t=(ar,english)=>en?english:ar;
 const [caseId,setCase]=useState(''),[propertyRef,setProperty]=useState(''),[result,setResult]=useState(null),[source,setSource]=useState(null),[busy,setBusy]=useState(false);
 const {linkedCase}=usePersonalCaseSession();
 const [passphrase,setPassphrase]=useState(''),[confirmed,setConfirmed]=useState(false),[overwrite,setOverwrite]=useState(false),[storageNotice,setStorageNotice]=useState('');
 const epoch=useRef(0),fileRef=useRef(null);
 useEffect(()=>()=>{epoch.current++;},[]);
 const clear=()=>{epoch.current++;setResult(null);setSource(null);setBusy(false);setPassphrase('');setConfirmed(false);setOverwrite(false);setStorageNotice('');if(fileRef.current)fileRef.current.value='';};
 useLayoutEffect(()=>{clear();setCase(linkedCase?.caseId||'');setProperty('');},[linkedCase?.caseId,linkedCase?.name,linkedCase?.mode]);
 async function load(file){
  const token=++epoch.current;setResult(null);setSource(null);setBusy(false);if(!file)return;
  if(file.size>MAX_BYTES){setResult({status:STATUS.HOLD,blockers:['C59_FILE_SIZE_INVALID']});return;}
  setBusy(true);
  try{
   const raw=await file.text();
   const next=await reviewLocalDepreciation({text:raw,expectedCaseId:caseId.trim(),expectedPropertyRef:propertyRef.trim()});
   if(epoch.current!==token)return;
   setResult(next);if(next.status===STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW){
    const parsed=JSON.parse(raw);
    const {packet,allocations,omissionReviews,ageLifeChecks=[]}=parsed;
    setSource(JSON.stringify({packet,allocations,omissionReviews,ageLifeChecks}));
   }
  }catch{if(epoch.current===token)setResult({status:STATUS.HOLD,blockers:['C59_LOCAL_REVIEW_FAILED']});}
  finally{if(epoch.current===token)setBusy(false);}
 }
 const ok=result?.status===STATUS.READY_FOR_INDEPENDENT_PROFESSIONAL_REVIEW;
 const linked=!!linkedCase&&linkedCase.mode==='building'&&caseId===linkedCase.caseId;
 async function persist(action){
  if(!linked||!propertyRef.trim()||passphrase.length<12||!browserStorage.isAvailable())return;
  const token=++epoch.current;setBusy(true);setStorageNotice('');
  if(action==='load'){setResult(null);setSource(null);}
  try{
   const options={storage:browserStorage,dealId:caseId,propertyRef:propertyRef.trim(),passphrase};
   if(action==='save'){
    await saveEncryptedDepreciationDraft({...options,text:source,confirmed,overwrite});
    if(epoch.current===token)setStorageNotice('saved');
   }else{
    const restored=await loadEncryptedDepreciationDraft(options);
    if(epoch.current!==token)return;
    if(restored.found){setSource(restored.text);setResult(restored.result);setStorageNotice('loaded');}
    else setStorageNotice('missing');
   }
  }catch(error){if(epoch.current===token)setStorageNotice(error?.message==='C59_EXISTING_DRAFT_CONFIRM_OVERWRITE'?'exists':'failed');}
  finally{if(epoch.current===token){setBusy(false);setPassphrase('');setConfirmed(false);setOverwrite(false);}}
 }
 const money=n=>new Intl.NumberFormat(en?'en-SA':'ar-SA',{style:'currency',currency:'SAR',maximumFractionDigits:2}).format(n);
 return <section data-testid="local-depreciation-review" className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-slate-100" dir={en?'ltr':'rtl'}>
 <h3 className="text-sm font-semibold">{t('مراجعة الإهلاك حسب مكونات العقار','Component depreciation review')}</h3>
 <p className="mt-2 text-xs text-amber-200">{t('بحث محلي غير معتمد. تطابق البصمة لا يثبت أصالة الدليل أو هوية المراجع. لا يعدل الصفقة أو يمنح تفويضًا.','Uncertified local research. Hash consistency does not authenticate evidence or reviewers. No deal changes or authorization.')}</p>
 <div className="mt-3 grid gap-2 md:grid-cols-2">
 <label className="text-xs">{t('معرف الحالة المتوقع','Expected case ID')}<input data-testid="depreciation-case" value={caseId} maxLength={1024} onChange={e=>{clear();setCase(e.target.value);}} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>
 <label className="text-xs">{t('مرجع العقار المتوقع','Expected property reference')}<input data-testid="depreciation-property" value={propertyRef} maxLength={1024} onChange={e=>{clear();setProperty(e.target.value);}} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>
 </div>
 <label className="mt-3 block text-xs">{t('استيراد ملف مدخلات التكلفة وتوزيع الإهلاك','Import cost packet and allocations (JSON)')}<input ref={fileRef} data-testid="depreciation-file" type="file" accept=".json,application/json" disabled={busy||!caseId.trim()||!propertyRef.trim()} onChange={e=>load(e.target.files?.[0])} className="mt-2 block w-full"/></label>
 <p className="mt-2 text-xs text-slate-400">{t('تتضمن الحزمة بيانات التكلفة وتوزيع الإهلاك ومراجعات أنواع الفقد، وفحص العمر الاقتصادي عند توفره. لا تُرفع الحزمة إلى الخادم.','Bundle includes packet, allocations, omissionReviews and optional ageLifeChecks. It is not uploaded.')}</p>
 <button type="button" data-testid="depreciation-reset" onClick={clear} className="mt-2 rounded border border-slate-700 px-3 py-2 text-xs">{t('مسح المراجعة','Clear review')}</button>
 {busy&&<p role="status" className="text-xs">{t('جارٍ التحقق المحلي','Checking locally')}</p>}
 {result&&<div data-testid="depreciation-status" className="mt-3 text-xs" data-status={result.status}>{ok?t('مطابقة حسابية فقط — مراجعة مستقلة مطلوبة','Arithmetic reconciled only — independent review required'):t('معلّق — لم تُعرض نتائج حسابية','HOLD — calculation results suppressed')}</div>}
 {result&&!ok&&<ul className="mt-2 text-xs text-amber-200">{result.blockers.map(code=><li key={code} className="break-all"><code>{code}</code></li>)}</ul>}
 {linked&&<div className="mt-3 rounded border border-slate-700 p-3 text-xs" data-testid="depreciation-local-custody">
 <h4 className="font-semibold">{t('حفظ مشفر محلي مرتبط بالصفقة النشطة','Encrypted local draft linked to active deal')}</h4>
 <p className="mt-2" data-user-content>{linkedCase.name}</p>
 <p className="mt-2 text-amber-200">{t('لا مزامنة ولا استعادة لكلمة المرور. لا يُعد هذا مخزنًا مؤسسيًا أو نسخة احتياطية. احتفظ بنسخة خارج المتصفح.','No synchronization or password recovery. This is not an institutional vault or backup. Retain an external copy.')}</p>
 <label className="mt-2 block">{t('عبارة مرور خاصة لا تقل عن ١٢ حرفًا','Private passphrase, at least 12 characters')}<input type="password" autoComplete="new-password" maxLength={256} disabled={busy} value={passphrase} onChange={e=>setPassphrase(e.target.value)} data-testid="depreciation-passphrase" className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>
 <label className="mt-2 block"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> {t('أقر بأن مرجع العقار يخص الصفقة النشطة وأوافق على الحفظ المشفر محليًا','I attest the property reference belongs to this deal and consent to encrypted local storage')}</label>
 <label className="mt-2 block"><input type="checkbox" checked={overwrite} disabled={busy} onChange={e=>setOverwrite(e.target.checked)}/> {t('أوافق على استبدال المسودة الموجودة إن وجدت','Replace existing draft if present')}</label>
 <div className="mt-2 flex flex-wrap gap-2"><button type="button" data-testid="depreciation-encrypted-save" disabled={busy||!ok||!confirmed||passphrase.length<12} onClick={()=>persist('save')} className="rounded border border-slate-700 px-3 py-2">{t('حفظ مشفر','Encrypt and save')}</button><button type="button" data-testid="depreciation-encrypted-load" disabled={busy||!propertyRef.trim()||passphrase.length<12} onClick={()=>persist('load')} className="rounded border border-slate-700 px-3 py-2">{t('فتح وإعادة احتساب','Unlock and recalculate')}</button></div>
 <p role="status" data-testid="depreciation-storage-notice">{({saved:t('تم التحقق من الحفظ المحلي المشفر','Encrypted local save verified'),loaded:t('استعيدت المدخلات وأعيد الحساب','Inputs restored and recalculated'),missing:t('لا توجد مسودة محفوظة','No saved draft'),exists:t('توجد مسودة؛ يلزم إقرار الاستبدال','Existing draft requires overwrite consent'),failed:t('تعذر الحفظ أو فتح المسودة؛ تحقق من الهوية والعبارة ومساحة التخزين','Save or unlock failed; check scope, passphrase and storage')})[storageNotice]||''}</p>
 </div>}
 {ok&&<div data-testid="depreciation-result" className="mt-3">
 <div className="grid gap-2 md:grid-cols-3 text-xs">{[[t('قيمة الأرض','Land value'),result.landValueSar],[t('تكلفة التحسينات الجديدة','Improvement cost new'),result.improvementCostNewSar],[t('الإهلاك المتراكم','Accrued depreciation'),result.accruedDepreciationSar],[t('مؤشر طريقة التكلفة غير المعتمد','Uncertified cost indication'),result.costApproachValueIndicationSar]].map(([label,value])=><div key={label} className="rounded border border-slate-700 p-2">{label}<strong className="block mt-1">{money(value)}</strong></div>)}</div>
 <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[600px] text-xs"><thead><tr>{[t('المكون','Component'),t('التكلفة الجديدة','Cost new'),t('مادي','Physical'),t('وظيفي','Functional'),t('خارجي','External'),t('القيمة المتبقية','Residual')].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{result.componentDepreciationTrace.map(r=><tr key={r.componentId} className="border-t border-slate-800"><td className="p-2 break-all" data-user-content>{r.componentId}</td>{[r.costNewSar,r.physicalLossSar,r.functionalLossSar,r.externalLossSar,r.residualImprovementValueSar].map((v,i)=><td key={i} className="p-2">{money(v)}</td>)}</tr>)}</tbody></table></div>
 <div className="mt-3 flex flex-wrap gap-2"><button type="button" data-testid="depreciation-save" onClick={()=>download(source,'local-depreciation-inputs.json')} className="rounded border border-slate-700 px-3 py-2 text-xs">{t('حفظ المدخلات لإعادة الاستيراد','Save inputs for reimport')}</button><button type="button" data-testid="depreciation-report" onClick={()=>download(JSON.stringify({schemaVersion:1,kind:'LOCAL_RESEARCH_DRAFT',...result},null,2),'local-depreciation-research-draft.json')} className="rounded border border-slate-700 px-3 py-2 text-xs">{t('تصدير مسودة النتائج','Export draft results')}</button></div>
 </div>}
 </section>;
}
