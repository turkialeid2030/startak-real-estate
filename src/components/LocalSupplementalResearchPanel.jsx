import React,{useState,useRef,useLayoutEffect,useEffect} from 'react';
import {usePersonalCaseSession} from './PersonalCaseSessionContext.jsx';
const {useLocale}=require('../i18n/LocaleContext.js');
const {MAX_BYTES,reviewSupplementalText,blankSupplementalInput}=require('../engines/financial/supplemental-research-input');
const browserStorage=require('../storage/browser-local-storage-provider');
const {saveEncryptedSupplementalDraft,loadEncryptedSupplementalDraft,deleteEncryptedSupplementalDraft}=require('../engines/financial/encrypted-supplemental-draft');
const {validateOpeningPortfolioSnapshot}=require('../portfolio/opening-return-snapshot');
const {buildSupplementalAppendix,reportReference}=require('../reporting/supplemental-research-appendix');
const METHODS={annual:['العوائد والاسترداد المخصوم','Annual returns and discounted payback'],gross:['عائد الإيجار الإجمالي ومضاعفه','Gross rent yield and multiplier'],wacc:['تكلفة رأس المال','Weighted average cost of capital'],breakEven:['نقطة التعادل وهامش الأمان','Break-even and margin of safety'],holding:['عائد الاحتفاظ والنمو والعائد الحقيقي','Holding, growth and real returns'],portfolio:['عائد المحفظة','Portfolio return']};
const LABELS={DISCOUNTED_PAYBACK_PERIOD_END:['الاسترداد المخصوم عند نهاية السنة','Discounted payback at year end'],PROFITABILITY_INDEX_CONVENTIONAL:['مؤشر الربحية للتدفقات التقليدية','Conventional profitability index'],EQUIVALENT_ANNUAL_ANNUITY:['القيمة السنوية المكافئة','Equivalent annual annuity'],GROSS_RENTAL_YIELD:['عائد الإيجار الإجمالي','Gross rental yield'],GROSS_RENT_MULTIPLIER:['مضاعف الإيجار الإجمالي','Gross rent multiplier'],WACC:['تكلفة رأس المال المرجحة','WACC'],PROJECT_BREAK_EVEN_UNITS:['تعادل المشروع بالوحدات','Break-even units'],PROJECT_BREAK_EVEN_REVENUE:['إيراد التعادل','Break-even revenue'],MARGIN_OF_SAFETY:['هامش الأمان','Margin of safety'],HOLDING_PERIOD_RETURN:['عائد فترة الاحتفاظ','Holding period return'],VALUE_ONLY_CAGR:['النمو السنوي المركب للقيمة دون التوزيعات','Value-only CAGR'],REAL_HOLDING_PERIOD_RETURN:['العائد الحقيقي لفترة الاحتفاظ','Real holding return'],PORTFOLIO_HOLDING_PERIOD_RETURN:['عائد المحفظة لفترة الاحتفاظ','Portfolio holding return']};
const REASONS={NOT_RECOVERED_WITHIN_STUDY:['لم يتحقق الاسترداد خلال الدراسة','Not recovered during study'],NON_CONVENTIONAL_CASHFLOWS:['تدفقات غير تقليدية','Non-conventional cash flows'],ZERO_GROSS_RENT:['الإيجار الإجمالي صفر','Zero gross rent'],NON_POSITIVE_CONTRIBUTION:['هامش المساهمة غير موجب','Non-positive contribution'],ZERO_REVENUE:['الإيراد صفر','Zero revenue'],INFLATION_NOT_SUPPLIED:['لم يقدم معدل التضخم','Inflation not supplied']};
export default function LocalSupplementalResearchPanel(){
 const {locale}=useLocale(),en=locale==='en',t=(ar,eng)=>en?eng:ar;
 const {linkedCase,researchScope}=usePersonalCaseSession();
 const [method,setMethod]=useState('annual'),[caseId,setCase]=useState(''),[property,setProperty]=useState(''),[asOfDate,setDate]=useState(''),[portfolioId,setPortfolio]=useState(''),[assets,setAssets]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
 const [source,setSource]=useState(null),[passphrase,setPassphrase]=useState(''),[confirmed,setConfirmed]=useState(false),[overwrite,setOverwrite]=useState(false),[confirmDelete,setConfirmDelete]=useState(false),[notice,setNotice]=useState('');
 const [snapshotText,setSnapshotText]=useState(null),[snapshotNotice,setSnapshotNotice]=useState('');
 const [reportText,setReportText]=useState(null),[appendixNotice,setAppendixNotice]=useState('');
 const epoch=useRef(0),fileRef=useRef(null),snapshotRef=useRef(null),reportRef=useRef(null);
 function clear(preserveSnapshot=false){setReportText(null);setAppendixNotice('');if(reportRef.current)reportRef.current.value='';if(preserveSnapshot!==true){setSnapshotText(null);setSnapshotNotice('');if(snapshotRef.current)snapshotRef.current.value='';}epoch.current++;setResult(null);setSource(null);setPassphrase('');setConfirmed(false);setOverwrite(false);setConfirmDelete(false);setNotice('');setBusy(false);if(fileRef.current)fileRef.current.value='';}
 useLayoutEffect(()=>{clear();setCase(linkedCase?.caseId||'');setProperty('');setDate('');setPortfolio('');setAssets('');},[linkedCase?.caseId,linkedCase?.name,linkedCase?.mode]);
 useEffect(()=>()=>{epoch.current++;},[]);
 const isPortfolio=method==='portfolio',assetIds=assets.split('\n').map(x=>x.trim()).filter(Boolean);
 const expected=isPortfolio?{portfolioId:portfolioId.trim(),asOfDate,assetIds}:{caseId:caseId.trim(),propertyRef:property.trim(),asOfDate};
 const ready=!!asOfDate&&(isPortfolio?!!portfolioId.trim()&&assetIds.length>=2&&assetIds.length<=1000&&new Set(assetIds).size===assetIds.length:!!caseId.trim()&&!!property.trim());
 const change=setter=>e=>{clear();setter(e.target.value);};
 function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function load(file){
  clear(true);const token=epoch.current;if(!file)return;setBusy(true);
  try{const raw=file.size>MAX_BYTES?null:await file.text();if(epoch.current===token){const next=reviewSupplementalText({method,text:raw,expected});setResult(next);if(next.status==='ANALYTICAL_ONLY'&&next.metrics.some(m=>Number.isFinite(m.value)))setSource(raw);}}
  catch{if(epoch.current===token)setResult({status:'HOLD',metrics:[],blockers:['RESEARCH_FILE_READ_FAILED']});}
  finally{if(epoch.current===token)setBusy(false);}
 }
 const usable=result?.status==='ANALYTICAL_ONLY';
 const linked=!isPortfolio&&!!linkedCase&&caseId===linkedCase.caseId;
 const custodyReady=linked||(isPortfolio&&!!snapshotText);
 async function loadSnapshot(file){
  clear();const token=epoch.current;if(!file)return;setBusy(true);
  try{const raw=file.size>MAX_BYTES?null:await file.text();validateOpeningPortfolioSnapshot(raw,expected);if(epoch.current===token){setSnapshotText(raw);setSnapshotNotice('valid');}}
  catch{if(epoch.current===token)setSnapshotNotice('invalid');}
  finally{if(epoch.current===token)setBusy(false);}
 }
 async function persist(action){
  if(!custodyReady||!ready||passphrase.length<12)return;
  // Revoke stale output before attempting an unlock, even when storage is denied.
  if(action==='load'){setResult(null);setSource(null);}
  if(!browserStorage.isAvailable()){
   epoch.current++;setBusy(false);setPassphrase('');setConfirmed(false);setOverwrite(false);setConfirmDelete(false);setNotice('failed');return;
  }
  const token=++epoch.current;setBusy(true);setNotice('');
  try{
   const opts={storage:browserStorage,dealId:linkedCase?.caseId,propertyRef:property.trim(),asOfDate,method,portfolioId:portfolioId.trim(),assetIds,snapshotText,passphrase,isCurrent:()=>epoch.current===token};
   if(action==='save'){await saveEncryptedSupplementalDraft({...opts,text:source,confirmed,overwrite});if(epoch.current===token)setNotice('saved');}
   else if(action==='delete'){const removed=await deleteEncryptedSupplementalDraft({...opts,confirmDelete});if(epoch.current===token){setResult(null);setSource(null);setNotice(removed.deleted?'deleted':'missing');}}
   else{const restored=await loadEncryptedSupplementalDraft(opts);if(epoch.current!==token)return;if(restored.found){setResult(restored.result);setSource(restored.text);setNotice('loaded');}else setNotice('missing');}
  }catch(e){if(epoch.current===token)setNotice(e?.message==='SUPPLEMENTAL_EXISTING_DRAFT_CONFIRM_OVERWRITE'?'exists':'failed');}
  finally{if(epoch.current===token){setBusy(false);setPassphrase('');setConfirmed(false);setOverwrite(false);setConfirmDelete(false);}}
 }
 async function loadReference(file){
  const token=++epoch.current;setReportText(null);setAppendixNotice('');if(!file)return;setBusy(true);
  try{const raw=file.size>MAX_BYTES?null:await file.text();reportReference(raw,expected);if(epoch.current===token){setReportText(raw);setAppendixNotice('linked');}}
  catch{if(epoch.current===token)setAppendixNotice('invalid');}
  finally{if(epoch.current===token)setBusy(false);}
 }
 function exportAppendix(){
  try{const a=buildSupplementalAppendix({method,text:source,expected,reportText,snapshotText});download('supplemental-research-appendix.json',a);setAppendixNotice('exported');}
  catch{setAppendixNotice('invalid');}
 }
 const number=(v,u)=>!Number.isFinite(v)?'—':new Intl.NumberFormat(en?'en-SA':'ar-SA',u==='RATIO'&&!result?.metrics?.some(m=>m.value===v&&m.id==='PROFITABILITY_INDEX_CONVENTIONAL')||['ANNUAL_RATIO','PERIOD_RATIO'].includes(u)?{style:'percent',maximumFractionDigits:3}:u.startsWith('SAR')?{style:'currency',currency:'SAR',maximumFractionDigits:2}:{maximumFractionDigits:4}).format(v);
 const fields=isPortfolio?[[t('معرف المحفظة','Portfolio ID'),portfolioId,setPortfolio,'portfolio']]:[[t('معرف الحالة','Case ID'),caseId,setCase,'case'],[t('مرجع العقار','Property reference'),property,setProperty,'property']];
 return <section data-testid="local-supplemental-research" dir={en?'ltr':'rtl'} className="mt-4 rounded-xl border border-slate-700 bg-slate-950/30 p-3 text-slate-100">
 <h3 className="text-sm font-semibold">{t('المؤشرات المالية والاستثمارية الإضافية','Supplemental financial and investment metrics')}</h3>
 <p className="mt-2 text-xs text-amber-200">{t('تحليل بحثي محلي من مدخلات موثقة ذاتيًا؛ لا يعدل محرك التقييم أو يثبت صحة المصدر أو يمنح صلاحية الاستثمار. لا حفظ تلقائي أو إرسال للخادم.','Local research using self-documented inputs; no change to valuation, independent source verification or investment authority. No automatic storage or server upload.')}</p>
 <label className="mt-3 block text-xs">{t('نوع التحليل','Analysis type')}<select data-testid="supplemental-method" value={method} onChange={change(setMethod)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2">{Object.entries(METHODS).map(([k,v])=><option key={k} value={k}>{v[en?1:0]}</option>)}</select></label>
 <div className="mt-3 grid gap-2 md:grid-cols-3">{[...fields,[t('تاريخ التحليل','Analysis date'),asOfDate,setDate,'date']].map(([label,v,set,id])=><label key={id} className="text-xs">{label}<input data-testid={'supplemental-'+id} value={v} type={id==='date'?'date':'text'} maxLength={160} readOnly={id==='case'&&!!linkedCase} onChange={change(set)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>)}</div>
 {isPortfolio&&<label className="mt-2 block text-xs">{t('معرفات جميع الأصول المتوقعة — معرف لكل سطر','All expected asset IDs — one per line')}<textarea data-testid="supplemental-assets" value={assets} maxLength={160000} onChange={change(setAssets)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>}
 {!isPortfolio&&linkedCase&&<button data-testid="supplemental-apply-date" type="button" disabled={researchScope?.caseId!==caseId} onClick={()=>{clear();setDate(researchScope.asOfDate);}} className="mt-2 rounded border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">{t('استخدام التاريخ المشترك','Use shared date')}</button>}
 <div className="mt-3 flex flex-wrap gap-2"><button type="button" data-testid="supplemental-template" disabled={!ready} onClick={()=>download('supplemental-research-input.json',blankSupplementalInput(method,expected))} className="rounded border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">{t('تحميل قالب المدخلات الفارغ','Download blank input template')}</button><button type="button" data-testid="supplemental-reset" onClick={clear} className="rounded border border-slate-700 px-3 py-2 text-xs">{t('مسح النتائج','Clear results')}</button></div>
 <label className="mt-3 block text-xs">{t('استيراد المدخلات بعد استكمالها','Import completed inputs')}<input ref={fileRef} data-testid="supplemental-file" type="file" accept=".json,application/json" disabled={!ready||busy} onChange={e=>load(e.target.files?.[0])} className="mt-1 block w-full"/></label>
 {busy&&<p role="status">{t('جارٍ التحقق','Checking')}</p>}
 {result&&<p data-testid="supplemental-status" data-status={result.status} className="mt-2 text-xs">{usable?t('نتائج تحليلية غير معتمدة','Non-authorizing analytical results'):t('المدخلات غير صالحة أو غير مكتملة','Invalid or incomplete inputs')}</p>}
 {isPortfolio&&<div className="mt-3 text-xs">
 <label>{t('استيراد لقطة المحفظة المستقلة لبداية الفترة','Import independent opening portfolio snapshot')}<input ref={snapshotRef} data-testid="supplemental-opening-snapshot" type="file" accept=".json,application/json" disabled={!ready||busy} onChange={e=>loadSnapshot(e.target.files?.[0])} className="mt-1 block w-full"/></label>
 <p className="mt-1 text-amber-200">{t('يلزم سجل المحفظة الموجود من محرك التركيز، بالقيم المهنية في بداية الفترة. البصمة تثبت اتساق المحتوى لا صحة المصدر.','Requires an existing concentration-engine snapshot with opening professional value indications. The hash checks consistency, not source authenticity.')}</p>
 <p role="status" data-testid="supplemental-snapshot-status">{snapshotNotice==='valid'?t('تم التحقق من اتساق لقطة البداية','Opening snapshot consistency verified'):snapshotNotice==='invalid'?t('لقطة البداية غير صالحة أو غير مطابقة','Opening snapshot invalid or mismatched'):''}</p>
 </div>}
 {custodyReady&&<div data-testid="supplemental-local-custody" className="mt-3 rounded border border-slate-700 p-3 text-xs">
 <h4 className="font-semibold">{t('مسودة مالية محلية مشفرة','Encrypted local financial draft')}</h4>
 <p data-user-content>{isPortfolio?portfolioId:linkedCase.name}</p>
 <p className="mt-2 text-amber-200">{t('مسودة محلية لكل طريقة وصفقة أو محفظة؛ يلزم النطاق نفسه والتاريخ وعبارة المرور، وللمحفظة نفس لقطة البداية. لا مزامنة ولا استعادة لعبارة المرور.','One local draft per method/deal or portfolio; same scope, date and passphrase required, and the same opening snapshot for a portfolio. No synchronization or passphrase recovery.')}</p>
 <label className="mt-2 block">{t('عبارة مرور خاصة لا تقل عن ١٢ حرفًا','Private passphrase, at least 12 characters')}<input data-testid="supplemental-passphrase" type="password" autoComplete="new-password" maxLength={256} disabled={busy} value={passphrase} onChange={e=>setPassphrase(e.target.value)} className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"/></label>
 <label className="mt-2 block"><input data-testid="supplemental-consent" type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> {t('أقر بنطاق التحليل وأوافق على الحفظ المحلي المشفر','I attest the analysis scope and consent to encrypted local storage')}</label>
 <label className="mt-2 block"><input data-testid="supplemental-overwrite" type="checkbox" checked={overwrite} disabled={busy} onChange={e=>setOverwrite(e.target.checked)}/> {t('أوافق على استبدال المسودة السابقة','Replace existing draft')}</label>
 <label className="mt-2 block"><input data-testid="supplemental-delete-consent" type="checkbox" checked={confirmDelete} disabled={busy} onChange={e=>setConfirmDelete(e.target.checked)}/> {t('أوافق على حذف المسودة بعد فتحها','Confirm deletion after unlock')}</label>
 <div className="mt-2 flex flex-wrap gap-2">{[['save',t('حفظ مشفر','Encrypt and save'),!usable||!source||!confirmed],['load',t('فتح وإعادة احتساب','Unlock and recalculate'),false],['delete',t('حذف المسودة','Delete draft'),!confirmDelete]].map(([action,label,blocked])=><button type="button" key={action} data-testid={'supplemental-encrypted-'+action} disabled={busy||!ready||passphrase.length<12||blocked} onClick={()=>persist(action)} className="rounded border border-slate-700 px-3 py-2 disabled:opacity-50">{label}</button>)}</div>
 <p role="status" data-testid="supplemental-storage-notice">{({saved:t('تم التحقق من الحفظ المحلي المشفر','Encrypted local save verified'),loaded:t('استعيدت المدخلات وأعيد الحساب','Inputs restored and recalculated'),deleted:t('تم التحقق من حذف المسودة','Draft deletion verified'),missing:t('لا توجد مسودة محفوظة','No saved draft'),exists:t('يلزم إقرار الاستبدال','Existing draft requires overwrite consent'),failed:t('تعذر الحفظ أو فتح المسودة','Save or unlock failed')})[notice]||''}</p>
 </div>}
 {isPortfolio&&!snapshotText&&<p className="mt-2 text-xs text-amber-200">{t('الحفظ والاستعادة مشروطان بلقطة بداية مطابقة.','Save and restore require a matching opening snapshot.')}</p>}
 {usable&&<div data-testid="supplemental-result" className="mt-3"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="p-2 text-start">{t('المؤشر','Metric')}</th><th className="p-2 text-start">{t('النتيجة','Result')}</th></tr></thead><tbody>{result.metrics.map(m=><tr data-testid={'supplemental-metric-'+m.id} key={m.id} className="border-t border-slate-800"><td className="p-2">{LABELS[m.id]?.[en?1:0]}</td><td className="p-2">{m.id==='PROFITABILITY_INDEX_CONVENTIONAL'&&Number.isFinite(m.value)?new Intl.NumberFormat(en?'en-SA':'ar-SA',{maximumFractionDigits:4}).format(m.value):number(m.value,m.unit)} {REASONS[m.reason]?.[en?1:0]||''}</td></tr>)}</tbody></table></div>
 <p className="mt-2 text-xs text-slate-400">{t('التقرير يتضمن أساس الاحتساب والمراجع والفترة؛ ليس تقرير تقييم مهني.','The draft includes calculation basis, sources and period; not a professional valuation report.')}</p>
 {!isPortfolio&&source&&<label className="mt-3 block text-xs">{t('اختياري: ربط الملحق بنسخة التقرير المرجعي المطابقة','Optional: link appendix to matching reference report')}<input ref={reportRef} data-testid="supplemental-reference-report" type="file" accept=".json,application/json" disabled={busy} onChange={e=>loadReference(e.target.files?.[0])} className="mt-1 block w-full"/></label>}
 <p className="mt-2 text-xs text-amber-200">{t('الملحق مستقل وغير معتمد؛ ربط البصمة لا يثبت هوية مُصدر التقرير ولا يرفع حالة اعتماده.','Separate uncertified appendix; digest linkage does not authenticate the report issuer or upgrade QA.')}</p>
 <button data-testid="supplemental-appendix" type="button" disabled={busy||!source||(!isPortfolio&&appendixNotice==='invalid')} onClick={exportAppendix} className="mt-3 rounded border border-slate-700 px-3 py-2 text-xs disabled:opacity-50">{t('تصدير الملحق التحليلي الموثق بالبصمة','Export digest-linked analytical appendix')}</button>
 <p role="status" data-testid="supplemental-appendix-status" className="text-xs">{({linked:t('تمت مطابقة مرجع التقرير','Reference report matched'),invalid:t('تعذر مطابقة المرجع أو المدخلات','Reference or input mismatch'),exported:t('تم إنشاء الملحق المستقل','Separate appendix generated')})[appendixNotice]||''}</p>
 <button data-testid="supplemental-report" type="button" onClick={()=>download('supplemental-research-report.json',{...result,kind:'LOCAL_RESEARCH_DRAFT'})} className="mt-3 rounded border border-slate-700 px-3 py-2 text-xs">{t('تصدير مسودة التحليل','Export research draft')}</button></div>}
 </section>;
}
