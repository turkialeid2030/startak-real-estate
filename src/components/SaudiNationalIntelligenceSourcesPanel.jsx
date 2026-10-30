import React,{useMemo,useState} from 'react';
const {useLocale}=require('../i18n/LocaleContext.js');
const {SOURCES,OFFICIAL_RESEARCH_ENTRYPOINTS,importNationalSourcesCsv,mergeNationalResearch,filterNationalResearch,
 summarizeNationalResearch}=require('../market/saudi-national-intelligence-sources');
const {MAX_CSV_BYTES}=require('../market/public-dataset-import');
const confidenceAr={HIGH:'مرتفعة',MEDIUM:'متوسطة',LOW:'منخفضة'};
const metricAr={estimated_value_sar:'القيمة المقدرة',sale_price_sar:'سعر بيع منشور',
 deal_count:'عدد الصفقات',deal_value_sar:'إجمالي قيمة الصفقات',
 avg_sqm_sar:'متوسط سعر المتر'};
const classLabel={
 OFFICIAL_AGGREGATE:'مؤشر حكومي مجمع',OFFICIAL_REPORTED_SALE:'صفقة منشورة بواجهة حكومية',
 THIRD_PARTY_AGGREGATE:'مؤشر خاص مجمع',THIRD_PARTY_REPORTED_SALE:'صفقة منقولة عن جهة ثالثة',
 EXTERNAL_AVM_ESTIMATE:'تقدير آلي خارجي',RESEARCH_NOTE:'مرجع بحثي بلا قيمة رقمية'
};
const confidenceEn={HIGH:'High (provider claim)',MEDIUM:'Medium (provider claim)',LOW:'Low (provider claim)'};
const metricEn={estimated_value_sar:'Estimated value',sale_price_sar:'Published asking/sale price (unverified)',
 deal_count:'Transaction count',deal_value_sar:'Reported transaction value',
 avg_sqm_sar:'Average SAR/sqm'};
