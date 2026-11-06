import React,{useEffect,useMemo,useRef,useState} from 'react';
const {parseNumericText}=require('../validation/numeric-text');
const STEPS=[['الغرض','Purpose'],['العقار','Property'],['أدلة السوق','Market evidence'],['النموذج','Model'],['النتيجة','Results']];
const WORDS={
 ar:{title:'ستارتك',current:'الخطوة الحالية',missing:'ما ينقص',advance:'الوضع المتقدم',simple:'الوضع المبسط',previous:'السابق',next:'التالي',study:'نوع الدراسة',building:'مبنى قائم',land:'أرض وتطوير',name:'اسم العقار أو المشروع',length:'طول الأرض (م)',width:'عرض الأرض (م)',age:'عمر المبنى (سنة)',price:'قيمة شراء المبنى (ريال)',landPrice:'سعر الأرض للمتر (ريال)',rent:'الإيجار السنوي للمتر (ريال)',construction:'تكلفة الإنشاء للمتر (ريال)',occupancy:'الإشغال (%)',discount:'معدل الخصم (%)',hurdle:'العائد المستهدف (%)',holding:'مدة الاحتفاظ (سنة)',exit:'معدل رسملة التخارج (%)',market:'راجع أدلة السوق والمصادر قبل اعتماد النتيجة.',evidence:'أدخل أدلة المقارنات ومراجعها في اللوحة الموجودة أدناه. الأسعار المعروضة ليست صفقات منفذة موثقة تلقائيًا.',assumption:'هذه بيانات افتراضية للتجربة حتى تستبدلها ببيانات العقار ومراجعها.',invalid:'راجع المدخلات غير الصالحة. الحساب القديم لا يصلح للاعتماد.',notReady:'لا توجد نتيجة صالحة بالمدخلات الحالية.',provisional:'نتائج حسابية غير معتمدة مهنيًا؛ لم تُتحقق أدلة السوق مستقلاً.',irr:'العائد الداخلي',npv:'صافي القيمة الحالية',income:'قيمة الدخل الاسترشادية',none:'لا توجد حقول أساسية ناقصة؛ تبقى مراجعة الأدلة والافتراضات مطلوبة.',language:'English'},
 en:{title:'Startak',current:'Current step',missing:'What is missing',advance:'Advanced mode',simple:'Simple mode',previous:'Back',next:'Next',study:'Study type',building:'Existing building',land:'Land development',name:'Property or project name',length:'Land length (m)',width:'Land width (m)',age:'Building age (years)',price:'Building purchase price (SAR)',landPrice:'Land price per sqm (SAR)',rent:'Annual rent per sqm (SAR)',construction:'Construction cost per sqm (SAR)',occupancy:'Occupancy (%)',discount:'Discount rate (%)',hurdle:'Target return (%)',holding:'Holding period (years)',exit:'Exit capitalization rate (%)',market:'Review market evidence and sources before relying on the result.',evidence:'Use the market evidence panel below to review comparables and source references. Listing prices are not verified executed sales.',assumption:'Current values are example assumptions until replaced with the property evidence.',invalid:'Invalid inputs require review. Do not rely on previous calculations.',notReady:'No valid result for the current inputs.',provisional:'Calculations are not a certified valuation; market evidence is not independently verified.',irr:'IRR',npv:'NPV',income:'Indicative income value',none:'No missing basic fields; market evidence and assumptions still need review.',language:'العربية'}
};
const okPositive=v=>Number.isFinite(Number(v))&&Number(v)>0;
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
function Metric({label,value,locale,percent=false}){
 const valid=typeof value==='number'&&Number.isFinite(value);
 return <div className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 p-3"><dt className="text-sm text-slate-300">{label}</dt>
  <dd className="mt-1 text-lg font-semibold text-amber-100" dir="auto">{valid?new Intl.NumberFormat(locale==='ar-SA'?'ar-SA':'en-US',{maximumFractionDigits:percent?3:0}).format(percent?value*100:value)+(percent?'%':''):'—'}</dd>
 </div>;
}
export default function OwnerFiveStepWizard({locale='ar-SA',step=0,onStepChange,mode,onModeChange,inputs,onChangeInput,results,validationError,onAdvanced,onLocaleSwitch}){
 const lang=locale==='ar-SA'?'ar':'en',t=WORDS[lang],focusRef=useRef(null);
 const gapItems=useMemo(()=>{
  const gaps=[],add=(s,k,label)=>gaps.push({s,k,label});
  if(!String(inputs.projectTitle||'').trim())add(1,'projectTitle',t.name);
  if(!okPositive(inputs.landLength))add(1,'landLength',t.length);
  if(!okPositive(inputs.landWidth))add(1,'landWidth',t.width);
  if(mode==='building'){
   if(!okPositive(inputs.buildingPrice))add(3,'buildingPrice',t.price);
   if(!okPositive(inputs.rentPerSqm))add(3,'rentPerSqm',t.rent);
  }else{
   if(!okPositive(inputs.landPricePerSqm))add(3,'landPricePerSqm',t.landPrice);
   if(!okPositive(inputs.marketRentPerSqm))add(3,'marketRentPerSqm',t.rent);
  }
  if(!okPositive(inputs.exitCapRate))add(3,'exitCapRate',t.exit);
  // Current panel retains evidence qualification logic. This is a review task, not invented missing data.
  gaps.push({s:2,k:'market-evidence',label:t.market});
  if(validationError)gaps.push({s:4,k:'results',label:t.invalid});
  return gaps;
 },[inputs,mode,validationError,lang]);
 useEffect(()=>{const id=focusRef.current;if(!id)return;const el=document.getElementById(fieldId(id));if(el){el.scrollIntoView({block:'center'});el.focus({preventScroll:true});}focusRef.current=null;},[step]);
 const navigate=(s,key)=>{focusRef.current=key;onStepChange(s);};
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
    <button type="button" className="min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-start text-sm" onClick={()=>navigate(x.s,x.k)}>{x.label}</button>
   </li>)}</ul>:<p className="mt-3 text-sm">{t.none}</p>}
  </div>}
  {step===0&&<div className="mt-5"><h3 className="text-sm font-semibold">{t.study}</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">
   {[['building',t.building],['land',t.land]].map(([value,label])=><button type="button" key={value} aria-pressed={mode===value}
    className={'min-h-[48px] rounded-lg border p-3 text-start '+(mode===value?'border-amber-400 bg-amber-900/40':'border-slate-600 bg-slate-800')}
    onClick={()=>onModeChange(value)}>{label}</button>)}</div><p className="mt-3 text-xs text-slate-300">{t.assumption}</p></div>}
  {step===1&&<div className="mt-5 grid gap-4 sm:grid-cols-2" data-testid="owner-property-inputs">
   <label htmlFor={fieldId('projectTitle')} className="sm:col-span-2 text-sm">{t.name}
    <input id={fieldId('projectTitle')} type="text" data-testid={fieldId('projectTitle')} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-3 text-base"
     value={inputs.projectTitle||''} onChange={e=>onChangeInput('projectTitle',e.target.value)}/></label>
   {number('landLength',t.length)}{number('landWidth',t.width)}
   {mode==='building'&&number('buildingAge',t.age)}
  </div>}
  {step===2&&<div id={fieldId('market-evidence')} tabIndex={-1} data-testid="owner-evidence-instructions" className="mt-5 rounded-lg border border-slate-600 p-4 text-sm leading-7">{t.evidence}</div>}
  {step===3&&<div className="mt-5 grid gap-4 sm:grid-cols-2" data-testid="owner-model-inputs">
   {mode==='building'?<>{number('buildingPrice',t.price)}{number('rentPerSqm',t.rent)}</>:<>{number('landPricePerSqm',t.landPrice)}{number('constructionCostPerSqm',t.construction)}{number('marketRentPerSqm',t.rent)}</>}
   {number('occupancyRate',t.occupancy,true)}
   {mode==='building'?<>{number('discountRate',t.discount,true)}{number('holdPeriod',t.holding)}</>:<>{number('hurdleRate',t.hurdle,true)}{number('operatingPeriod',t.holding)}</>}
   {number('exitCapRate',t.exit,true)}
  </div>}
  {step===4&&<div id={fieldId('results')} tabIndex={-1} data-testid="owner-results" className="mt-5">
   {validationError?<p role="alert" className="text-sm text-rose-300">{t.invalid}</p>:results?<dl className="grid gap-3 sm:grid-cols-2">
    <Metric locale={locale} label={t.irr} value={results.irr} percent/>
    <Metric locale={locale} label={t.npv} value={results.npv}/>
    <Metric locale={locale} label={t.income} value={results.marketValueByIncomeCap}/></dl>:<p>{t.notReady}</p>}
   <p className="mt-3 text-xs text-slate-300">{t.provisional}</p>
  </div>}
  <div className="mt-6 flex justify-between gap-3">
   <button type="button" onClick={()=>onStepChange(Math.max(0,step-1))} disabled={step===0} className="min-h-[44px] rounded-lg border border-slate-600 px-5 disabled:opacity-40">{t.previous}</button>
   <button type="button" onClick={()=>onStepChange(Math.min(4,step+1))} disabled={step===4} className="min-h-[44px] rounded-lg bg-amber-700 px-5 disabled:opacity-40">{t.next}</button>
  </div>
 </section>;
