import React,{useMemo,useState} from 'react';
const {useLocale}=require('../i18n/LocaleContext.js');
const {advancedMarketLabel,advancedMarketMoney}=require('../i18n/advanced-market-presentation');
const {reviewMarketOffers,importOfferRowsCsv}=require('../market/asking-offers');
const {ASSET_TYPES}=require('../market/instant-market-study');
const INPUT='w-full min-h-[40px] rounded-lg border border-slate-600 bg-[#101c30] px-3 py-2 mt-1 text-sm text-slate-100';
const yesterday=()=>new Date().toISOString().slice(0,10);
const newOffer=()=>({
 offerKind:'SALE',assetType:'',evidenceType:'ASKING',date:yesterday(),sourceUrl:'',
 price:'',annualRent:'',rentPeriod:'YEAR',investmentTerms:'',
 builtArea:'',landArea:'',rentableArea:'',landSubtype:'',city:'',district:'',location:'',
});
const assetOptions=[['','اختر النوع'],...Object.entries(ASSET_TYPES)];
function Field({title,value,onChange,type='text',placeholder=''}) {
 const {locale}=useLocale();const L=(value,code)=>advancedMarketLabel(value,locale,code);
 return <label className="min-w-0 block text-xs text-slate-300">{L(title)}
 <input className={INPUT} type={type} value={value||''} onChange={e=>onChange(e.target.value)}
  placeholder={placeholder} dir={type==='date'?'ltr':'auto'}/>
 </label>;
}
function Select({title,value,onChange,options}) {
 const {locale}=useLocale();const L=(value,code)=>advancedMarketLabel(value,locale,code);
 return <label className="min-w-0 block text-xs text-slate-300">{L(title)}
 <select value={value||''} className={INPUT} onChange={e=>onChange(e.target.value)}>
  {options.map(([v,title])=><option key={v} value={v}>{L(title,v)}</option>)}
 </select></label>;
}
const rejectLabels={
 ASSET_TYPE_MISMATCH:'نوع عقار غير مطابق',NOT_ASKING_OFFER:'لم يؤكد أنه سعر مطلوب',
 WRONG_OFFER_PURPOSE:'طبيعة العرض غير واضحة',SOURCE_LINK_REQUIRED:'رابط المصدر مفقود',
 STALE_OR_INVALID_DATE:'إعلان قديم أو تاريخه غير صحيح',OUTSIDE_5_KM:'خارج نطاق 5 كم',
 NO_VERIFIABLE_LOCATION_MATCH:'المدينة والحي/الموقع غير مطابقين',
 COMPARABLE_AREA_REQUIRED:'المساحة المقارنة ناقصة',ASKING_PRICE_REQUIRED:'السعر المطلوب ناقص',
 RENT_PERIOD_UNSUPPORTED:'دورية الإيجار غير معروفة',NO_LONGER_ACTIVE:'الإعلان غير نشط',
 UNIT_PRICE_IMPLAUSIBLE:'سعر المتر غير منطقي',DUPLICATE_SOURCE:'إعلان مكرر',LAND_SUBTYPE_UNVERIFIED:'تصنيف الأرض غير معلوم أو لا يطابق الأرض المراد تقييمها',
 INVESTMENT_STRUCTURE_REQUIRES_SEPARATE_UNDERWRITING:'الفرصة الاستثمارية تحتاج دراسة لشروطها والتدفقات؛ ليست مقارنة سعر متر',
};
export default function MarketOfferResearchPanel({subject,offers,setOffers,asOf}) {
 const {locale}=useLocale();const en=locale==='en';
 const L=(value,code)=>advancedMarketLabel(value,locale,code);
 const money=value=>advancedMarketMoney(value,locale);

 const [message,setMessage]=useState('');
 const [reuseAcknowledged,setReuseAcknowledged]=useState(false);
 const asOfMs=asOf instanceof Date?asOf.getTime():Date.now();
 const research=useMemo(()=>reviewMarketOffers({subject,offers,asOf:new Date(asOfMs)}),[subject,offers,asOfMs]);
 const update=(i,k,v)=>setOffers(old=>old.map((x,j)=>i===j?{...x,[k]:v}:x));
 const add=()=>setOffers(old=>old.length<50?[...old,{...newOffer(),
  assetType:subject.assetType,landSubtype:subject.landSubtype||'',city:subject.city,district:subject.district}]:old);
 const importCsv=async file=>{
  if(!file)return;
  try{
   if(!reuseAcknowledged)throw Error('يلزم الإقرار بحق استخدام البيانات قبل الاستيراد');
   if(file.size>512*1024)throw Error('ملف أكبر من نصف ميغابايت');
   const result=importOfferRowsCsv(await file.text());
   setOffers(old=>[...old,...result.offers].slice(0,300));
   setMessage({count:result.offers.length});
  }catch(e){setMessage({error:String(e.message||'CSV_INVALID')});}
 };
 const selectArea=subject.assetType==='LAND'?'landArea':'builtArea';
 const rentArea=subject.assetType==='LAND'?'landArea':'rentableArea';
 return <details dir={en?'ltr':'rtl'} data-testid="asking-offer-research"
   className="mt-5 rounded-xl border border-slate-600 bg-[#16273C] p-3 md:p-4 text-slate-100">
   <summary className="cursor-pointer min-h-[44px] text-sm font-bold text-amber-100">{L("عروض السوق المعلنة — عقار والمنصات العقارية الأخرى (ليست صفقات منفذة)")}</summary>
   <p className="mt-3 text-xs text-slate-300 leading-6">{L("افتح موقع عقار أو مصدرًا آخر للاطلاع، ثم أضف رابط الإعلان وسعره ومساحته وموقعه أو استورد ملف CSV لديك حق استخدامه. لا تجلب STARTAK الإعلانات آليًا من مواقع خاصة في هذا الإصدار، ولا تخزن أرقام تواصل المعلنين. العروض المعلنة تستخدم لتحليل المنافسة والسعر المطلوب، ولا تتحول إلى قيمة بيع منفذة أو إيجار متعاقد عليه.")}</p>
   <div className="flex flex-wrap gap-2 mt-3">
    <a href="https://sa.aqar.fm/" className="inline-flex min-h-[40px] items-center rounded-lg border border-amber-600 px-3 py-2 text-xs text-sky-200"
     target="_blank" rel="noopener noreferrer">{L("استعراض إعلانات عقار")}</a>
    <a href="https://rei.rega.gov.sa/ar/advanced-search/deals"
      className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-600 px-3 py-2 text-xs text-sky-200"
      target="_blank" rel="noopener noreferrer">{L("الصفقات المسجلة — المؤشرات العقارية")}</a>
    <a href="https://www.moj.gov.sa/ar/opendata/Pages/reports.aspx"
      className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-600 px-3 py-2 text-xs text-sky-200"
      target="_blank" rel="noopener noreferrer">{L("تقارير وزارة العدل")}</a>
   </div>
   <div className="mt-3">
    <label className="flex min-h-[40px] items-center gap-3 text-xs text-slate-300">
     <input type="checkbox" className="h-6 w-6 shrink-0" checked={reuseAcknowledged}
      onChange={e=>setReuseAcknowledged(e.target.checked)}/>{L("أؤكد امتلاكي حق استخدام بيانات ملف الإعلانات لأغراض البحث")}</label>
    <label className="block text-xs text-slate-300">{L("استيراد عروض من ملف CSV مرخّص أو أعددته بنفسك")}<input className={INPUT} disabled={!reuseAcknowledged} type="file" accept=".csv,text/csv,text/plain"
      onChange={async e=>{const f=e.target.files?.[0];e.target.value='';await importCsv(f);}}/>
    </label>
    <p className="mt-1 text-xs text-slate-400">{L("الأعمدة: نوع العرض، نوع العقار، حالة السعر (عرض)، تاريخ الإعلان، رابط الإعلان، السعر المطلوب أو الإيجار المطلوب، دورية الإيجار، المساحة، المدينة، الحي، الموقع.")}</p>
   </div>
   <p role="status" className="mt-2 text-xs text-amber-200">{message&&(message.error?(en?'Import failed: ':'تعذر الاستيراد: ')+L(message.error):(en?'Imported ':'تم استيراد ')+message.count+(en?' listings. Incomplete rows are excluded from indicators.':' عرضاً. تُستبعد الصفوف غير المكتملة من المؤشرات.'))}</p>
   {offers.map((offer,i)=><div key={i} className="mt-3 rounded-lg border border-slate-700 p-3">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-xs text-amber-100">{L("عرض معلن")} {i+1}</strong>
      <button type="button" className="min-h-[36px] rounded px-3 text-xs text-rose-200"
        onClick={()=>setOffers(old=>old.filter((_,j)=>i!==j))}>{L("حذف")}</button>
     </div>
     <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
       <Select title="الغرض من العرض" value={offer.offerKind} onChange={v=>update(i,'offerKind',v)}
        options={[['SALE',L('عرض بيع')],['RENT',L('عرض إيجار')],['INVESTMENT',L('فرصة استثمارية — سياق فقط')]]}/>
       <Select title="نوع العقار المحدد" value={offer.assetType} onChange={v=>update(i,'assetType',v)} options={assetOptions}/>
       {offer.assetType==='LAND'&&<Select title="نوع الأرض المعلنة" value={offer.landSubtype}
         onChange={v=>update(i,'landSubtype',v)}
         options={[['',L('اختر نوع الأرض')],['RAW',L('أرض خام غير مخدومة')],
          ['SERVICED',L('أرض مخدومة ومخططة')],['RESIDENTIAL',L('قطعة أرض سكنية')],
          ['COMMERCIAL',L('قطعة أرض تجارية')],['AGRICULTURAL',L('أرض زراعية')]]}/>}

       <Field title="تاريخ الإعلان أو المراجعة" type="date" value={offer.date} onChange={v=>update(i,'date',v)}/>
       {offer.offerKind==='SALE'
        ?<Field title="السعر المطلوب للبيع (ريال)" value={offer.price} onChange={v=>update(i,'price',v)}/>
        :offer.offerKind==='RENT'?<>
         <Field title="قيمة الإيجار المعلن للفترة (ريال)" value={offer.annualRent} onChange={v=>update(i,'annualRent',v)}/>
         <Select title="دورية الإيجار" value={offer.rentPeriod} onChange={v=>update(i,'rentPeriod',v)}
          options={[['YEAR',L('سنوي')],['MONTH',L('شهري')],['UNKNOWN',L('غير معروف / موسمي — يستبعد')]]}/>
        </>:<Field title="وصف شروط فرصة الاستثمار (دون معلومات شخصية)"
          value={offer.investmentTerms} onChange={v=>update(i,'investmentTerms',v)}/>}
       {offer.offerKind!=='INVESTMENT'&&<Field title={offer.offerKind==='SALE'?(selectArea==='landArea'?L('مساحة الأرض المقارنة (م²)'):L('مساحة البناء المقارنة (م²)')):
         (rentArea==='landArea'?L('مساحة الأرض المؤجرة (م²)'):L('المساحة القابلة للتأجير (م²)'))}
         value={offer[offer.offerKind==='SALE'?selectArea:rentArea]}
         onChange={v=>update(i,offer.offerKind==='SALE'?selectArea:rentArea,v)}/>}
       <Field title="المدينة" value={offer.city} onChange={v=>update(i,'city',v)}/>
       <Field title="الحي" value={offer.district} onChange={v=>update(i,'district',v)}/>
       <Field title="الإحداثيات — عند توفرها" value={offer.location} onChange={v=>update(i,'location',v)}
         placeholder="24.7,46.7"/>
       <div className="sm:col-span-2 lg:col-span-3">
         <Field title="رابط الإعلان الأصلي (رابط آمن)" value={offer.sourceUrl}
           onChange={v=>update(i,'sourceUrl',v)} placeholder="https://sa.aqar.fm/..."/>
       </div>
     </div>
     {!!research.reviewed[i]?.issues?.length&&<p className="mt-2 text-xs text-amber-200">{L("غير مؤهل للمقارنة حاليًا:")} {research.reviewed[i].issues.map(x=>L(rejectLabels[x]||x)).join('؛ ')}
     </p>}
     {research.reviewed[i]?.accepted&&<p className="mt-2 text-xs text-slate-300">{L("السعر المطلوب لكل م²:")} {money(research.reviewed[i].unitAskingSar)}.
      {research.reviewed[i].spatialMatch==='SAME_DISTRICT_APPROXIMATION'?L(' تطابق على مستوى الحي فقط؛ المسافة غير مؤكدة.'):''}
     </p>}
    </div>)}
   <div className="flex flex-wrap gap-3 mt-3">
    <button type="button" onClick={add} aria-label={L("إضافة عرض بيع أو إيجار")} className="min-h-[40px] rounded-lg border border-amber-600 px-4 py-2 text-xs text-amber-200">{L("+ إضافة عرض بيع أو إيجار")}</button>
    {offers.length>0&&<button type="button" className="min-h-[40px] rounded-lg border border-slate-600 px-3 py-2 text-xs text-rose-200"
      onClick={()=>setOffers([])}>{L("مسح العروض")}</button>}
   </div>
   <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div className="rounded-xl border border-slate-600 p-3">
     <p className="text-xs text-slate-300">{L("مؤشر سعر البيع المطلوب /م²")}</p>
     <strong className="block mt-1 text-base text-amber-100">{money(research.askingSales.medianAskingSarPerSqm)}</strong>
     <p className="text-xs mt-1 text-slate-300">{L("عروض مؤهلة:")} {research.askingSales.acceptedOffers} ({L('الحد الأدنى 3')})</p>
    </div>
    <div className="rounded-xl border border-slate-600 p-3">
     <p className="text-xs text-slate-300">{L("مؤشر الإيجار المطلوب سنويًا /م²")}</p>
     <strong className="block mt-1 text-base text-amber-100">{money(research.askingRentalsAnnual.medianAskingSarPerSqm)}</strong>
     <p className="text-xs mt-1 text-slate-300">{L("عروض مؤهلة:")} {research.askingRentalsAnnual.acceptedOffers} ({L('الحد الأدنى 3')})</p>
    </div>
   </div>
   <p className="mt-3 text-xs text-amber-200 leading-6">{L("الحساب أعلاه للمعلَن فقط، وليس سعر تنفيذ أو إيجار عقود موثقة. لا تطبق المنصة خصم تفاوض ثابتًا أو تحول مؤشر العرض تلقائيًا إلى قيمة العقار اليوم. الإعلانات قد تكون مكررة أو قديمة أو تحتوي رسومًا وخدمات إضافية؛ لذلك يجب مراجعتها.")}</p>
  </details>;
}
