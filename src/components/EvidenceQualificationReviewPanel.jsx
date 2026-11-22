import React,{useMemo,useState} from 'react';
const {useLocale}=require('../i18n/LocaleContext.js');
const {
 qualifiedResearchIntake,portableReviewDossier,
}=require('../market/evidence-qualification-gate');
const CODES=Object.freeze({
 REFERENCE_ONLY_NOT_A_TRANSACTION:['مرجع موقع وليس صفقة','Website reference, not a transaction'],
 DATASET_LICENSE_AND_RIGHTS_NOT_INDEPENDENTLY_VERIFIED:['حقوق البيانات غير متحقق منها','Dataset reuse rights unverified'],
 INDEPENDENT_REVIEW_AND_SOURCE_EVIDENCE_REQUIRED:['يلزم تحقق مستقل من الدليل','Independent verification required'],
 TRANSACTION_ORIGIN_NOT_AUTHENTICATED:['الصفقة غير مثبتة من أصلها','Original transaction not authenticated'],
 AREA_BASIS_AND_INTEREST_NOT_VERIFIED:['المساحة ونوع الحق غير متحقق منهما','Area basis and legal interest unverified'],
 AGGREGATE_PERIOD_REQUIRED:['الفترة الإحصائية ناقصة','Aggregate period required'],
 AREA_STATISTIC_NOT_PROPERTY_COMPARABLE:['مؤشر منطقة وليس مقارنة لعقار','Area aggregate is not a property comparable'],
 AVM_IS_NOT_AN_EXECUTED_TRANSACTION:['تقدير آلي وليس صفقة منفذة','Automated estimate is not a closed sale'],
 SUBJECT_CITY_MISMATCH:['مدينة مختلفة','Different city'],
 SUBJECT_DISTRICT_MISMATCH:['حي مختلف','Different district'],
 SUBJECT_ASSET_TYPE_MISMATCH:['نوع عقار مختلف','Different asset type'],
 POSSIBLE_CROSS_PROVIDER_SAME_TRANSACTION:['اشتباه صفقة مكررة بين مزودين','Possible same transaction across providers'],
 UNTRUSTED_AUTHORITY_CLAIM:['ادعاء اعتماد غير موثوق','Untrusted approval claim'],
 SOURCE_URL_UNTRUSTED:['عنوان المصدر غير موثوق','Untrusted source URL'],
 INVALID_OR_AUTHORITY_FORGED_MANUAL_REFERENCE:['مرجع يدوي غير صالح أو معدل','Invalid or altered manual reference'],
});
function label(code,en){
 return CODES[code]?.[en?1:0]||(en?'Review required':'يلزم فحص الدليل');
}
export default function EvidenceQualificationReviewPanel({records=[],references=[],subject={}}){
 const {locale}=useLocale(),en=locale==='en';
 const tr=(ar,english)=>en?english:ar;
 const [downloadError,setDownloadError]=useState(false);
 const result=useMemo(()=>{
  try{return qualifiedResearchIntake({
    records,references,
    subject:{city:subject?.city||'',district:subject?.district||'',
      assetType:subject?.assetType||''},
  });}catch{return null;}
 },[records,references,subject?.city,subject?.district,subject?.assetType]);
 function download(){
  if(!result)return;
  try{
   const raw=portableReviewDossier(result);
   const blob=new Blob([raw],{type:'application/json;charset=utf-8'});
   const u=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=u;a.download='startak-evidence-review-hold.json';
   document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);
   setDownloadError(false);
  }catch{setDownloadError(true);}
 }
 const count=result?.totals;
 return <section data-testid="evidence-qualification-gate" dir={en?'ltr':'rtl'}
  className="mt-4 rounded-lg border border-amber-700 p-3 text-slate-100">
  <h4 className="text-sm font-semibold">
   {tr('محرك تأهيل الأدلة العقارية — مراجعة قبل التقييم',
    'Property evidence qualification — pre-valuation review')}
  </h4>
  <p className="mt-2 text-xs text-amber-200" data-testid="qualification-decision">
   {tr('القرار: تعليق الاعتماد. يلزم توثيق حقوق البيانات ومصدر الصفقات وهوية العقار ومراجعة مستقلة.',
    'Decision: HOLD. Dataset rights, original records, property identity and independent review are required.')}
  </p>
  {!result?<p className="mt-2 text-xs">
    {tr('تعذر فحص السجلات؛ تحقق من نوع البيانات وحدود الاستيراد.',
     'Cannot evaluate intake; check record format and import limits.')}
  </p>:<>
   <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs" data-testid="qualification-summary">
    <div className="rounded border border-slate-700 p-2">
     {tr('سجلات بحثية','Research records')}: <strong>{count.importedRows}</strong>
    </div>
    <div className="rounded border border-slate-700 p-2">
     {tr('مراجع يدوية','Manual references')}: <strong>{count.manualReferences}</strong>
    </div>
    <div className="rounded border border-slate-700 p-2">
     {tr('صفقات مرشحة للمراجعة','Reported-sale candidates')}: <strong>{count.reportedSaleCandidates}</strong>
    </div>
    <div className="rounded border border-slate-700 p-2">
     {tr('مقارنات مؤكدة مستقلة','Independently verified comparables')}: <strong>0</strong>
    </div>
    <div className="rounded border border-slate-700 p-2">
     {tr('مكررات داخل المصدر','Same-source duplicates')}: <strong>{count.duplicatePairs}</strong>
    </div>
    <div className="rounded border border-slate-700 p-2">
     {tr('مشتبه بها بين المصادر','Possible cross-provider duplicates')}: <strong>{count.crossProviderReviewPairs}</strong>
    </div>
    <div className="rounded border border-slate-700 p-2">
     {tr('سجلات غير صالحة','Rejected intake rows')}: <strong>{count.rejected}</strong>
    </div>
    <div className="rounded border border-slate-700 p-2">
     {tr('قيم سوقية معتمدة','Certified market values')}: <strong>0</strong>
    </div>
   </div>
   <p className="mt-3 text-xs text-slate-300">
    {tr('هذه النتائج فحص أولي للهوية والتواريخ والتكرار ونوع الدليل؛ لا تثبت سعر البيع أو حق إعادة الاستخدام أو الملكية.',
     'These are preliminary identity/date/duplicate/evidence-type checks; they do not authenticate sale price, reuse rights or title.')}
   </p>
   <div data-testid="qualification-findings" className="mt-2 max-h-52 overflow-y-auto space-y-2 text-xs">
    {result.findings.slice(0,25).map(f=><div key={f.index} className="rounded border border-slate-700 p-2">
     <span className="font-medium">{tr('سجل','Row')} {f.index+1}</span>{' · '}
     <span data-user-content translate="no">{f.sourceId||'—'}</span>{' · '}
     {f.status==='REJECTED'?tr('مرفوض','Rejected'):tr('معلّق للمراجعة','Held for review')}
     <p className="mt-1 text-amber-200">{f.reasons.slice(0,3).map(c=>label(c,en)).join('؛ ')}</p>
     {f.warnings.length>0&&<p className="mt-1 text-slate-300">
      {f.warnings.slice(0,2).map(c=>label(c,en)).join('؛ ')}
     </p>}
    </div>)}
    {result.referenceFindings.length>0&&<p className="text-xs">
     {tr('مراجع المواقع مسجلة للبحث فقط؛ لا تمثل صفقات منفذة أو نتائج تقييم.',
      'Manual links are research-only, not closed transactions or valuation outcomes.')}
    </p>}
   </div>
   <button type="button" onClick={download} data-testid="qualification-download-review"
    className="mt-3 rounded border border-amber-600 px-3 py-2 text-xs text-amber-100">
    {tr('تنزيل ملف متطلبات المراجعة','Download reviewer checklist file')}
   </button>
   <p className="mt-2 text-xs text-slate-400">
    {tr('الملف يتضمن أعداد السجلات وأسباب التعليق والمصادر، ولا يتضمن مبالغ الصفقات أو بيانات الملاك. لا يصدر اعتمادًا مهنيًا.',
     'The file contains review counts, reason codes and sources, without deal prices or owner identity. It grants no professional approval.')}
   </p>
   {downloadError&&<p role="status" className="mt-1 text-xs text-rose-300">
    {tr('تعذر إنشاء ملف المراجعة','Could not generate review file')}
   </p>}
  </>}
 </section>;
}
