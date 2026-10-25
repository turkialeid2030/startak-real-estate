import React,{useState} from 'react';
const {EXPENSE_TREATMENT}=require('../valuation-intelligence/income-capitalization');
const {VALUATION_METHOD}=require('../valuation-intelligence/contracts');
const {STATUS,MARKET_UNITS,evaluatePersonalSectorScenarios}=require('../valuation-intelligence/personal-sector-scenario-workbench');
const {parseAmount}=require('../source-intelligence/personal-saudi-sale-csv');

const REASONS={
 UNKNOWN_ASSET_CLASS:'نوع العقار غير معرّف',
 CITY_REQUIRED:'حدد المدينة',
 PROPERTY_SUBTYPE_REQUIRED:'حدد النوع التفصيلي للعقار',
 VALUATION_DATE_INVALID:'تاريخ الدراسة غير صحيح',
 SUBJECT_AREA_REQUIRED:'أدخل المساحة',
 PROPERTY_RIGHT_UNDEFINED:'حدد الحق العقاري محل التحليل',
 RESTRICTED_PROPERTY_INTEREST_REQUIRES_SPECIFIC_CASHFLOW_MODEL:'حق الإيجار أو الانتفاع أو الوقف يتطلب نموذجًا مستقلاً لمدة الحق والتزاماته؛ لا يُعامل كملكية كاملة',
 AT_LEAST_ONE_METHOD_REQUIRED:'اختر طريقة تقييم واحدة على الأقل',
 GROUND_RENT_INSTEAD_OF_BUILDING_NOI_REQUIRED:'دخل الأرض يجب أن يكون إيجار حق الأرض الموثق وليس دخل مبنى',
 OPERATING_BUSINESS_NOI_NOT_SEPARATED:'افصل دخل العقار عن أرباح النشاط والمعدات والسمعة التجارية',
 MIXED_USE_SHARED_COSTS_UNALLOCATED:'وزّع التكاليف المشتركة على مكونات المجمع',
 PROPERTY_NOI_INPUTS_INVALID:'دخل العقار ومصروفاته غير صالحين',
 CAP_RATE_MISSING_OR_OUT_OF_BOUNDS:'معدل الرسملة يجب أن يكون موجبًا وأقل من 50%',
 OPERATING_EXPENSE_POLICY_REQUIRED:'حدد سياسة تحمل مصروفات العقار',
 ZERO_OPEX_NO_TENANT_POLICY:'المصروفات الصفرية تتطلب تحديد تحمل المستأجر',
 REPLACEMENT_COST_INPUTS_INVALID:'تكلفة الاستبدال أو الاستهلاك غير صالحة',
 LAND_ONLY_REQUIRES_LAND_METHOD_NOT_BUILDING_REPLACEMENT:'الأرض الفضاء لا تُقيّم بتكلفة مبنى غير موجود',
 NON_REAL_ESTATE_COMPONENTS_NOT_EXCLUDED_FROM_COST:'استبعد المعدات والقيم التجارية من تكلفة العقار',
 AT_LEAST_THREE_EXECUTED_COMPARABLES_REQUIRED:'أدخل ثلاث صفقات منفذة مماثلة على الأقل',
 MARKET_COMPARABLE_IDENTITY_DATE_OR_STATUS_INVALID:'الصفقات غير متطابقة بالحي أو المدينة أو النوع أو الحق أو وحدة المقارنة أو التاريخ أو المرجع',
 MARKET_UNIT_NOT_APPROPRIATE_FOR_SECTOR:'وحدة المقارنة المختارة غير مناسبة لطبيعة هذا القطاع',
 SUBJECT_DISTRICT_REQUIRED_FOR_SALES:'حدد الحي الذي تقع فيه المقارنات',
 SUBJECT_MARKET_COMPARISON_QUANTITY_REQUIRED:'أدخل عدد وحدات المقارنة المناسبة للقطاع',
 MARKET_PRICE_INCLUDES_UNSEPARATED_OPERATING_BUSINESS:'قيمة الصفقات تتضمن أرباح التشغيل أو المعدات غير العقارية',
 MIXED_USE_COMPARABLE_ALLOCATION_UNCLEAR:'لا توجد تسوية واضحة لمكونات قيمة المجمع متعدد الاستخدامات',
 SECOND_INDEPENDENT_METHOD_NOT_PROVIDED:'متاح مؤشر طريقة واحدة فقط ولا يوجد ترجيح نهائي',
 RECONCILIATION_POLICY_REQUIRED:'أدخل أوزان الطرق وحد فرق القيم للترجيح',
 RECONCILIATION_POLICY_INVALID:'الأوزان يجب أن يكون مجموعها 1 وكل وزن أكبر من صفر',
 HOLD_DISPERSION:'الفرق بين الطرق يتجاوز الحد؛ يُحجب الرقم المرجح',
 HOLD_DATE_MISMATCH:'اختلاف تواريخ التقييم',
 HOLD_BASIS_MISMATCH:'اختلاف أساس القيمة بين الطرق',
 INDEPENDENT_MARKET_AND_SPECIALIST_EVIDENCE_STILL_REQUIRED:'الترجيح الحسابي افتراضي؛ يلزم إثبات مستقل للبيانات والقطاع',
};
const inputClass='w-full rounded-lg border border-slate-500/50 p-2 text-sm min-h-[36px]';
const initialMarket=()=>Array.from({length:3},()=>({id:'',city:'',district:'',subtype:'',right:'',date:'',unitValue:'',source:'',unit:''}));
function Row({ar,label,value,onChange,placeholder='',type='text'}){
 return <label className="block text-xs" style={{color:'#E6E9F0'}}>
  {label}
  <input className={inputClass} type={type} style={{background:'#F4F5F5',color:'#192336',marginTop:5}}
   value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>
 </label>;
}
export default function PersonalSectorValuationWorkbench({assetClass,locale='ar-SA'}){
 const ar=locale!=='en';
 const [subject,setSubject]=useState({city:'',district:'',subtype:'',date:'',area:'',right:''});
 const [methods,setMethods]=useState({income:false,cost:false,market:false});
 const [inc,setInc]=useState({gross:'',opex:'',cap:'',expenseTreatment:'',realEstateOnly:false,groundLease:false,sharedCosts:false});
 const [cost,setCost]=useState({land:'',replacement:'',depreciation:'',excludesBusiness:false});
 const [comparables,setComparables]=useState(initialMarket);
 const [marketOptions,setMarketOptions]=useState({unit:'',quantity:'',businessExcluded:false,mixedAllocated:false});
 const [policy,setPolicy]=useState({maxDispersion:'',incomeWeight:'',costWeight:'',marketWeight:''});
 const [output,setOutput]=useState(null);
 const change=(fn,k,v)=>{fn(old=>({...old,[k]:v}));setOutput(null);};
 const calc=()=>{
  const income=methods.income?{
   annualEffectivePropertyIncome:parseAmount(inc.gross),
   annualPropertyOperatingExpenses:parseAmount(inc.opex),
   capRate:parseAmount(inc.cap),expenseTreatment:inc.expenseTreatment,
   realEstateOnlyConfirmed:inc.realEstateOnly,
   groundLeaseEvidenceConfirmed:inc.groundLease,sharedCostsAllocated:inc.sharedCosts,
  }:null;
  const replacement=methods.cost?{
   landValue:parseAmount(cost.land),replacementBuildingCost:parseAmount(cost.replacement),
   depreciationRate:parseAmount(cost.depreciation),businessEquipmentExcluded:cost.excludesBusiness,
  }:null;
  const market=methods.market?{
   unitOfComparison:marketOptions.unit,subjectQuantity:parseAmount(marketOptions.quantity),
   businessAssetsExcluded:marketOptions.businessExcluded,
   mixedUseComparableAllocationConfirmed:marketOptions.mixedAllocated,
   comparables:comparables.map(c=>({
   comparableId:c.id,city:c.city,district:c.district,assetClass,unitOfComparison:c.unit,
   propertySubtype:c.subtype,propertyRight:c.right,transactionDate:c.date,
   sourceRef:c.source,unitValue:parseAmount(c.unitValue),transactionStatus:'EXECUTED_SALE',
  }))}:null;
  const weights={};
  if(methods.income)weights[VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]=parseAmount(policy.incomeWeight);
  if(methods.cost)weights[VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]=parseAmount(policy.costWeight);
  if(methods.market)weights[VALUATION_METHOD.MARKET_COMPARABLE]=parseAmount(policy.marketWeight);
  const reconciliationPolicy=Object.keys(weights).length>=2?{
   maxDispersion:parseAmount(policy.maxDispersion),methodWeights:weights,
  }:null;
  try{
   setOutput(evaluatePersonalSectorScenarios({
    assetClass,city:subject.city,propertySubtype:subject.subtype,subjectDistrict:subject.district,
    valuationDate:subject.date,subjectAreaSqm:parseAmount(subject.area),
    propertyRight:subject.right,income,cost:replacement,market,reconciliationPolicy,
   }));
  }catch(e){setOutput({status:STATUS.HOLD,reasonCodes:['INVALID_SCENARIO_VALUES'],methods:[],
   provisionalReconciledAmountSar:null});}
 };
 const money=n=>new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:0}).format(n);
 const Checkbox=({label,checked,onChange})=><label className="flex items-center gap-2 text-xs min-h-[36px]" style={{color:'#E7E9EE'}}>
  <input type="checkbox" style={{width:28,height:28,flexShrink:0}} checked={checked} onChange={e=>onChange(e.target.checked)}/>{label}
 </label>;
 return <section data-testid="personal-sector-workbench" dir={ar?'rtl':'ltr'}
   className="rounded-xl mt-4 p-4" style={{background:'#1A2942',border:'1px solid #40506A'}}>
  <h4 className="text-sm font-semibold" style={{color:'#F0E8D7'}}>
   {ar?'مختبر حسابي متعدد الطرق لهذا النوع العقاري':'Multi-method arithmetic research for this asset class'}
  </h4>
  <p className="text-xs mt-2 leading-relaxed" style={{color:'#BFC9D8'}}>
   {ar?'لا توجد أرقام افتراضية مخفية. أدخل افتراضاتك للصفقات أو تكلفة الاستبدال أو دخل العقار فقط. النتائج ليست قيمة سوقية معتمدة؛ تحتاج مستندات فعلية ومراجعة قطاعية مستقلة.'
    :'No hidden preset numbers. Supply your own comparables, replacement cost or real-estate income. These are not certified market values.'}
  </p>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
   <Row ar={ar} label={ar?'المدينة':'City'} value={subject.city} onChange={v=>change(setSubject,'city',v)}/>
   <Row ar={ar} label={ar?'الحي العقاري':'Property district'} value={subject.district} onChange={v=>change(setSubject,'district',v)}/>
   <Row ar={ar} label={ar?'نوع العقار التفصيلي (مثلاً: فندق 4 نجوم)':'Exact property subtype'}
    value={subject.subtype} onChange={v=>change(setSubject,'subtype',v)}/>
   <Row ar={ar} label={ar?'مساحة العقار (م²)':'Area sqm'} value={subject.area} onChange={v=>change(setSubject,'area',v)}/>
   <Row ar={ar} label={ar?'تاريخ الدراسة':'Valuation date'} type="date" value={subject.date} onChange={v=>change(setSubject,'date',v)}/>
   <label className="text-xs" style={{color:'#E7E9EE'}}>{ar?'الحق العقاري محل التقييم':'Property right'}
    <select className={inputClass} style={{background:'#F4F5F5',color:'#192336',marginTop:5}}
      value={subject.right} onChange={e=>change(setSubject,'right',e.target.value)}>
      <option value="">{ar?'اختر الحق العقاري':'Select property right'}</option>
      <option value="FREEHOLD">{ar?'ملكية كاملة':'Freehold'}</option>
      <option value="LEASEHOLD">{ar?'حق إيجار':'Leasehold'}</option>
      <option value="USUFRUCT">{ar?'حق انتفاع':'Usufruct'}</option>
      <option value="WAQF_RESTRICTED">{ar?'حق عقاري وقفي مقيد':'Restricted waqf interest'}</option>
    </select>
   </label>
  </div>
  <div className="flex flex-wrap gap-5 mt-4">
   {Object.entries({income:ar?'دخل عقاري صافٍ ورسملة':'Realty income',cost:ar?'تكلفة الاستبدال':'Replacement cost',market:ar?'صفقات مماثلة منفذة':'Executed comparables'}).map(([key,label])=>
    <Checkbox key={key} label={label} checked={methods[key]} onChange={v=>change(setMethods,key,v)}/>)}
  </div>
  {methods.income&&<div className="mt-3 p-3 rounded-lg border border-slate-500/40">
   <strong className="text-xs" style={{color:'#E8C98B'}}>{ar?'طريقة الدخل: استبعد أرباح التشغيل غير العقارية':'Income: exclude non-property business earnings'}</strong>
   <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
    <Row label={ar?'الدخل العقاري الفعلي السنوي (ر.س)':'Annual realty income SAR'} value={inc.gross} onChange={v=>change(setInc,'gross',v)}/>
    <Row label={ar?'مصروفات العقار السنوية (ر.س)':'Annual realty OPEX SAR'} value={inc.opex} onChange={v=>change(setInc,'opex',v)}/>
    <Row label={ar?'معدل الرسملة ككسر (0.08 = 8%)':'Cap rate as decimal (0.08 = 8%)'} value={inc.cap} onChange={v=>change(setInc,'cap',v)}/>
   </div>
   <label className="block text-xs mt-2" style={{color:'#E7E9EE'}}>{ar?'طريقة تحمل المصروفات':'Expense treatment'}
    <select value={inc.expenseTreatment} className={inputClass} style={{background:'#F4F5F5',color:'#192336',marginTop:5}}
      onChange={e=>change(setInc,'expenseTreatment',e.target.value)}>
      <option value="">{ar?'اختر':'Select'}</option>
      <option value={EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX}>{ar?'مصروفات المالك الفعلية':'Actual owner expenses'}</option>
      <option value={EXPENSE_TREATMENT.MARKET_ESTIMATE}>{ar?'مصروفات تقديرية':'Estimated expenses'}</option>
      <option value={EXPENSE_TREATMENT.TENANT_BORNE_CONFIRMED}>{ar?'يتحملها المستأجر بعقد':'Contractually tenant-borne'}</option>
      <option value={EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED}>{ar?'يُفترض تحمل المستأجر':'Assumed tenant-borne'}</option>
    </select>
   </label>
   {assetClass==='LAND'&&<Checkbox label={ar?'أؤكد أن هذا دخل إيجار الأرض نفسها':'I confirm land-only ground rental income'}
    checked={inc.groundLease} onChange={v=>change(setInc,'groundLease',v)}/>}
   {!['LAND','RESIDENTIAL','OFFICE','RETAIL'].includes(assetClass)&&<Checkbox
     label={ar?'فصلت دخل العقار عن أرباح النشاط والمعدات والحقوق غير العقارية':'Excluded business income, equipment and intangibles'}
     checked={inc.realEstateOnly} onChange={v=>change(setInc,'realEstateOnly',v)}/>}
   {assetClass==='MIXED_USE'&&<Checkbox
     label={ar?'وزعت مصروفات المناطق المشتركة ولم أحتسبها مرتين':'Shared expenses allocated only once'}
     checked={inc.sharedCosts} onChange={v=>change(setInc,'sharedCosts',v)}/>}
  </div>}
  {methods.cost&&<div className="mt-3 p-3 rounded-lg border border-slate-500/40">
   <strong className="text-xs" style={{color:'#E8C98B'}}>{ar?'طريقة تكلفة استبدال التحسينات العقارية':'Real property replacement cost'}</strong>
   <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
    <Row label={ar?'قيمة الأرض (ر.س)':'Land amount SAR'} value={cost.land} onChange={v=>change(setCost,'land',v)}/>
    <Row label={ar?'تكلفة إنشاء المبنى دون الأرض (ر.س)':'Building replacement SAR'} value={cost.replacement} onChange={v=>change(setCost,'replacement',v)}/>
    <Row label={ar?'نسبة الاستهلاك 0–1':'Depreciation fraction 0–1'} value={cost.depreciation} onChange={v=>change(setCost,'depreciation',v)}/>
   </div>
   {!['LAND','RESIDENTIAL','OFFICE','RETAIL'].includes(assetClass)&&<Checkbox
     label={ar?'استبعدت الأصول التشغيلية والمعدات والسمعة التجارية':'Non-realty equipment, contracts and brand value excluded'}
     checked={cost.excludesBusiness} onChange={v=>change(setCost,'excludesBusiness',v)}/>}
  </div>}
  {methods.market&&<div className="mt-3 p-3 rounded-lg border border-slate-500/40">
   <strong className="text-xs" style={{color:'#E8C98B'}}>{ar?'ثلاث صفقات بيع منفذة من نفس الحي والمدينة والنوع والحق؛ دون عروض':'Three executed sales matching district, subtype and property right; no asking prices'}</strong>
   <label className="block text-xs mt-3" style={{color:'#E7E9EE'}}>
     {ar?'وحدة المقارنة المناسبة للقطاع':'Sector-appropriate market comparison unit'}
     <select value={marketOptions.unit} className={inputClass} style={{background:'#F4F5F5',color:'#192336',marginTop:5}}
      onChange={e=>change(setMarketOptions,'unit',e.target.value)}>
      <option value="">{ar?'حدد وحدة المقارنة':'Choose unit'}</option>
      {(MARKET_UNITS[assetClass]||[]).map(unit=><option key={unit} value={unit}>
       {({SQM:ar?'ريال لكل متر مربع':'SAR per sqm',UNIT:ar?'ريال لكل وحدة سكنية':'SAR per home',ROOM_KEY:ar?'ريال لكل غرفة فندقية':'SAR per hotel key',
         BED:ar?'ريال لكل سرير':'SAR per bed',SEAT:ar?'ريال لكل مقعد':'SAR per seat',
         SPACE:ar?'ريال لكل موقف':'SAR per parking space',MW_IT:ar?'ريال لكل ميجاوات تقنية':'SAR per IT MW'})[unit]||unit}
      </option>)}
     </select>
   </label>
   {marketOptions.unit&&marketOptions.unit!=='SQM'&&<Row
      label={ar?'عدد وحدات المقارنة في العقار':'Number of comparison units'}
      value={marketOptions.quantity} onChange={v=>change(setMarketOptions,'quantity',v)}/>}
   {!['LAND','RESIDENTIAL','OFFICE','RETAIL'].includes(assetClass)&&<Checkbox
      label={ar?'أؤكد فصل قيمة العقار عن النشاط والمعدات في صفقات المقارنة':'Sale unit values exclude equipment and operating business value'}
      checked={marketOptions.businessExcluded} onChange={v=>change(setMarketOptions,'businessExcluded',v)}/>}
   {assetClass==='MIXED_USE'&&<Checkbox
      label={ar?'تمت تسوية قيمة أجزاء الاستخدامات المختلطة دون ازدواج':'Mixed-use components allocated consistently'}
      checked={marketOptions.mixedAllocated} onChange={v=>change(setMarketOptions,'mixedAllocated',v)}/>}
   {comparables.map((c,i)=><div key={i} className="mt-3 border-b border-slate-500/40 pb-3">
    <span className="text-xs" style={{color:'#E8C98B'}}>{ar?'الصفقة ':'Sale '}{i+1}</span>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
     {[
      ['id',ar?'رقم الصفقة':'Sale ID'],
      ['city',ar?'مدينة الصفقة':'Sale city'],
      ['district',ar?'حي الصفقة':'Sale district'],
      ['subtype',ar?'النوع التفصيلي للصفقة':'Property subtype'],
      ['date',ar?'تاريخ البيع':'Sale date'],
      ['unitValue',ar?'السعر لكل وحدة مقارنة مختارة (ريال)':'SAR per selected comparison unit'],
      ['source',ar?'مرجع الصفقة المصدرية':'Sale source reference'],
     ].map(([k,label])=><Row key={k} label={label} type={k==='date'?'date':'text'} value={c[k]}
       onChange={v=>{setComparables(old=>old.map((row,j)=>j===i?{...row,[k]:v}:row));setOutput(null);}}/>)}
     <label className="block text-xs" style={{color:'#E7E9EE'}}>{ar?'وحدة المقارنة في الصفقة':'Unit of comparison in sale'}
      <select value={c.unit} className={inputClass} style={{background:'#F4F5F5',color:'#192336'}}
       onChange={e=>{setComparables(old=>old.map((row,j)=>j===i?{...row,unit:e.target.value}:row));setOutput(null);}}>
       <option value="">{ar?'اختر':'Choose'}</option>
       {(MARKET_UNITS[assetClass]||[]).map(x=><option key={x} value={x}>{x}</option>)}
      </select>
     </label>
     <label className="block text-xs" style={{color:'#E7E9EE'}}>{ar?'الحق المنقول في الصفقة':'Comparable property right'}
      <select value={c.right} className={inputClass} style={{background:'#F4F5F5',color:'#192336'}}
       onChange={e=>{setComparables(old=>old.map((row,j)=>j===i?{...row,right:e.target.value}:row));setOutput(null);}}>
       <option value="">{ar?'اختر':'Select'}</option>
       <option value="FREEHOLD">{ar?'ملكية كاملة':'Freehold'}</option>
       <option value="LEASEHOLD">{ar?'إيجار':'Leasehold'}</option>
       <option value="USUFRUCT">{ar?'انتفاع':'Usufruct'}</option>
       <option value="WAQF_RESTRICTED">{ar?'حق وقفي':'Waqf'}</option>
      </select>
     </label>
    </div>
   </div>)}
  </div>}
  {Object.values(methods).filter(Boolean).length>=2&&<div className="mt-3 p-3 border border-slate-500/40 rounded-lg">
   <p className="text-xs mb-2" style={{color:'#D9E3EF'}}>{ar?'الترجيح الصريح بين الطرق (مجموع الأوزان = 1)؛ لا ينتج اعتمادًا لسعر السوق':'Explicit method weights summing to 1; does not certify market value'}</p>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {methods.income&&<Row label={ar?'وزن الدخل':'Income weight'} value={policy.incomeWeight} onChange={v=>change(setPolicy,'incomeWeight',v)}/>}
    {methods.cost&&<Row label={ar?'وزن التكلفة':'Cost weight'} value={policy.costWeight} onChange={v=>change(setPolicy,'costWeight',v)}/>}
    {methods.market&&<Row label={ar?'وزن الصفقات':'Comparables weight'} value={policy.marketWeight} onChange={v=>change(setPolicy,'marketWeight',v)}/>}
    <Row label={ar?'الحد الأقصى لفرق الطرق (0.2 = 20%)':'Maximum dispersion (0.2 = 20%)'}
      value={policy.maxDispersion} onChange={v=>change(setPolicy,'maxDispersion',v)}/>
   </div>
  </div>}
  <button type="button" onClick={calc} data-testid="personal-sector-calculate"
   className="mt-4 px-4 py-3 rounded-lg text-xs font-semibold min-h-[40px]"
   style={{background:'#C9A24C',color:'#142236'}}>
   {ar?'احسب المؤشرات الافتراضية (دون اعتماد)':'Calculate unverified research scenarios'}
  </button>
  {output&&<div role="status" data-testid="personal-sector-scenario-output"
    className="mt-4 rounded-lg p-3" style={{background:'#101D31',color:'#E6EBF5'}}>
    <strong className="text-sm">{output.status===STATUS.HOLD
      ? (ar?'الحساب محجوب لقصور البيانات أو سياسة القطاع':'Held due to missing evidence or sector policy')
      :output.status===STATUS.RECONCILED
       ? (ar?'ترجيح حسابي مبدئي غير معتمد سوقياً':'Reconciled research scenario; market unverified')
       :(ar?'مؤشرات طرق منفصلة دون قيمة نهائية':'Method indicators only; no final value')}</strong>
    {output.methods?.map(item=><p key={item.method} className="mt-2 text-xs">
      <span dir="ltr">{item.method}</span>: {money(item.scenarioAmountSar)} {ar?'ريال (افتراضي)':'SAR (scenario)'}
    </p>)}
    {output.provisionalReconciledAmountSar!==null&&
      <p className="mt-2 text-sm" data-testid="personal-sector-provisional-value">
       {ar?'ترجيح افتراضي، لا يمثل سعراً سوقياً موثقاً: ':'Scenario-only blend, not verified market value: '}
       {money(output.provisionalReconciledAmountSar)} {ar?'ريال':'SAR'}
      </p>}
    {!!output.reasonCodes?.length&&<p data-testid="personal-sector-reasons" className="mt-2 text-xs" style={{color:'#E8C18C'}}>
      {output.reasonCodes.map(c=>ar?(REASONS[c]||'شرط تحقّق إضافي غير مكتمل'):c).join('؛ ')}
    </p>}
    <p className="text-xs mt-2" style={{color:'#BBC7D8'}}>{ar?
      'الدخل والتكاليف والصفقات مدخلة من المستخدم ولم يتم التحقق منها رسميًا. لا تستخدم الأرقام كقرار شراء أو تقرير تقييم مهني.'
      :'Inputs and sales are owner declarations and have not been independently verified. Do not use as a buying recommendation or professional appraisal.'}</p>
  </div>}
 </section>;
}
