import React,{useRef,useState} from 'react';
const {normalizeKiteResearch}=require('../market/kite-personal-market-research');
const ERROR_TEXT={
 PERSONAL_SOURCE_CONNECTOR_NOT_CONFIGURED:['لم تُضبط مفاتيح التكامل في استضافة STARTAK بعد.','Server-side connection keys are not configured.'],
 PERSONAL_SOURCE_ACCESS_DENIED:['رمز الوصول الشخصي غير صحيح.','Personal access token was rejected.'],
 KITE_DATA_KEY_REJECTED:['مفتاح مزود البيانات غير صالح.','Provider data key rejected.'],
 KITE_PROVIDER_RATE_LIMIT:['حد طلبات المزود؛ أعد المحاولة لاحقًا.','Provider rate limit reached.'],
 KITE_PROVIDER_UNAVAILABLE:['المزود غير متاح حاليًا.','Provider unavailable.'],
 KITE_TIMEOUT:['انتهت مهلة استجابة المزود.','Provider request timed out.'],
 KITE_SCHEMA_OR_ATTRIBUTION_INVALID:['رد المزود أو إشعار المصدر غير مكتمل.','Provider schema or attribution missing.'],
 KITE_RESEARCH_PAYLOAD_INVALID:['بيانات المصدر لا تطابق العقد البحثي.','Provider response does not match research contract.'],
};
const USES=[['','كل استعمالات الأرض','All land uses'],['residential','سكني','Residential land use'],
 ['commercial','تجاري','Commercial land use'],['industrial','صناعي','Industrial land use'],
 ['agricultural','زراعي','Agricultural land use'],['mixed_use','مختلط','Mixed land use']];
