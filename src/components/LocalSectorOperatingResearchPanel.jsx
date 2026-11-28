import React,{useState,useRef,useLayoutEffect} from 'react';
const {STATUS,SUPPORTED_SECTORS}=require('../specialized-assets/local-sector-operating-research');
const {SOURCE_FIELDS,MAX_BYTES,calculateStudy,createInputArchive,createOperatingReport,restoreStudyFile}=require('../specialized-assets/local-sector-operating-archive');
const {INDUSTRIAL_SUBTYPE,LEASE_STRUCTURE,INTERNAL_INSPECTION_STATUS,BUILDING_PERMIT_STATUS}=require('../valuation-intelligence/adapters/industrial-logistics');
const F=(key,ar,en,kind='number',options=null)=>({key,ar,en,kind,options});
const hotel=[
 F('availableRoomNights','الليالي المتاحة','Available room nights'),F('occupiedRoomNights','الليالي المشغولة','Occupied room nights'),
 F('roomsRevenueSar','دخل الغرف','Room revenue SAR'),F('foodBeverageRevenueSar','دخل الأغذية والمشروبات','Food and beverage revenue SAR'),
 F('otherOperatingRevenueSar','الإيرادات التشغيلية الأخرى','Other operating revenue SAR'),F('departmentalExpensesSar','مصروفات الأقسام','Departmental expenses SAR'),
 F('undistributedOperatingExpensesSar','مصروفات التشغيل غير الموزعة','Undistributed expenses SAR'),F('managementAndFranchiseFeesSar','رسوم الإدارة والامتياز','Management and franchise fees SAR'),F('ffeReserveSar','احتياطي الأثاث والمعدات','FF&E reserve SAR')];
const hotelSource=[
 F('sourceCurrency','عملة المصدر','Source currency','select',['SAR','OTHER']),
 F('sourceSurplusBasis','أساس الفائض الوارد في المصدر','Reported surplus basis','select',['AFTER_FFE_BEFORE_FIXED_CHARGES','OTHER']),
 F('sourceAdrDecimals','عدد المنازل العشرية في ADR (0–2)','Reported ADR decimal places (0–2)'),
 F('sourceAverageDailyRateSar','متوسط سعر الغرفة المبلّغ (ر.س)','Reported ADR SAR'),
 F('sourceRoomsRevenueSar','إيرادات الغرف المبلّغة (ر.س)','Reported room revenue SAR'),
 F('sourceTotalOperatingRevenueSar','إجمالي الإيرادات المبلّغ (ر.س)','Reported total revenue SAR'),
 F('sourceOperatingSurplusAfterFfeReserveSar','الفائض المبلّغ بعد احتياطي الأثاث والمعدات وقبل التكاليف الثابتة (ر.س)','Reported surplus after FF&E before fixed charges SAR')];
const industrial=[
 F('assetId','مرجع الأصل','Asset reference','text'),F('subtype','النوع الصناعي','Industrial subtype','select',Object.values(INDUSTRIAL_SUBTYPE)),
 F('customSubtype','وصف النوع الآخر','Other subtype description','text'),F('landAreaSqm','مساحة الأرض م²','Land area sqm'),F('builtAreaSqm','مساحة البناء م²','Built area sqm'),F('netLeasableAreaSqm','المساحة التأجيرية م²','Leasable area sqm'),
 F('clearHeightMeters','الارتفاع الصافي بالمتر','Clear height m'),F('powerCapacityKva','القدرة الكهربائية بالكيلو فولت أمبير','Power capacity kVA'),F('annualRentSar','إيجار العقار السنوي','Annual property rent SAR'),F('landlordExpensesSar','مصروفات المالك السنوية','Annual landlord expenses SAR'),
 F('leaseStructure','هيكل الإيجار','Lease structure','select',Object.values(LEASE_STRUCTURE)),F('internalInspectionStatus','حالة المعاينة المصرح بها','Declared inspection status','select',Object.values(INTERNAL_INSPECTION_STATUS)),F('buildingPermitStatus','حالة الرخصة المصرح بها','Declared permit status','select',Object.values(BUILDING_PERMIT_STATUS)),
 F('tenantOpexConfirmed','أقر بأن العقد يحمل المستأجر المصروفات','I declare the lease assigns expenses to the tenant','check')];
