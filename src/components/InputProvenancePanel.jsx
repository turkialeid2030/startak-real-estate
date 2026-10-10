import React,{useState} from 'react';
import DiagnosticText from './DiagnosticText.jsx';
const {useLocale}=require('../i18n/LocaleContext');
const {recordInputProvenance,provenanceForInputs}=require('../app/input-provenance');
const input='mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2';
export default function InputProvenancePanel({mode,inputs,provenance,onChange}){
 const {locale}=useLocale(),ar=locale==='ar-SA';const [form,setForm]=useState({field:Object.keys(inputs)[0]||'',unit:'',sourceKind:'USER_ESTIMATE',sourceReference:'',sourceDate:'',location:'',reviewerRef:'',documentDigestSha256:''}),[error,setError]=useState(null);
 const labels=ar?require('../i18n/locales/ar-SA'):require('../i18n/locales/en');const group=mode==='building'?labels.inputBuilding:labels.inputLand;
 const label=field=>typeof group?.[field]==='string'?group[field]:field;
 const states=provenanceForInputs(mode,inputs,provenance);const recorded=Object.values(states).filter(s=>s.status!=='SOURCE_NOT_RECORDED');
 return <details data-testid="input-provenance" className="mt-3 rounded-xl border border-slate-600 bg-[#101a2d] p-3 text-xs text-slate-200"><summary className="cursor-pointer p-2 font-semibold">{ar?'مصدر المدخلات ووحداتها وتاريخها':'Input sources, units and dates'}</summary>
  <p className="my-2 leading-6">{ar?'سجل المصدر لكل مدخل جوهري. عند تغيير القيمة يطلب السجل مراجعة المصدر. المرجع المحلي لا يثبت صحة المستند أو أسعار السوق أو تطبيق الأنظمة.':'Record sources for material inputs. Changing a value marks its source for rechecking. Local references do not independently verify documents, market prices or regulations.'}</p>
  <div className="grid gap-2 sm:grid-cols-2">
   <label>{ar?'المدخل':'Input'}<select data-testid="provenance-field" value={form.field} onChange={e=>setForm({...form,field:e.target.value})} className={input}>{Object.keys(inputs).map(field=><option key={field} value={field}>{label(field)}</option>)}</select></label>
   <label>{ar?'نوع المصدر':'Source kind'}<select data-testid="provenance-sourceKind" value={form.sourceKind} onChange={e=>setForm({...form,sourceKind:e.target.value})} className={input}><option value="USER_ESTIMATE">{ar?'تقدير المستخدم':'User estimate'}</option><option value="DOCUMENT_REFERENCE">{ar?'مستند ذو بصمة رقمية':'Document with a digest'}</option></select></label>
   {[["unit",ar?'الوحدة':'Unit'],["sourceReference",ar?'مرجع المصدر والصفحة':'Source and page reference'],["sourceDate",ar?'تاريخ المصدر':'Source date'],["location",ar?'الموقع الجغرافي أو نطاق المدخل':'Location or input scope'],["reviewerRef",ar?'مسجل المصدر':'Source recorder'],["documentDigestSha256",ar?'بصمة المستند — مطلوبة لمصدر مستندي':'Document digest — required for documents']].map(([key,label])=><label key={key}>{label}<input data-testid={`provenance-${key}`} type={key==='sourceDate'?'date':'text'} maxLength={key==='sourceReference'?2000:key==='location'?500:key==='unit'?80:160} className={input} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
  </div><button data-testid="save-input-provenance" aria-label={ar?'إضافة مرجع للمدخل الحالي':'Record the current input source'} type="button" className="mt-3 rounded border border-sky-600 px-3 py-2" onClick={()=>{try{onChange(recordInputProvenance({mode,inputs,current:provenance,...form}));setError(null);}catch(e){setError(e.code);}}}>{ar?'إضافة مرجع للمدخل الحالي':'Record the current input source'}</button>
  {error?<p role="alert" className="mt-3 text-rose-200"><DiagnosticText code={error} locale={locale}/></p>:null}
  <p data-testid="input-provenance-count" className="mt-3">{ar?'مدخلات ذات مرجع':'Inputs with references'}: {recorded.length}/{Object.keys(inputs).length}</p>
  <ul className="mt-2 space-y-2">{recorded.map(s=><li key={s.field}><span data-user-content translate="no">{label(s.field)} · {s.unit} · {s.sourceReference} · {s.sourceDate}</span><br/><DiagnosticText code={s.status} locale={locale}/></li>)}</ul>
 </details>;
}
