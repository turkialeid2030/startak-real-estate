import React,{useState} from 'react';
const {useLocale}=require('../i18n/LocaleContext.js');
const {
 BY_SOURCE,AGGREGATE_METRICS,buildPersonalNoApiResearchEntry,
}=require('../market/personal-noapi-manual-entry');
const {SOURCES}=require('../market/saudi-national-intelligence-sources');

const INPUT='mt-1 w-full min-w-0 rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100';
const KINDS={
 RESEARCH_NOTE:['ملاحظة مصدر','Source note'],
 OFFICIAL_REPORTED_SALE:['صفقة منشورة في مصدر حكومي','Official reported sale'],
 THIRD_PARTY_REPORTED_SALE:['صفقة منشورة في مصدر خاص','Third-party reported sale'],
 OFFICIAL_AGGREGATE:['مؤشر حكومي مجمع','Official aggregate'],
 THIRD_PARTY_AGGREGATE:['مؤشر خاص مجمع','Third-party aggregate'],
 EXTERNAL_AVM_ESTIMATE:['تقدير آلي خارجي','External automated estimate'],
};
const METRICS={
 avg_sale_sar:['متوسط قيمة البيع (ريال)','Average sale price (SAR)'],
 avg_rent_sar:['متوسط الإيجار (ريال)','Average rent (SAR)'],
 avg_sqm_sar:['متوسط سعر المتر (ريال/م²)','Average price per sqm (SAR)'],
 deal_count:['عدد الصفقات','Transaction count'],
 rent_contract_count:['عدد عقود الإيجار','Rent contract count'],
 deal_value_sar:['إجمالي قيمة الصفقات (ريال)','Transaction total (SAR)'],
 area_sqm:['المساحة (م²)','Area (sqm)'],
};
const ASSET_TYPES=['LAND','RESIDENTIAL_LAND','APARTMENT','VILLA','FLOOR',
 'OFFICE','RETAIL','WAREHOUSE','HOTEL','INDUSTRIAL'];
