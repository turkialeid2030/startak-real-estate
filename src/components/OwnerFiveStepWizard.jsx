import React,{useEffect,useMemo,useRef,useState} from 'react';
const {parseNumericText}=require('../validation/numeric-text');
const {coreMarketAssetOptions}=require('../i18n/market-study-core-labels');
const {ownerMarketEvidenceGuidance}=require('../market/owner-market-evidence-guidance');
const {marketIdentityGate}=require('../market/owner-market-identity-gate');
const STEPS=[['الغرض','Purpose'],['العقار','Property'],['أدلة السوق','Market evidence'],['النموذج','Model'],['النتيجة','Results']];
const WORDS={
 ar:{title:'ستارتك',current:'الخطوة الحالية',missing:'ما ينقص',advance:'الوضع المتقدم',simple:'الوضع المبسط',previous:'السابق',next:'التالي',study:'نوع الدراسة',building:'مبنى قائم',land:'أرض وتطوير',name:'اسم العقار أو المشروع',length:'طول الأرض (م)',width:'عرض الأرض (م)',age:'عمر المبنى (سنة)',price:'قيمة شراء المبنى (ريال)',landPrice:'سعر الأرض للمتر (ريال)',rent:'الإيجار السنوي للمتر (ريال)',construction:'تكلفة الإنشاء للمتر (ريال)',occupancy:'الإشغال (%)',discount:'معدل الخصم (%)',hurdle:'العائد المستهدف (%)',holding:'مدة الاحتفاظ (سنة)',exit:'معدل رسملة التخارج (%)',exitTransactionCost:'تكلفة نقل الملكية عند التخارج (%)',market:'راجع أدلة السوق والمصادر قبل اعتماد النتيجة.',evidence:'أدخل أدلة المقارنات ومراجعها في اللوحة الموجودة أدناه. الأسعار المعروضة ليست صفقات منفذة موثقة تلقائيًا.',assumption:'هذه بيانات افتراضية للتجربة حتى تستبدلها ببيانات العقار ومراجعها.',invalid:'راجع المدخلات غير الصالحة. الحساب القديم لا يصلح للاعتماد.',notReady:'لا توجد نتيجة صالحة بالمدخلات الحالية.',provisional:'نتائج حسابية غير معتمدة مهنيًا؛ لم تُتحقق أدلة السوق مستقلاً.',irr:'العائد الداخلي',npv:'صافي القيمة الحالية',income:'قيمة الدخل الاسترشادية',none:'لا توجد حقول أساسية ناقصة؛ تبقى مراجعة الأدلة والافتراضات مطلوبة.',purposeBoundary:'هذا الاختيار يحدد النموذج المالي فقط؛ غرض التقييم للبيع أو الشراء أو إعادة التأجير وتاريخ التقييم يُحددان بصورة مستقلة داخل دراسة السوق، ولا يثبتان صحة حسابات الجدوى.',language:'الإنجليزية'},
 en:{title:'Startak',current:'Current step',missing:'What is missing',advance:'Advanced mode',simple:'Simple mode',previous:'Back',next:'Next',study:'Study type',building:'Existing building',land:'Land development',name:'Property or project name',length:'Land length (m)',width:'Land width (m)',age:'Building age (years)',price:'Building purchase price (SAR)',landPrice:'Land price per sqm (SAR)',rent:'Annual rent per sqm (SAR)',construction:'Construction cost per sqm (SAR)',occupancy:'Occupancy (%)',discount:'Discount rate (%)',hurdle:'Target return (%)',holding:'Holding period (years)',exit:'Exit capitalization rate (%)',exitTransactionCost:'Exit transfer cost (%)',market:'Review market evidence and sources before relying on the result.',evidence:'Use the market evidence panel below to review comparables and source references. Listing prices are not verified executed sales.',assumption:'Current values are example assumptions until replaced with the property evidence.',invalid:'Invalid inputs require review. Do not rely on previous calculations.',notReady:'No valid result for the current inputs.',provisional:'Calculations are not a certified valuation; market evidence is not independently verified.',irr:'IRR',npv:'NPV',income:'Indicative income value',none:'No missing basic fields; market evidence and assumptions still need review.',purposeBoundary:'This choice selects only the financial model. Sale, purchase or whole-property reletting purpose and valuation date are controlled separately in the market study; neither establishes the validity of the other.',language:'العربية'}
};
const MARKET_LABELS={
 ar:{
  purpose:'غرض دراسة القيمة السوقية',date:'تاريخ القيمة المطلوب دراستها',
  purchase:'دراسة شراء أو استحواذ',portfolio:'مراجعة محفظة أصول',rentStudy:'دراسة أجرة سوقية',
  finance:'مراجعة تمويلية غير رسمية',other:'دراسة شخصية أخرى',choose:'اختر الغرض',
  marketName:'اسم العقار في دراسة السوق',city:'المدينة',district:'الحي',location:'الموقع أو الإحداثيات',
  landArea:'مساحة الأرض وفق المصدر (م²)',assetType:'نوع العقار في دراسة السوق',builtArea:'إجمالي المساحات المبنية (م²)',rentableArea:'المساحة التأجيرية (م²)',buildingCount:'عدد المباني',unitCount:'عدد الوحدات',roomCount:'عدد الغرف الفندقية',sectorNote:'نوع العقار اختيار بحثي لا يثبت الاستخدام المعتمد أو الملكية، ولا يعني أن النموذج المالي يدعم هذا القطاع تخصصيًا.',right:'الحق العقاري (يحتاج تحقق)',
  unknown:'غير متحقق',full:'ملكية كاملة',usufruct:'حق انتفاع',longLease:'حق تأجير طويل المدة',otherRight:'حق آخر',
  marketResults:'مؤشرات دراسة السوق المستقلة',capital:'القيمة السوقية الاسترشادية (ريال)',
  annualRent:'الأجرة السنوية الاسترشادية (ريال)',marketBlocked:'تدقيق مرتبط يوقف عرض المؤشرات.',marketIdentityMissing:'أكمل غرض دراسة السوق وتاريخ التقييم الصحيح واسم العقار وإقرار نوع الحق قبل عرض أي مؤشر استرشادي.',marketSubjectChanged:'المقارنات أدخلت لعقار سابق. راجع ارتباط كل صف ومصدر بالعقار الحالي ثم أكّد ذلك في لوحة أدلة السوق قبل عرض المؤشرات.',marketReviewEvidence:'مراجعة المقارنات في أدلة السوق',
  evidenceStatus:'سجلات المقارنة المؤهلة: بيع',rentEvidence:'إيجار',openSales:'فتح مقارنات البيع المنفذة',openRentals:'فتح عقود الإيجار المنفذة',evidenceScope:'تُدخل المقارنات في لوحة البحث السوقي الأصلية. لا تُحتسب عروض الطلب، ويلزم مراجعة المصدر والحق في استعمال البيانات.',readinessTitle:'متطلبات الدراسة السوقية غير المحسومة',readinessPending:'يُحدّث تقرير الأدلة؛ راجع اللوحة التفصيلية.',sourceUnverified:'مقارنات المستخدم لا تثبت صحة المصدر أو ملكية العقار أو حق استخدام البيانات.',goToInput:'الانتقال للحقل',
  marketCaution:'نتائج حسابية بحثية غير معتمدة مهنيًا. القيمة والأجرة مستقلتان، ولا تعني نتيجة الجدوى اعتماد تقييم العقار.'
 },
 en:{
  purpose:'Market-study purpose',date:'Market valuation date',
  purchase:'Purchase or acquisition study',portfolio:'Portfolio review',rentStudy:'Market rental study',
  finance:'Informal financing review',other:'Other personal research',choose:'Choose purpose',
  marketName:'Property name in market study',city:'City',district:'District',location:'Location or coordinates',
  landArea:'Land area from source (sqm)',assetType:'Market-study asset class',builtArea:'Total built area (sqm)',rentableArea:'Rentable area (sqm)',buildingCount:'Buildings',unitCount:'Units',roomCount:'Hotel rooms',sectorNote:'Asset class is a research choice, not verification of permitted use, ownership, or a specialist financial engine.',right:'Property interest (needs verification)',
  unknown:'Unverified',full:'Full ownership',usufruct:'Usufruct',longLease:'Long leasehold',otherRight:'Other interest',
  marketResults:'Independent market research indications',capital:'Indicative capital value (SAR)',
  annualRent:'Indicative annual market rent (SAR)',marketBlocked:'Linked review blocks market indications.',marketIdentityMissing:'Complete the market-study purpose, valid valuation date, property name and declared interest before viewing provisional figures.',marketSubjectChanged:'Comparables were entered for a different property identity. Review the rows and their sources and reconfirm their use for this property in Market Evidence before provisional indicators return.',marketReviewEvidence:'Review comparables in Market Evidence',
  evidenceStatus:'Eligible comparable records: sales',rentEvidence:'leases',openSales:'Open executed-sale comparables',openRentals:'Open executed-lease comparables',evidenceScope:'These controls open the original market-study evidence forms. Asking listings do not count as executed transactions; source and reuse rights require review.',readinessTitle:'Outstanding market-study requirements',readinessPending:'Evidence report is updating; review the detailed panel.',sourceUnverified:'User-supplied comparables do not establish source validity, property title or data reuse rights.',goToInput:'Go to field',
  marketCaution:'Non-certified research calculations. Capital value and rent are independent; financial feasibility does not certify property valuation.'
 }
};
const okPositive=v=>Number.isFinite(Number(v))&&Number(v)>0;
const validNonnegativePercent=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0;
const fieldId=key=>'owner-'+key;
function OwnerNumber({id,value,onChange,percent=false,locale}){
 const asText=v=>typeof v==='number'&&Number.isFinite(v)?String(percent?+(v*100).toFixed(5):v):String(v??'');
 const [draft,setDraft]=useState(()=>asText(value));
 const last=useRef(value);
 useEffect(()=>{if(!Object.is(value,last.current)){last.current=value;setDraft(asText(value));}},[value,percent]);
 const parsed=parseNumericText(draft),valid=parsed.ok&&Number.isFinite(parsed.value);
 return <>
  <input id={id} data-testid={id} value={draft} type="text" inputMode="decimal"
   aria-invalid={!valid} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3 text-base text-white"
   onChange={event=>{const text=event.target.value,p=parseNumericText(text);const next=p.ok?(percent?p.value/100:p.value):text;setDraft(text);last.current=next;onChange(next);}}/>
  {!valid&&<small role="alert" className="block text-rose-300">{locale==='ar-SA'?'أدخل رقمًا صالحًا':'Enter a valid number'}</small>}
 </>;
}
function Metric({label,value,locale,percent=false,testId}){
 const valid=typeof value==='number'&&Number.isFinite(value);
 return <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-3"><dt className="text-sm text-slate-300">{label}</dt>
  <dd data-testid={testId} className="mt-1 text-lg font-semibold text-amber-100" dir="auto">{valid?new Intl.NumberFormat(locale==='ar-SA'?'ar-SA':'en-US',{maximumFractionDigits:percent?3:0}).format(percent?value*100:value)+(percent?'%':''):'—'}</dd>
 </div>;
}
function OwnerMarketReadiness({guidance,mt,onNavigate}){
 return <div data-testid="owner-evidence-review" className="mt-3 rounded-lg border border-slate-600 p-3 text-xs">
  <h4 className="font-semibold text-amber-100">{mt.readinessTitle}</h4>
  {!guidance.available?<p data-testid="owner-evidence-pending" className="mt-2 text-slate-300">{mt.readinessPending}</p>:
   <ul className="mt-2 list-disc space-y-1 ps-5">
    {guidance.items.map(item=><li key={item.key} data-testid="owner-evidence-note" className={item.kind==='hold'?'text-rose-200':'text-slate-200'}>
      <span>{item.description}</span>
      {item.target&&onNavigate&&<button type="button" data-testid={'owner-review-'+item.key}
        onClick={()=>onNavigate(item.target)} className="ms-2 min-h-[40px] rounded border border-amber-500 px-2 text-amber-100">{mt.goToInput}</button>}
     </li>)}
   </ul>}
  {guidance.unverified&&<p data-testid="owner-evidence-unverified" className="mt-2 text-amber-200">{mt.sourceUnverified}</p>}
 </div>;
}
function GovernedRate({id,label,value,onCommit,locale,invalidAr='معدل رسملة التخارج غير صالح',invalidEn='Invalid exit capitalization rate'}){
 const format=v=>Number.isFinite(Number(v))?String(Number(v)*100):'';
 const [draft,setDraft]=useState(()=>format(value)),[invalid,setInvalid]=useState(false);
 const rejectedCommit=useRef(false);
 // Preserve the owner's rejected text while the canonical controller stores
 // an invalid NaN (fail-closed). Valid restoration or a later valid commit
 // still synchronizes the canonical value back into the editor.
 useEffect(()=>{
  if(rejectedCommit.current&&Number.isNaN(value))return;
  rejectedCommit.current=false;setDraft(format(value));setInvalid(false);
 },[value]);
 const commit=()=>{
  const result=onCommit(draft),rejected=result?.ok===false;
  rejectedCommit.current=rejected;setInvalid(rejected);
 };
 return <label htmlFor={id} className="block text-sm text-slate-100">{label}
  <input id={id} data-testid={id} type="text" inputMode="decimal" value={draft}
   aria-invalid={invalid} onChange={event=>setDraft(event.target.value)} onBlur={commit}
   className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3 text-base text-white"/>
  {invalid&&<span role="alert" className="block text-xs text-rose-300">{locale==='ar-SA'?invalidAr:invalidEn}</span>}
 </label>;
}
export default function OwnerFiveStepWizard({locale='ar-SA',step=0,onStepChange,mode,onModeChange,inputs,onChangeInput,results,validationError,onAdvanced,onLocaleSwitch,onExitCapTextCommit,onExitTransactionCostTextCommit,marketSubject=null,onMarketSubjectChange=()=>{},marketSummary=null}){
 const lang=locale==='ar-SA'?'ar':'en',t=WORDS[lang],mt=MARKET_LABELS[lang],focusRef=useRef(null);
 const market=marketSubject||{};
 const governedMarket=marketSummary?.subjectKey===JSON.stringify(market)?marketSummary:null;
 const evidenceGuidance=ownerMarketEvidenceGuidance(governedMarket,locale);
 const gapItems=useMemo(()=>{
  const gaps=[],add=(s,k,label)=>gaps.push({s,k,label});
  if(!String(inputs.projectTitle||'').trim())add(1,'projectTitle',t.name);
  // The same canonical identity gate that hides unqualified market indicators
  // must drive the owner's missing-fields list (including invalid/future dates).
  const mandate=marketIdentityGate(market);
  if(mandate.issues.includes('MARKET_PURPOSE_REQUIRED'))add(0,'valuationPurpose',mt.purpose);
  if(mandate.issues.includes('VALUATION_DATE_REQUIRED_OR_INVALID')||mandate.issues.includes('FUTURE_VALUATION_DATE_NOT_SUPPORTED'))add(0,'valuationDate',mt.date);
  if(mandate.issues.includes('PROPERTY_RIGHT_DECLARATION_REQUIRED'))add(1,'propertyRight',mt.right);
  if(mandate.issues.includes('MARKET_SUBJECT_NAME_REQUIRED'))add(1,'name',mt.marketName);
  if(!okPositive(inputs.landLength))add(1,'landLength',t.length);
  if(!okPositive(inputs.landWidth))add(1,'landWidth',t.width);
  if(mode==='building'){
   if(!okPositive(inputs.buildingPrice))add(3,'buildingPrice',t.price);
   if(!okPositive(inputs.rentPerSqm))add(3,'rentPerSqm',t.rent);
   // Zero exit transfer cost is a valid explicit assumption; absent is not.
   if(!validNonnegativePercent(inputs.exitTransferFeeRate))add(3,'exitTransferFeeRate',t.exitTransactionCost);
  }else{
   if(!okPositive(inputs.landPricePerSqm))add(3,'landPricePerSqm',t.landPrice);
   if(!okPositive(inputs.marketRentPerSqm))add(3,'marketRentPerSqm',t.rent);
  }
  if(!okPositive(inputs.exitCapRate))add(3,'exitCapRate',t.exit);
  // Show *only* original engine hard holds which have an existing user-editable
  // correction target. Do not manufacture a "fix" for professional review,
  // source authenticity, legal rights, or a future unknown gate.
  const identityReasons=new Set([
   'MARKET_PURPOSE_REQUIRED','VALUATION_DATE_REQUIRED_OR_INVALID',
   'FUTURE_VALUATION_DATE_NOT_SUPPORTED','PROPERTY_RIGHT_DECLARATION_REQUIRED',
   'MARKET_SUBJECT_NAME_REQUIRED'
  ]);
  for(const item of evidenceGuidance.items){
   if(item.kind!=='hold'||!item.target||identityReasons.has(item.key))continue;
   gaps.push({s:item.target.step,k:'requirement-'+item.key,
    label:item.description,target:item.target,reason:item.key});
  }
  // Evidence and expert review remain required even when the editable list
  // has been completed; they cannot be cleared by client-side navigation.
  gaps.push({s:2,k:'market-evidence',label:t.market});
  if(validationError)gaps.push({s:4,k:'results',label:t.invalid});
  return gaps;
 },[inputs,mode,validationError,lang,marketSubject,governedMarket]);
 useEffect(()=>{const id=focusRef.current;if(!id)return;
  // The authored navigation mapping, not user-provided fields, owns the target.
  const el=document.getElementById(fieldId(id))||document.querySelector('[data-testid="'+id+'"]');
  if(el){el.scrollIntoView({block:'center'});el.focus({preventScroll:true});}
  focusRef.current=null;
 },[step]);
 const navigate=(s,key)=>{
  if(s===step){
   // React does not fire the step effect for a no-op state update.
   const el=document.getElementById(fieldId(key))||document.querySelector('[data-testid="'+key+'"]');
   if(el){el.scrollIntoView({block:'center'});el.focus({preventScroll:true});}
   return;
  }
  focusRef.current=key;onStepChange(s);
 };
 const goToMarketRequirement=target=>{
  if(!target||!Number.isInteger(target.step)||typeof target.key!=='string')return;
  if(target.step===2&&target.key.startsWith('market-comparables-')){
   // Step two exposes the existing source editor; no parallel evidence state.
   if(step!==2){navigate(2,target.key);return;}
   const group=document.querySelector('[data-testid="'+target.key+'"]');
   if(group){group.scrollIntoView({block:'start'});group.focus({preventScroll:true});}
   return;
  }
  if(target.step===step){
   const field=document.getElementById(fieldId(target.key))||
    document.querySelector('[data-testid="'+target.key+'"]');
   if(field){field.scrollIntoView({block:'center'});field.focus({preventScroll:true});}
  }else navigate(target.step,target.key);
 };
 // The original comparable inputs are mounted once under the wizard.
 // Focus them rather than creating parallel evidence rows or market state.
 const openEvidence=kind=>{
  const target=document.querySelector('[data-testid="market-comparables-'+kind+'"]');
  if(!target)return;
  target.scrollIntoView({block:'start',behavior:'auto'});
  target.focus({preventScroll:true});
 };
 const number=(key,label,percent=false)=><label key={key} className="block text-sm text-slate-100" htmlFor={fieldId(key)}>{label}
  <OwnerNumber id={fieldId(key)} locale={locale} percent={percent} value={inputs[key]} onChange={v=>onChangeInput(key,v)}/>
 </label>;
 const stepName=STEPS[step]?.[lang==='ar'?0:1]||STEPS[0][0];
 return <section className="owner-wizard mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-[#121b2b] p-4 text-white shadow-xl md:p-6"
  data-testid="startak-owner-wizard" dir={lang==='ar'?'rtl':'ltr'} aria-label={t.title}>
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h1 className="text-xl font-bold text-amber-100">{t.title}</h1>
   <div className="flex gap-2"><button type="button" onClick={onLocaleSwitch} data-testid="owner-language" className="min-h-[44px] rounded-lg border border-slate-500 px-3">{t.language}</button>
   <button type="button" onClick={onAdvanced} data-testid="owner-advanced-mode" className="min-h-[44px] rounded-lg border border-amber-400 px-3 text-amber-100">{t.advance}</button></div>
  </div>
  <h2 className="mt-4 text-base font-semibold" data-testid="owner-current-step">{t.current}: {stepName} ({step+1}/5)</h2>
  <nav className="mt-3 grid grid-cols-5 gap-1" aria-label={t.current}>
   {STEPS.map((pair,index)=><button key={index} type="button" data-testid={'owner-step-'+index} aria-current={step===index?'step':undefined}
     onClick={()=>onStepChange(index)} className={'min-h-[44px] rounded-lg p-1 text-xs '+(step===index?'bg-amber-700 text-white':'bg-slate-700 text-slate-100')}>
     <span className="block">{index+1}</span><span className="hidden sm:block">{pair[lang==='ar'?0:1]}</span></button>)}
  </nav>
  {step===0&&<div className="mt-5" data-testid="owner-missing-list">
   <h3 className="text-base font-semibold">{t.missing}</h3>
   {gapItems.length?<ul className="mt-3 space-y-2">{gapItems.map(x=><li key={x.k}>
    <button type="button" data-testid={x.reason?'owner-missing-reason-'+x.reason:undefined}
     className="min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-start text-sm"
     onClick={()=>x.target?goToMarketRequirement(x.target):navigate(x.s,x.k)}>{x.label}</button>
   </li>)}</ul>:<p className="mt-3 text-sm">{t.none}</p>}
  </div>}
  {step===0&&<div className="mt-5"><h3 className="text-sm font-semibold">{t.study}</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">
   {[['building',t.building],['land',t.land]].map(([value,label])=><button type="button" key={value} aria-pressed={mode===value}
    className={'min-h-[48px] rounded-lg border p-3 text-start '+(mode===value?'border-amber-400 bg-amber-900/40':'border-slate-600 bg-slate-800')}
    onClick={()=>onModeChange(value)}>{label}</button>)}</div><p className="mt-3 text-xs text-slate-300">{t.assumption}</p><p data-testid="owner-purpose-boundary" className="mt-2 text-xs text-amber-100">{t.purposeBoundary}</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="owner-market-purpose">
     <label htmlFor={fieldId('valuationPurpose')} className="block text-sm">{mt.purpose}
      <select id={fieldId('valuationPurpose')} data-testid="owner-valuation-purpose" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3" value={market.valuationPurpose||''}
       onChange={e=>onMarketSubjectChange('valuationPurpose',e.target.value)}>
       {[['',mt.choose],['ACQUISITION',mt.purchase],['PORTFOLIO_REVIEW',mt.portfolio],['RENT_STUDY',mt.rentStudy],['FINANCING_REVIEW',mt.finance],['OTHER',mt.other]].map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select>
     </label>
     <label htmlFor={fieldId('valuationDate')} className="block text-sm">{mt.date}
      <input id={fieldId('valuationDate')} data-testid="owner-valuation-date" type="date" dir="ltr"
       className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3"
       value={market.valuationDate||''} onChange={e=>onMarketSubjectChange('valuationDate',e.target.value)}/>
     </label>
    </div></div>}
  {step===1&&<div className="mt-5 grid gap-4 sm:grid-cols-2" data-testid="owner-property-inputs">
   <label htmlFor={fieldId('projectTitle')} className="sm:col-span-2 text-sm">{t.name}
    <input id={fieldId('projectTitle')} type="text" data-testid={fieldId('projectTitle')} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3 text-base"
     value={inputs.projectTitle||''} onChange={e=>onChangeInput('projectTitle',e.target.value)}/></label>
   {number('landLength',t.length)}{number('landWidth',t.width)}
   {mode==='building'&&number('buildingAge',t.age)}
   <div className="sm:col-span-2 border-t border-slate-700 pt-3 text-xs text-amber-100">{mt.marketName} — {mt.marketCaution}</div>
   <label className="block text-sm sm:col-span-2">{mt.marketName}
    <input id={fieldId('name')} data-testid="owner-market-name" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3"
     value={market.name||''} onChange={e=>onMarketSubjectChange('name',e.target.value)}/></label>
   <label className="block text-sm">{mt.city}
    <input data-testid="owner-market-city" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3"
     value={market.city||''} onChange={e=>onMarketSubjectChange('city',e.target.value)}/></label>
   <label className="block text-sm">{mt.district}
    <input data-testid="owner-market-district" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3"
     value={market.district||''} onChange={e=>onMarketSubjectChange('district',e.target.value)}/></label>
   <label className="block text-sm sm:col-span-2">{mt.location}
    <input data-testid="owner-market-location" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3"
     value={market.location||''} onChange={e=>onMarketSubjectChange('location',e.target.value)}/></label>
   <label className="block text-sm">{mt.landArea}
    <input data-testid="owner-market-land-area" type="text" inputMode="decimal" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3"
     value={market.landArea||''} onChange={e=>onMarketSubjectChange('landArea',e.target.value)}/></label>
   <label className="block text-sm">{mt.right}
    <select id={fieldId('propertyRight')} data-testid="owner-property-right" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3"
     value={market.propertyRight||'UNKNOWN'} onChange={e=>onMarketSubjectChange('propertyRight',e.target.value)}>
     {[['UNKNOWN',mt.unknown],['FULL_OWNERSHIP',mt.full],['USUFRUCT',mt.usufruct],['LONG_LEASE',mt.longLease],['OTHER',mt.otherRight]].map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
   <label className="block text-sm sm:col-span-2">{mt.assetType}
    <select data-testid="owner-market-asset-type" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3" value={market.assetType||''}
     onChange={e=>onMarketSubjectChange('assetType',e.target.value)}>
     {coreMarketAssetOptions(locale).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
    <span className="mt-1 block text-xs text-amber-100">{mt.sectorNote}</span>
   </label>
   {market.assetType!=='LAND'&&<>
    <label className="block text-sm">{mt.builtArea}
     <input data-testid="owner-market-built-area" inputMode="decimal" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3" value={market.builtArea||''} onChange={e=>onMarketSubjectChange('builtArea',e.target.value)}/></label>
    <label className="block text-sm">{mt.rentableArea}
     <input data-testid="owner-market-rentable-area" inputMode="decimal" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3" value={market.rentableArea||''} onChange={e=>onMarketSubjectChange('rentableArea',e.target.value)}/></label>
    <label className="block text-sm">{mt.buildingCount}
     <input data-testid="owner-market-building-count" inputMode="numeric" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3" value={market.buildingCount||''} onChange={e=>onMarketSubjectChange('buildingCount',e.target.value)}/></label>
    {['RESIDENTIAL_COMPOUND','RESIDENTIAL_BUILDING','COMMERCIAL_COMPLEX','COMMERCIAL_MALL','OFFICE_TOWER','MIXED_USE'].includes(market.assetType)&&
     <label className="block text-sm">{mt.unitCount}
      <input data-testid="owner-market-unit-count" inputMode="numeric" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3" value={market.unitCount||''} onChange={e=>onMarketSubjectChange('unitCount',e.target.value)}/></label>}
    {market.assetType==='HOTEL'&&<label className="block text-sm">{mt.roomCount}
     <input data-testid="owner-market-room-count" inputMode="numeric" type="text" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3" value={market.roomCount||''} onChange={e=>onMarketSubjectChange('roomCount',e.target.value)}/></label>}
   </>}
  </div>}
  {step===2&&<div id={fieldId('market-evidence')} tabIndex={-1} data-testid="owner-evidence-instructions" className="mt-5 rounded-lg border border-slate-600 p-4 text-sm leading-7">
   <p>{t.evidence}</p>
   <p data-testid="owner-evidence-counts" className="mt-2 text-xs text-slate-300">{mt.evidenceStatus}: {governedMarket?.eligibleSalesCount??0} — {mt.rentEvidence}: {governedMarket?.eligibleRentalsCount??0}.</p>
   <p className="mt-2 text-xs text-amber-100">{mt.evidenceScope}</p>
   {governedMarket?.evidenceScopeHold&&<p data-testid="owner-market-evidence-scope-hold" role="alert" className="mt-2 text-xs text-rose-200">{mt.marketSubjectChanged}</p>}
   <OwnerMarketReadiness guidance={evidenceGuidance} mt={mt} onNavigate={goToMarketRequirement}/>
   <div className="mt-3 flex flex-wrap gap-2">
    <button type="button" data-testid="owner-open-sales" className="min-h-[44px] rounded-lg border border-amber-500 px-3 py-2 text-sm" onClick={()=>openEvidence('sale')}>{mt.openSales}</button>
    <button type="button" data-testid="owner-open-rentals" className="min-h-[44px] rounded-lg border border-amber-500 px-3 py-2 text-sm" onClick={()=>openEvidence('rent')}>{mt.openRentals}</button>
   </div>
  </div>}
  {step===3&&<div className="mt-5 grid gap-4 sm:grid-cols-2" data-testid="owner-model-inputs">
   {mode==='building'?<>{number('buildingPrice',t.price)}{number('rentPerSqm',t.rent)}</>:<>{number('landPricePerSqm',t.landPrice)}{number('constructionCostPerSqm',t.construction)}{number('marketRentPerSqm',t.rent)}</>}
   {number('occupancyRate',t.occupancy,true)}
   {mode==='building'?<>{number('discountRate',t.discount,true)}{number('holdPeriod',t.holding)}</>:<>{number('hurdleRate',t.hurdle,true)}{number('operatingPeriod',t.holding)}</>}
   {mode==='building'&&onExitCapTextCommit?<GovernedRate id={fieldId('exitCapRate')} label={t.exit} value={inputs.exitCapRate} onCommit={onExitCapTextCommit} locale={locale}/>:number('exitCapRate',t.exit,true)}
   {mode==='building'&&(onExitTransactionCostTextCommit?
    <GovernedRate id={fieldId('exitTransferFeeRate')} label={t.exitTransactionCost} value={inputs.exitTransferFeeRate} onCommit={onExitTransactionCostTextCommit} locale={locale}
     invalidAr="تكلفة نقل الملكية عند التخارج غير صالحة" invalidEn="Invalid exit transfer cost"/>:null)}
  </div>}
  {step===4&&<div id={fieldId('results')} tabIndex={-1} data-testid="owner-results" className="mt-5">
   {validationError?<p role="alert" className="text-sm text-rose-300">{t.invalid}</p>:results?<dl className="grid gap-3 sm:grid-cols-2">
    <Metric locale={locale} label={t.irr} value={results.irr} percent/>
    <Metric locale={locale} label={t.npv} value={results.npv}/>
    <Metric locale={locale} label={t.income} value={results.marketValueByIncomeCap}/></dl>:<p>{t.notReady}</p>}
   <p className="mt-3 text-xs text-slate-300">{t.provisional}</p>
   <section data-testid="owner-market-results" className="mt-4 border-t border-slate-600 pt-4">
    <h3 className="text-sm font-semibold">{mt.marketResults}</h3>
    {governedMarket?.blocked&&<p data-testid="owner-market-linked-hold" role="alert" className="mt-2 text-xs text-rose-300">{mt.marketBlocked}</p>}
    {governedMarket?.identityHold&&<p data-testid="owner-market-identity-hold" role="alert" className="mt-2 text-xs text-amber-200">{mt.marketIdentityMissing}</p>}
    {governedMarket?.evidenceScopeHold&&<div data-testid="owner-market-results-evidence-scope-hold" role="alert" className="mt-2 text-xs text-rose-200">
     <p>{mt.marketSubjectChanged}</p>
     <button type="button" data-testid="owner-market-review-comparables" onClick={()=>onStepChange(2)}
      className="mt-2 min-h-[44px] rounded border border-amber-500 px-3 text-amber-100">{mt.marketReviewEvidence}</button>
    </div>}
    <dl className="mt-2 grid gap-3 sm:grid-cols-2">
     <Metric locale={locale} testId="owner-market-capital-indication" label={mt.capital} value={governedMarket?.saleIndicationSar}/>
     <Metric locale={locale} testId="owner-market-rent-indication" label={mt.annualRent} value={governedMarket?.annualRentIndicationSar}/>
    </dl>
    <p className="mt-2 text-xs text-slate-300">{mt.evidenceStatus}: {governedMarket?.eligibleSalesCount??0} — {mt.rentEvidence}: {governedMarket?.eligibleRentalsCount??0}.</p>
    <OwnerMarketReadiness guidance={evidenceGuidance} mt={mt} onNavigate={goToMarketRequirement}/>
    <p className="mt-2 text-xs text-amber-100">{mt.marketCaution}</p>
   </section>
  </div>}
  <div className="mt-6 flex justify-between gap-3">
   <button type="button" onClick={()=>onStepChange(Math.max(0,step-1))} disabled={step===0} className="min-h-[44px] rounded-lg border border-slate-600 px-5 disabled:opacity-40">{t.previous}</button>
   <button type="button" onClick={()=>onStepChange(Math.min(4,step+1))} disabled={step===4} className="min-h-[44px] rounded-lg bg-amber-700 px-5 disabled:opacity-40">{t.next}</button>
  </div>
 </section>;
}
