import React,{useEffect,useRef,useState} from 'react';
import DiagnosticText from './DiagnosticText.jsx';
const {useLocale}=require('../i18n/LocaleContext');
const {createStorageProvider}=require('../storage/create-storage-provider');
const {createLocalReviewJournal,readLocalReviewJournal,journalKey}=require('../storage/local-review-journal');
export default function LocalEvidenceJournalPanel({intakeRecord,candidate,verificationRecord}) {
 const {locale}=useLocale(),ar=locale==='ar-SA';const [journal,setJournal]=useState(null),[message,setMessage]=useState(null);const fileRef=useRef();
 const scope=intakeRecord?{caseId:intakeRecord.caseId,projectId:null,kind:'EVIDENCE'}:null;
 const key=scope?journalKey(scope)+':'+intakeRecord.digest:null;
 const validate=text=>{
  const read=readLocalReviewJournal(text,scope);
  if(read.payload?.source?.digest!==intakeRecord.digest||read.payload.source.caseId!==scope.caseId||read.payload.candidate?.caseId!==scope.caseId) throw Object.assign(new Error('LOCAL_RECORD_SCOPE_MISMATCH'),{code:'LOCAL_RECORD_SCOPE_MISMATCH'});
  return read;
 };
 useEffect(()=>{let active=true;setJournal(null);setMessage(null);if(key){(async()=>{try{const raw=await createStorageProvider().get(key);if(raw&&active)setJournal(validate(raw));}catch(e){if(active)setMessage(e.code||'LOCAL_RECORD_INVALID');}})();}return()=>{active=false;};},[key]);
 if(!scope)return null;
 async function save(){try{
  if(candidate?.status!=='CANDIDATE_REQUIRES_VERIFICATION')throw Object.assign(new Error('LOCAL_RECORD_INVALID'),{code:'LOCAL_RECORD_INVALID'});
  const {result,...source}=intakeRecord;
  const next=createLocalReviewJournal({...scope,payload:{source,candidate,verificationRecord:verificationRecord||null}});
  await createStorageProvider().set(key,JSON.stringify(next));setJournal(next);setMessage(ar?'حُفظ سجل المراجعة محليًا. لم يعتمد كمدخل مالي.':'Review record saved locally. It was not adopted as a financial input.');
 }catch(e){setMessage(e.code||'LOCAL_RECORD_INVALID');}}
 function exportJournal(){const url=URL.createObjectURL(new Blob([JSON.stringify(journal,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`startak-evidence-${intakeRecord.digest.slice(0,12)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function restore(file){try{if(!file||file.size>2000000)throw Object.assign(new Error('LOCAL_RECORD_INVALID'),{code:'LOCAL_RECORD_INVALID'});const next=validate(await file.text());await createStorageProvider().set(key,JSON.stringify(next));setJournal(next);setMessage(ar?'استُعيد سجل مرجعي للمصدر الحالي؛ لا يثبت مصادقة المراجع ولا يتجاوز بوابات التحقق.':'Reference record restored for this source; reviewer identity and verification gates remain unchanged.');}catch(e){setMessage(e.code||'LOCAL_RECORD_INVALID');}finally{if(fileRef.current)fileRef.current.value='';}}
 return <section data-testid="local-evidence-journal" className="mx-auto my-4 max-w-7xl rounded-xl border border-slate-600 bg-[#101a2d] p-4 text-xs text-slate-200">
  <h2 className="font-semibold">{ar?'حفظ سجل المصدر والمراجعة':'Source and review journal'}</h2>
  <p className="my-2 leading-6">{ar?'يُحفظ مرجع الملف وبصمته والقيمة والمراجع وقرار التحقق دون حفظ الملف الأصلي. أعد إرفاق الأصل مع معرّف الحالة نفسه لعرض السجل. النسخة المصدرة قد تتضمن النص المنقول من مستندك.':'Stores the file reference, digest, selected value, reviewer and verification decision without storing the original file. Reattach the original with the same case ID to view the record. Exports may contain transcribed document content.'}</p>
  <div className="flex flex-wrap gap-2">
   <button data-testid="save-evidence-journal" type="button" disabled={!candidate?.fact} onClick={save} className="rounded border border-sky-600 px-3 py-2 disabled:opacity-50">{ar?'حفظ سجل المراجعة':'Save review record'}</button>
   <button data-testid="export-evidence-journal" type="button" disabled={!journal} onClick={exportJournal} className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50">{ar?'تصدير سجل المصدر':'Export source record'}</button>
   <button type="button" onClick={()=>fileRef.current.click()} className="rounded border border-slate-600 px-3 py-2">{ar?'استعادة سجل لهذا المصدر':'Restore this source record'}</button><input aria-label={ar?'ملف سجل المصدر':'Source journal file'} className="sr-only" type="file" ref={fileRef} accept=".json" onChange={e=>restore(e.target.files?.[0])}/>
  </div>
  {message?<p role="status" className="mt-3"><DiagnosticText code={message} locale={locale}/></p>:null}
  {journal?<div data-testid="saved-evidence-journal" className="mt-3 break-words"><p>{ar?'سجل سابق ذو هوية محلية غير مصادق عليها':'Previous record with unauthenticated local identity'}</p><p data-user-content translate="no">{journal.payload.candidate.sourceProvenance?.reviewerRef} · {journal.recordedAt}</p><code>{journal.recordHashSha256}</code></div>:null}
 </section>;
}
