import React,{useEffect,useRef,useState} from 'react';
const {ASSET_CLASS}=require('../project-model/project-profile');
const {
 EVIDENCE_TYPES,normalizeSpecialistReferenceIntake,
}=require('../app/specialist-reference-intake');
const {
 fingerprintLocalFile,addDocumentHash,normalizeManifest,
 assessLocalDocumentManifest,MAX_BYTES,
}=require('../app/specialist-document-intake');

const CONTROL_LABEL=Object.freeze({
 zoning:['مستند التخطيط','Zoning document'],
 titleInterest:['مستند الحقوق العقارية','Title document'],
 inspection:['تقرير المعاينة','Inspection report'],
 utilityService:['إثبات المرافق','Utility record'],
 fireLifeSafety:['مستند السلامة','Fire and safety record'],
 environmentalContamination:['تقرير البيئة','Environmental record'],
 deferredCapex:['مستند الصيانة والتكاليف','CAPEX record'],
 leaseRights:['مستند الإيجار','Lease record'],
 professionalSpecialistReview:['مستند المراجعة الفنية','Specialist review record'],
});
const MESSAGES=Object.freeze({
 ar:{
  heading:'بصمات المستندات المحلية — بدون رفع ملفات أو اعتماد مصدر',
  warning:'يمكن اختيار ملف PDF أو PNG أو JPEG حتى ٥ ميجابايت. تحسب المنصة بصمة SHA-256 من البايتات داخل هذا المتصفح فقط، وتحفظ نوع الملف وحجمه وبصمته ومرجع الدليل؛ ولا تحتفظ ببايتات المستند أو اسم الملف. البصمة لا تثبت صحة المستند أو حقوق استخدامه أو ترخيص المُراجع.',
  choose:'اختيار ملف لحساب البصمة',
  wait:'جارٍ حساب البصمة...',
  done:'تم حساب بصمة ملف محلي. لم يُرفع الملف ولم تُعتمد صحة مصدره.',
  error:'تعذر قبول الملف: تحقق من وجود مرجع دليل محفوظ، وأن حجم الملف ونوعه وتوقيعه صحيح، وأن ملف المراجع لم يتغير.',
  invalid:'سجل البصمات لا يطابق مراجع العقار الحالية أو يحتوي حقولًا غير مقبولة؛ يُحظر الاعتماد على السجل حتى إزالته أو تصحيحه.',
  reset:'حذف سجل البصمات المحلية (لا يؤثر على المراجع)',
  count:'عدد ملفات جرى حساب بصمتها محليًا',
  noRef:'احفظ مرجع هذا الدليل أولًا في قائمة C70.',
  hold:'حالة حوكمة المستندات: معلّقة — لا تحقق مستقل من المصدر أو المُراجع أو صلاحية التقرير.',
 },
 en:{
  heading:'Local document fingerprints — no upload or source authorization',
  warning:'Select a PDF, PNG or JPEG up to 5 MiB. SHA-256 is computed over actual bytes locally in this browser. Only evidence reference, type, size and digest are saved; file bytes and filename are not retained. A hash does not authenticate source, usage rights or a licensed reviewer.',
  choose:'Choose file to hash',
  wait:'Calculating fingerprint...',
  done:'Local file bytes hashed. No upload and no source approval.',
  error:'File not accepted: check saved evidence reference, file size, MIME and signature, and unchanged case context.',
  invalid:'Stored fingerprint manifest does not match current specialist references or includes disallowed fields. Reset or correct it before use.',
  reset:'Clear local fingerprint manifest (keep references)',
  count:'Locally hashed document controls',
  noRef:'Save this C70 evidence reference first.',
  hold:'Governance remains ON HOLD: no independent source, reviewer or report authorization.',
 },
});
export default function SpecialistDocumentHashPanel({
 locale='ar-SA',valuationCase=null,onChangeValuationCase,runtime=null,
}){
 const cls=valuationCase?.classification?.assetClass;
 const enabled=[ASSET_CLASS.HOSPITALITY,ASSET_CLASS.INDUSTRIAL_LOGISTICS].includes(cls);
 const [error,setError]=useState(null);
 const [done,setDone]=useState(null);
 const [busy,setBusy]=useState(false);
 const caseRef=useRef(valuationCase);
 // Always compare with the most recent rendered case, not the async handler's closure.
 caseRef.current=valuationCase;
 const operationRef=useRef(0);
 useEffect(()=>()=>{operationRef.current+=1;},[]);
 useEffect(()=>{setError(null);setDone(null);},[valuationCase]);
 if(!enabled)return null;
 const copy=MESSAGES[locale==='en'?'en':'ar'];
 const rtl=locale!=='en';
 const rawIntake=valuationCase?.institutionalEvidence?.specialistIntake;
 const rawManifest=valuationCase?.institutionalEvidence?.specialistDocumentManifest;
 const assessment=assessLocalDocumentManifest(valuationCase);
 let intake=null,manifest=null;
 try{
  intake=normalizeSpecialistReferenceIntake(rawIntake,cls);
  manifest=normalizeManifest(rawManifest,intake,valuationCase);
 }catch{/* user-imported or outdated record must remain HOLD */}
 const invalid=assessment.invalid||Boolean(rawManifest&&!manifest);
 const onFile=async(type,event)=>{
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  const startedCase=caseRef.current;
  const operation=++operationRef.current;
  setError(null);setDone(null);setBusy(true);
  try{
   if(!intake||invalid||startedCase!==valuationCase)
    throw new TypeError('C72_INVALID_CURRENT_CASE');
   const entry=await fingerprintLocalFile(file,intake,type);
   // A different case, changed source reference, or superseded request must never receive the old digest.
   if(operation!==operationRef.current||caseRef.current!==startedCase)
    throw new TypeError('C72_STALE_ASYNC_CASE_CONTEXT');
   const next=addDocumentHash(rawManifest,intake,entry,startedCase);
   onChangeValuationCase({
    ...startedCase,
    institutionalEvidence:{
     ...(startedCase.institutionalEvidence||{}),
     specialistDocumentManifest:next,
    },
   });
   setDone(type);
  }catch{
   if(operation===operationRef.current)setError(type);
  }finally{
   if(operation===operationRef.current)setBusy(false);
  }
 };
 const clear=()=>{
  operationRef.current+=1;
  setBusy(false);
  if(!rawManifest)return;
  const {specialistDocumentManifest:_discarded,...kept}=
    valuationCase.institutionalEvidence||{};
  onChangeValuationCase({
   ...valuationCase,institutionalEvidence:kept,
  });
  setError(null);setDone(null);
 };
 const n=manifest?.entries?.length||0;
 return <section data-testid="specialist-doc-hash-panel"
  dir={rtl?'rtl':'ltr'} className="mx-auto mt-3 rounded-xl border border-slate-700 bg-slate-900/80 p-4"
  style={{color:'#EDE6D6'}}>
  <h3 className="text-sm font-semibold">{copy.heading}</h3>
  <p className="mt-2 text-xs leading-6">{copy.warning}</p>
  <p className="mt-2 text-xs" data-testid="specialist-doc-limit">{MAX_BYTES/1024/1024} MiB</p>
  {invalid?<p role="alert" data-testid="specialist-doc-invalid"
   className="mt-2 text-xs text-amber-300">{copy.invalid}</p>:null}
  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
   {EVIDENCE_TYPES.map(type=>{
    const ref=intake?.evidenceRefs?.[type]||'';
    const fingerprint=manifest?.entries?.find(item=>item.evidenceType===type);
    return <label className="rounded-lg border border-slate-700 p-3 text-xs" key={type}>
     <span className="font-medium">{CONTROL_LABEL[type][rtl?0:1]}</span>
     <span className="block mt-1 text-slate-400">{ref||copy.noRef}</span>
     <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
      aria-label={CONTROL_LABEL[type][rtl?0:1]}
      data-testid={`specialist-doc-file-${type}`}
      className="mt-2 block w-full text-xs" disabled={busy||!ref||invalid}
      onChange={e=>void onFile(type,e)} />
     {fingerprint?<div className="mt-2 break-all text-xs text-amber-100"
       data-testid={`specialist-doc-fingerprint-${type}`}>
       SHA-256: {fingerprint.sha256Hex} · {fingerprint.sizeBytes} B · {fingerprint.mediaType}
     </div>:null}
    </label>;
   })}
  </div>
  {busy?<p className="mt-2 text-xs" role="status">{copy.wait}</p>:null}
  {error?<p className="mt-2 text-xs text-amber-300" role="alert"
   data-testid="specialist-doc-error">{copy.error}</p>:null}
  {done?<p className="mt-2 text-xs" role="status" data-testid="specialist-doc-success">{copy.done}</p>:null}
  <div className="mt-3 flex flex-wrap items-center gap-3">
   <span className="text-xs" data-testid="specialist-doc-hash-count">{copy.count}: {n} / {EVIDENCE_TYPES.length}</span>
   {rawManifest?<button type="button" onClick={clear}
      data-testid="specialist-doc-clear" className="rounded-lg border border-slate-700 px-3 py-2 text-xs">
      {copy.reset}
    </button>:null}
  </div>
  <p className="mt-2 text-xs text-amber-200" data-testid="specialist-doc-governance"
   data-c72-status={assessment.status}>{copy.hold}</p>
  {runtime?.specialistRoute ? <span className="sr-only" data-testid="specialist-doc-specialist-hold">
    {runtime.specialistRoute.status}
   </span>:null}
 </section>;
}
