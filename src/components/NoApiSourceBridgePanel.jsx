import React,{useState} from 'react';
const {useLocale}=require('../i18n/LocaleContext.js');
const {
 SOURCES,BY_ID,MAX_PORTABLE_BYTES,captureReference,mergeReferences,
 exportReferences,importReferences,
}=require('../market/no-api-source-bridge');

const FIELD='mt-1 w-full rounded-md border border-slate-600 bg-slate-900 p-2 text-sm text-slate-100';
const TODAY=()=>new Date().toISOString().slice(0,10);
export default function NoApiSourceBridgePanel(){
 const {locale}=useLocale(),en=locale==='en';
 const tr=(ar,english)=>en?english:ar;
 const [sourceId,setSourceId]=useState('MOJ_OPEN');
 const [sourceUrl,setSourceUrl]=useState(BY_ID.MOJ_OPEN.url);
 const [city,setCity]=useState(''),[district,setDistrict]=useState('');
 const [observedOn,setObservedOn]=useState(TODAY);
 const [references,setReferences]=useState([]);
 const [notice,setNotice]=useState(null);
 const src=BY_ID[sourceId];
 function changeSource(id){
  const next=BY_ID[id];if(!next)return;
  setSourceId(id);setSourceUrl(next.url);setNotice(null);
 }
 function addReference(){
  try{
   const item=captureReference({sourceId,sourceUrl,city,district,observedOn});
   const merged=mergeReferences(references,[item]);
   setReferences(merged.references);
   setNotice({ar:merged.duplicates?'المرجع مسجل مسبقًا ولم يُكرر.':'سُجل رابط بحثي يدوي غير متحقق؛ لم تُنقل أي قيمة إلى التقييم.',
    en:merged.duplicates?'Duplicate research link was not added.':'Manual unverified research link added; no valuation input was changed.'});
  }catch(_){setNotice({ar:'تعذر تسجيل المرجع: تحقق من الموقع الرسمي وتاريخ الاطلاع والحقول.',
    en:'Cannot add reference: verify the official host, date and fields.'});}
 }
 function download(){
  try{
   const contents=exportReferences(references);
   const blob=new Blob([contents],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');
   a.href=url;a.download='startak-no-api-manual-references.json';
   document.body.appendChild(a);a.click();a.remove();
   URL.revokeObjectURL(url);
   setNotice({ar:'تم إنشاء ملف المراجع على جهازك؛ لا يُرسل إلى المواقع الخارجية.',
    en:'Research reference file generated locally; nothing sent to external sources.'});
  }catch(_){setNotice({ar:'تعذر تصدير الملف.','en':'Could not export reference file.'});}
 }
 async function restore(file){
  if(!file)return;
  try{
   if(file.size>MAX_PORTABLE_BYTES)throw Error('NOAPI_FILE_TOO_LARGE');
   const imported=importReferences(await file.text());
   const merged=mergeReferences(references,imported.references);
   setReferences(merged.references);
   setNotice({ar:'تم استيراد المراجع دون منحها صلاحية اعتماد. المكرر: '+merged.duplicates,
    en:'Reference list imported without approving any source. Duplicates: '+merged.duplicates});
  }catch(_){setNotice({ar:'ملف المراجع غير صالح أو يحتوي على حقول اعتماد غير مسموحة.',
   en:'Invalid reference file, or it attempts to import forbidden authority fields.'});}
 }
 return <section data-testid="no-api-source-bridge" className="mt-4 rounded-xl border border-sky-700 bg-slate-950 p-3 text-slate-100" dir={en?'ltr':'rtl'}>
  <h4 className="text-sm font-semibold">{tr('ربط المواقع العقارية دون واجهة تقنية','Real estate sources without an API')}</h4>
  <p className="mt-1 text-xs text-amber-200">
   {tr('المسار الأول: افتح المصدر بنفسك وسجّل رابط المراجعة وتاريخها. لا نسحب بيانات الموقع ولا نسجّل دخولك، ولا نعدّ المرجع صفقة أو تقييمًا معتمدًا.',
   'Path one: open the provider yourself, and record its reference and review date. We do not scrape the site or sign in for you. A link is not a verified sale or appraisal.')}
  </p>
  <div className="mt-3 grid gap-2 sm:grid-cols-2">
   <label className="text-xs">{tr('مصدر البحث','Research source')}
    <select className={FIELD} data-testid="noapi-source-select" value={sourceId} onChange={e=>changeSource(e.target.value)}>
     {SOURCES.map(s=><option value={s.id} key={s.id}>{en?s.nameEn:s.nameAr}</option>)}
    </select>
   </label>
   <div className="flex flex-col justify-end gap-1 text-xs">
    <a data-testid="noapi-open-source" href={src.url} target="_blank" rel="noopener noreferrer"
      className="w-fit rounded border border-slate-500 px-3 py-2 text-sky-300">
      {tr('فتح الموقع الأصلي','Open original site')}
    </a>
    <span className="text-slate-400">
     {src.mode==='LICENSE_REVIEW_FOR_FILE'?
       tr('يمكن فحص التنزيل بعد مراجعة ترخيص مجموعة البيانات.','Downloaded dataset requires a specific licence review.'):
       tr('مرجع عرض يدوي فقط؛ لا نسخ آلي للمحتوى.','Manual reference only; no automatic content copying.')}
    </span>
   </div>
   <label className="text-xs sm:col-span-2">{tr('رابط المرجع — بدون رموز دخول أو بيانات شخصية','Reference URL — no login tokens or personal data')}
    <input data-testid="noapi-source-url" className={FIELD} type="url" dir="ltr" value={sourceUrl}
      maxLength={1600} onChange={e=>setSourceUrl(e.target.value)}/>
   </label>
   <label className="text-xs">{tr('المدينة إن كانت ذات صلة','City if applicable')}
    <input data-testid="noapi-city" className={FIELD} maxLength={100} value={city}
     onChange={e=>setCity(e.target.value)}/>
   </label>
   <label className="text-xs">{tr('الحي إن كان ذا صلة','District if applicable')}
    <input data-testid="noapi-district" className={FIELD} maxLength={100} value={district}
     onChange={e=>setDistrict(e.target.value)}/>
   </label>
   <label className="text-xs">{tr('تاريخ الاطلاع','Review date')}
    <input data-testid="noapi-observed-on" type="date" className={FIELD}
     value={observedOn} max={TODAY()} onChange={e=>setObservedOn(e.target.value)}/>
   </label>
   <div className="flex items-end">
    <button type="button" data-testid="noapi-add-link" onClick={addReference}
     className="rounded border border-sky-600 px-3 py-2 text-xs text-sky-200">
     {tr('إضافة مرجع بحثي','Add research reference')}
    </button>
   </div>
  </div>
  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
   <button type="button" data-testid="noapi-export" onClick={download}
    className="rounded border border-slate-600 px-3 py-2 text-slate-200">
    {tr('تنزيل سجل المراجع','Download reference register')}
   </button>
   <label className="rounded border border-slate-600 px-3 py-2 text-slate-200">
    {tr('استعادة سجل المراجع','Restore reference register')}
    <input data-testid="noapi-import" type="file" accept=".json,application/json" className="block max-w-48 mt-1 text-xs"
     onChange={async e=>{const file=e.target.files?.[0];e.target.value='';await restore(file);}}/>
   </label>
  </div>
  <p className="mt-2 text-xs text-amber-200">
   {tr('المسار الثاني: للبيانات المفتوحة المرخصة، نزّل الملف من الجهة ثم استخدم استيراد الملفات البحثية الموجود أدناه. لا تستخدم ملفات مواقع خاصة دون إذن إعادة الاستخدام.',
    'Path two: download a dataset with documented reuse rights, then use the research-file importer below. Do not import copied private-site content without permission.')}
  </p>
  <p className="mt-2 text-xs text-slate-300" data-testid="noapi-reference-count">
   {tr('عدد المراجع اليدوية: ','Manual reference count: ')}{references.length}
   {tr(' — قيم مالية معتمدة: صفر.',' — authorized financial valuations: zero.')}
  </p>
  {references.length>0&&<ul className="mt-2 max-h-40 overflow-y-auto text-xs space-y-2" data-testid="noapi-reference-list">
   {references.slice(-25).map((r,i)=><li key={r.sourceId+'|'+r.sourceUrl+'|'+i}
     className="rounded border border-slate-700 p-2">
     <a href={r.sourceUrl} rel="noopener noreferrer" target="_blank" className="text-sky-300 underline" data-user-content translate="no">
      {en?BY_ID[r.sourceId].nameEn:BY_ID[r.sourceId].nameAr}
     </a>
     <span className="ms-2">{r.observedOn}</span>
     <span className="ms-2" data-user-content translate="no">{[r.city,r.district].filter(Boolean).join(' / ')}</span>
     <span className="ms-2">{tr('غير متحقق','Unverified')}</span>
    </li>)}
  </ul>}
  {notice&&<p role="status" data-testid="noapi-status" className="mt-2 text-xs text-sky-300">
   {en?notice.en:notice.ar}
  </p>}
 </section>;
}
