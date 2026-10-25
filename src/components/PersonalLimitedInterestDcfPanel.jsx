import React,{useState} from 'react';
const {assessLimitedPropertyInterest,RIGHTS,STATUS}=
 require('../valuation-intelligence/personal-limited-interest-dcf');
const {parseAmount}=require('../source-intelligence/personal-saudi-sale-csv');
const LABELS=Object.freeze({
 termYears:'المدة المتبقية للحق (بالسنوات الصحيحة)',valuationDate:'تاريخ التقييم',
 annualPropertyIncomeSar:'الدخل العقاري السنوي الصافي من الأنشطة التجارية الأخرى',
 annualPropertyOperatingExpenseSar:'مصروفات تشغيل العقار السنوية',
 annualGroundRentSar:'الأجرة السنوية المدفوعة لمالك أصل العقار',
 annualSustainingCapexSar:'الإنفاق الرأسمالي السنوي اللازم لصيانة الحق',
 incomeEscalationRate:'نمو الدخل السنوي (-0.02 = نقص 2%)',
 operatingExpenseEscalationRate:'نمو المصروفات السنوي',
 groundRentEscalationRate:'نمو أجرة حق الأصل السنوي',
 nominalDiscountRate:'معدل الخصم السنوي الاسمي (0.10 = 10%)',
 upfrontRightConsiderationSar:'المقابل المقدم للحصول على الحق (ريال)',
});
const REASONS=Object.freeze({
 WAQF_RESTRICTED_INTEREST_REQUIRES_INDEPENDENT_LEGAL_REVIEW:'حق الوقف مقيد ويحتاج مراجعة مستقلة للصك وصلاحية التصرف، ولا ينتج عنه تقييم رقمي تلقائي.',
 ASSIGNABILITY_CONSENT_NOT_ESTABLISHED:'تنازل الحق يستلزم موافقة؛ ولم تثبت الموافقة المستقلة.',
 CONTRACTUAL_TERM_AND_OBLIGATIONS_NOT_DECLARED_REVIEWED:'يجب مراجعة مدة الحق والأجرة والالتزامات في العقد.',
 PROPERTY_REVENUE_EXCLUDING_OPERATING_BUSINESS_NOT_CONFIRMED:'افصل دخل العقار عن أرباح المشغل أو المعدات والسمعة.',
 IMPROVEMENT_REVERSION_REQUIRES_SEPARATE_VERIFIED_MODEL:'التعويض أو ملكية التحسينات عند نهاية الحق تتطلب نموذجًا مستقلًا موثقًا.',
 REMAINING_RIGHT_TERM_1_TO_80_YEARS_REQUIRED:'أدخل مدة صحيحة من سنة إلى 80 سنة.',
 INVALID_NOMINAL_DISCOUNT_RATE:'معدل الخصم يجب أن يكون بين 0% و75%.',
 PROPERTY_REVENUE_REQUIRED:'أدخل دخلًا عقاريًا سنويًا موجبًا.',
});
const FIELDS=['annualPropertyIncomeSar','annualPropertyOperatingExpenseSar','annualGroundRentSar',
 'annualSustainingCapexSar','incomeEscalationRate','operatingExpenseEscalationRate',
 'groundRentEscalationRate','nominalDiscountRate','upfrontRightConsiderationSar'];