const classEn={
 OFFICIAL_AGGREGATE:'Official aggregated indicator',
 OFFICIAL_REPORTED_SALE:'Sale reported by government interface (not independently confirmed)',
 THIRD_PARTY_AGGREGATE:'Third-party aggregated indicator',
 THIRD_PARTY_REPORTED_SALE:'Third-party reported transaction (unverified)',
 EXTERNAL_AVM_ESTIMATE:'External automated valuation estimate',
 RESEARCH_NOTE:'Research reference without numeric value'
};
export default function SaudiNationalIntelligenceSourcesPanel({onResearchChange}){
 const {locale}=useLocale();
 const en=locale==='en';
 const tr=(ar,translation)=>en?translation:ar;
 const fmt=n=>new Intl.NumberFormat(en?'en-US':'ar-SA').format(n);
 const evidenceClassLabels=en?classEn:classLabel;
 const metrics=en?metricEn:metricAr;
 const [records,setRecords]=useState([]);
 const [sourceId,setSourceId]=useState(''),[city,setCity]=useState('');
 const [evidenceClass,setEvidenceClass]=useState('');
 const [observedOn,setObservedOn]=useState(()=>new Date().toISOString().slice(0,10));
 const [notice,setNotice]=useState('');
 const summary=useMemo(()=>summarizeNationalResearch(records),[records]);
 const filtered=useMemo(()=>filterNationalResearch(records,{sourceId,city,evidenceClass}),
  [records,sourceId,city,evidenceClass]);
 async function importFile(file){
  if(!file)return;
  if(file.size>MAX_CSV_BYTES){setNotice({ar:'حجم الملف أكبر من الحد المسموح',en:'CSV file exceeds allowed size'});return;}
  try{
   const fresh=importNationalSourcesCsv(await file.text(),{observedOn});
   const merged=mergeNationalResearch(records,fresh.records);
   setRecords(merged.records);onResearchChange?.(merged.records);setSourceId('');setCity('');setEvidenceClass('');
   setNotice({en:'Imported '+merged.added+'; duplicates '+merged.duplicates+
      '; conflicts '+merged.conflicts.length+'; excluded '+fresh.rejected.length+
      '. No independently verified executed sales or certified valuations.',
     ar:'أضيف '+merged.added+'؛ مكرر '+merged.duplicates+
      '؛ متعارض '+merged.conflicts.length+'؛ مستبعد '+fresh.rejected.length+
      '. لا توجد صفقات منفذة مؤكدة أو تقييمات معتمدة.'});
  }catch(e){setNotice({ar:'خطأ بالاستيراد: '+String(e.message||'UNKNOWN'),en:'CSV import error: '+String(e.message||'UNKNOWN')});}
 }
 return <section dir={en?'ltr':'rtl'} data-testid="national-intelligence-sources"
   className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-sky-800 bg-slate-950 p-4 text-slate-100">
  <h3 className="text-base font-bold">{tr('مصادر البيانات الرسمية والتقييم العقاري — بحث شخصي','Saudi official and third-party property evidence — personal research')}</h3>
  <p className="mt-2 text-xs leading-6 text-slate-300">
   {tr('مصادر حكومية وتحليلية وتقديرات خارجية، ومنها بيوت تروڤاليو. رابط مانوس محفوظ كمرجع غير مقروء. الأرقام المستوردة هنا معلومات بحثية غير محققة بشكل مستقل؛ لا تنتقل إلى نموذج القيمة أو التقارير المعتمدة.',
   'Government and analytical sources and third-party estimates, including Bayut TrueValue. The Manus URL is a reference only and cannot be read by this workflow. Imported figures are research inputs without independent authentication and are not promoted into certified valuations or financial results.')}
  </p>
  <div data-testid="national-sources-links" className="mt-3 flex flex-wrap gap-2">
   {SOURCES.map(src=><a key={src.id} target="_blank" rel="noopener noreferrer"
    href={src.url} data-user-content translate="no" className="rounded border border-slate-600 px-3 py-2 text-xs text-sky-300">
    {src.label}</a>)}
  </div>
  <div data-testid="national-official-entrypoints" className="mt-4 rounded-lg border border-slate-700 p-3">
   <h4 className="text-sm font-semibold">{tr('التحقق من المصادر السعودية الرسمية','Research Saudi official source entrypoints')}</h4>
   <p className="mt-1 text-xs text-amber-200">{tr('هذه روابط عرض وبحث على مواقع الجهات الرسمية، وليست تكامل API داخل STARTAK. يجب التفريق بين الصفقات اليومية الخام والبيانات التاريخية المنقحة ومؤشرات الإيجار، ولا تُدرج أي قيمة آليًا في تقرير التقييم.',
 'These are links for human research on official websites, not live API integrations. Raw daily transactions, revised historical transaction data and rent indices must be distinguished. No value is automatically imported into a certified report.')}</p>
   <div className="mt-2 grid gap-2 sm:grid-cols-2">
    {OFFICIAL_RESEARCH_ENTRYPOINTS.map(src=><a key={src.id} href={src.url}
     target="_blank" rel="noopener noreferrer" data-testid={'official-entry-'+src.id}
     className="rounded border border-slate-600 p-2 text-xs text-sky-300">
      <strong data-user-content translate="no" className="block">{src.label}</strong>
      <span className="mt-1 block text-slate-300">{en?({REGA_DAILY_RAW:'Raw data require review of classification, duplicates, parties and property rights.',REGA_HISTORICAL_CLEANED:'Revised research indicators or records do not establish a matching property or an independent professional value.',REGA_RENT_INDICATORS:'Aggregated rent indicators are not a property rent roll or a verified tenant contract.',MOJ_INTERACTIVE_REPORTS:'Review dataset dates, scope and reuse rights before importing a copy.'})[src.id]:src.caveat}</span>
     </a>)}
   </div>
  </div>
  <p className="mt-3 text-xs text-slate-300 break-all">
   {en?'CSV schema: ':'صيغة CSV: '}<code>source,city,district,kind,recordId,eventDate,periodStart,periodEnd,metricName,metricValue,unit,sourceUrl,assetType</code>.
   {tr('ولتقديرات القيمة الآلية (اختياري):','Optional AVM fields:')} <code>rangeLowSar,rangeHighSar,confidenceLabel,modelAsOf</code>.
   {tr('مستوى الثقة المعلن ليس دقة مثبتة. المؤشرات تحتاج فترة ووحدة قياس، والصفقات المنشورة تحتاج معرفًا وتاريخًا، والتقدير الآلي لا يُعد صفقة.',
     'Provider-stated confidence is not validated accuracy. Indicators require a defined reporting period and unit; reported sales need IDs and dates, and automated estimates are not executed transactions.')}
  </p>
  <div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="text-xs">{tr('تاريخ الاطلاع','Observation date')}
    <input type="date" data-testid="national-observed-on" value={observedOn}
     onChange={e=>setObservedOn(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="rounded border border-slate-600 p-2 text-xs">{tr('استيراد CSV بحثي','Import research CSV')}
    <input type="file" accept=".csv,text/csv" data-testid="national-import-csv"
     className="block max-w-[210px]" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';await importFile(file);}}/>
   </label>
   <label className="text-xs">{tr('المدينة','City')}
    <select data-testid="national-city-filter" value={city} onChange={e=>setCity(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">{tr('كل المدن','All cities')}</option>
     {summary.cities.map(x=><option data-user-content translate="no" key={x} value={x}>{x}</option>)}
    </select>
   </label>
   <label className="text-xs">{tr('المصدر','Source')}
    <select data-testid="national-source-filter" value={sourceId} onChange={e=>setSourceId(e.target.value)}
     className="mt-1 block max-w-[220px] rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">{tr('جميع المصادر','All sources')}</option>
     {SOURCES.map(x=><option data-user-content translate="no" key={x.id} value={x.id}>{x.label}</option>)}
    </select>
   </label>
   <label className="text-xs">{tr('نوع الدليل','Evidence class')}
    <select data-testid="national-class-filter" value={evidenceClass}
     onChange={e=>setEvidenceClass(e.target.value)}
     className="mt-1 block max-w-[230px] rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">{tr('كل الأنواع','All classes')}</option>
     {Object.entries(evidenceClassLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
   </label>
  </div>
  <p className="mt-3 text-xs text-slate-300" data-testid="national-summary">
   {tr('المصادر المسجلة: ','Recorded sources: ')}{summary.sources} | {tr('الصفوف المستوردة: ','Imported rows: ')}{summary.imported} |
   {tr('المدن: ','Cities: ')}{summary.cities.length} | {tr('الصفقات الفردية المثبتة: ','Independently verified executed transactions: ')}{summary.verifiedExecutedSales}
  </p>
  <div className="mt-3 w-full min-w-0 max-w-full overflow-x-auto">
   <table className={'w-full min-w-[780px] text-xs '+(en?'text-left':'text-right')}>
    <thead className="border-b border-slate-700 text-slate-300"><tr>
     <th className="p-2">{tr('المصدر','Source')}</th><th className="p-2">{tr('المدينة','City')}</th><th className="p-2">{tr('الحي','District')}</th>
     <th className="p-2">{tr('النوع','Type')}</th><th className="p-2">{tr('المؤشر','Metric')}</th>
     <th className="p-2">{tr('القيمة / الوحدة','Value / unit')}</th><th className="p-2">{tr('نطاق المزود / ثقته المعلنة','Provider range / stated confidence')}</th><th className="p-2">{tr('المصدر','Source')}</th>
    </tr></thead>
    <tbody>{filtered.slice(0,50).map((r,i)=><tr key={r.sourceId+'|'+r.observedOn+'|'+r.recordId+'|'+i}
     className="border-b border-slate-800">
      <td data-user-content translate="no" className="p-2">{SOURCES.find(x=>x.id===r.sourceId)?.label}</td>
      <td data-user-content translate="no" className="p-2">{r.city}</td><td data-user-content translate="no" className="p-2">{r.district}</td>
      <td className="p-2">{evidenceClassLabels[r.evidenceClass]}</td><td className="p-2">{metrics[r.metricName]||r.metricName||'—'}</td>
      <td className="p-2">{r.metricValue===null?'—':fmt(r.metricValue)+' '+r.metricUnit}</td>
      <td className="p-2">{r.providerRangeLowSar===null?'—':
       fmt(r.providerRangeLowSar)+' – '+
       fmt(r.providerRangeHighSar)}
       {r.providerStatedConfidence?tr(' / ثقة المزود المعلنة: ',' / Stated provider confidence: ')+
        ((en?confidenceEn:confidenceAr)[r.providerStatedConfidence]||r.providerStatedConfidence):''}</td>
      <td className="p-2"><a target="_blank" rel="noopener noreferrer"
       href={r.sourceUrl} className="text-sky-300 underline">{tr('فتح','Open')}</a></td>
     </tr>)}</tbody>
   </table>
  </div>
  <p className="mt-2 text-xs text-slate-400">
   {tr('المعروض ','Showing ')}{Math.min(filtered.length,50)} {tr('من ','of ')}{filtered.length}
   {tr(' سجل بحثي. لا يوجد ربط API حي مؤكد، ولا تحقق مستقل من صكوك أو أسعار الصفقات أو دقة أي نموذج تقييم خارجي.',
   ' research rows. No confirmed live API, independently checked land titles, executed sales or external AVM accuracy.')}
  </p>
  {en&&<p data-testid="national-language-scope" className="mt-2 text-xs text-amber-200">
    Provider names, descriptions and original official-site caveats retain source-language wording;
    translation does not validate any source or authorize market use.
  </p>}
  {notice&&<p role="status" data-testid="national-import-status"
   data-diagnostic-content translate="no" className="mt-2 text-xs text-sky-200">{en?notice.en:notice.ar}</p>}
 </section>;
}