'use strict';
// Intake/orchestration only: reuse the existing comparison, cost and income engines.
// User-entered evidence never grants market verification or professional certification.
const {number}=require('./appraisal-assurance');
const {BASIS_OF_VALUE,EVIDENCE_GRADE,INPUT_STATUS}=require('../valuation-intelligence/contracts');
const {createComparable,calculateMarketComparableIndication,WEIGHTING_POLICY}=require('../valuation-intelligence/market-comparables');
const {calculateDirectCapitalization,EXPENSE_TREATMENT}=require('../valuation-intelligence/income-capitalization');
const {calculateDepreciatedReplacementCost}=require('../valuation-intelligence/cost-approach');
const {sha256Hex}=require('../crypto/sha256');
const {assertPersonalReportExportAllowed}=require('./appraisal-report-export-gate');
const VERSION='PROPERTY_MARKET_CASE_V1';
const MAX_BYTES=128*1024;
const TYPES=Object.freeze({
 LAND:['أرض','Land'],WAREHOUSE:['مستودع','Warehouse'],HOTEL:['فندق','Hotel'],
 COMMERCIAL_BUILDING:['مبنى تجاري / معرض / مكاتب','Commercial building / showroom / office'],
 MALL:['مول / مركز تجاري','Mall / shopping centre'],RESIDENTIAL_BUILDING:['عمارة سكنية','Residential building'],
 RESIDENTIAL_COMPLEX:['مجمع عمائر سكنية','Residential complex'],MIXED_USE:['عقار متعدد الاستخدامات','Mixed-use property'],
 FUEL_STATION:['محطة وقود','Fuel station'],VEHICLE:['مركبة / معدات منقولة — خارج التقييم العقاري','Vehicle / movable equipment — separate valuation'],
});
const REASONS=Object.freeze({
 IDENTITY_REQUIRED:['أكمل اسم العقار ونوعه ومدينته وحيه وتاريخ التقييم.','Complete property name, type, city, district and valuation date.'],
 PURPOSE_REQUIRED:['حدد الغرض: بيع أو إعادة تأجير أو معرفة القيمة.','Choose sale, reletting or market knowledge.'],
 LOCATION_REQUIRED:['أدخل العنوان أو رابط خرائط مدعومًا أو إحداثيات صحيحة.','Enter an address, supported map link or valid coordinates.'],
 MAP_NOT_VERIFIED:['رابط الموقع لا يثبت حدود القطعة؛ طابقه بالصك والمخطط.','A map link does not verify parcel boundaries; check title and survey.'],
 SHORT_MAP_LINK:['الرابط مختصر؛ لم يُفتح تلقائيًا ولم تُثبت إحداثياته.','Short map link retained; it was not automatically resolved or geocoded.'],
 LAND_AREA_REQUIRED:['مساحة الأرض غير متوفرة أو غير صالحة.','Land area is missing or invalid.'],
 BUILT_AREA_REQUIRED:['أدخل مساحة البناء مستقلة عن مساحة الأرض.','Enter built area separately from land area.'],
 AREA_CONFLICT:['المساحة التأجيرية الداخلية غير صالحة أو تتجاوز البناء.','Indoor leasable area is invalid or exceeds built area.'],
 MIXED_AREA_UNITS:['مصدر المساحة يجمع تجهيز موقع ومظلات وخزانات أو وحدات مختلفة؛ استخرج مساحة البناء الداخلية وحدها.','Area source combines site works, canopies, tanks or mixed units; establish indoor built area separately.'],
 SCOPE_REQUIRED:['حدد أرضًا فقط أو أرضًا ومبنى أو سيناريو أرض بعد الإزالة.','Choose land only, land and building, or a cleared-land scenario.'],
 RIGHTS_REQUIRE_REVIEW:['الحق غير محدد أو محدود؛ استخدم نموذج الحقوق والتدفقات التفصيلي.','Unknown or limited interest requires the detailed rights/cash-flow model.'],
 EXISTING_LEASE_REQUIRED:['قيمة مصلحة المالك المؤجرة تحتاج مرجع العقد القائم ومدته والتزاماته.','Leased ownership value needs the existing lease, remaining term and obligations reference.'],
 TAX_POLICY_INVALID:['هذه الرحلة تعرض القيم غير شاملة الضريبة فقط.','This journey reports amounts exclusive of tax only.'],
 NON_REAL_ESTATE_SCOPE:['المركبات والمعدات المنقولة تحتاج مسار تقييم مستقلًا عن العقار.','Vehicles and movable equipment need a separate non-property valuation.'],
 BUSINESS_SEPARATION_REQUIRED:['افصل نشاط التشغيل والمركبات والمعدات المنقولة عن حق العقار.','Separate operating business, vehicles and movable equipment from real property.'],
 SOURCE_REVIEW_REQUIRED:['مراجع الملكية والمعاينة والتراخيص تحتاج استكمالًا ومراجعة.','Title, inspection and permit references need completion and review.'],
 LEASE_TERMS_REQUIRED:['أكمل مدة التأجير والسماح وتوزيع المصروفات ومرجع شروط العقد المفترض.','Complete lease term, rent-free months, expense allocation and assumed lease-terms reference.'],
 MULTI_UNIT_RENT_ROLL_REQUIRED:['التأجير المجزأ يحتاج جدول عقود وتسوية شغور وخدمات؛ استخدم المسار التفصيلي.','Multi-unit letting needs a rent roll, vacancy and service reconciliation in the detailed workflow.'],
 COMPARABLES_REQUIRED:['يلزم ثلاثة شواهد مستقلة مدخلة لهذا الاختبار البحثي؛ ليست عتبة كفاية مهنية عامة.','This research protocol needs three separately entered comparables; this is not a universal professional sufficiency threshold.'],
 WEIGHTING_REQUIRED:['اختر الأوزان المتساوية صراحة لهذا الاختبار، أو انتقل للمقارنات التفصيلية بأوزان مبررة.','Explicitly select equal weights for this research test, or use detailed comparables with supported weights.'],
 COMPARABLE_INVALID:['راجع رقم الشاهد ومبلغه وتاريخه ومصدره وتكراره ونوعه.','Check comparable ID, amount, date, source, duplicate or transaction kind.'],
 COMPARABLE_SCOPE_REQUIRED:['أكد ملاءمة النوع والموقع والحق والنطاق والشروط والتسويات لكل شاهد.','Confirm type, location, interest, scope, lease terms and adjustments for each comparable.'],
 COMPARABLE_TAX_REQUIRED:['الشاهد شامل الضريبة أو غير معلوم؛ أدخل مبلغًا موثقًا غير شاملها.','Comparable tax basis is inclusive or unknown; supply an evidenced tax-exclusive amount.'],
 COMPARABLE_DERIVED:['لا يستخدم إيجار مشتق من قيمة العقار كشاهد إيجاري مستقل.','Rent derived from capital value cannot be an independent rental comparable.'],
 COMPARISON_UNIT_INVALID:['اختر وحدة مناسبة للنطاق؛ لا تستخدم مساحة البناء للمقارنة بأرض.','Choose a scope-appropriate comparison unit; built area cannot price land comparables.'],
 CLOSED_RENT_REVIEW:['العقار مغلق / مقيد؛ لا يصدر إيجار استخدام عادي دون معالجة القيد.','Closed/restricted property cannot receive an unrestricted-use rental indication.'],
 CLOSED_AS_IS_REVIEW:['يجب أن تعكس مقارنات البيع الإغلاق أو القيد والحالة الحالية.','Sale comparables must reflect the closure/restriction and as-is condition.'],
 INCOME_INPUTS_REQUIRED:['أكمل دخل العقار الصافي من الضريبة ومصروفاته ومعدل الرسملة ومراجعها.','Complete tax-exclusive property income, owner costs, cap rate and supporting references.'],
 STABLE_INCOME_REQUIRED:['الرسملة المباشرة تتطلب دخلًا مستقرًا ومعالجة العقود؛ وإلا استخدم التدفقات التفصيلية.','Direct capitalization requires stable income and reviewed leases; otherwise use detailed DCF.'],
 COST_INPUTS_REQUIRED:['أكمل قيمة الأرض وتكلفة البناء والتقادم وملكية التحسينات ومصدرها.','Complete land value, replacement cost, depreciation, improvement ownership and evidence.'],
 LAND_METHOD_REQUIRED:['الأرض تقارن بأرض؛ لا تضف تكلفة مبنى إلى نطاق أرض فقط.','Land requires land evidence; do not add building cost to a land-only scope.'],
 CLEARANCE_REQUIRED:['سيناريو الأرض بعد الإزالة يحتاج تكلفة إزالة وإخلاء ومرجع قابلية التنفيذ.','Cleared-land scenario requires clearance/demolition cost and feasibility evidence.'],
 EQUIPMENT_AND_ENVIRONMENT_REVIEW:['للمحطة: راجع الخزانات وملكيتها والسلامة والبيئة؛ لا تجمع وحدات القياس كمساحة بناء.','For fuel stations, review tanks, ownership, safety and environment; do not sum mixed units as built area.'],
 CAPACITY_AND_LICENSE_REVIEW:['راجع حالة الترخيص والتصنيف والطاقة المصرح بها والاستخدام الموسمي.','Review licence status, classification, permitted capacity and seasonal use.'],
 UNVERIFIED_RESEARCH_ONLY:['النتيجة بحثية من مدخلات المستخدم؛ ليست تقييمًا مهنيًا معتمدًا أو دقة سوقية مثبتة.','User-input research indication; not a certified appraisal or demonstrated market accuracy.'],
});
const label=(code,locale='ar-SA')=>REASONS[code]?.[locale==='en'?1:0]||code;
const text=x=>typeof x==='string'?x.trim():'';
const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||'')&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const positive=x=>number(x)!==null&&number(x)>0;
const nonnegative=x=>number(x)!==null&&number(x)>=0;
const descriptor=ref=>({grade:EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED,status:INPUT_STATUS.UNVERIFIED,sourceType:'USER_ENTERED_REFERENCE',sourceRef:text(ref)||null});
function comparableRow(){return {id:'',amountSar:'',date:'',sourceRef:'',kind:'',adjustmentPct:'',taxBasis:'',scopeConfirmed:false};}
function freshPropertyMarketCase(){return {
 version:VERSION,
 subject:{name:'',assetType:'',city:'',district:'',location:'',latitude:'',longitude:'',valuationDate:'',
  landAreaSqm:'',builtAreaSqm:'',nlaSqm:'',areaBasis:'UNKNOWN',rightType:'',scope:'',operatingStatus:'UNKNOWN',
  nonRealEstateExcluded:false,sourceRef:'',existingLeaseRef:'',restrictedConditionRef:''},
 mandate:{purpose:'',lettingBasis:'WHOLE_PROPERTY',taxBasis:'EXCLUSIVE',leaseTermYears:'',rentFreeMonths:'',expenseAllocation:'',leaseTermsRef:''},
 capital:{method:'MARKET_COMPARABLE',grossIncomeSar:'',ownerExpensesSar:'',capRatePct:'',expenseTreatment:'',incomeSourceRef:'',capRateSourceRef:'',incomeOrigin:'',stableIncomeConfirmed:false,
  landValueSar:'',replacementCostSar:'',depreciationPct:'',costSourceRef:'',improvementOwner:''},
 sales:{unit:'WHOLE_PROPERTY',weightingPolicy:'',comparables:Array.from({length:3},comparableRow)},
 rents:{unit:'WHOLE_PROPERTY',weightingPolicy:'',comparables:Array.from({length:3},comparableRow)},
 sector:{permitRef:'',inspectionRef:'',environmentalRef:'',licenseRef:'',capacityRef:'',clearHeightMeters:'',units:'',rooms:''},
 landScenario:{demolitionCostSar:'',clearanceRef:''},
 };}
