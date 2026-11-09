import React,{useState} from 'react';
import {parseNumericText} from '../validation/numeric-text';
const {INDICATORS,calculateDeclaredOptionalResearchIndicator}=require('../analysis/optional-property-indicators');

// Deliberately separate from the canonical appraisal and investor decision
// workspaces. Nothing here is written to an asset, a report or a valuation.
const FIELDS=Object.freeze({
 GROSS_RENTAL_YIELD:['grossAnnualRentSar','purchasePriceSar'],
 GROSS_RENT_MULTIPLIER:['grossAnnualRentSar','purchasePriceSar'],
 CASH_ON_CASH:['annualPreTaxEquityCashFlowSar','cashEquityInvestedSar'],
 DISCOUNTED_PAYBACK:['annualCashflowsSar','discountRate'],
 PROFITABILITY_INDEX:['initialInvestmentSar','futureAnnualInflowsSar','discountRate'],
 MIRR:['annualCashflowsSar','financeRate','reinvestmentRate'],
 EQUIVALENT_ANNUAL_ANNUITY:['npvSar','discountRate','periodYears'],
});
const FIELD_LABELS=Object.freeze({
 grossAnnualRentSar:['الإيجار الإجمالي السنوي (ريال)','Annual gross rent (SAR)'],
 purchasePriceSar:['سعر شراء العقار (ريال)','Property purchase price (SAR)'],
 annualPreTaxEquityCashFlowSar:['التدفق السنوي لحقوق الملكية بعد خدمة الدين وقبل الضريبة (ريال)','Annual after-debt, before-tax equity cash flow (SAR)'],
 cashEquityInvestedSar:['رأس المال النقدي المستثمر فعليًا (ريال)','Actual invested cash equity (SAR)'],
 annualCashflowsSar:['التدفقات السنوية بدءًا بالسنة صفر؛ افصل بينها بفاصلة منقوطة ;','Annual cash flows from year zero; separate with semicolons ;'],
 futureAnnualInflowsSar:['التدفقات السنوية الداخلة بعد السنة صفر؛ افصل بفاصلة منقوطة ;','Future annual inflows; separate with semicolons ;'],
 discountRate:['معدل الخصم السنوي (%)؛ أدخل 10 لتمثيل 10%','Annual discount rate (%); enter 10 for 10%'],
 initialInvestmentSar:['الاستثمار الأولي الوحيد في السنة صفر (ريال)','Single initial investment at year zero (SAR)'],
 financeRate:['معدل التمويل السنوي (%)','Annual finance rate (%)'],
 reinvestmentRate:['معدل إعادة الاستثمار السنوي (%)','Annual reinvestment rate (%)'],
 npvSar:['صافي القيمة الحالية المُدخل (ريال)','Entered NPV (SAR)'],
 periodYears:['عدد السنوات الصحيح','Integer number of years'],
 terminalSaleYear:['سنة التخارج الأخيرة (عدد صحيح)','Final year of terminal sale (integer)'],
});
const ENGLISH_NAMES=Object.freeze({
 GROSS_RENTAL_YIELD:'Gross rental yield',GROSS_RENT_MULTIPLIER:'Gross rent multiplier',
 CASH_ON_CASH:'Cash-on-cash return',DISCOUNTED_PAYBACK:'Discounted payback',
 PROFITABILITY_INDEX:'Profitability index',MIRR:'Modified internal rate of return',
 EQUIVALENT_ANNUAL_ANNUITY:'Equivalent annual annuity',
});
const PERCENT_IDS=new Set(['GROSS_RENTAL_YIELD','CASH_ON_CASH','MIRR']);
const RATE_FIELDS=new Set(['discountRate','financeRate','reinvestmentRate']);
const SERIES_FIELDS=new Set(['annualCashflowsSar','futureAnnualInflowsSar']);
function parseField(key,raw) {
 if(SERIES_FIELDS.has(key)){
  if(typeof raw!=='string'||!raw.trim())return null;
  // Semicolon is unambiguous: Arabic and English commas may be thousands separators.
  return raw.split(';').map(v=>{const p=parseNumericText(v);return p.ok?p.value:null;});
 }
 const p=parseNumericText(raw??'');
 if(!p.ok)return null;
 return RATE_FIELDS.has(key)?p.value/100:p.value;
}
function display(value,id,unit,locale){
 const lang=locale==='en'?'en-US':'ar-SA';
 const n=new Intl.NumberFormat(lang,{maximumFractionDigits:4});
 return PERCENT_IDS.has(id)?n.format(value*100)+'%':
  unit==='SAR/year'?n.format(value)+' '+(locale==='en'?'SAR/year':'ريال/سنة'):
  unit==='years'?n.format(value)+' '+(locale==='en'?'years':'سنة'):
  n.format(value)+(unit==='multiple'?'x':'');
}
export default function OptionalPropertyIndicatorsResearchPanel({locale='ar-SA',blocked=false}){
 const ar=locale!=='en';
 const [metric,setMetric]=useState('GROSS_RENTAL_YIELD');
 const [raw,setRaw]=useState({});
 const [sourceReference,setSourceReference]=useState('');
 const [sourceDate,setSourceDate]=useState('');
 const [userAttested,setUserAttested]=useState(false);
 const [terminalSale,setTerminalSale]=useState('');
 const [result,setResult]=useState(null);
 const reset=()=>setResult(null);
 const choose=id=>{
  setMetric(id);setRaw({});setSourceReference('');setSourceDate('');
  setUserAttested(false);setTerminalSale('');reset();
 };
 const updateField=(key,value)=>{
  setRaw(current=>({...current,[key]:value}));reset();
 };
 const calculate=()=>{
  if(blocked){setResult({status:'HOLD_INVALID_OR_INCOMPLETE',value:null,reasonCode:'LINKED_APPRAISAL_REVIEW_HOLD'});return;}
  const inputs={};
  for(const key of FIELDS[metric])inputs[key]=parseField(key,raw[key]);
  if(metric==='DISCOUNTED_PAYBACK'){
   if(terminalSale!=='')inputs.includesTerminalSale=terminalSale==='yes';
   if(terminalSale==='yes')inputs.terminalSaleYear=parseField('terminalSaleYear',raw.terminalSaleYear);
  }
  setResult(calculateDeclaredOptionalResearchIndicator(metric,inputs,{
   sourceReference,sourceDate,userAttested,
  }));
 };
 const shown=FIELDS[metric]||[];
 return <section data-testid="optional-indicators-775" dir={ar?'rtl':'ltr'}
  className="mt-5 rounded-2xl border border-slate-600 bg-[#111d32] p-4 text-slate-100 md:p-5">
  <details>
   <summary className="cursor-pointer text-sm font-semibold">
    {ar?'مؤشرات استثمار عقاري إضافية — بحث شخصي غير معتمد':'Supplemental property indicators — unverified personal research'}
   </summary>
   <p className="mt-3 text-xs leading-6 text-amber-200" data-testid="optional-uncertified-notice">
    {ar?'هذه مؤشرات حسابية اختيارية من مدخلات تُدخِلها يدويًا. إدخال مرجع المستند وإقرارك لا يثبتان صحته استقلاليًا. لا تدخل النتائج في القيمة السوقية أو تقرير التقييم أو قرار التمويل، ولا تُحفظ ضمن الصفقة.':
      'These are optional calculations from your manual inputs. A document reference and your attestation do not establish independent verification. Results never enter appraised value, approved reports, financing decisions or saved deals.'}
   </p>
   {blocked&&<p role="alert" data-testid="optional-linked-review-hold" className="mt-2 text-sm text-rose-300">
    {ar?'إيقاف بسبب اختلاف مرتبط بمراجعة التقييم':'Blocked by linked appraisal-review discrepancy'}
   </p>}
   <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="text-xs" htmlFor="optional-metric">
     {ar?'المؤشر':'Indicator'}
     <select id="optional-metric" data-testid="optional-metric" value={metric}
      onChange={e=>choose(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-sm">
      {Object.keys(INDICATORS).map(id=><option key={id} value={id}>{ar?INDICATORS[id].nameAr:ENGLISH_NAMES[id]}</option>)}
     </select>
    </label>
    <label className="text-xs" htmlFor="optional-source-ref">
     {ar?'مرجع المستند المصرح به (ليس تحققًا مستقلًا)':'Declared document reference (not verified)'}
     <input id="optional-source-ref" data-testid="optional-source-ref" value={sourceReference}
      onChange={e=>{setSourceReference(e.target.value);reset();}} maxLength={160} placeholder="DOC-REFERENCE"
      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-sm"/>
    </label>
    <label className="text-xs" htmlFor="optional-source-date">
     {ar?'تاريخ مرجع البيانات':'Date of source data'}
     <input id="optional-source-date" data-testid="optional-source-date" type="date" value={sourceDate}
      onChange={e=>{setSourceDate(e.target.value);reset();}}
      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-sm"/>
    </label>
    {shown.map(key=><label key={key} className="text-xs" htmlFor={'optional-'+key}>
     {ar?FIELD_LABELS[key][0]:FIELD_LABELS[key][1]}
     <input id={'optional-'+key} data-testid={'optional-'+key}
      type="text" inputMode={SERIES_FIELDS.has(key)?'text':'decimal'}
      value={raw[key]||''} onChange={e=>updateField(key,e.target.value)}
      placeholder={SERIES_FIELDS.has(key)?'-100000; 50000; 60000':''}
      className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-sm"/>
    </label>)}
    {metric==='DISCOUNTED_PAYBACK'&&<>
     <label className="text-xs" htmlFor="optional-terminal-sale">
      {ar?'هل آخر تدفق يشمل بيع الأصل؟':'Does the final cash flow include a terminal sale?'}
      <select id="optional-terminal-sale" data-testid="optional-terminal-sale" value={terminalSale}
       onChange={e=>{setTerminalSale(e.target.value);reset();}}
       className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-sm">
       <option value="">{ar?'اختر صراحةً':'Select explicitly'}</option>
       <option value="no">{ar?'لا':'No'}</option>
       <option value="yes">{ar?'نعم':'Yes'}</option>
      </select>
     </label>
     {terminalSale==='yes'&&<label htmlFor="optional-terminalSaleYear" className="text-xs">
      {ar?FIELD_LABELS.terminalSaleYear[0]:FIELD_LABELS.terminalSaleYear[1]}
      <input id="optional-terminalSaleYear" data-testid="optional-terminalSaleYear"
       type="text" inputMode="numeric" value={raw.terminalSaleYear||''}
       onChange={e=>updateField('terminalSaleYear',e.target.value)}
       className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-sm"/>
     </label>}
    </>}
   </div>
   <label className="mt-4 flex items-start gap-2 text-xs">
    <input type="checkbox" data-testid="optional-user-attested" checked={userAttested}
     onChange={e=>{setUserAttested(e.target.checked);reset();}}/>
    {ar?'أقر بأن البيانات أُدخلت مني؛ ولا أزعم اعتماد المستند أو صحة المخرجات مهنيًا':
      'I entered these data; neither the source nor output is professionally verified'}
   </label>
   <button type="button" data-testid="optional-calculate" onClick={calculate} disabled={blocked}
    className="mt-4 min-h-[44px] rounded-lg border border-amber-500 px-4 py-2 text-sm disabled:opacity-50">
    {ar?'حساب المؤشر الاختياري':'Calculate optional indicator'}
   </button>
   {result&&<div role="status" data-testid="optional-result" data-status={result.status}
    data-value={result.value===null?'':String(result.value)}
    className="mt-3 rounded-lg border border-slate-500 p-3 text-sm">
    {result.status==='CALCULATED_UNVERIFIED'?
     <><strong>{display(result.value,metric,result.unit,locale)}</strong>
      <p className="mt-1 text-xs text-amber-200">{ar?'حساب غير موثق استقلاليًا — ليس تقييمًا أو توصية':'Unverified calculation — not an appraisal or recommendation'}</p></>:
     <p className="text-rose-300">{ar?'لا يمكن الحساب حتى تصحيح المدخلات وإقرار المصدر':'Cannot calculate until inputs and source declaration are corrected'} <code dir="ltr">{result.reasonCode}</code></p>}
   </div>}
  </details>
 </section>;
}
