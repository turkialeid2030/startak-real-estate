import React,{useState} from 'react';
const {assessPersonalPhasedDevelopment,STATUS,MAX_ROWS}=
 require('../valuation-intelligence/personal-phased-development-dcf');
const {parseAmount}=require('../source-intelligence/personal-saudi-sale-csv');

const inputClass='block w-full min-h-[40px] rounded-lg p-2 mt-1 text-sm';
const inputStyle={background:'#F4F5F5',color:'#192336'};
const initially=()=>[
 {month:'0',gdv:'',construction:'',other:''},
 {month:'12',gdv:'',construction:'',other:''},
];
const {researchReason}=require('../i18n/personal-research-presentation');
function Field({label,value,onChange,type='text',testId,inputMode}){
 return <label className="block text-xs" style={{color:'#F0E8D9'}}>{label}
  <input type={type} data-testid={testId} inputMode={inputMode||(type==='text'?'decimal':undefined)}
   className={inputClass} style={inputStyle} value={value} onChange={e=>onChange(e.target.value)}/>
 </label>;
}
export default function PersonalPhasedDevelopmentDcfPanel({locale='ar-SA'}){
 const ar=locale!=='en';
 const [valuationDate,setValuationDate]=useState('');
 const [right,setRight]=useState('FREEHOLD');
 const [area,setArea]=useState('');
 const [rate,setRate]=useState('');
 const [rows,setRows]=useState(initially);
 const [checks,setChecks]=useState({risk:false,margin:false,financing:false,nonRealty:false,timing:false});
 const [result,setResult]=useState(null);
 const invalidate=()=>{setChecks({risk:false,margin:false,financing:false,nonRealty:false,timing:false});setResult(null)};
 const change=(setter,value)=>{setter(value);invalidate()};
 const changeRow=(index,key,value)=>{setRows(old=>old.map((x,i)=>i===index?{...x,[key]:value}:x));invalidate()};
 const changeCheck=(key,value)=>{setChecks(old=>({...old,[key]:value}));setResult(null)};
 const calculate=()=>{
  try{
   setResult(assessPersonalPhasedDevelopment({
    assetClass:'LAND',propertyRight:right,valuationDate,landAreaSqm:parseAmount(area),
    annualDiscountRate:parseAmount(rate),
    periods:rows.map(r=>({month:parseAmount(r.month),
     gdvReceiptsSar:parseAmount(r.gdv),constructionCostsSar:parseAmount(r.construction),
     otherDevelopmentCostsSar:parseAmount(r.other)})),
    riskAndDeveloperReturnIncludedInDiscountRate:checks.risk,
    noSeparateDeveloperProfitOrRiskSpread:checks.margin,
    noFinancingCostsOrDebtServiceIncluded:checks.financing,
    nonRealtyBusinessAndEquipmentExcluded:checks.nonRealty,
    documentedTimingReviewed:checks.timing,
   }));
  }catch(e){
   setResult({status:STATUS.HOLD,reasonCodes:['PHASE_ROW_INVALID'],periods:[],
    landResidualPvSar:null,transactionAuthorized:false});
  }
 };
 const money=v=>new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:2}).format(v);
 return <section dir={ar?'rtl':'ltr'} data-testid="personal-phased-development-dcf"
  className="rounded-xl mt-4 p-4" style={{background:'#162940',border:'1px solid #536176'}}>
  <h4 className="text-sm font-semibold" style={{color:'#F2E5CC'}}>
   {ar?'التطوير العقاري — تدفقات شهرية مخصومة للبحث الشخصي':'Phased land development — private monthly discounted cashflows'}
  </h4>
  <p className="text-xs mt-2 leading-relaxed" style={{color:'#CAD5E4'}}>
   {ar?'تُخصم إيرادات البيع وتكاليف الإنشاء والمصروفات الأخرى في الشهر الذي تحدث فيه. شهر 0 هو تاريخ التقييم؛ ويُعدّ العائد والمخاطر ضمن معدل الخصم مرة واحدة، دون فوائد التمويل أو ربح مطور منفصل. لا قيمة تخارج مفترضة ولا بيانات سوق معتمدة. لا تغيّر هذه الدراسة نموذج المتبقي الاسمي القديم.':
    'Discount GDV receipts and construction/other outlays at their actual month; month 0 is the valuation date. Project risk and developer return are included once in the discount rate with no separate developer profit, financing or debt service. No market certification or change to the legacy nominal residual.'}
  </p>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
   <Field label={ar?'تاريخ التقييم':'Valuation date'} type="date" value={valuationDate} onChange={v=>change(setValuationDate,v)}/>
   <Field label={ar?'مساحة الأرض (م²)':'Land area sqm'} value={area} onChange={v=>change(setArea,v)}/>
   <Field label={ar?'معدل الخصم الفعلي السنوي (0.12 = 12%)':'Effective annual discount rate (0.12 = 12%)'} value={rate} onChange={v=>change(setRate,v)}/>
   <label className="text-xs" style={{color:'#F0E8D9'}}>
    {ar?'الحق العقاري':'Property interest'}
    <select value={right} data-testid="phased-property-right"
     className={inputClass} style={inputStyle} onChange={e=>change(setRight,e.target.value)}>
     <option value="FREEHOLD">{ar?'ملكية كاملة':'Freehold'}</option>
     <option value="LEASEHOLD">{ar?'حق إيجار':'Leasehold'}</option>
     <option value="WAQF_RESTRICTED">{ar?'وقف مقيد':'Restricted waqf'}</option>
    </select>
   </label>
  </div>
  <p className="mt-4 text-xs" style={{color:'#E7C98D'}}>
   {ar?'الأشهر منذ التقييم — لكل شهر صف واحد فقط؛ أدخل 0 صراحة عند عدم وجود إيراد أو تكلفة.':
    'Months since valuation; one row per month. Enter explicit 0 for zero receipts or costs.'}
  </p>
  <div className="flex flex-col gap-3 mt-2">
   {rows.map((r,i)=><div key={i} className="rounded-lg p-3 border border-slate-500/50">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
     <Field label={ar?'الشهر':'Month'} value={r.month} testId="phased-month-input" inputMode="numeric" onChange={v=>changeRow(i,'month',v)}/>
     <Field label={ar?'تحصيل مبيعات المشروع (ر.س)':'GDV receipts SAR'} value={r.gdv} onChange={v=>changeRow(i,'gdv',v)}/>
     <Field label={ar?'تكاليف الإنشاء (ر.س)':'Construction SAR'} value={r.construction} onChange={v=>changeRow(i,'construction',v)}/>
     <Field label={ar?'مصاريف أخرى دون تمويل أو ربح مطور (ر.س)':'Other costs, no financing/profit SAR'}
      value={r.other} onChange={v=>changeRow(i,'other',v)}/>
    </div>
    {rows.length>2&&<button type="button" className="mt-2 min-h-[40px] text-xs underline" style={{color:'#EAC58D'}}
     onClick={()=>{setRows(old=>old.filter((_,j)=>j!==i));invalidate();}}>
     {ar?'حذف هذه الفترة':'Remove period'}
    </button>}
   </div>)}
  </div>
  <button type="button" disabled={rows.length>=MAX_ROWS} data-testid="phased-add-month"
   className="text-xs border border-slate-500 rounded-lg px-3 py-2 mt-3 min-h-[40px]"
   style={{color:'#F0E8D9'}} onClick={()=>{
    setRows(old=>[...old,{month:'',gdv:'',construction:'',other:''}]);invalidate();
   }}>{ar?'إضافة شهر تحصيل أو صرف':'Add month'}</button>
  <div className="mt-4 space-y-2">
   {[
    ['risk',ar?'أقر أن معدل الخصم يشمل مخاطر المشروع وعائد المطور مرة واحدة':'Discount rate includes development risk and developer return once'],
    ['margin',ar?'لا أطرح هامش مطور أو علاوة مخاطر إضافية من التدفقات':'No separate developer margin or risk spread deducted'],
    ['financing',ar?'لا تشمل التكاليف فوائد التمويل أو خدمة الدين؛ الحساب غير ممول':'No financing or debt service; unlevered model'],
    ['nonRealty',ar?'استبعدت المعدات والأنشطة التجارية من قيمة المبيعات':'Non-realty operating assets/business excluded'],
    ['timing',ar?'راجعت أشهر الصرف والتحصيل المقترحة':'I reviewed timing of actual draws and receipts'],
   ].map(([key,label])=><label key={key} className="flex gap-3 items-center min-h-[40px] text-xs"
    style={{color:'#E7EBF2'}}><input type="checkbox" checked={checks[key]}
     onChange={e=>changeCheck(key,e.target.checked)} className="w-6 h-6 flex-shrink-0"/>{label}</label>)}
  </div>
  <button type="button" data-testid="phased-development-calculate" className="mt-3 rounded-lg px-4 py-3 min-h-[40px] text-xs font-semibold"
   style={{background:'#C9A24C',color:'#142236'}} onClick={calculate}>
   {ar?'احسب القيمة المتبقية البحثية المخصومة':'Calculate unverified discounted land residual'}
  </button>
  {result&&<div data-testid="phased-development-result" role="status"
   className="mt-4 rounded-lg p-3" style={{background:'#0C1C31',color:'#ECF0F6'}}>
   <strong className="text-sm">{result.status===STATUS.HOLD?
    (ar?'الحساب محجوب لقصور الأدلة أو شروط الطريقة':'Held due to missing inputs or methodology'):
    (ar?'القيمة المتبقية البحثية للأرض — غير معتمدة':'Private unverified land residual research')}</strong>
   {result.status===STATUS.RESEARCH&&<>
    <p data-testid="phased-development-pv" className="text-sm mt-2">
     {ar?'صافي القيمة الحالية المتبقية للأرض (ريال): ':'Residual land present value SAR: '}
     {money(result.landResidualPvSar)}
    </p>
    <p className="text-xs mt-1">{ar?'القيمة لكل متر مربع (ريال): ':'Residual per sqm SAR: '}
     {money(result.landResidualPvPerSqmSar)}</p>
    <p className="text-xs mt-1">{ar?'المتبقي الاسمي قبل شراء الأرض (ريال): ':'Undiscounted before land SAR: '}
     {money(result.nominalNetBeforeLandSar)}</p>
    {result.methodContrast&&<section data-testid="phased-development-method-contrast"
     className="mt-3 rounded-lg border border-slate-500/50 p-3">
     <h5 className="text-xs font-semibold">
      {ar?'مقارنة حسابية لأسس التوقيت — غير معتمدة':'Timing-basis method contrast — not certified'}
     </h5>
     <p className="text-xs mt-2">
      {ar?'هذه ثلاث قراءات للتدفقات نفسها؛ لا تُجمع ولا يُختار المتوسط أو الأعلى آليًا. طريقة نهاية المشروع تفترض وقوع جميع التحصيلات والتكاليف في الشهر الأخير، ولذلك تختلف عن الخصم الشهري الفعلي.':
       'Three mathematical views of the SAME user-supplied cashflows. Do not average or select one automatically. The terminal shadow assumes every receipt and cost occurs in the last month rather than at its dated period.'}
     </p>
     <div className="overflow-x-auto mt-2"><table className="w-full text-xs">
      <tbody>
       <tr><th className="p-2 text-start">{ar?'التدفقات الشهرية المخصومة':'Dated monthly present value'}</th><td className="p-2">{money(result.methodContrast.monthlyDatedPvSar)}</td></tr>
       <tr><th className="p-2 text-start">{ar?'المتبقي الاسمي دون خصم':'Undiscounted nominal shadow'}</th><td className="p-2">{money(result.methodContrast.nominalUndiscountedSar)}</td></tr>
       <tr><th className="p-2 text-start">{ar?'صافي نهاية المشروع المخصوم (محاكاة حسابية)':'Terminal-aggregate discount shadow'}</th><td className="p-2">{money(result.methodContrast.terminalAggregateShadowSar)}</td></tr>
       <tr><th className="p-2 text-start">{ar?'فرق خصم نهاية المشروع عن الجدول الشهري':'Terminal minus monthly difference'}</th><td className="p-2">{money(result.methodContrast.differenceTerminalMinusMonthlySar)}</td></tr>
      </tbody>
     </table></div>
     <p className="mt-2 text-xs" style={{color:'#E7C08C'}}>
      {ar?'هذه مقارنة تعليمية للطرق وليست تسوية مهنية أو سعر شراء. تتطلب اعتماد التخطيط والصك والتكاليف والتوقيت ومعدل الخصم والبيانات الواقعية من مختص مستقل.':
       'Not a professional reconciliation or acquisition price. Requires independent planning, title, cost, timing, discount rate, and real-market reviews.'}
     </p>
    </section>}
    <div className="overflow-x-auto mt-2"><table className="text-xs w-full" style={{color:'#ECF0F6'}}>
     <thead><tr><th className="p-2 text-start">{ar?'الشهر':'Month'}</th>
      <th className="p-2 text-start">{ar?'الصافي الاسمي':'Nominal net'}</th>
      <th className="p-2 text-start">{ar?'الصافي المخصوم':'Discounted net'}</th></tr></thead>
     <tbody>{result.periods.map(p=><tr key={p.month}>
      <td className="p-2">{p.month}</td><td className="p-2">{money(p.nominalNetSar)}</td>
      <td className="p-2">{money(p.discountedNetSar)}</td>
     </tr>)}</tbody>
    </table></div>
   </>}
   {result.reasonCodes?.length>0&&<ul data-testid="phased-development-reasons"
    className="mt-2 text-xs" style={{color:'#E7C08C'}}>
    {result.reasonCodes.map(code=><li key={code} data-diagnostic-content translate="no">
      <span>{researchReason(code,locale).message}</span>{' '}<code dir="ltr">{code}</code>
    </li>)}
   </ul>}
   <p className="mt-2 text-xs" style={{color:'#CAD4E4'}}>{ar?
    'حساب شخصي من افتراضات المستخدم؛ لا يمثل سعر شراء أو تقييمًا مهنيًا أو تحققًا من التخطيط والصك والصفقات. لا يحفظ نتيجة داخل عقد أو يصدر تقرير تقييم معتمد.':
    'User-supplied assumptions only. Not a purchase ceiling, licensed appraisal, verified planning/title, audited market sale or authorization.'}</p>
  </div>}
 </section>;
}