const fuel=[F('annualLitres','اللترات المباعة سنويًا','Annual litres sold'),F('sellingPricePerLitre','سعر بيع اللتر','Selling price SAR/litre'),F('purchaseCostPerLitre','تكلفة شراء اللتر','Purchase cost SAR/litre'),F('annualNonFuelRevenueSar','إيراد الأنشطة غير الوقودية','Annual non-fuel revenue SAR'),F('annualNonFuelDirectCostSar','تكلفتها المباشرة','Annual non-fuel direct cost SAR'),F('annualOperatingExpensesSar','مصروفات النشاط الأخرى دون الإيجار والاحتياطي','Other operating expenses excluding rent/reserve SAR'),F('annualPropertyRentSar','إيجار العقار السنوي على المشغل','Annual property rent paid by operator SAR'),F('annualEnvironmentalReserveSar','احتياطي المخاطر البيئية السنوي','Annual environmental reserve SAR'),F('nonFuelSeparated','فصلت النشاط غير الوقودي','Non-fuel activity separated','check'),F('propertyRentSeparated','فصلت الإيجار عن التشغيل','Property rent separately stated','check'),F('environmentalReviewDeclared','راجعت احتياجات المخاطر البيئية بحسب إقراري','Environmental reserve reviewed as declared','check')];
const special=[F('propertyRightRef','مرجع الحق العقاري','Property interest reference','text'),F('landValueSar','مبلغ الأرض المدخل','Declared land amount SAR'),F('replacementCostSar','تكلفة استبدال التحسينات','Improvement replacement cost SAR'),F('physicalLossSar','الفاقد المادي','Physical loss SAR'),F('functionalLossSar','التقادم الوظيفي','Functional loss SAR'),F('externalLossSar','التقادم الخارجي','External loss SAR'),F('lossCausesDistinct','أقر بعدم تكرار أسباب الفاقد','I declare distinct loss causes','check'),F('businessAssetsExcluded','استبعدت أصول النشاط','Business assets excluded','check')];
const mixed=[F('totalLeasableAreaSqm','إجمالي المساحة التأجيرية','Total leasable sqm'),F('commonExpensesSar','المصاريف المشتركة السنوية','Annual common expenses SAR'),F('sharedExpensesAllocatedOnce','أقر باحتساب المصروفات المشتركة مرة واحدة','Shared expenses counted once','check')];
const segmentFields=[F('id','معرّف الشريحة','Segment ID','text'),F('areaSqm','مساحة الشريحة','Segment area sqm'),F('annualPropertyRevenueSar','إيراد العقار السنوي','Annual property revenue SAR'),F('annualDirectExpensesSar','المصروفات المباشرة السنوية','Annual direct expenses SAR'),F('propertyIncomeOnly','دخل عقاري فقط','Property income only','check')];
const unitNames={HEALTHCARE:['سرير','beds'],EDUCATION:['مقعد','seats'],PARKING:['موقف','spaces'],DATA_CENTER:['ميجاوات تقنية','IT MW']};
const capacity=cls=>[F('capacity','الطاقة الإجمالية ('+unitNames[cls][0]+')','Total capacity ('+unitNames[cls][1]+')'),F('usedCapacity','الطاقة المستخدمة ('+unitNames[cls][0]+')','Used capacity ('+unitNames[cls][1]+')'),F('annualOperatingRevenueSar','إيراد النشاط السنوي','Annual operating revenue SAR'),F('annualOperatingExpensesSar','مصروفات النشاط السنوية','Annual operating expenses SAR')];
const issueLabels={
 SPECIALIST_SECTOR_UNSUPPORTED:['القطاع غير مدعوم','Sector unsupported'],INPUTS_REQUIRED:['المدخلات مطلوبة','Inputs required'],
 FUEL_STATION_OPERATING_INPUTS_INVALID:['راجع حجم المبيعات والأسعار والتكاليف وفصل الإيجار والأنشطة الأخرى والاحتياطي البيئي.','Check volumes, prices, costs, rent separation and environmental reserve.'],
 SOURCE_CURRENCY_OR_BASIS_UNQUALIFIED:['تحقق من عملة المصدر وأساس الفائض ودقة ADR.','Check source currency, surplus basis and ADR precision.'],
 SOURCE_REPORTED_VALUES_INCOMPLETE_OR_INVALID:['بيانات المصدر المبلّغة ناقصة أو غير صالحة.','Reported source values incomplete or invalid.'],
 SOURCE_ROOMS_REVENUE_MISMATCH:['إيرادات الغرف المبلّغة لا تطابق المدخلات.','Reported room revenue does not reconcile.'],
 SOURCE_ADR_REVENUE_MISMATCH:['متوسط سعر الغرفة المبلّغ لا يطابق الإيرادات والليالي المشغولة.','Reported ADR does not reconcile to revenue and occupied nights.'],
 SOURCE_TOTAL_REVENUE_MISMATCH:['إجمالي الإيرادات المبلّغ لا يطابق مكوناته.','Reported total revenue does not reconcile.'],
 SOURCE_OPERATING_SURPLUS_MISMATCH:['الفائض التشغيلي المبلّغ لا يطابق الإيرادات والمصروفات.','Reported operating surplus does not reconcile.'],
 HOTEL_OPERATING_INPUTS_INVALID:['راجع الليالي والإيرادات والمصروفات؛ لا يجوز تجاوز الليالي المتاحة.','Check nights, revenue and expenses; occupied nights cannot exceed available nights.'],
 INDUSTRIAL_OPERATING_INPUTS_INVALID:['راجع المساحات والقدرة والارتفاع والعقد والإيراد والمصروفات.','Check areas, power, height, lease, income and expenses.'],
 INDUSTRIAL_ZERO_OPEX_REQUIRES_CONFIRMED_LEASE:['صفر مصروفات يتطلب عقدًا يحملها المستأجر وإقرارًا صريحًا.','Zero expenses require an explicitly declared tenant-borne lease.'],
 INDUSTRIAL_SPEC_INVALID:['المواصفات الصناعية غير صالحة.','Industrial specification invalid.'],
 CAPACITY_OPERATING_INPUTS_INVALID:['راجع الطاقة والاستخدام والإيرادات والمصروفات.','Check capacity, utilization, revenue and expenses.'],
 MIXED_USE_SEGMENT_INPUTS_INVALID:['أكمل بيانات الشرائح وفصل الدخل وتوزيع المصروفات.','Complete segments, income separation and expense allocation.'],
 MIXED_USE_AREA_NOT_RECONCILED:['مجموع مساحات الشرائح لا يطابق الإجمالي.','Segment areas do not reconcile to the total.'],
 SPECIAL_PURPOSE_COST_INPUTS_INVALID:['راجع الحق العقاري والتكلفة وأنواع الفاقد.','Check property interest, cost and loss causes.'],
 SPECIAL_PURPOSE_LOSS_EXCEEDS_COST:['الفاقد يتجاوز تكلفة التحسينات.','Loss exceeds improvement cost.']};