const empty=()=>Object.fromEntries(FIELDS.map(k=>[k,'']));
export default function PersonalLimitedInterestDcfPanel({assetClass,locale='ar-SA'}){
 const ar=locale!=='en';
 const [right,setRight]=useState('');
 const [inputs,setInputs]=useState(empty);
 const [term,setTerm]=useState('');
 const [valuationDate,setValuationDate]=useState('');
 const [confirmed,setConfirmed]=useState({terms:false,realty:false,improvements:false,consentRequired:false,consentVerified:false});
 const [result,setResult]=useState(null);
 const update=(setter,key,value)=>{setter(old=>({...old,[key]:value}));setResult(null)};
 const calc=()=>{
  try{
   setResult(assessLimitedPropertyInterest({
    assetClass,propertyRight:right,valuationDate,termYears:Number(term),
    ...Object.fromEntries(FIELDS.map(k=>[k,parseAmount(inputs[k])])),
    termsCheckedAgainstContract:confirmed.terms,
    propertyOnlyCashflowsConfirmed:confirmed.realty,
    improvementOwnershipAtTermEnd:confirmed.improvements,
    assignabilityRequiresConsent:confirmed.consentRequired,
    consentEvidenceIndependentlyVerified:confirmed.consentVerified,
   }));
  }catch(e){
   setResult({status:STATUS.HOLD,reasonCodes:['UNSUPPORTED_RIGHTS_SCENARIO'],periods:[]});
  }
 };
 const currency=n=>new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:0}).format(n);
 return <section data-testid="personal-limited-interest-dcf" dir={ar?'rtl':'ltr'}
  className="mt-4 rounded-xl p-4" style={{background:'#172A41',border:'1px solid #536176'}}>
  <h4 className="text-sm font-semibold" style={{color:'#F0E8DA'}}>
   {ar?'تقييم منفعة حق عقاري محدد المدة — التدفقات النقدية':'Time-limited property interest — cashflow DCF'}
  </h4>
  <p className="text-xs mt-2 leading-relaxed" style={{color:'#BECBE0'}}>
   {ar?'يُخصم دخل العقار بعد مصروفات التشغيل وأجرة حق الأرض والنفقات الرأسمالية عبر المدة المتبقية فقط. لا تُضاف قيمة تخارج أو تجديد تلقائي. حق الوقف المقيد يظل محجوبًا للمراجعة القانونية.'
     :'Discount property-only net cashflows after operating costs, head rent and recurring capex over the stated term. No assumed terminal value or renewal. Restricted waqf rights are held for legal review.'}
  </p>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
   <label className="text-xs" style={{color:'#E8E9ED'}}>
    {ar?'نوع الحق العقاري':'Interest to be valued'}
    <select value={right} onChange={e=>{setRight(e.target.value);setResult(null);}}
     data-testid="limited-interest-right" className="block w-full min-h-[40px] rounded-lg p-2 mt-1"
     style={{background:'#F5F4F0',color:'#202937'}}>
     <option value="">{ar?'حدد الحق':'Select interest'}</option>
     <option value={RIGHTS.LEASEHOLD}>{ar?'حق إيجار محدد المدة':'Leasehold'}</option>
     <option value={RIGHTS.USUFRUCT}>{ar?'حق انتفاع محدد المدة':'Usufruct'}</option>
     <option value={RIGHTS.WAQF_RESTRICTED}>{ar?'حق وقفي مقيد':'Restricted waqf interest'}</option>
    </select>
   </label>
   <label className="text-xs" style={{color:'#E8E9ED'}}>
    {ar?'المدة المتبقية بالسنوات':'Remaining term, full years'}
    <input type="number" min="1" max="80" step="1" value={term}
     onChange={e=>{setTerm(e.target.value);setResult(null);}} className="block w-full rounded-lg p-2 min-h-[40px] mt-1"
     style={{background:'#F5F4F0',color:'#202937'}}/>
   </label>
   <label className="text-xs" style={{color:'#E8E9ED'}}>
    {ar?'تاريخ التقييم':'Valuation date'}
    <input type="date" value={valuationDate}
     onChange={e=>{setValuationDate(e.target.value);setResult(null);}} className="block w-full rounded-lg p-2 min-h-[40px] mt-1"
     style={{background:'#F5F4F0',color:'#202937'}}/>
   </label>
   {FIELDS.map(k=><label key={k} className="text-xs" style={{color:'#E8E9ED'}}>
     {ar?LABELS[k]:k.replace(/([A-Z])/g,' $1')}
     <input type="text" inputMode="decimal" value={inputs[k]}
      className="block w-full rounded-lg p-2 min-h-[40px] mt-1"
      style={{background:'#F5F4F0',color:'#202937'}}
      onChange={e=>update(setInputs,k,e.target.value)}/>
   </label>)}
  </div>
  <div className="mt-3">
   {[
    ['terms',ar?'راجعت عقد الحق ومدته والتزاماته':'I reviewed the term, lease and obligations'],
    ['realty',ar?'فصلت الدخل العقاري عن أرباح التشغيل':'I excluded operating-business profit'],
    ['improvements',ar?'توجد مطالبة بملكية التحسينات أو قيمتها عند انتهاء الحق':'Improvements may revert with value at term expiry'],
    ['consentRequired',ar?'التنازل عن الحق يحتاج موافقة':'Transfer requires consent'],
    ['consentVerified',ar?'لدي مستند موافقة مستقل يجب التحقق منه':'I have independently reviewable consent evidence'],
   ].map(([k,label])=><label key={k} className="flex items-center gap-3 text-xs min-h-[40px]"
     style={{color:'#E8E9ED'}}>
     <input type="checkbox" style={{width:28,height:28,flexShrink:0}}
       checked={confirmed[k]} onChange={e=>update(setConfirmed,k,e.target.checked)}/>
     {label}
   </label>)}
  </div>
  <button type="button" data-testid="limited-interest-calculate"
   onClick={calc} className="rounded-lg p-3 min-h-[40px] text-xs font-semibold mt-3"
   style={{background:'#C9A24C',color:'#17233B'}}>
   {ar?'احسب سيناريو منفعة الحق دون اعتماد سوقي':'Calculate property interest research scenario'}
  </button>
  {result&&<div data-testid="limited-interest-result" role="status" className="mt-4 rounded-lg p-3"
    style={{color:'#EBEEF5',background:'#101C31'}}>
    <strong className="text-sm">
     {result.status===STATUS.HOLD
      ? ar?'حجب الحساب — يلزم التحقق من الحق والمدخلات':'Held — right or inputs are not ready'
      : ar?'نتيجة حسابية للبحث الشخصي فقط':'Private interest DCF research only'}
    </strong>
    {result.status===STATUS.RESEARCH&&<>
     <p className="mt-2 text-xs">{ar?'القيمة الحالية لتدفقات منفعة الحق (ر.س): ':'PV of right net cashflows SAR: '}
       {currency(result.propertyCashflowPvSar)}</p>
     <p className="mt-2 text-xs">{ar?'صافي الاستثمار بعد المقابل المدفوع (ر.س): ':'Investor NPV after upfront premium SAR: '}
       {currency(result.ownerInvestmentNpvAfterUpfrontSar)}</p>
    </>}
    <p className="mt-2 text-xs" style={{color:'#EAC38B'}}>
      {(result.reasonCodes||[]).map(c=>ar?(REASONS[c]||'المدخلات غير معتمدة خارجيًا'):c).join('؛ ')}
    </p>
    <p className="mt-2 text-xs">{ar?
      'النتائج افتراضية ولم يتم إثبات قابلية التنازل أو الأسعار أو تراخيص الحقوق المستقلة؛ ليست سعر شراء أو تقييمًا مهنيًا.'
      :'User-supplied assumptions, not legally verified, certified, or an authorized purchase price.'}</p>
  </div>}
 </section>;
}