function riyadhToday(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const val=k=>parts.find(p=>p.type===k)?.value;
 return [val('year'),val('month'),val('day')].join('-');
}
export default function PersonalNoApiManualEntryPanel({subject={},onResearchRows}){
 const {locale}=useLocale(),en=locale==='en';
 const tr=(ar,english)=>en?english:ar;
 const [sourceId,setSourceId]=useState('PASEETAH');
 const [kind,setKind]=useState('RESEARCH_NOTE');
 const [sourceUrl,setSourceUrl]=useState(BY_SOURCE.PASEETAH.url);
 const [city,setCity]=useState(''),[district,setDistrict]=useState('');
 const [assetType,setAssetType]=useState('LAND');
 const [observedOn,setObservedOn]=useState(riyadhToday);
 const [recordId,setRecordId]=useState('');
 const [eventDate,setEventDate]=useState('');
 const [periodStart,setPeriodStart]=useState(''),[periodEnd,setPeriodEnd]=useState('');
 const [metricName,setMetricName]=useState('avg_rent_sar');
 const [metricValue,setMetricValue]=useState('');
 const [rangeLowSar,setRangeLowSar]=useState(''),[rangeHighSar,setRangeHighSar]=useState('');
 const [confidenceLabel,setConfidenceLabel]=useState('');
 const [modelAsOf,setModelAsOf]=useState('');
 const [notice,setNotice]=useState(null);
 const source=BY_SOURCE[sourceId];
 const note=kind==='RESEARCH_NOTE';
 const sale=kind==='OFFICIAL_REPORTED_SALE'||kind==='THIRD_PARTY_REPORTED_SALE';
 const aggregate=kind==='OFFICIAL_AGGREGATE'||kind==='THIRD_PARTY_AGGREGATE';
 const avm=kind==='EXTERNAL_AVM_ESTIMATE';
 function changeSource(id){
  const next=Object.prototype.hasOwnProperty.call(BY_SOURCE,id)?BY_SOURCE[id]:null;
  if(!next)return;
  setSourceId(id);setKind(next.allowed.includes('RESEARCH_NOTE')?'RESEARCH_NOTE':next.allowed[0]);
  setSourceUrl(next.url);setRecordId('');setEventDate('');setMetricValue('');
  setPeriodStart('');setPeriodEnd('');setModelAsOf('');
  setRangeLowSar('');setRangeHighSar('');setConfidenceLabel('');
  setAssetType(id==='BAYUT_TRUVALUE'?'APARTMENT':'LAND');setNotice(null);
 }
 function changeKind(value){
  if(!source.allowed.includes(value))return;
  setKind(value);setRecordId('');setEventDate('');setMetricValue('');
  setPeriodStart('');setPeriodEnd('');setModelAsOf('');
  setRangeLowSar('');setRangeHighSar('');setConfidenceLabel('');setNotice(null);
 }
 function usePropertyLocation(){
  const c=typeof subject?.city==='string'?subject.city.trim():'';
  const d=typeof subject?.district==='string'?subject.district.trim():'';
  if(!c||!d){
   setNotice({ar:'أدخل مدينة العقار وحيّه أولًا في بيانات العقار، أو اكتبهما هنا.',
    en:'Provide the property city and district, or type them here.'});
   return;
  }
  setCity(c);setDistrict(d);
  setNotice({ar:'نُقلت المدينة والحي من العقار الحالي إلى نموذج البحث اليدوي.',
   en:'Current property city and district were copied into the manual research form.'});
 }
 function add(){
  try{
   if(typeof onResearchRows!=='function')throw Error('PERSONAL_NOAPI_RESEARCH_TARGET_MISSING');
   const row=buildPersonalNoApiResearchEntry({
    sourceId,kind,sourceUrl,city,district,assetType,observedOn,
    recordId,eventDate,periodStart,periodEnd,metricName,metricValue,
    rangeLowSar,rangeHighSar,confidenceLabel,modelAsOf,
   },{asOf:riyadhToday()});
   const result=onResearchRows([row]);
   if(!result||!Array.isArray(result.records))throw Error('PERSONAL_NOAPI_RESEARCH_IMPORT_FAILED');
   setNotice({
    ar:'أُضيف '+result.added+' سجل بحثي شخصي؛ مكرر '+result.duplicates+
     '، تعارض '+result.conflicts.length+'. الملاحظة لا تُعد اعتمادًا لصفقة أو تقييم.',
    en:'Added '+result.added+' personal research row; duplicates '+result.duplicates+
     ', conflicts '+result.conflicts.length+'. This note does not certify a sale or appraisal.',
   });
   if(result.added>0){setRecordId('');setMetricValue('');}
  }catch(error){
   // Render stable, non-sensitive parser reason codes, not the input body.
   const code=String(error?.message||'PERSONAL_NOAPI_CAPTURE_INVALID');
   const reasons=code.startsWith('PERSONAL_NOAPI_CAPTURE_REJECTED:')?
    code.slice('PERSONAL_NOAPI_CAPTURE_REJECTED:'.length):'PERSONAL_NOAPI_CAPTURE_INVALID';
   setNotice({ar:'تعذر إضافة المعلومة؛ راجع المصدر والمدينة والحي والتاريخ والقيمة. '+reasons,
    en:'Could not add the observation. Check source, location, date and amount. '+reasons});
  }
 }
 return <section data-testid="personal-noapi-market-entry"
  dir={en?'ltr':'rtl'} className="mt-4 rounded-xl border border-sky-700 bg-slate-950 p-3 text-slate-100">
  <h4 className="text-sm font-semibold">{tr('إدخال معلومة سوقية يدويًا — دون API','Manual market entry — no API')}</h4>
  <p className="mt-1 text-xs text-slate-300">
   {tr('افتح المصدر في تبويب مستقل ثم أدخل المعلومة التي راجعتها بنفسك. ستُضاف لسجل البحث الحالي، دون سحب آلي أو تعديل نتيجة المحرك المالي.',
    'Open the source yourself and enter what you reviewed. The observation is added to the current research register, without automated retrieval or changing financial-model results.')}
  </p>
  <div className="mt-3 grid gap-2 sm:grid-cols-2">
   <label className="text-xs">{tr('الجهة / المصدر','Research provider')}
    <select data-testid="personal-noapi-source" className={INPUT} value={sourceId}
      onChange={e=>changeSource(e.target.value)}>
      {SOURCES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
   </label>
   <label className="text-xs">{tr('نوع المعلومة','Observation type')}
    <select data-testid="personal-noapi-kind" className={INPUT} value={kind}
     onChange={e=>changeKind(e.target.value)}>
      {source.allowed.map(s=><option key={s} value={s}>{KINDS[s]?.[en?1:0]||s}</option>)}
    </select>
   </label>
   <div className="flex items-center">
    <a data-testid="personal-noapi-open-source" className="rounded-md border border-sky-600 px-3 py-2 text-sm text-sky-300"
     href={source.url} target="_blank" rel="noopener noreferrer">
     {tr('فتح الموقع الأصلي','Open source website')}
    </a>
   </div>
   <label className="text-xs">{tr('رابط الصفحة التي راجعتها','Reviewed page link')}
    <input data-testid="personal-noapi-url" type="url" dir="ltr" className={INPUT}
     maxLength={1600} value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/>
   </label>
   <div className="flex items-center">
    <button type="button" data-testid="personal-noapi-use-property"
     className="rounded-md border border-slate-500 px-3 py-2 text-xs text-sky-200"
     onClick={usePropertyLocation}>{tr('استخدام موقع العقار الحالي','Use current property location')}</button>
   </div>
   <p className="self-center text-xs text-slate-400">
    {tr('الربط بحسب المدينة والحي؛ لا يُستنتج رقم صك أو قطعة.',
    'Linked as location research by city/district, not by a presumed deed or parcel.')}
   </p>
   <label className="text-xs">{tr('المدينة','City')}
    <input data-testid="personal-noapi-city" className={INPUT} value={city} maxLength={120}
     onChange={e=>setCity(e.target.value)}/>
   </label>
   <label className="text-xs">{tr('الحي','District')}
    <input data-testid="personal-noapi-district" className={INPUT} value={district} maxLength={120}
     onChange={e=>setDistrict(e.target.value)}/>
   </label>
   <label className="text-xs">{tr('نوع العقار','Asset type')}
    <select data-testid="personal-noapi-asset" className={INPUT} value={assetType}
     onChange={e=>setAssetType(e.target.value)}>
     {ASSET_TYPES.map(type=><option key={type} value={type}>{type}</option>)}
    </select>
   </label>
   <label className="text-xs">{tr('تاريخ اطلاعك على المعلومة','Date reviewed')}
    <input data-testid="personal-noapi-observed" type="date" className={INPUT}
     value={observedOn} max={riyadhToday()} onChange={e=>setObservedOn(e.target.value)}/>
   </label>
   {(sale||avm)&&<label className="text-xs">
    {tr('معرّف السجل المنشور أو التقدير','Published record / estimate ID')}
    <input data-testid="personal-noapi-record-id" className={INPUT}
     value={recordId} maxLength={130} onChange={e=>setRecordId(e.target.value)}/>
   </label>}
   {sale&&<label className="text-xs">{tr('تاريخ الصفقة المنشور','Reported transaction date')}
    <input data-testid="personal-noapi-event-date" type="date" className={INPUT}
     value={eventDate} max={observedOn} onChange={e=>setEventDate(e.target.value)}/>
   </label>}
   {aggregate&&<>
    <label className="text-xs">{tr('المؤشر','Metric')}
     <select data-testid="personal-noapi-metric" value={metricName} className={INPUT}
      onChange={e=>setMetricName(e.target.value)}>
      {AGGREGATE_METRICS.map(metric=><option key={metric} value={metric}>
       {METRICS[metric]?.[en?1:0]||metric}
      </option>)}
     </select>
    </label>
    <label className="text-xs">{tr('بداية الفترة','Period start')}
     <input type="date" className={INPUT} data-testid="personal-noapi-period-start"
      value={periodStart} onChange={e=>setPeriodStart(e.target.value)}/>
    </label>
    <label className="text-xs">{tr('نهاية الفترة','Period end')}
     <input type="date" className={INPUT} data-testid="personal-noapi-period-end"
      value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)}/>
    </label>
   </>}
   {(sale||aggregate||avm)&&<label className="text-xs">
    {tr('قيمة المؤشر أو السعر (بالوحدة المحددة)','Published amount / metric')}
    <input data-testid="personal-noapi-value" className={INPUT} type="text"
     inputMode="decimal" value={metricValue} maxLength={45}
     onChange={e=>setMetricValue(e.target.value)}
     placeholder={tr('مثال: ٢٬٤٠٠٬٠٠٠','Example: 2,400,000')}/>
   </label>}
   {avm&&<>
    <label className="text-xs">{tr('تاريخ نموذج التقدير (اختياري)','Model date (optional)')}
     <input type="date" className={INPUT} data-testid="personal-noapi-model-date"
      value={modelAsOf} onChange={e=>setModelAsOf(e.target.value)}/>
    </label>
    <label className="text-xs">{tr('الحد الأدنى من المصدر (اختياري)','Provider lower estimate (optional)')}
     <input className={INPUT} value={rangeLowSar} inputMode="decimal"
      onChange={e=>setRangeLowSar(e.target.value)}/>
    </label>
    <label className="text-xs">{tr('الحد الأعلى من المصدر (اختياري)','Provider upper estimate (optional)')}
     <input className={INPUT} value={rangeHighSar} inputMode="decimal"
      onChange={e=>setRangeHighSar(e.target.value)}/>
    </label>
    <label className="text-xs">{tr('مستوى الثقة المعلن من المصدر','Source-stated confidence')}
     <select className={INPUT} value={confidenceLabel}
      onChange={e=>setConfidenceLabel(e.target.value)}>
      <option value="">{tr('غير مذكور','Not stated')}</option>
      <option value="HIGH">{tr('مرتفعة','High')}</option>
      <option value="MEDIUM">{tr('متوسطة','Medium')}</option>
      <option value="LOW">{tr('منخفضة','Low')}</option>
     </select>
    </label>
   </>}
  </div>
  <div className="mt-3 flex items-center gap-3">
   <button type="button" data-testid="personal-noapi-add" onClick={add}
    className="rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white">
    {tr('إضافة إلى بحثي','Add to my research')}
   </button>
   <span className="text-xs text-slate-400">
    {tr('البيانات لا تُرسل إلى المصدر','Nothing is sent to the provider')}
   </span>
  </div>
  {notice&&<p role="status" data-testid="personal-noapi-status"
    className="mt-2 text-xs text-sky-200">{en?notice.en:notice.ar}</p>}
 </section>;
}