const metricsLabels={
 fuelRevenueSar:['إيرادات الوقود','Fuel sales','sar'],fuelMarginSar:['هامش الوقود','Fuel contribution','sar'],nonFuelMarginSar:['هامش الأنشطة الأخرى','Non-fuel contribution','sar'],contributionPerLitreSar:['هامش اللتر','Contribution per litre','sar'],
 occupancyRate:['الإشغال','Occupancy','pct'],averageDailyRateSar:['متوسط أجرة الغرفة ADR','ADR','sar'],revParSar:['إيراد الغرفة المتاحة RevPAR','RevPAR','sar'],
 totalOperatingRevenueSar:['إجمالي إيرادات النشاط','Total operating revenue','sar'],grossOperatingProfitBeforeOperatorFeesSar:['الربح التشغيلي قبل رسوم المشغل','GOP before operator fees','sar'],operatingSurplusAfterFfeReserveSar:['الفائض بعد احتياطي الأثاث والمعدات (ليس NOI العقار)','Surplus after FF&E (not property NOI)','sar'],
 coverageRatio:['نسبة مساحة البناء إلى الأرض','Built-to-land area ratio','pct'],leasableEfficiency:['كفاءة المساحة التأجيرية','Leasable efficiency','pct'],annualRentPerLeasableSqm:['الإيجار السنوي للمتر التأجيري','Annual rent per leasable sqm','sar'],declaredNetPropertyIncomeSar:['صافي دخل عقاري مصرح به، غير متحقق','Declared property net income, unverified','sar'],operationalSpecCompleteness:['اكتمال المواصفات المدخلة (ليس دقة التقييم)','Spec completeness (not valuation accuracy)','pct'],
 utilizationRate:['نسبة استخدام الطاقة','Capacity utilization','pct'],operatingRevenuePerCapacitySar:['إيراد النشاط لكل وحدة طاقة','Operating revenue per capacity unit','sar'],operatingSurplusSar:['فائض النشاط (ليس NOI العقار)','Operating surplus (not property NOI)','sar'],
 segmentCount:['عدد الشرائح','Segments','num'],totalLeasableAreaSqm:['المساحة التأجيرية','Leasable area','num'],totalPropertyRevenueSar:['إيراد العقار الكلي','Total property revenue','sar'],totalPropertyExpensesSar:['مصروفات العقار الكلية','Total property expenses','sar'],
 totalDeclaredLossSar:['إجمالي الفاقد المصرح به','Declared total loss','sar'],remainingImprovementCostSar:['تكلفة التحسينات المتبقية','Remaining improvement cost','sar'],declaredLandAmountSar:['مبلغ الأرض المصرح به','Declared land amount','sar']};
