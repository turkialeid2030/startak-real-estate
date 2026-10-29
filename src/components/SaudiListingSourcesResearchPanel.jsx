import React,{useMemo,useState} from 'react';
const {SOURCES,parseListingResearchCsv,mergeListingResearch,filterListingResearch,
 listingResearchSummary}=require('../market/saudi-listing-source-research');
const {useLocale}=require('../i18n/LocaleContext.js');
const {researchSourceLabel,researchNumber}=require('../i18n/research-source-presentation');
const {MAX_CSV_BYTES}=require('../market/public-dataset-import');
const KIND_LABELS={SALE_OFFER:'عرض بيع',RENT_OFFER:'عرض إيجار',
 PROJECT_INDICATIVE:'مشروع / سعر استرشادي',AUCTION_ASK:'سعر مزاد معلن',
 BUYER_REQUEST:'طلب عقاري / ميزانية'};
export default function SaudiListingSourcesResearchPanel({onResearchChange}){
 const {locale}=useLocale();const en=locale==='en';
 const L=value=>researchSourceLabel(value,locale);
 const fmt=value=>researchNumber(value,locale);
 const [records,setRecords]=useState([]);
 const [city,setCity]=useState('');
 const [platform,setPlatform]=useState('');
 const [kind,setKind]=useState('');
 const [observedOn,setObservedOn]=useState(()=>new Date().toISOString().slice(0,10));
 const [notice,setNotice]=useState('');
 const [batchIssues,setBatchIssues]=useState([]);
 const summary=useMemo(()=>listingResearchSummary(records),[records]);
 const filtered=useMemo(()=>filterListingResearch(records,{city,sourceId:platform,kind}),[records,city,platform,kind]);
 const onFile=async file=>{
  if(!file)return;
  if(file.size>MAX_CSV_BYTES){setNotice({ar:'حجم ملف CSV يتجاوز الحد البحثي',en:'CSV exceeds the research size limit'});return;}
  try{
   const parsed=parseListingResearchCsv(await file.text(),{observedOn});
   const merged=mergeListingResearch(records,parsed.records);
   setRecords(merged.records);onResearchChange?.(merged.records);
   setCity('');setPlatform('');setKind('');
   const issues=[...parsed.rejected.slice(0,10),...merged.conflicts.slice(0,10)];
   setBatchIssues(issues);
   setNotice({ar:'أُضيف '+merged.added+' سجلًا؛ مكرر '+merged.duplicates+'؛ متعارض '+merged.conflicts.length+'؛ مرفوض '+parsed.rejected.length+'؛ تكرار محتمل بين المنصات '+merged.potentialCrossSourceDuplicates.length+'. لا توجد صفقات منفذة مستوردة.',
    en:'Added '+merged.added+'; duplicates '+merged.duplicates+'; conflicts '+merged.conflicts.length+'; rejected '+parsed.rejected.length+'; possible cross-platform duplicates '+merged.potentialCrossSourceDuplicates.length+'. No executed transactions imported.'});
  }catch(e){setBatchIssues([]);const code=String(e.message||'UNKNOWN');setNotice({ar:'تعذر قراءة البيانات: '+code,en:'Import failed: '+code});}
 };
 return <section data-testid="saudi-listing-research" dir={en?'ltr':'rtl'}
  className="mt-5 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-sky-800 bg-slate-950 p-4 text-slate-100">
  <h3 className="text-base font-bold">{L("مصادر العروض والطلبات العقارية — جميع مدن المملكة")}</h3>
  <p className="mt-2 text-xs leading-6 text-slate-300">{L("سبعة مصادر بحثية. الأسعار المطلوبة والميزانيات والمشاريع والمزادات ليست صفقات منفذة، ولا تدخل تلقائيًا في حساب القيمة السوقية أو تقرير مهني. لم تُشغّل واجهة جمع آلي لهذه المواقع.")}</p>
  <div data-testid="saudi-listing-sources" className="mt-3 flex flex-wrap gap-2">
   {SOURCES.map(s=><a key={s.id} target="_blank" rel="noopener noreferrer" href={s.baseUrl}
    className="rounded border border-slate-600 px-3 py-2 text-xs text-sky-300">{s.nameAr}</a>)}
  </div>
  <p className="mt-3 break-all text-xs text-slate-300">{L("صيغة ملف CSV: source,city,district,kind,priceSar,areaSqm,listingUrl,listingId,assetType,listingDate. تصنيفات kind: SALE_OFFER / RENT_OFFER / PROJECT_INDICATIVE / AUCTION_ASK / BUYER_REQUEST.")}</p>
  <div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="text-xs">{L("تاريخ الاطلاع على الدفعة")}<input data-testid="listing-observed-on" type="date" value={observedOn}
     onChange={e=>setObservedOn(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2"/>
   </label>
   <label className="text-xs rounded border border-slate-600 p-2">{L("إضافة CSV بحثي للعروض")}<input data-testid="listing-source-csv" type="file" accept=".csv,text/csv"
     className="block max-w-[220px]" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';await onFile(file);
     }}/>
   </label>
   <label className="text-xs">{L("المدينة")}<select data-testid="listing-city-filter" value={city} onChange={e=>setCity(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">{L("جميع المدن المستوردة")}</option>
     {summary.cities.map(c=><option value={c} key={c}>{c}</option>)}
    </select>
   </label>
   <label className="text-xs">{L("المنصة")}<select data-testid="listing-platform-filter" value={platform} onChange={e=>setPlatform(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">{L("جميع المنصات")}</option>{SOURCES.map(s=><option key={s.id} value={s.id}>{s.nameAr}</option>)}
    </select>
   </label>
   <label className="text-xs">{L("نوع الإشارة")}<select data-testid="listing-kind-filter" value={kind} onChange={e=>setKind(e.target.value)}
     className="mt-1 block rounded border border-slate-600 bg-slate-900 p-2">
     <option value="">{L("الجميع")}</option>
     {Object.entries(KIND_LABELS).map(([key,label])=>[key,L(label)]).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
  </div>
  <p className="mt-3 text-xs text-slate-300" data-testid="listing-research-scope">
   {en?'Configured sources: ':'المصادر المتاحة: '}{summary.sourcesConfigured} | {en?'Imported rows: ':'السجلات المستوردة: '}{summary.imported} | {en?'Cities: ':'المدن في البيانات: '}{summary.cities.length} | {en?'Independently verified executed sales: 0':'الصفقات المنفذة المؤكدة: 0'}
  </p>
  <div className="mt-3 w-full max-w-full min-w-0 overflow-x-auto">
   <table className="w-full min-w-[760px] text-xs" style={{textAlign:en?'left':'right'}}>
    <thead className="border-b border-slate-700 text-slate-300"><tr>
     <th className="p-2">{L("المصدر")}</th><th className="p-2">{L("المدينة")}</th><th className="p-2">{L("الحي")}</th>
     <th className="p-2">{L("النوع")}</th><th className="p-2">{L("المبلغ المعلن (ر.س)")}</th>
     <th className="p-2">{L("المساحة (م²)")}</th><th className="p-2">{L("المشاهدة")}</th>
    </tr></thead>
    <tbody>{filtered.slice(0,75).map((r,i)=><tr className="border-b border-slate-800"
      key={r.sourceId+'|'+r.listingUrl+'|'+r.observedOn+'|'+i}>
     <td className="p-2">{r.sourceNameAr}</td><td className="p-2">{r.city}</td>
     <td className="p-2">{r.district}</td><td className="p-2">{L(KIND_LABELS[r.kind])}</td>
     <td className="p-2">{fmt(r.askingPriceOrBudgetSar)}</td>
     <td className="p-2">{fmt(r.areaSqm)}</td>
     <td className="p-2"><a href={r.listingUrl} target="_blank" rel="noopener noreferrer"
      className="text-sky-300 underline">{L("المصدر")}</a></td>
    </tr>)}</tbody>
   </table>
  </div>
  <p className="mt-2 text-xs text-slate-400">
   {en?'Showing ':'المعروض '}{Math.min(filtered.length,75)} {en?'of ':'من '}{filtered.length}. {en?'Buyer-request amounts are budgets or expressions of interest, not sale prices. Same-day conflicts require manual review.':'أي مبلغ لطلب عقاري هو ميزانية أو إشارة اهتمام، وليس سعر بيع. تعارض المصدر في اليوم نفسه يتطلب مراجعة يدوية.'}
  </p>
  {notice&&<p role="status" data-testid="listing-import-notice"
   className="mt-2 text-xs text-sky-200">{en?notice.en:notice.ar}</p>}
  {batchIssues.length>0&&<p data-testid="listing-import-issues" className="mt-2 text-xs text-amber-200">
    {en?'Rows or conflicts needing manual review: ':'أسطر أو تعارضات تحتاج مراجعة يدوية: '}{batchIssues.length}.
   </p>}
 </section>;
}