// Whitelist import/export shape, preserving unknown values as blank, never zero.
function copyInputs(input){
 const template=freshPropertyMarketCase();
 if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==VERSION)throw Error('PROPERTY_CASE_INVALID');
 function copy(sample,value){
  if(Array.isArray(sample)){
   if(!Array.isArray(value)||value.length>20)throw Error('PROPERTY_CASE_INVALID');
   return value.map(row=>copy(comparableRow(),row));
  }
  if(sample&&typeof sample==='object'){
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('PROPERTY_CASE_INVALID');
   if(Object.keys(value).some(k=>!Object.hasOwn(sample,k)))throw Error('PROPERTY_CASE_INVALID');
   return Object.fromEntries(Object.entries(sample).map(([k,v])=>[k,copy(v,value[k])]));
  }
  if(typeof sample==='boolean'){if(typeof value!=='boolean')throw Error('PROPERTY_CASE_INVALID');return value;}
  if(typeof value!=='string'||value.length>3000)throw Error('PROPERTY_CASE_INVALID');
  return value;
 }
 return copy(template,input);
}
function parsePropertyLocation({location='',latitude='',longitude=''}={}){
 const lat=number(latitude),lng=number(longitude),raw=text(location);
 const hasCoordinates=text(String(latitude))!==''||text(String(longitude))!=='';
 if(hasCoordinates){if(lat===null||lng===null||Math.abs(lat)>90||Math.abs(lng)>180)return {status:'INVALID',coordinates:null};
  return {status:'USER_COORDINATES_NOT_VERIFIED',coordinates:{latitude:lat,longitude:lng}};}
 if(!raw||raw.length>3000)return {status:'INVALID',coordinates:null};
 if(!/^[a-z][a-z0-9+.-]*:/i.test(raw))return {status:'USER_ADDRESS_NOT_VERIFIED',coordinates:null};
 try{
  const url=new URL(raw);
  const maps=['maps.app.goo.gl','maps.google.com','maps.apple.com','goo.gl','google.com','www.google.com'];
  if(url.protocol!=='https:'||url.username||url.password||!maps.includes(url.hostname))return {status:'INVALID',coordinates:null};
  if(url.hostname==='goo.gl'&&!url.pathname.startsWith('/maps/'))return {status:'INVALID',coordinates:null};
  const coord=url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)||
    (url.searchParams.get('q')||url.searchParams.get('query')||url.searchParams.get('ll')||'').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if(coord&&Math.abs(Number(coord[1]))<=90&&Math.abs(Number(coord[2]))<=180)
   return {status:'MAP_COORDINATES_NOT_VERIFIED',coordinates:{latitude:Number(coord[1]),longitude:Number(coord[2])}};
  return {status:['maps.app.goo.gl','goo.gl'].includes(url.hostname)?'SHORT_LINK_REQUIRES_CONFIRMATION':'MAP_REQUIRES_CONFIRMATION',coordinates:null};
 }catch{return {status:'INVALID',coordinates:null};}
}
const SECTOR_FIELDS=Object.freeze({
 permitRef:['مرجع الاستخدام المسموح ورخصة البناء','Permitted use and building permit reference'],
 inspectionRef:['المعاينة الداخلية والحالة والصيانة','Internal inspection, condition and maintenance'],
 environmentalRef:['الخزانات وملكيتها والسلامة والبيئة','Tanks, ownership, safety and environmental review'],
 licenseRef:['حالة الترخيص / التصنيف','Licence / classification status'],
 capacityRef:['التصريح والطاقة النظامية / الاستخدام الموسمي','Permitted capacity / seasonal use'],
 clearHeightMeters:['ارتفاع المستودع والتحميل والطاقة في المعاينة','Warehouse clear height; loading and power in inspection'],
 units:['عدد المباني والوحدات والاستخدامات','Building/unit count and uses'],rooms:['عدد الغرف المرخصة','Licensed room count'],
});
function sectorEvidenceGaps(input){
 const type=input.subject.assetType,keys=['permitRef','inspectionRef'];
 if(type==='FUEL_STATION')keys.push('environmentalRef','licenseRef');
 if(type==='HOTEL')keys.push('licenseRef','capacityRef','rooms');
 if(type==='WAREHOUSE')keys.push('clearHeightMeters');
 if(['RESIDENTIAL_BUILDING','RESIDENTIAL_COMPLEX','MIXED_USE'].includes(type))keys.push('units');
 return keys.filter(k=>!text(input.sector[k])||(k==='clearHeightMeters'||k==='rooms')&&!positive(input.sector[k]))
  .map(field=>({field,labels:SECTOR_FIELDS[field],status:'MISSING_SECTOR_EVIDENCE'}));
}
function comparePacket(packet,subject,kind){
 const errors=[],rows=packet.comparables;
 if(packet.weightingPolicy!==WEIGHTING_POLICY.EQUAL)errors.push('WEIGHTING_REQUIRED');
 if(rows.length<3)errors.push('COMPARABLES_REQUIRED');
 const seen=new Set();
 for(const row of rows){
  const id=text(row.id),pct=number(row.adjustmentPct);
  if(row.kind==='CAPITAL_VALUE_PERCENTAGE')errors.push('COMPARABLE_DERIVED');
  if(!id||seen.has(id)||!positive(row.amountSar)||!date(row.date)||row.date>subject.valuationDate||!text(row.sourceRef)||
    row.kind!==(kind==='rent'?'EXECUTED_LEASE':'EXECUTED_SALE')||pct===null||pct<=-100||pct>=100)errors.push('COMPARABLE_INVALID');
  seen.add(id);
  if(row.scopeConfirmed!==true)errors.push('COMPARABLE_SCOPE_REQUIRED');
  if(row.taxBasis!=='EXCLUSIVE')errors.push('COMPARABLE_TAX_REQUIRED');
 }
 const land=subject.scope!=='LAND_AND_BUILDING';
 const quantity=packet.unit==='WHOLE_PROPERTY'?1:packet.unit==='LAND_SQM'?number(subject.landAreaSqm):
   packet.unit==='INDOOR_SQM'&&!land?number(subject.nlaSqm):null;
 if(!positive(quantity)||!['WHOLE_PROPERTY','LAND_SQM','INDOOR_SQM'].includes(packet.unit)||
   (packet.unit==='INDOOR_SQM'&&land))errors.push('COMPARISON_UNIT_INVALID');
 if(errors.length)return {amountSar:null,reasons:[...new Set(errors)]};
 const indication=calculateMarketComparableIndication({
  comparables:rows.map(row=>createComparable({comparableId:row.id,unitValue:number(row.amountSar),transactionStatus:row.kind,
   evidenceGrade:EVIDENCE_GRADE.H_CLIENT_SUPPLIED_UNVERIFIED,transactionDate:row.date,sourceRef:row.sourceRef,
   adjustments:[{factor:'USER_DOCUMENTED_SCOPE_AND_TERMS_ADJUSTMENT',percent:number(row.adjustmentPct)/100}]})),
  subjectArea:quantity,basis:kind==='rent'?BASIS_OF_VALUE.MARKET_RENT:BASIS_OF_VALUE.MARKET_VALUE,
  weightingPolicy:WEIGHTING_POLICY.EQUAL,valuationDate:subject.valuationDate,
 });
 return {amountSar:indication.value,reasons:[],method:indication.method,comparisonUnit:packet.unit,comparableCount:rows.length,
  assumptions:indication.assumptions};
}
function evaluatePropertyMarketCase(raw){
 const input=copyInputs(raw),{subject:s,mandate:m,capital:c}=input;
 const common=[],warnings=['UNVERIFIED_RESEARCH_ONLY'];
 if(!text(s.name)||!Object.hasOwn(TYPES,s.assetType)||!text(s.city)||!text(s.district)||!date(s.valuationDate))common.push('IDENTITY_REQUIRED');
 if(!['SALE','RELETTING','MARKET_KNOWLEDGE'].includes(m.purpose))common.push('PURPOSE_REQUIRED');
 const location=parsePropertyLocation(s);
 if(location.status==='INVALID')common.push('LOCATION_REQUIRED');
 else warnings.push(location.status==='SHORT_LINK_REQUIRES_CONFIRMATION'?'SHORT_MAP_LINK':'MAP_NOT_VERIFIED');
 if(!positive(s.landAreaSqm))common.push('LAND_AREA_REQUIRED');
 if(!['LAND_ONLY','LAND_AND_BUILDING','AS_VACANT_LAND'].includes(s.scope)||
   (s.assetType==='LAND'&&s.scope!=='LAND_ONLY')||(s.assetType!=='LAND'&&s.scope==='LAND_ONLY'))common.push('SCOPE_REQUIRED');
 if(s.scope==='LAND_AND_BUILDING'&&!positive(s.builtAreaSqm))common.push('BUILT_AREA_REQUIRED');
 if(s.scope==='LAND_AND_BUILDING'&&s.areaBasis==='MIXED_ITEMS')common.push('MIXED_AREA_UNITS');
 if(text(s.nlaSqm)&&(!nonnegative(s.nlaSqm)||s.scope==='LAND_AND_BUILDING'&&number(s.nlaSqm)>number(s.builtAreaSqm)))common.push('AREA_CONFLICT');
 if(!['FREEHOLD','LEASED_FEE'].includes(s.rightType))common.push('RIGHTS_REQUIRE_REVIEW');
 if(m.taxBasis!=='EXCLUSIVE')common.push('TAX_POLICY_INVALID');
 if(s.assetType==='VEHICLE')common.push('NON_REAL_ESTATE_SCOPE');
 if(['HOTEL','FUEL_STATION','MIXED_USE'].includes(s.assetType)&&s.scope==='LAND_AND_BUILDING'&&!s.nonRealEstateExcluded)common.push('BUSINESS_SEPARATION_REQUIRED');
 if(!text(s.sourceRef)||!text(input.sector.permitRef)||!text(input.sector.inspectionRef))warnings.push('SOURCE_REVIEW_REQUIRED');
 if(s.assetType==='FUEL_STATION')warnings.push('EQUIPMENT_AND_ENVIRONMENT_REVIEW');
 if(s.assetType==='HOTEL')warnings.push('CAPACITY_AND_LICENSE_REVIEW');
 if(!['OPEN','CLOSED_OR_RESTRICTED','UNKNOWN'].includes(s.operatingStatus))common.push('IDENTITY_REQUIRED');
 const capErrors=[...common],rentErrors=[...common];
 if(s.rightType==='LEASED_FEE'&&!text(s.existingLeaseRef))capErrors.push('EXISTING_LEASE_REQUIRED');
 const restricted=s.operatingStatus==='CLOSED_OR_RESTRICTED';
 if(restricted){rentErrors.push('CLOSED_RENT_REVIEW');if(!text(s.restrictedConditionRef))capErrors.push('CLOSED_AS_IS_REVIEW');}
 if(s.operatingStatus==='UNKNOWN')warnings.push('SOURCE_REVIEW_REQUIRED');
 const term=number(m.leaseTermYears),free=number(m.rentFreeMonths);
 if(!positive(term)||!nonnegative(free)||free>term*12||!['LANDLORD','TENANT','SHARED'].includes(m.expenseAllocation)||!text(m.leaseTermsRef))rentErrors.push('LEASE_TERMS_REQUIRED');
 if(m.lettingBasis!=='WHOLE_PROPERTY')rentErrors.push('MULTI_UNIT_RENT_ROLL_REQUIRED');
 let capitalResult={amountSar:null,reasons:capErrors},rentResult={amountSar:null,reasons:rentErrors};
 if(!capErrors.length){
  if(c.method==='MARKET_COMPARABLE')capitalResult=comparePacket(input.sales,s,'sale');
  else if(c.method==='INCOME_DIRECT_CAPITALIZATION'){
   const errors=[];
   if(!positive(c.grossIncomeSar)||!nonnegative(c.ownerExpensesSar)||number(c.ownerExpensesSar)>=number(c.grossIncomeSar)||
     !positive(c.capRatePct)||number(c.capRatePct)>=50||!Object.values(EXPENSE_TREATMENT).includes(c.expenseTreatment)||
     !text(c.incomeSourceRef)||!text(c.capRateSourceRef)||!['CONTRACTUAL_PROPERTY_INCOME','INDEPENDENT_MARKET_PROPERTY_INCOME'].includes(c.incomeOrigin))errors.push('INCOME_INPUTS_REQUIRED');
   if(c.incomeOrigin==='CAPITAL_VALUE_PERCENTAGE')errors.push('COMPARABLE_DERIVED');
   if(!c.stableIncomeConfirmed||s.rightType==='LEASED_FEE')errors.push('STABLE_INCOME_REQUIRED');
   if(s.scope==='AS_VACANT_LAND')errors.push('LAND_METHOD_REQUIRED');
   if(number(c.ownerExpensesSar)===0&&![EXPENSE_TREATMENT.TENANT_BORNE_CONFIRMED,EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED].includes(c.expenseTreatment))errors.push('INCOME_INPUTS_REQUIRED');
   if(!errors.length){const result=calculateDirectCapitalization({effectiveGrossIncome:number(c.grossIncomeSar),operatingExpenses:number(c.ownerExpensesSar),capitalizationRate:number(c.capRatePct)/100,
    expenseTreatment:c.expenseTreatment,incomeEvidence:descriptor(c.incomeSourceRef),expenseEvidence:descriptor(c.incomeSourceRef),capRateEvidence:descriptor(c.capRateSourceRef),valuationDate:s.valuationDate});
    capitalResult={amountSar:result.value,reasons:[],method:result.method};
   }else capitalResult={amountSar:null,reasons:errors};
  }else if(c.method==='COST_DEPRECIATED_REPLACEMENT'){
   const errors=[];
   if(s.scope!=='LAND_AND_BUILDING')errors.push('LAND_METHOD_REQUIRED');
   if(!nonnegative(c.landValueSar)||!positive(c.replacementCostSar)||!nonnegative(c.depreciationPct)||number(c.depreciationPct)>100||!text(c.costSourceRef)||c.improvementOwner!=='PROPERTY_OWNER'||s.rightType==='LEASED_FEE')errors.push('COST_INPUTS_REQUIRED');
   if(!errors.length){const result=calculateDepreciatedReplacementCost({landValue:number(c.landValueSar),directReplacementCost:number(c.replacementCostSar),depreciationRate:number(c.depreciationPct)/100,
    landEvidence:descriptor(c.costSourceRef),replacementCostEvidence:descriptor(c.costSourceRef),depreciationEvidence:descriptor(c.costSourceRef),valuationDate:s.valuationDate});
    capitalResult={amountSar:result.value,reasons:[],method:result.method};
   }else capitalResult={amountSar:null,reasons:errors};
  }else capitalResult={amountSar:null,reasons:['COMPARISON_UNIT_INVALID']};
 }
 if(!rentErrors.length)rentResult=comparePacket(input.rents,s,'rent');
 if(s.scope==='AS_VACANT_LAND'){
  const l=input.landScenario;
  if(!nonnegative(l.demolitionCostSar)||!text(l.clearanceRef)){
   capitalResult={amountSar:null,reasons:[...capitalResult.reasons,'CLEARANCE_REQUIRED']};
   rentResult={amountSar:null,reasons:[...rentResult.reasons,'CLEARANCE_REQUIRED']};
  }
  else if(capitalResult.amountSar!==null){capitalResult={...capitalResult,grossClearedLandAmountSar:capitalResult.amountSar,clearanceCostSar:number(l.demolitionCostSar),amountSar:capitalResult.amountSar-number(l.demolitionCostSar)};}
  // A cleared-land rental scenario is hypothetical; it is never current rent for the standing building.
  warnings.push('CLEARANCE_REQUIRED');
 }
 for(const row of [capitalResult,rentResult]){row.reasons=[...new Set(row.reasons)];row.status=row.amountSar===null?'HOLD_EVIDENCE_REQUIRED':'USER_INPUT_RESEARCH_INDICATION';row.taxBasis='EXCLUSIVE';}
 return {version:VERSION,status:capitalResult.amountSar!==null&&rentResult.amountSar!==null?'TWO_RESEARCH_INDICATIONS':capitalResult.amountSar!==null||rentResult.amountSar!==null?'PARTIAL_RESEARCH_INDICATION':'HOLD_EVIDENCE_REQUIRED',
  valuationDate:s.valuationDate,purpose:m.purpose,scope:s.scope,lettingBasis:m.lettingBasis,taxBasis:'EXCLUSIVE',currency:'SAR',
  capital:capitalResult,rental:{...rentResult,period:'ANNUAL',rentDefinition:'ANNUAL_RENT_ON_STATED_LEASE_TERMS'},location,sectorGaps:sectorEvidenceGaps(input),warnings:[...new Set(warnings)],
  marketEvidenceIndependentlyVerified:false,professionalValuationCertified:false,commercialReportAuthorized:false};
}
function createPropertyCaseArchive(input){const inputs=copyInputs(input);return {kind:VERSION,inputs,sha256:sha256Hex(JSON.stringify(inputs))};}
function restorePropertyCaseArchive(archive){
 if(!archive||archive.kind!==VERSION||!archive.inputs||archive.sha256!==sha256Hex(JSON.stringify(archive.inputs)))throw Error('PROPERTY_ARCHIVE_INVALID');
 if(JSON.stringify(archive).length>MAX_BYTES)throw Error('PROPERTY_ARCHIVE_INVALID');
 return copyInputs(archive.inputs);
}
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderPropertyMarketReport(input,{locale='ar-SA',link=null}={}){
 const safe=copyInputs(input),s=safe.subject,result=evaluatePropertyMarketCase(safe),ar=locale!=='en';
 assertPersonalReportExportAllowed({subject:{name:s.name,assetType:s.assetType,landArea:s.landAreaSqm,valuationDate:s.valuationDate},link});
 const money=x=>x===null?'—':new Intl.NumberFormat(ar?'ar-SA':'en-SA',{maximumFractionDigits:2}).format(x)+' SAR';
 const captions=ar?['دراسة القيمة السوقية والإيجار — مسودة بحثية','القيمة الرأسمالية غير شاملة الضريبة','الإيجار السنوي غير شامل الضريبة','الغرض','تاريخ التقييم','نطاق العقار','الحق المقيم','نموذج التأجير','الموقع','شروط التأجير','الشواهد والمدخلات','النواقص والقيود']:['Market value and rent study — research draft','Capital indication exclusive of tax','Annual rental indication exclusive of tax','Purpose','Valuation date','Property scope','Property interest','Letting model','Location','Lease terms','Evidence and inputs','Gaps and limitations'];
 const purpose={SALE:['بيع','Sale'],RELETTING:['إعادة تأجير','Reletting'],MARKET_KNOWLEDGE:['معرفة القيمة السوقية','Market knowledge']};
 const metadata=[[captions[3],purpose[result.purpose]?.[ar?0:1]||'—'],[captions[4],s.valuationDate],[captions[5],s.scope],[captions[6],s.rightType],[captions[7],safe.mandate.lettingBasis],[captions[8],s.location||`${s.latitude}, ${s.longitude}`],
  [captions[9],`${safe.mandate.leaseTermYears} ${ar?'سنة':'years'}; ${safe.mandate.rentFreeMonths} ${ar?'شهر سماح':'rent-free months'}; ${safe.mandate.expenseAllocation}; ${safe.mandate.leaseTermsRef}`]];
 const gaps=[...new Set([...result.capital.reasons,...result.rental.reasons,...result.warnings])];
 return '<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(captions[0])+'</title><style>body{font:16px/1.8 Tahoma,Arial;margin:24px auto;padding:0 18px;max-width:1000px;color:#182538}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #cbd2da;padding:10px;text-align:start;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}h1{font-size:24px}li{margin-bottom:8px}@media print{body{margin:0;max-width:none}}</style><h1>'+escape(captions[0])+'</h1><h2>'+escape(s.name)+'</h2><p>'+escape(label('UNVERIFIED_RESEARCH_ONLY',locale))+'</p><table>'+metadata.map(([k,v])=>'<tr><th>'+escape(k)+'</th><td>'+escape(v)+'</td></tr>').join('')+'</table><h2>'+escape(captions[1])+'</h2><p>'+escape(money(result.capital.amountSar))+'</p><h2>'+escape(captions[2])+'</h2><p>'+escape(money(result.rental.amountSar))+'</p><h2>'+escape(captions[11])+'</h2><ul>'+gaps.map(code=>'<li>'+escape(label(code,locale))+'</li>').join('')+result.sectorGaps.map(row=>'<li>'+escape(row.labels[ar?0:1])+'</li>').join('')+'</ul><details><summary>'+escape(captions[10])+'</summary><pre dir="auto">'+escape(JSON.stringify(safe,null,2))+'</pre></details><p>NOT_CERTIFIED · '+escape(VERSION)+'</p></html>';
}
module.exports={VERSION,MAX_BYTES,TYPES,REASONS,label,freshPropertyMarketCase,copyInputs,parsePropertyLocation,evaluatePropertyMarketCase,createPropertyCaseArchive,restorePropertyCaseArchive,renderPropertyMarketReport};
