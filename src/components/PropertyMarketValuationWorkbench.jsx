import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useAppraisalReviewSession} from './AppraisalReviewSessionContext.jsx';
const {TYPES,MAX_BYTES,label,freshPropertyMarketCase,evaluatePropertyMarketCase,
 createPropertyCaseArchive,restorePropertyCaseArchive,renderPropertyMarketReport}=require('../market/property-market-valuation-case');
const {evaluatePersonalReportExport}=require('../market/appraisal-report-export-gate');
const {EXPENSE_TREATMENT}=require('../valuation-intelligence/income-capitalization');
const control='mt-1 block w-full min-h-[44px] rounded-lg border border-slate-500 bg-slate-950 p-2 text-sm text-slate-100';
function Field({id,title,value,onChange,type='text',dateHint=''}){return <label className="block min-w-0 text-xs text-slate-200" htmlFor={id}>{title}
 <input id={id} data-testid={id} className={control} type={type==='date'?'text':type} placeholder={type==='date'?dateHint:undefined} inputMode={type==='date'?'numeric':undefined} value={value} onChange={e=>onChange(e.target.value)} dir={type==='date'?'ltr':'auto'}/></label>;}
function Select({id,title,value,onChange,options}){return <label className="block min-w-0 text-xs text-slate-200" htmlFor={id}>{title}
 <select id={id} data-testid={id} className={control} value={value} onChange={e=>onChange(e.target.value)}>
  {options.map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label>;}
function Check({id,title,value,onChange}){return <label className="flex min-h-[44px] items-center gap-2 text-xs text-slate-200">
 <input type="checkbox" data-testid={id} checked={value} onChange={e=>onChange(e.target.checked)}/>{title}</label>;}
export default function PropertyMarketValuationWorkbench({locale='ar-SA'}){
 const ar=locale!=='en',T=(a,b)=>ar?a:b;
 const [study,setStudy]=useState(freshPropertyMarketCase),[step,setStep]=useState(0),[result,setResult]=useState(null),[notice,setNotice]=useState('');
 const fileRef=useRef(null),operation=useRef(0);
 useEffect(()=>()=>{operation.current++;},[]);
 const {link}=useAppraisalReviewSession();
 const s=study.subject,m=study.mandate,c=study.capital;
 const exportGate=useMemo(()=>evaluatePersonalReportExport({subject:{name:s.name,assetType:s.assetType,landArea:s.landAreaSqm,valuationDate:s.valuationDate},link}),[s,link]);
 const update=(section,key,value)=>{operation.current++;setStudy(old=>({...old,[section]:{...old[section],[key]:value}}));setResult(null);setNotice('');};
 const setType=value=>{operation.current++;const next=freshPropertyMarketCase();next.subject.assetType=value;next.subject.scope=value==='LAND'?'LAND_ONLY':'LAND_AND_BUILDING';setStudy(next);setResult(null);setNotice('');};
 const field=(section,key,a,b,type='text')=><Field key={key} id={'property-case-'+section+'-'+key} title={T(a,b)} type={type} dateHint={T('سنة-شهر-يوم','Year-month-day')} value={study[section][key]} onChange={v=>update(section,key,v)}/>;
 const select=(section,key,a,b,options)=><Select key={key} id={'property-case-'+section+'-'+key} title={T(a,b)} value={study[section][key]} onChange={v=>update(section,key,v)} options={options.map(([v,a,b])=>[v,T(a,b)])}/>;
 const blank=['',T('غير محدد','Not specified')];
 const chooseOptions=items=>[blank,...items.map(([v,a,b])=>[v,T(a,b)])];
 const download=(body,name,mime)=>{const url=URL.createObjectURL(new Blob([body],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);};
 const exportInputs=()=>{try{download(JSON.stringify(createPropertyCaseArchive(study),null,2),'startak-property-market-inputs-v1.json','application/json');setNotice('INPUTS_SAVED');}catch{setNotice('FAILED');}};
 const importInputs=async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const id=++operation.current;
  try{if(file.size<=0||file.size>MAX_BYTES)throw Error('SIZE');const raw=JSON.parse(await file.text());
   if(id!==operation.current)return;
   const restored=restorePropertyCaseArchive(raw);setStudy(restored);setResult(null);setStep(0);setNotice('RESTORED');
  }catch{if(id===operation.current)setNotice('REJECTED');}
 };
 const calculate=()=>{try{setResult(evaluatePropertyMarketCase(study));setNotice('');}catch{setNotice('FAILED');setResult(null);}};
 const exportReport=()=>{try{if(!result||JSON.stringify(evaluatePropertyMarketCase(study))!==JSON.stringify(result))throw Error('STALE');
  download(renderPropertyMarketReport(study,{locale,link}),'startak-property-market-research.html','text/html;charset=utf-8');setNotice('REPORT_SAVED');
 }catch{setNotice('FAILED');}};
 const notices={INPUTS_SAVED:T('تم تنزيل المدخلات فقط؛ لا توجد نتيجة محفوظة أو موافقة مهنية.','Inputs downloaded only; no stored result or professional approval.'),
  RESTORED:T('استُعيدت المدخلات؛ أعد الحساب. البصمة ليست توقيعًا مهنيًا.','Inputs restored; recalculate. Digest is not a professional signature.'),
  REJECTED:T('رُفض الملف؛ لم تتغير الدراسة الحالية.','File rejected; current study unchanged.'),FAILED:T('تعذر الإجراء؛ راجع المدخلات أو التدقيق المرتبط.','Action failed; review inputs or linked appraisal.'),
  REPORT_SAVED:T('تم تنزيل مسودة بحثية بالقيم والنواقص؛ ليست تقرير تقييم معتمدًا.','Research draft downloaded with indications and gaps; not a certified appraisal.')};
 const patchComparable=(kind,index,key,value)=>{operation.current++;setStudy(old=>({...old,[kind]:{...old[kind],comparables:old[kind].comparables.map((row,i)=>i===index?{...row,[key]:value}:row)}}));setResult(null);setNotice('');};
 const comparableInputs=kind=><section className="mt-4 space-y-3" data-testid={'property-case-'+kind}>
  <h4 className="font-semibold text-amber-100">{kind==='sales'?T('شواهد البيع المستقلة','Independent sale comparables'):T('شواهد إيجار العقار كاملًا','Whole-property rental comparables')}</h4>
  <p className="text-xs leading-6 text-slate-300">{T('أدخل مبلغًا غير شامل الضريبة ومصدره وتاريخه. التسوية 0% تعني أنك اخترت عدم التسوية؛ تأكيد الملاءمة لا يثبت الشاهد خارجيًا.','Enter a tax-exclusive amount, source and date. A 0% adjustment is your explicit no-adjustment choice; confirming comparability is not external verification.')}</p>
  <Select id={'property-case-'+kind+'-weighting'} title={T('أوزان الشواهد بعد التسويات','Comparable weights after adjustments')} value={study[kind].weightingPolicy} onChange={v=>update(kind,'weightingPolicy',v)} options={chooseOptions([
   ['EQUAL','أختار أوزانًا متساوية لهذا الاختبار البحثي','I select equal weights for this research test']])}/>
  <Select id={'property-case-'+kind+'-unit'} title={T('وحدة المبالغ لجميع الشواهد','Amount unit for all comparables')} value={study[kind].unit} onChange={v=>update(kind,'unit',v)} options={[
   ['WHOLE_PROPERTY',kind==='sales'?T('ريال للعقار كاملًا','SAR per whole property'):T('ريال سنويًا للعقار كاملًا','SAR per whole property per year')],
   ['LAND_SQM',kind==='sales'?T('ريال لكل م² أرض','SAR per land sqm'):T('ريال لكل م² أرض سنويًا','SAR per land sqm per year')],
   ...(s.scope==='LAND_AND_BUILDING'?[['INDOOR_SQM',kind==='sales'?T('ريال لكل م² تأجيري داخلي','SAR per indoor leasable sqm'):T('ريال لكل م² تأجيري داخلي سنويًا','SAR per indoor leasable sqm per year')]]:[])]}/>
  {study[kind].comparables.map((row,i)=><fieldset key={i} className="rounded-lg border border-slate-600 p-3">
   <legend className="px-1 text-xs text-slate-200">{T('شاهد','Comparable')} {i+1}</legend>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {[['id','رقم الشاهد / العقد / الصفقة','Comparable / lease / sale ID','text'],['amountSar','المبلغ حسب الوحدة المحددة','Amount in selected unit','text'],['date','تاريخ الشاهد','Comparable date','date'],['sourceRef','المصدر والصفحة / شروط العقد والتسوية','Source and page / lease terms and adjustment','text'],['adjustmentPct','صافي التسوية (%)','Net adjustment (%)','text']].map(([key,a,b,type])=><Field key={key} id={'property-case-'+kind+'-'+i+'-'+key} title={T(a,b)} type={type} dateHint={T('سنة-شهر-يوم','Year-month-day')} value={row[key]} onChange={v=>patchComparable(kind,i,key,v)}/>)}
    <Select id={'property-case-'+kind+'-'+i+'-kind'} title={T('نوع الشاهد','Evidence kind')} value={row.kind} onChange={v=>patchComparable(kind,i,'kind',v)} options={chooseOptions([
     [kind==='sales'?'EXECUTED_SALE':'EXECUTED_LEASE',kind==='sales'?'صفقة بيع منفذة':'عقد إيجار مستقل',kind==='sales'?'Executed sale':'Independent executed lease'],
     ['ASKING','سعر عرض','Asking price'],['CAPITAL_VALUE_PERCENTAGE','إيجار مشتق من قيمة العقار','Rent derived from capital value']])}/>
    <Select id={'property-case-'+kind+'-'+i+'-taxBasis'} title={T('أساس ضريبة مبلغ الشاهد','Comparable amount tax basis')} value={row.taxBasis} onChange={v=>patchComparable(kind,i,'taxBasis',v)} options={chooseOptions([
     ['EXCLUSIVE','غير شامل الضريبة','Exclusive of tax'],['INCLUSIVE','شامل الضريبة','Inclusive of tax']])}/>
   </div>
   <Check id={'property-case-'+kind+'-'+i+'-scopeConfirmed'} title={T('راجعت ملاءمة النوع والموقع والحق والنطاق والحالة وشروط العقد والتسويات.','I reviewed type, location, interest, scope, condition, lease terms and adjustments.')} value={row.scopeConfirmed} onChange={v=>patchComparable(kind,i,'scopeConfirmed',v)}/>
  </fieldset>)}
 </section>;
 const money=n=>n===null?'—':new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:2}).format(n)+' '+T('ريال','SAR');
 const steps=[T('العقار والغرض','Property and purpose'),T('النطاق وشروط التأجير','Scope and lease terms'),T('شواهد البيع والإيجار','Sale and rental evidence'),T('النتيجة والنواقص','Indications and gaps')];
 return <section data-testid="property-market-workbench" dir={ar?'rtl':'ltr'} className="my-5 rounded-2xl border border-slate-600 bg-[#141F35] p-4 text-slate-100 md:p-5">
  <h3 className="text-base font-semibold text-amber-100">{T('القيمة السوقية للبيع وإيجار العقار كاملًا','Market value and whole-property market rent')}</h3>
  <p className="mt-2 text-xs leading-6 text-slate-300">{T('مخرجان مستقلان بتاريخ التقييم، غير شاملين الضريبة. تأجير العقار كاملًا هو الخيار الافتراضي؛ لا يُشتق الإيجار تلقائيًا من قيمة البيع.','Two independent indications as of the valuation date, exclusive of tax. Whole-property letting is the default; rent is never automatically derived from capital value.')}</p>
  <nav aria-label={T('خطوات التقييم','Valuation steps')} className="my-4 flex flex-wrap gap-2">
   {steps.map((title,i)=><button key={title} type="button" data-testid={'property-case-step-'+i} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)} className={'min-h-[44px] rounded-lg border px-3 py-2 text-xs '+(step===i?'border-amber-300 bg-slate-700':'border-slate-600')}>{i+1}. {title}</button>)}
  </nav>
  {step===0&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   <Select id="property-case-subject-assetType" title={T('نوع العقار','Property type')} value={s.assetType} onChange={setType} options={[blank,...Object.entries(TYPES).map(([id,names])=>[id,names[ar?0:1]])]}/>
   {field('subject','name','اسم العقار / رقم مرجعي','Property name / case reference')}
   {select('mandate','purpose','الغرض من التقييم','Valuation purpose',[
    ['', 'غير محدد','Not specified'],['SALE','البيع','Sale'],['RELETTING','إعادة التأجير','Reletting'],['MARKET_KNOWLEDGE','معرفة القيمة السوقية','Market knowledge']])}
   {field('subject','city','المدينة','City')}{field('subject','district','الحي','District')}
   {field('subject','valuationDate','تاريخ التقييم','Valuation date','date')}
   {field('subject','location','اللوكيشن: رابط خرائط أو عنوان','Location: map link or address')}
   {field('subject','latitude','خط العرض (اختياري)','Latitude (optional)')}{field('subject','longitude','خط الطول (اختياري)','Longitude (optional)')}
   {field('subject','landAreaSqm','مساحة الأرض · م²','Land area · sqm')}
   {select('subject','rightType','الحق المقيم','Interest valued',[
    ['','غير محدد','Not specified'],['FREEHOLD','ملكية كاملة غير مثقلة بعقد','Unencumbered freehold'],['LEASED_FEE','مصلحة المالك مع عقد قائم','Ownership subject to lease'],['LEASEHOLD','حق مستأجر محدود المدة','Limited leasehold'],['USUFRUCT','حق انتفاع','Usufruct']])}
   {field('subject','sourceRef','مرجع الصك / القطعة / المخطط وصفحته','Title / parcel / plan reference and page')}
   {s.rightType==='LEASED_FEE'&&field('subject','existingLeaseRef','العقد القائم: المدة المتبقية والزيادات والخروج والالتزامات','Existing lease: remaining term, escalations, breaks and obligations')}
   <p className="text-xs leading-6 text-slate-300 sm:col-span-2 lg:col-span-3">{T('الرابط المختصر يُحفظ كما هو دون فتحه أو إثبات حدود القطعة. استكمل الإحداثيات إن توفرت. تغيير نوع العقار يبدأ دراسة فارغة.','Short links are retained without resolving them or verifying parcel boundaries. Add coordinates when available. Changing property type starts a blank case.')}</p>
  </div>}
  {step===1&&<div className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {select('subject','scope','نطاق التقييم','Valuation scope',s.assetType==='LAND'?[['LAND_ONLY','أرض فقط','Land only']]:[['LAND_AND_BUILDING','أرض ومبنى قائم بحالته','Land and existing building as is'],['AS_VACANT_LAND','سيناريو أرض بعد إزالة المبنى','Hypothetical cleared-land scenario']])}
    {s.scope==='LAND_AND_BUILDING'&&field('subject','builtAreaSqm','مساحة البناء الداخلية · م²','Indoor built area · sqm')}
    {s.scope==='LAND_AND_BUILDING'&&field('subject','nlaSqm','المساحة التأجيرية الداخلية · م² (دون الساحات)','Indoor leasable area · sqm (excluding yards)')}
    {s.scope==='LAND_AND_BUILDING'&&select('subject','areaBasis','تعريف مساحة البناء في المصدر','Source definition of built area',[
     ['UNKNOWN','يحتاج مراجعة','Needs review'],['INDOOR_MEASURED','مساحة بناء داخلية مستقلة','Separate indoor built area'],['MIXED_ITEMS','إجمالي بنود يشمل ساحات / خزانات / مظلات','Mixed total including yards / tanks / canopies']])}
    {select('subject','operatingStatus','حالة الاستخدام / الإغلاق','Use / closure status',[
     ['UNKNOWN','غير معلومة','Unknown'],['OPEN','متاح للاستخدام وفق الشواهد','Available for use per evidence'],['CLOSED_OR_RESTRICTED','مغلق / مقيد الاستخدام','Closed / restricted use']])}
    {s.operatingStatus==='CLOSED_OR_RESTRICTED'&&field('subject','restrictedConditionRef','مرجع معالجة الإغلاق في قيمة الحالة الحالية','Reference for closure treatment in as-is value')}
    {select('mandate','lettingBasis','نموذج التأجير','Letting model',[
     ['WHOLE_PROPERTY','العقار كاملًا بعقد واحد','Whole property under one lease'],['MULTI_UNIT','تأجير مجزأ — يحتاج جدول عقود تفصيلي','Multi-unit — detailed rent roll required']])}
    {field('mandate','leaseTermYears','مدة عقد التأجير المفترض · سنوات','Assumed lease term · years')}
    {field('mandate','rentFreeMonths','السماح الإيجاري · أشهر (أدخل 0 إن لم يوجد)','Rent-free period · months (enter 0 if none)')}
    {select('mandate','expenseAllocation','توزيع مصروفات العقد المفترض','Assumed lease expense allocation',[
     ['','غير محدد','Not specified'],['LANDLORD','على المالك','Landlord'],['TENANT','على المستأجر وفق الشروط','Tenant per lease terms'],['SHARED','موزعة حسب الشروط','Shared per terms']])}
    {field('mandate','leaseTermsRef','شروط التسليم والصيانة والزيادات والخدمات / مصدرها','Handover, maintenance, escalations and services / source')}
    {s.scope==='AS_VACANT_LAND'&&field('landScenario','demolitionCostSar','تكلفة الإزالة والإخلاء والالتزامات · ريال','Demolition, clearance and obligations cost · SAR')}
    {s.scope==='AS_VACANT_LAND'&&field('landScenario','clearanceRef','مرجع قابلية الإزالة والحقوق والتوقيت','Clearance feasibility, rights and timing reference')}
   </div>
   {['HOTEL','FUEL_STATION','MIXED_USE'].includes(s.assetType)&&<Check id="property-case-non-real-estate" title={T('فصلت قيمة نشاط التشغيل والمركبات والمعدات المنقولة؛ تبقى التحسينات الثابتة بحسب الملكية والحق.','I separated operating business, vehicles and movable equipment; fixed improvements follow ownership and property rights.')} value={s.nonRealEstateExcluded} onChange={v=>update('subject','nonRealEstateExcluded',v)}/>}
   <details className="rounded-lg border border-slate-600 p-3"><summary className="min-h-[36px] text-sm">{T('مستندات وخصائص النوع العقاري','Property-type documents and attributes')}</summary>
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
     {field('sector','permitRef','مرجع الاستخدام المسموح ورخصة البناء','Permitted use and building permit reference')}
     {field('sector','inspectionRef','مرجع المعاينة الداخلية / الحالة والصيانة','Internal inspection / condition and maintenance reference')}
     {s.assetType==='FUEL_STATION'&&field('sector','environmentalRef','الخزانات وملكيتها والسلامة والتلوث / مرجعها','Tanks, ownership, safety and contamination / reference')}
     {['FUEL_STATION','HOTEL'].includes(s.assetType)&&field('sector','licenseRef','مرجع الترخيص / التصنيف وحالته','Operating licence / classification and status reference')}
     {s.assetType==='HOTEL'&&field('sector','rooms','عدد الغرف (وصف وليس دخل تشغيل المالك)','Room count (description, not owner operating revenue)')}
     {['HOTEL','RESIDENTIAL_BUILDING'].includes(s.assetType)&&field('sector','capacityRef','تصريح الإسكان الموسمي والطاقة المصرح بها إن انطبق','Seasonal accommodation permit and licensed capacity if applicable')}
     {['RESIDENTIAL_BUILDING','RESIDENTIAL_COMPLEX','MIXED_USE'].includes(s.assetType)&&field('sector','units','عدد المباني والوحدات وتوزيع الاستخدام','Building/unit count and use allocation')}
     {s.assetType==='WAREHOUSE'&&field('sector','clearHeightMeters','الارتفاع الصافي · م / التحميل والطاقة في مرجع المعاينة','Clear height · m / loading and power in inspection reference')}
    </div>
   </details>
  </div>}
  {step===2&&<div>
   {select('capital','method','طريقة مؤشر قيمة البيع','Capital indication method',[
    ['MARKET_COMPARABLE','مقارنات بيع','Sale comparison'],['INCOME_DIRECT_CAPITALIZATION','دخل عقاري مستقر ورسملة','Stable property income capitalization'],['COST_DEPRECIATED_REPLACEMENT','تكلفة أرض وتحسينات بعد التقادم','Land plus depreciated improvements']])}
   {c.method==='MARKET_COMPARABLE'&&comparableInputs('sales')}
   {c.method==='INCOME_DIRECT_CAPITALIZATION'&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
    {field('capital','grossIncomeSar','دخل العقار الفعال السنوي غير شامل الضريبة (بعد الشغور)','Annual effective property income excluding tax (after vacancy)')}
    {field('capital','ownerExpensesSar','مصروفات المالك السنوية · ريال','Annual owner expenses · SAR')}
    {field('capital','capRatePct','معدل الرسملة (%) مثال 7 وليس 0.07','Cap rate (%) e.g. 7, not 0.07')}
    {select('capital','expenseTreatment','مصدر توزيع المصروفات','Expense treatment',[
     ['','غير محدد','Not specified'],[EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX,'مصروفات مالك فعلية','Actual landlord costs'],[EXPENSE_TREATMENT.MARKET_ESTIMATE,'مصروفات تقديرية معلنة','Disclosed estimated costs'],[EXPENSE_TREATMENT.TENANT_BORNE_CONFIRMED,'يتحملها المستأجر بعقد','Contractually tenant-borne'],[EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED,'تحمل المستأجر افتراض فقط','Assumed tenant-borne']])}
    {select('capital','incomeOrigin','أصل دخل العقار','Property income origin',[
     ['','غير محدد','Not specified'],['CONTRACTUAL_PROPERTY_INCOME','عقد إيجار عقاري','Property lease'],['INDEPENDENT_MARKET_PROPERTY_INCOME','شواهد إيجارية مستقلة','Independent rental evidence'],['CAPITAL_VALUE_PERCENTAGE','نسبة من القيمة — لا تثبت القيمة نفسها','Percentage of value — cannot confirm that value']])}
    {field('capital','incomeSourceRef','مرجع الدخل والمصروفات غير شاملين الضريبة','Tax-exclusive income and expenses reference')}
    {field('capital','capRateSourceRef','شواهد معدل الرسملة وتاريخها','Cap rate evidence and date')}
    <Check id="property-case-stable-income" title={T('راجعت استقرار الدخل والعقود وعدم الحاجة لنموذج مدة أو رجوع أو تطوير.','I reviewed income stability, leases and need for a term, reversion or development model.')} value={c.stableIncomeConfirmed} onChange={v=>update('capital','stableIncomeConfirmed',v)}/>
   </div>}
   {c.method==='COST_DEPRECIATED_REPLACEMENT'&&<div className="mt-3 grid gap-3 sm:grid-cols-2">
    {field('capital','landValueSar','قيمة الأرض غير شاملة الضريبة · ريال','Land value exclusive of tax · SAR')}
    {field('capital','replacementCostSar','تكلفة إحلال التحسينات كاملة غير شاملة الضريبة · ريال','Total improvement replacement cost exclusive of tax · SAR')}
    {field('capital','depreciationPct','التقادم المبرر (%)','Supported depreciation (%)')}
    {field('capital','costSourceRef','مرجع الأرض والتكلفة والتقادم ووحدات البنود','Land, cost, depreciation and item-unit reference')}
    {select('capital','improvementOwner','ملكية التحسينات ضمن الحق المقيم','Improvement ownership within valued interest',[
     ['','غير محددة','Unknown'],['PROPERTY_OWNER','مالك العقار','Property owner'],['TENANT','المستأجر','Tenant'],['MIXED','مختلطة','Mixed']])}
   </div>}
   {comparableInputs('rents')}
  </div>}
  {step===3&&<div>
   <button type="button" data-testid="property-case-calculate" onClick={calculate} className="min-h-[44px] rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-100">{T('حساب المؤشرين وفحص النواقص','Calculate indications and review gaps')}</button>
   {result&&<div data-testid="property-case-result" data-status={result.status} className="mt-4 space-y-3">
    <p className="text-xs text-slate-300">{label('UNVERIFIED_RESEARCH_ONLY',locale)}</p>
    {exportGate.blocked&&<p role="alert" className="text-sm text-rose-200">{T('التدقيق المرتبط متوقف أو غير مطابق؛ حُجبت النتائج والتصدير.','Linked appraisal is held or unmatched; indications and report export are blocked.')}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
     {[['capital',T('مؤشر القيمة السوقية للبيع — غير شامل الضريبة','Capital market indication — exclusive of tax')],['rental',T('مؤشر الإيجار السوقي السنوي — غير شامل الضريبة','Annual market rent indication — exclusive of tax')]].map(([key,title])=><div key={key} className="rounded-lg border border-slate-500 p-3">
      <h4 className="text-xs text-slate-200">{title}</h4><strong data-testid={'property-case-'+key+'-amount'} className="mt-2 block text-lg">{exportGate.blocked?'—':money(result[key].amountSar)}</strong>
      <ul className="mt-2 space-y-1 text-xs text-amber-100">{result[key].reasons.map(code=><li key={code}>{label(code,locale)}</li>)}</ul>
     </div>)}
    </div>
    {s.scope==='AS_VACANT_LAND'&&<p className="text-xs text-amber-100">{T('سيناريو افتراضي لأرض بعد الإزالة؛ ليس قيمة المبنى بحالته أو إيجاره الحالي. تكلفة الإزالة تخص مؤشر البيع ولا تُخصم من إيجار سنة واحدة.','Hypothetical cleared-land scenario, not the standing building or its current rent. Clearance cost adjusts capital value, not one year of rent.')}</p>}
    <ul className="space-y-1 text-xs text-slate-300">{result.warnings.map(code=><li key={code}>{label(code,locale)}</li>)}</ul>
    {result.sectorGaps.length>0&&<div data-testid="property-case-sector-gaps" className="text-xs text-amber-100">
     <strong>{T('مستندات وخصائص تحتاج استكمالًا:','Documents and attributes still needed:')}</strong>
     <ul className="mt-1 space-y-1">{result.sectorGaps.map(row=><li key={row.field}>{row.labels[ar?0:1]}</li>)}</ul>
    </div>}
    <button type="button" data-testid="property-case-export-report" disabled={exportGate.blocked} onClick={exportReport} className="min-h-[44px] rounded-lg border border-slate-500 px-3 py-2 text-xs disabled:opacity-40">{T('تنزيل مسودة البحث بالقيم والنواقص','Download research draft with indications and gaps')}</button>
   </div>}
  </div>}
  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-600 pt-3">
   {step<3&&<button type="button" data-testid="property-case-next" onClick={()=>setStep(v=>v+1)} className="min-h-[44px] rounded-lg border border-amber-300 px-4 py-2 text-sm">{T('التالي','Next')}</button>}
   <button type="button" data-testid="property-case-save-inputs" onClick={exportInputs} className="min-h-[44px] rounded-lg border border-slate-500 px-3 py-2 text-xs">{T('تنزيل المدخلات للاستكمال','Download inputs to resume')}</button>
   <button type="button" data-testid="property-case-restore" onClick={()=>fileRef.current?.click()} className="min-h-[44px] rounded-lg border border-slate-500 px-3 py-2 text-xs">{T('استعادة مدخلات دراسة','Restore study inputs')}</button>
   <input ref={fileRef} data-testid="property-case-import" type="file" accept="application/json,.json" className="hidden" aria-label={T('ملف مدخلات الدراسة','Study input file')} onChange={importInputs}/>
   <button type="button" data-testid="property-case-reset" onClick={()=>{operation.current++;setStudy(freshPropertyMarketCase());setStep(0);setResult(null);setNotice('');}} className="min-h-[44px] rounded-lg border border-slate-500 px-3 py-2 text-xs">{T('عقار جديد','New property')}</button>
  </div>
  {notice&&<p role="status" data-testid="property-case-notice" className="mt-3 text-xs text-amber-100">{notices[notice]}</p>}
 </section>;
}
