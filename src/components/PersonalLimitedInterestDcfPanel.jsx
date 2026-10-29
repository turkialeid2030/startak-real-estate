import React,{useState,useRef,useEffect} from 'react';
const {assessLimitedPropertyInterest,RIGHTS,STATUS}=
 require('../valuation-intelligence/personal-limited-interest-dcf');
const {parseAmount}=require('../source-intelligence/personal-saudi-sale-csv');
const {MAX_ARCHIVE_BYTES,createLimitedInterestArchive,verifyLimitedInterestArchive}=
 require('../valuation-intelligence/personal-limited-interest-case-archive');
const LABELS=Object.freeze({
 termYears:'المدة المتبقية للحق (بالسنوات الصحيحة)',valuationDate:'تاريخ التقييم',
 annualPropertyIncomeSar:'الإيراد العقاري السنوي قبل مصروفات التشغيل وأجرة الحق والصيانة (دون دخل النشاط التجاري)',
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
 LIMITED_PROPERTY_RIGHT_REQUIRED:'حدد نوع حق الانتفاع أو حق الإيجار محل الدراسة.',
 VALUATION_DATE_REQUIRED:'أدخل تاريخ تقييم صحيحًا.',
 NON_FINITE_RIGHTS_CASHFLOW:'تجاوزت التدفقات الحدود الحسابية الآمنة؛ راجع الأرقام والنمو.',
 NON_FINITE_RIGHTS_NPV:'تعذّر حساب صافي القيمة الحالية دون تجاوز الحدود الآمنة.',
 UNSUPPORTED_RIGHTS_SCENARIO:'تعذّر حساب السيناريو من المدخلات الحالية؛ تحقق من الحقول.',
});
function reasonText(code,ar){
 if(!ar)return code;
 if(REASONS[code])return REASONS[code];
 if(code.startsWith('INVALID_AMOUNT_'))return 'قيمة نقدية غير صالحة: '+code.slice('INVALID_AMOUNT_'.length);
 if(code.startsWith('INVALID_ESCALATION_'))return 'معدل نمو خارج الحدود (-50% إلى 50%): '+code.slice('INVALID_ESCALATION_'.length);
 return 'سبب الحجب يحتاج فحصًا: '+code;
}
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
 const [archiveStatus,setArchiveStatus]=useState('');
 const archiveFileRef=useRef(null),operation=useRef(0);
 const currentContext=JSON.stringify([assetClass,right,term,valuationDate,inputs,confirmed]);
 const contextRef=useRef(currentContext);contextRef.current=currentContext;
 const invalidate=()=>{operation.current++;setResult(null);setArchiveStatus('');};
 useEffect(()=>()=>{operation.current++;},[]);
 const notices={
  EXPORTED:ar?'حُفظت مدخلات حق الانتفاع على جهازك فقط؛ لا تُحفظ النتائج أو صلاحيات التصرف.':'Input-only rights case exported locally. No results or transaction rights were saved.',
  EXPORT_FAILED:ar?'تعذر حفظ الملف بأمان؛ لم تُنشأ نسخة احتياطية.':'Secure local export failed; no backup was created.',
  INVALID_SIZE:ar?'حجم الملف غير صالح أو يتجاوز 16 كيلوبايت.':'Invalid rights case archive size (>16 KiB).',
  RESTORED:ar?'استُعيدت المدخلات فقط؛ يجب إعادة الحساب والتحقق من المستندات والموافقات.':'Inputs restored only. Recalculate and independently recheck documents and consents.',
  REJECTED:ar?'رفض الاستيراد: بصمة الملف أو نوع العقار أو البنية غير متطابقة. لم تُعدّل الدراسة.':'Import rejected: integrity, asset class or structure mismatch. Existing case unchanged.',
 };
 // Reset case and result if this component is reused for a different property sector.
 useEffect(()=>{
  operation.current++;
  setRight('');setInputs(empty());setTerm('');setValuationDate('');
  setConfirmed({terms:false,realty:false,improvements:false,consentRequired:false,consentVerified:false});
  setResult(null);setArchiveStatus('');
 },[assetClass]);
 const currentState=()=>({assetClass,right,term,valuationDate,inputs,confirmed});
 const exportCase=async()=>{
  const id=++operation.current,context=currentContext;setArchiveStatus('');
  try{
   const archive=await createLimitedInterestArchive(currentState(),{subtle:globalThis.crypto?.subtle});
   if(id!==operation.current||context!==contextRef.current)return;
   const url=URL.createObjectURL(new Blob([JSON.stringify(archive,null,2)],{type:'application/json;charset=utf-8'}));
   const link=document.createElement('a');
   link.href=url;link.download='startak-limited-interest-case-v1.json';
   document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
   setArchiveStatus('EXPORTED');
  }catch(e){if(id===operation.current&&context===contextRef.current)setArchiveStatus('EXPORT_FAILED');}
 };
 const importCase=async(event)=>{
  const id=++operation.current,context=currentContext,file=event.target.files?.[0];
  if(archiveFileRef.current)archiveFileRef.current.value='';
  setArchiveStatus('');
  if(!file)return;
  if(file.size<=0||file.size>MAX_ARCHIVE_BYTES){
   setArchiveStatus('INVALID_SIZE');return;
  }
  try{
   const buffer=await file.arrayBuffer();
   if(id!==operation.current||context!==contextRef.current)return;
   if(buffer.byteLength<=0||buffer.byteLength>MAX_ARCHIVE_BYTES)throw Error('ARCHIVE_TOO_LARGE');
   const raw=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
   const restored=await verifyLimitedInterestArchive(JSON.parse(raw),{
    subtle:globalThis.crypto?.subtle,expectedAssetClass:assetClass,
   });
   if(id!==operation.current||context!==contextRef.current)return;
   setRight(restored.right);setTerm(restored.term);
   setValuationDate(restored.valuationDate);setInputs(restored.inputs);
   setConfirmed(restored.confirmed);setResult(null);
   setArchiveStatus('RESTORED');
  }catch(e){if(id===operation.current&&context===contextRef.current)setArchiveStatus('REJECTED');}
 };
 const update=(setter,key,value)=>{invalidate();setter(old=>({...old,[key]:value}))};
 const calc=()=>{
  try{
   setResult(assessLimitedPropertyInterest({
    assetClass,propertyRight:right,valuationDate,termYears:Number(term),
    ...Object.fromEntries(FIELDS.map(k=>[k,parseAmount(inputs[k])])),
    termsCheckedAgainstContract:confirmed.terms,
    propertyOnlyCashflowsConfirmed:confirmed.realty,
    improvementOwnershipAtTermEnd:confirmed.improvements,
    assignabilityRequiresConsent:confirmed.consentRequired,
    consentDocumentUserDeclared:confirmed.consentVerified,
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
    <select value={right} onChange={e=>{invalidate();setRight(e.target.value);}}
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
    <input data-testid="limited-interest-term" type="number" min="1" max="80" step="1" value={term}
     onChange={e=>{invalidate();setTerm(e.target.value);}} className="block w-full rounded-lg p-2 min-h-[40px] mt-1"
     style={{background:'#F5F4F0',color:'#202937'}}/>
   </label>
   <label className="text-xs" style={{color:'#E8E9ED'}}>
    {ar?'تاريخ التقييم':'Valuation date'}
    <input data-testid="limited-interest-date" type="date" value={valuationDate}
     onChange={e=>{invalidate();setValuationDate(e.target.value);}} className="block w-full rounded-lg p-2 min-h-[40px] mt-1"
     style={{background:'#F5F4F0',color:'#202937'}}/>
   </label>
   {FIELDS.map(k=><label key={k} className="text-xs" style={{color:'#E8E9ED'}}>
     {ar?LABELS[k]:k.replace(/([A-Z])/g,' $1')}
     <input data-testid={'limited-interest-'+k} type="text" inputMode="decimal" value={inputs[k]}
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
  <div className="mt-4 rounded-lg border border-slate-500/50 p-3">
   <p className="text-xs leading-relaxed" style={{color:'#C5D3E1'}}>{ar?
    'يمكن حفظ واستعادة مدخلات الحق كملف JSON محلي. بصمة SHA-256 تكشف التعديل أو التلف، لكنها ليست توقيعًا موثقًا ولا إثباتًا لصحة العقد أو الموافقات.':
    'Export/import a private input-only JSON rights case. SHA-256 detects modification, but is not an identity signature, proof of contract, or verified consent.'}</p>
   <div className="flex flex-wrap gap-3 mt-2 items-center">
    <button type="button" data-testid="limited-interest-export-case" onClick={exportCase}
     className="rounded-lg border border-slate-500 px-3 py-2 text-xs min-h-[40px]"
     style={{color:'#F0E8DA'}}>{ar?'حفظ مدخلات الحق محليًا':'Export rights input case'}</button>
    <label className="text-xs" style={{color:'#F0E8DA'}}>
     {ar?'استعادة ملف حق سابق':'Import rights input case'}
     <input ref={archiveFileRef} type="file" accept=".json,application/json"
      data-testid="limited-interest-import-case" className="block mt-1 py-2 text-xs"
      onChange={importCase}/>
    </label>
   </div>
   {archiveStatus&&<p data-testid="limited-interest-archive-status" role="status"
    className="text-xs leading-relaxed mt-2" style={{color:'#E7BC7D'}}>{notices[archiveStatus]}</p>}
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
      {(result.reasonCodes||[]).map(c=>reasonText(c,ar)).join('؛ ')}
    </p>
    <p className="mt-2 text-xs">{ar?
      'النتائج افتراضية ولم يتم إثبات قابلية التنازل أو الأسعار أو تراخيص الحقوق المستقلة؛ ليست سعر شراء أو تقييمًا مهنيًا.'
      :'User-supplied assumptions, not legally verified, certified, or an authorized purchase price.'}</p>
  </div>}
 </section>;
}