const optionAr={SAR:'ريال سعودي',AFTER_FFE_BEFORE_FIXED_CHARGES:'بعد احتياطي الأثاث والمعدات وقبل التكاليف الثابتة',WAREHOUSE:'مستودع',DISTRIBUTION_CENTER:'مركز توزيع',COLD_STORAGE:'تبريد',LIGHT_INDUSTRIAL:'صناعي خفيف',FACTORY:'مصنع',WORKSHOP:'ورشة',YARD:'ساحة',OTHER:'آخر',GROSS:'إجمالي',NET:'صافي',TRIPLE_NET:'صافي ثلاثي',TENANT_BORNE_OPEX:'مصروفات على المستأجر',UNKNOWN:'غير محدد',FULL_INTERNAL:'داخلية كاملة',LIMITED_INTERNAL:'داخلية محدودة',EXTERNAL_ONLY:'خارجية فقط',NOT_INSPECTED:'لم تتم المعاينة',VERIFIED:'مراجعة بحسب الإقرار',PROVIDED_UNVERIFIED:'مقدمة غير متحققة',MISSING:'غير متوفرة',NOT_APPLICABLE:'لا تنطبق'};
export default function LocalSectorOperatingResearchPanel({assetClass,locale='ar-SA'}){
 const ar=locale!=='en',[values,setValues]=useState({}),[segments,setSegments]=useState([{},{}]),[output,setOutput]=useState(null);
 const [notice,setNotice]=useState(''),epoch=useRef(0),fileRef=useRef(null),mounted=useRef(true);
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 const invalidate=()=>{epoch.current++;setOutput(null);setNotice('');};
 const state=()=>({assetClass,values,segments:assetClass==='MIXED_USE'?segments:[]});
 if(!SUPPORTED_SECTORS.includes(assetClass))return null;
 const fields=assetClass==='HOSPITALITY'?hotel:assetClass==='INDUSTRIAL_LOGISTICS'?industrial:assetClass==='MIXED_USE'?mixed:assetClass==='SPECIAL_PURPOSE'?special:assetClass==='FUEL_STATION'?fuel:capacity(assetClass);
 const input=(field,raw,change,prefix='')=>{
  const id='specialist-'+prefix+field.key,label=ar?field.ar:field.en;
  const style={background:'#F4F5F5',color:'#192336'};
  return <label key={id} className="block text-xs text-slate-200">{label}
   {field.kind==='check'?<input data-testid={id} type="checkbox" className="ms-2" checked={raw===true} onChange={e=>change(e.target.checked)}/>:field.kind==='select'?<select data-testid={id} className="block w-full p-2 mt-1 rounded-md" style={style} value={raw??''} onChange={e=>change(e.target.value)}><option value="">{ar?'اختر':'Select'}</option>{field.options.map(o=><option key={o} value={o}>{ar?(optionAr[o]||o):o.replaceAll('_',' ')}</option>)}</select>:<input data-testid={id} className="block w-full p-2 mt-1 rounded-md" style={style} inputMode={field.kind==='number'?'decimal':'text'} value={raw??''} onChange={e=>change(e.target.value)}/>}
  </label>;
 };
 const calculate=()=>{epoch.current++;setNotice('');try{setOutput(calculateStudy(state()));}catch{setOutput({status:STATUS.HOLD,issues:['INPUTS_REQUIRED'],metrics:null});}};
 const notices={
  INPUTS_EXPORTED:['أُنشئ ملف المدخلات فقط؛ لا يتضمن نتيجة أو صلاحية.','Inputs-only file created; no result or authority included.'],
  REPORT_EXPORTED:['أُنشئ تقرير بحث تشغيلي غير معتمد بعد إعادة الحساب.','Unverified operating research report created after recomputation.'],
  INPUTS_RESTORED:['استُعيدت المدخلات فقط. أعد الحساب.','Inputs restored only. Recalculate.'],
  REPORT_RESTORED:['طابقت إعادة الحساب التقرير؛ استُعيدت المدخلات فقط. أعد الحساب.','Report recomputation matched; inputs only restored. Recalculate.'],
  REJECTED:['تعذر التحقق من الملف أو نوع القطاع أو النتيجة. بقيت المدخلات دون تغيير.','File, sector or result validation failed. Inputs unchanged.'],
  EXPORT_FAILED:['تعذر إنشاء الملف. تحقق من المدخلات وأعد الحساب قبل تصدير النتائج.','Could not create file. Check inputs and recalculate before exporting results.']};
 const download=(report)=>{
  epoch.current++;setNotice('');
  try{
   const file=report?createOperatingReport(state()):createInputArchive(state());
   if(report&&(!output||JSON.stringify(output)!==JSON.stringify(file.result)))throw Error('STALE_RESULT');
   const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='startak-specialist-'+assetClass.toLowerCase()+(report?'-report.json':'-inputs.json');
   try{document.body.appendChild(a);a.click();}finally{a.remove();URL.revokeObjectURL(url);}
   setNotice(report?'REPORT_EXPORTED':'INPUTS_EXPORTED');
  }catch{setNotice('EXPORT_FAILED');}
 };
 const restore=async e=>{
  const file=e.target.files?.[0];if(fileRef.current)fileRef.current.value='';if(!file)return;
  const op=++epoch.current;setNotice('');
  const current=()=>mounted.current&&epoch.current===op;
  try{
   if(file.size<=0||file.size>MAX_BYTES)throw Error('SIZE');
   const raw=await file.arrayBuffer();if(!current())return;
   const result=restoreStudyFile(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),{expectedAssetClass:assetClass});
   if(!current())return;
   setValues(result.studyInputs.values);setSegments(assetClass==='MIXED_USE'?result.studyInputs.segments:[{},{}]);setOutput(null);
   setNotice(result.sourceKind==='RECOMPUTED_REPORT'?'REPORT_RESTORED':'INPUTS_RESTORED');
  }catch{if(current())setNotice('REJECTED');}
 };
 const fmt=(v,kind)=>new Intl.NumberFormat(ar?'ar-SA':'en-SA',kind==='pct'?{style:'percent',maximumFractionDigits:2}:{maximumFractionDigits:2}).format(v)+(kind==='sar'?(ar?' ر.س':' SAR'):'');
 return <section data-testid={assetClass==='FUEL_STATION'?'fuel-station-operating-research':'local-sector-operating-research'} dir={ar?'rtl':'ltr'} className="mt-4 rounded-xl border border-slate-600 p-3">
  <h4 className="font-semibold text-sm text-amber-200">{assetClass==='FUEL_STATION'?(ar?'محرك تشغيل محطات الوقود':'Fuel station operating research'):(ar?'محرك التحليل التشغيلي التخصصي':'Specialist operating research engine')}</h4>
  <p className="text-xs mt-2 text-slate-300">{ar?'أدخل بيانات الفترة نفسها. هذه مؤشرات بحثية محلية لا تثبت صحة المصدر، ولا تنقل فائض النشاط إلى صافي دخل العقار أو قيمة التقييم تلقائيًا.':'Use figures from the same period. Local research diagnostics only; no source certification or automatic adoption of operating surplus as property NOI or value.'}</p>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">{fields.map(f=>input(f,values[f.key],v=>{invalidate();setValues(old=>({...old,[f.key]:v}));} ))}</div>
  {assetClass==='HOSPITALITY'&&<fieldset className="mt-4 rounded border border-slate-600 p-3"><legend className="text-xs text-slate-200">{ar?'مطابقة بيانات المصدر (اختيارية)':'Source reconciliation (optional)'}</legend>
   <p className="text-xs text-slate-300">{ar?'أدخل القيم كما وردت في المصدر دون تحويل أو تخمين. إذا أدخلت أي حقل، يلزم اكتمال المطابقة؛ واترك ADR فارغًا فقط عند انعدام الليالي المشغولة.':'Enter figures as reported without conversion or inference. Any source field activates the full reconciliation; leave ADR blank only for zero occupied nights.'}</p>
   <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">{hotelSource.map(f=>input(f,values[f.key],v=>{invalidate();setValues(old=>({...old,[f.key]:v}));}))}</div>
   {SOURCE_FIELDS.some(k=>Object.hasOwn(values,k))&&<button type="button" data-testid="specialist-clear-source" className="mt-2 border rounded p-2 text-xs" onClick={()=>{invalidate();setValues(old=>Object.fromEntries(Object.entries(old).filter(([k])=>!SOURCE_FIELDS.includes(k))));}}>{ar?'مسح بيانات المطابقة الاختيارية':'Clear optional reconciliation inputs'}</button>}
  </fieldset>}
  {assetClass==='MIXED_USE'&&<div className="mt-3 space-y-3">{segments.map((seg,i)=><div key={i} className="border border-slate-600 rounded p-2"><div className="text-xs">{ar?'الشريحة':'Segment'} {i+1}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{segmentFields.map(f=>input(f,seg[f.key],v=>{invalidate();setSegments(old=>old.map((s,j)=>i===j?{...s,[f.key]:v}:s));},'segment-'+i+'-'))}</div></div>)}<div className="flex flex-wrap gap-2"><button type="button" data-testid="specialist-add-segment" disabled={segments.length>=20} onClick={()=>{invalidate();setSegments(s=>[...s,{}]);}} className="border rounded p-2 text-xs">{ar?'إضافة شريحة':'Add segment'}</button><button type="button" data-testid="specialist-remove-segment" disabled={segments.length<=2} onClick={()=>{invalidate();setSegments(s=>s.slice(0,-1));}} className="border rounded p-2 text-xs">{ar?'حذف آخر شريحة':'Remove last segment'}</button></div></div>}
  <button type="button" data-testid="specialist-calculate" onClick={calculate} className="mt-4 p-3 rounded-lg bg-slate-100 text-slate-900 text-sm">{ar?'احسب المؤشرات التخصصية':'Calculate specialist metrics'}</button>
  {output&&<div data-testid="specialist-result" data-status={output.status} role="status" className="mt-3 text-xs">
   {output.status===STATUS.HOLD?<ul className="text-amber-200 list-disc ps-4">{output.issues.map(code=><li key={code}>{issueLabels[code]?.[ar?0:1]||code}</li>)}</ul>:<><div className="text-slate-200">{ar?'مؤشرات تشغيلية غير معتمدة':'Unverified operating diagnostics'}</div>{output.metrics.sourceReconciliationStatus==='ARITHMETICALLY_CONSISTENT'&&<p data-testid="specialist-source-reconciliation" className="mt-2 text-slate-200">{ar?'مطابقة حسابية لبيانات المصدر؛ لا تثبت أصالته.':'Source arithmetic reconciled; authenticity is not established.'}</p>}<dl className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">{Object.entries(output.metrics).filter(([k,v])=>metricsLabels[k]&&typeof v==='number').map(([k,v])=><div key={k} className="border border-slate-600 rounded p-2"><dt>{metricsLabels[k][ar?0:1]}</dt><dd data-testid={'specialist-metric-'+k} className="font-semibold mt-1">{fmt(v,metricsLabels[k][2])}</dd></div>)}</dl>{assetClass==='INDUSTRIAL_LOGISTICS'&&<p className="mt-2 text-amber-200">{ar?'المعاينة والرخص والالتزامات البيئية ومواصفات الأصل تحتاج مراجعة مستقلة.':'Inspection, permits, environmental liabilities and specifications require independent review.'}</p>}</>}
  </div>}
  <div className="mt-4 border-t border-slate-600 pt-3 space-y-2">
   <p className="text-xs text-slate-300">{ar?'ملفات محلية غير مشفرة. احفظها في مكان آمن. بصمة SHA-256 للتحقق من الاتساق وليست توقيعًا رقميًا أو إثباتًا لهوية المصدر.':'Local files are not encrypted. Store securely. SHA-256 checks consistency; it is not a digital signature or proof of source identity.'}</p>
   <div className="flex flex-wrap gap-2">
    <button type="button" data-testid="specialist-export-inputs" onClick={()=>download(false)} className="border rounded p-2 text-xs">{ar?'حفظ المدخلات JSON':'Save inputs JSON'}</button>
    <button type="button" data-testid="specialist-export-report" disabled={output?.status!==STATUS.READY} onClick={()=>download(true)} className="border rounded p-2 text-xs disabled:opacity-50">{ar?'تصدير تقرير بحثي JSON':'Export research report JSON'}</button>
    <button type="button" data-testid="specialist-import-button" onClick={()=>fileRef.current?.click()} className="border rounded p-2 text-xs">{ar?'استعادة المدخلات من ملف':'Restore inputs from file'}</button>
    <input type="file" ref={fileRef} data-testid="specialist-import-file" accept=".json,application/json" className="hidden" onChange={restore}/>
   </div>
   {notice&&<p data-testid="specialist-file-notice" role="status" className="text-xs text-slate-200">{notices[notice]?.[ar?0:1]}</p>}
  </div>
  <p data-testid="specialist-authority-hold" className="text-xs mt-3 text-amber-200">{ar?'الاعتماد المهني والتصدير الرسمي والقرار الاستثماري: معلّق.':'Professional valuation, official export and investment authorization: HOLD.'}</p>
 </section>;
}