export default function KitePersonalTransactionsPanel({locale='ar-SA',onResearchRows}){
 const en=locale==='en';const tr=(ar,english)=>en?english:ar;
 const [ownerToken,setOwnerToken]=useState('');
 const [city,setCity]=useState('riyadh'),[landUse,setLandUse]=useState('');
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[minSqm,setMinSqm]=useState('100');
 const [items,setItems]=useState([]),[attribution,setAttribution]=useState(null);
 const [nextCursor,setNextCursor]=useState(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState(null),[lastStatus,setLastStatus]=useState('NOT_CONNECTED');
 const requestId=useRef(0),abort=useRef(null);
 const invalidate=()=>{requestId.current++;abort.current?.abort();setBusy(false);setItems([]);
  setNextCursor(null);setAttribution(null);setError(null);setLastStatus('NOT_CONNECTED');};
 const update=(setter)=>(e)=>{invalidate();setter(e.target.value)};
 async function search(cursor=null){
  if(busy)return;
  const id=++requestId.current;abort.current?.abort();const ctrl=new AbortController();abort.current=ctrl;
  setBusy(true);setError(null);
  try{
   const u=new URL('/api/personal-data/kite-transactions',window.location.origin);
   const slug=city.trim().toLowerCase();
   if(!/^[a-z_]{2,40}$/.test(slug))throw Error('CITY_SLUG_INVALID');
   u.searchParams.set('city',slug);
   if(landUse)u.searchParams.set('land_use',landUse);
   if(from)u.searchParams.set('month_from',from);
   if(to)u.searchParams.set('month_to',to);
   if(minSqm)u.searchParams.set('price_per_sqm_min',minSqm);
   if(cursor)u.searchParams.set('cursor',cursor);
   const response=await fetch(u,{method:'GET',signal:ctrl.signal,cache:'no-store',
     headers:{'Authorization':'Bearer '+ownerToken.trim(),'Accept':'application/json'}});
   const payload=await response.json();
   if(id!==requestId.current)return;
   if(!response.ok||!payload.ok)throw Error(payload.code||'KITE_FETCH_FAILED');
   const study=normalizeKiteResearch(payload);
   // Data are retained as independent research: no automatic financial or
   // certified market valuation overwrite, even when a page is imported.
   const next=cursor?[...items,...study.rows]:study.rows;
   setItems(next);setAttribution(study.attribution);
   setLastStatus('LIVE_OPEN_DATA_RESEARCH_NOT_VERIFIED');
   setNextCursor(payload.nextCursor||null);
   onResearchRows?.(study.rows);
  }catch(e){
   if(id===requestId.current&&e?.name!=='AbortError'){
    setError(e?.message||'KITE_FETCH_FAILED');setLastStatus('NOT_CONNECTED');
   }
  }finally{if(id===requestId.current)setBusy(false);}
 }
 const format=n=>Number.isFinite(n)?new Intl.NumberFormat(en?'en-US':'ar-SA',{maximumFractionDigits:0}).format(n):'—';
 const message=error?(ERROR_TEXT[error]||[tr('تعذر استرجاع بيانات المصدر.','Data retrieval failed.'),'Data retrieval failed.'])[en?1:0]:null;
 return <section data-testid="kite-personal-transactions" dir={en?'ltr':'rtl'}
   className="mt-4 rounded-xl border border-amber-700 bg-slate-900 p-3 text-slate-100">
  <h4 className="text-sm font-semibold">{tr('الصفقات المسجلة — تغذية Kite API المباشرة (بحث شخصي)','Registered transactions — Kite live API (personal research)')}</h4>
  <p className="mt-2 text-xs leading-6 text-amber-100" data-testid="kite-coverage-warning">
    {tr('مصدرها بيانات وزارة العدل الفصلية المفتوحة عبر Kite: بيانات أشهر لا أيام، وتصنيف استعمال الأرض لا نوع المبنى. مدينة الرياض بعد 18 مايو 2026 غير مغطاة بهذا المسار، وبعض صفقات 2024–2026 تمثل كتابات العدل فقط. لا تُستخدم وحدها لتقييم العقار.',
     'MOJ quarterly open data via Kite: month precision, land-use rather than building type. Riyadh city after May 18, 2026 is not covered; some 2024–2026 data are notary-only. Never rely on this alone to value a property.')}
  </p>
  <div className="mt-3 grid gap-3 sm:grid-cols-3">
    <label className="text-xs">{tr('معرّف المدينة لدى المزود','Provider city slug')}
      <input value={city} onChange={update(setCity)} data-testid="kite-city"
       className="mt-1 w-full rounded bg-slate-800 p-2" maxLength={40} dir="ltr"/></label>
    <label className="text-xs">{tr('استعمال الأرض','Land use')}
      <select data-testid="kite-land-use" value={landUse} onChange={update(setLandUse)}
       className="mt-1 w-full rounded bg-slate-800 p-2">{USES.map(([key,ar,english])=>
       <option key={key} value={key}>{en?english:ar}</option>)}</select></label>
    <label className="text-xs">{tr('الحد الأدنى لسعر المتر (ريال)','Minimum SAR/sqm')}
      <input type="number" min="0" max="99999999" step="1" value={minSqm}
       onChange={update(setMinSqm)} data-testid="kite-min-sqm"
       className="mt-1 w-full rounded bg-slate-800 p-2" dir="ltr"/></label>
    <label className="text-xs">{tr('من شهر','Month from')}
      <input type="month" value={from} onChange={update(setFrom)} data-testid="kite-from"
       className="mt-1 w-full rounded bg-slate-800 p-2" dir="ltr"/></label>
    <label className="text-xs">{tr('إلى شهر','Month to')}
      <input type="month" value={to} onChange={update(setTo)} data-testid="kite-to"
       className="mt-1 w-full rounded bg-slate-800 p-2" dir="ltr"/></label>
    <label className="text-xs">{tr('رمز مالك المنصة — لا يُخزن ولا يُرسل إلى Kite','Owner token — not stored or sent to Kite')}
      <input type="password" autoComplete="off" spellCheck={false}
       value={ownerToken} onChange={update(setOwnerToken)} data-testid="kite-owner-token"
       className="mt-1 w-full rounded bg-slate-800 p-2" placeholder={tr('رمز الوصول الشخصي','Personal access token')}/></label>
  </div>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" data-testid="kite-search" disabled={busy||ownerToken.trim().length<32}
    className="rounded border border-amber-500 px-4 py-2 text-xs disabled:opacity-50"
    onClick={()=>search()}>{busy?tr('جارٍ الجلب…','Loading…'):tr('جلب الصفقات من المصدر','Fetch source transactions')}</button>
   {nextCursor&&<button type="button" data-testid="kite-next" disabled={busy}
    className="rounded border border-slate-500 px-4 py-2 text-xs disabled:opacity-50"
    onClick={()=>search(nextCursor)}>{tr('المزيد من الصفقات','More records')}</button>}
  </div>
  {message&&<p role="alert" data-testid="kite-error" className="mt-2 text-xs text-rose-200">{message}</p>}
  <p data-testid="kite-status" data-status={lastStatus} className="mt-2 text-xs text-slate-300">
    {lastStatus==='LIVE_OPEN_DATA_RESEARCH_NOT_VERIFIED'
      ?tr('وصلت استجابة حية، ولكن الصفقات غير مؤهلة تلقائيًا للمقارنة أو القرار.','Live response received; sale rows are not automatically qualified comparables.')
      :tr('لم يثبت اتصال المزود بعد؛ يلزم إعداد المفاتيح على الخادم.','Source connection not confirmed; server-side keys required.')}
  </p>
  {items.length>0&&<div data-testid="kite-results" className="mt-3 max-w-full overflow-x-auto">
   <p className="mb-2 text-xs">{tr('صفوف بحثية: ','Research rows: ')}{items.length}</p>
   <table className="min-w-[720px] w-full text-xs"><thead><tr className="border-b border-slate-600">
    <th className="p-2">{tr('الشهر','Month')}</th><th className="p-2">{tr('المدينة','City')}</th>
    <th className="p-2">{tr('الحي','District')}</th><th className="p-2">{tr('السعر (ريال)','Price SAR')}</th>
    <th className="p-2">{tr('المساحة (م²)','Area m²')}</th><th className="p-2">{tr('سعر المتر','SAR/sqm')}</th>
    <th className="p-2">{tr('عدد العقارات','Property count')}</th></tr></thead>
    <tbody>{items.slice(0,120).map((r,i)=><tr key={r.recordId+'|'+i} className="border-b border-slate-800">
     <td className="p-2" dir="ltr">{r.periodStart.slice(0,7)}</td>
     <td className="p-2">{r.city}</td><td className="p-2">{r.district}</td>
     <td className="p-2">{format(r.metricValue)}</td><td className="p-2">{format(r.areaSqm)}</td>
     <td className="p-2">{format(r.pricePerSqmSar)}</td><td className="p-2">{format(r.propertyCount)}</td>
    </tr>)}</tbody></table>
  </div>}
  {attribution&&<p data-testid="kite-attribution" className="mt-3 text-xs text-slate-300">
    {tr('المصدر: بيانات وزارة العدل الفصلية المفتوحة (تقدم عبر Kite). راجع إشعار النسب الأصلي: ','Source: MOJ quarterly open data via Kite. Original attribution: ')}
    <a href="https://platform.kite.sa/docs/reference/transactions-search" target="_blank"
     rel="noopener noreferrer" className="text-sky-300 underline">Kite / MOJ — ODC Attribution</a>
    <span className="sr-only" data-testid="kite-attribution-json">{JSON.stringify(attribution)}</span>
   </p>}
 </section>;
}
