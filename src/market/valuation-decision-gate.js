'use strict';
// STARTAK personal study quality gate and single source of truth for CURRENT workbench.
// Does NOT certify a value, verify linked URLs, or grant permission to transact.
const {number,extractCoordinates,ASSET_TYPES}=require('./instant-market-study');
const {localDateString}=require('./study-asof');
const SPECIALIST=new Set(['HOTEL','HEALTHCARE_PROPERTY','INDUSTRIAL_PROPERTY']);
const INCOME_REQUIRED=new Set([
 'RESIDENTIAL_COMPOUND','RESIDENTIAL_BUILDING','COMMERCIAL_COMPLEX',
 'COMMERCIAL_MALL','OFFICE_TOWER','WAREHOUSE','LOGISTICS_PARK','MIXED_USE',
]);
const ASSET_METHODS=Object.freeze({
 LAND:{primary:'MARKET_COMPARABLES',alternates:['DEVELOPMENT_RESIDUAL'],blocked:['GENERIC_NLA_INCOME']},
 RESIDENTIAL_COMPOUND:{primary:'MARKET_AND_INCOME',alternates:['COST_CROSS_CHECK'],blocked:[]},
 RESIDENTIAL_BUILDING:{primary:'MARKET_AND_INCOME',alternates:['COST_CROSS_CHECK'],blocked:[]},
 RESIDENTIAL_VILLA:{primary:'MARKET_COMPARABLES',alternates:['COST_CROSS_CHECK'],blocked:[]},
 COMMERCIAL_COMPLEX:{primary:'INCOME_AND_MARKET',alternates:['COST_CROSS_CHECK'],blocked:[]},
 COMMERCIAL_MALL:{primary:'INCOME_AND_MARKET',alternates:['COST_CROSS_CHECK'],blocked:[]},
 OFFICE_TOWER:{primary:'INCOME_AND_MARKET',alternates:['COST_CROSS_CHECK'],blocked:[]},
 WAREHOUSE:{primary:'INCOME_AND_MARKET',alternates:['COST_CROSS_CHECK'],blocked:[]},
 LOGISTICS_PARK:{primary:'INCOME_AND_MARKET',alternates:['COST_CROSS_CHECK'],blocked:[]},
 MIXED_USE:{primary:'SEGMENTED_PROPERTY_SPECIFIC',alternates:['SPECIALIST_CROSS_CHECK'],blocked:['WHOLE_ASSET_GENERIC_RENT']},
 HOTEL:{primary:'SPECIALIST_HOTEL_DCF',alternates:['ROOM_COMPARABLES'],blocked:['GENERIC_NLA_INCOME']},
 HEALTHCARE_PROPERTY:{primary:'SPECIALIST_HEALTHCARE',alternates:['SPECIALIST_CROSS_CHECK'],blocked:['GENERIC_NLA_INCOME']},
 INDUSTRIAL_PROPERTY:{primary:'SPECIALIST_INDUSTRIAL',alternates:['SPECIALIST_CROSS_CHECK'],blocked:['GENERIC_NLA_INCOME']},
});
const reasonText=Object.freeze({
  ASSET_TYPE_UNSUPPORTED:'نوع العقار غير مدعوم',
  LOCATION_EVIDENCE_MISSING:'إحداثيات العقار مطلوبة للمراجعة المكانية',
  VALUATION_DATE_INVALID:'تاريخ التقييم المدخل غير صالح',
  FUTURE_VALUATION_DATE_NOT_SUPPORTED:'التقييم التاريخي لا يقبل تاريخًا مستقبليًا',
  LAND_AREA_MISSING:'مساحة الأرض غير مكتملة',
  BUILT_AREA_MISSING:'مساحة المباني غير مكتملة',
  RENTABLE_AREA_MISSING:'المساحة التأجيرية غير مكتملة',
  UNIT_COUNT_MISSING:'عدد الوحدات غير مكتمل',
  BUILDING_COUNT_MISSING:'عدد المباني غير مكتمل',
  HOTEL_ROOM_COUNT_MISSING:'عدد الغرف الفندقية غير مكتمل',
  SPECIALIST_METHOD_REQUIRED:'الأصل يحتاج نموذجًا متخصصًا، ولا يجوز استخدام إيجار المتر العام',
  MIXED_USE_SEGMENT_VALUATION_REQUIRED:'المشروع متعدد الاستخدامات يتطلب حساب كل شريحة على حدة',
  NO_EXECUTED_SALE_COMPARABLES:'لا توجد ثلاث مقارنات بيع منفذة مؤهلة',
  NO_EXECUTED_RENT_COMPARABLES:'لا توجد ثلاث عقود إيجار مؤهلة',
  SOURCE_INDEPENDENCE_NOT_VERIFIED:'لم يتم إثبات صحة المصادر والحقوق العقارية من جهة مستقلة',
  DISTRICT_APPROXIMATION_USED:'بعض المقارنات على مستوى الحي فقط لا على مستوى موقع القطعة',
  METHODS_UNRECONCILED:'القيمة السوقية وقيمة الدخل تختلفان اختلافًا جوهريًا',
  RENT_ESTIMATES_UNRECONCILED:'يوجد فرق جوهري بين الإيجار العام وإيجار فئات الوحدات',
  TENANCY_LEGAL_REVIEW_REQUIRED:'الأجرة الممكن تحصيلها نظاميًا تحتاج مراجعة العقود والضوابط',
  RENT_CLASS_EVIDENCE_INCOMPLETE:'فئات الوحدات لا تحتوي على عقود كافية أو مساحات وأعداد متسقة',
});
function present(n){const v=number(n);return v!==null&&v>0;}
function inRange(n){const v=number(n);return v!==null&&v>=0&&v<=1;}
function percentGap(a,b){
 if(!Number.isFinite(a)||!Number.isFinite(b)||!(a>0&&b>0))return null;
 return Math.abs(a-b)/Math.max(a,b)*100;
}
function evidenceRow(row,kind,now){
 const source=typeof row?.sourceUrl==='string'?row.sourceUrl.trim():'';
 const validUrl=/^https:\/\/[^\/@\s]+(?:\/.*)?$/i.test(source);
 const date=String(row?.date||''),ms=/^\d{4}-\d{2}-\d{2}$/.test(date)?
   Date.parse(date+'T00:00:00Z'):NaN;
 const dateValid=Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===date&&
   ms<=now.getTime();
 const ageDays=dateValid?(now.getTime()-ms)/86400000:null;
 const disclosedStatus=row?.status||'UNKNOWN';
 const isExecuted=disclosedStatus==='EXECUTED';
 let tier='EXCLUDED_UNVERIFIED_OR_ASKING';
 if(isExecuted&&validUrl&&dateValid){
  tier=kind==='RENT'?'USER_ASSERTED_SIGNED_RENT':'USER_ASSERTED_EXECUTED_SALE';
 }
 return {tier,declaredExecuted:isExecuted,sourceUrlPresent:validUrl,
   sourceVerifiedIndependently:false,ageDays,
   stale:ageDays!==null&&ageDays>365,
   containsCoordinates:Boolean(extractCoordinates(String(row?.location||''))),
   dataRightsVerified:false};
}
function auditValuationReadiness({subject={},report={},segmentedRent=null,sales=[],rentals=[],asOf=new Date()}={}){
 const d=asOf instanceof Date?asOf:new Date(asOf);
 if(!Number.isFinite(d.getTime()))throw Error('READINESS_AS_OF_INVALID');
 const type=String(subject.assetType||''),policy=ASSET_METHODS[type]||null;
 const reasons=[],notices=[],add=(collection,id)=>{if(!collection.includes(id))collection.push(id);};
 if(!Object.prototype.hasOwnProperty.call(ASSET_TYPES,type)||!policy)add(reasons,'ASSET_TYPE_UNSUPPORTED');
 const valueDate=String(subject?.valuationDate||'');
 if(valueDate){
   const matching=/^\d{4}-\d{2}-\d{2}$/.test(valueDate);
   const date=matching?new Date(valueDate+'T00:00:00.000Z'):new Date(NaN);
   if(!matching||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==valueDate)
     add(reasons,'VALUATION_DATE_INVALID');
   else if(valueDate>localDateString(d))add(reasons,'FUTURE_VALUATION_DATE_NOT_SUPPORTED');
 }

 if(!extractCoordinates(String(subject.location||'')))add(reasons,'LOCATION_EVIDENCE_MISSING');
 if(!present(subject.landArea))add(reasons,'LAND_AREA_MISSING');
 if(type!=='LAND'&&!present(subject.builtArea))add(reasons,'BUILT_AREA_MISSING');
 if(INCOME_REQUIRED.has(type)&&!present(subject.rentableArea))add(reasons,'RENTABLE_AREA_MISSING');
 if(['RESIDENTIAL_COMPOUND','RESIDENTIAL_BUILDING','COMMERCIAL_COMPLEX','COMMERCIAL_MALL','OFFICE_TOWER','MIXED_USE'].includes(type)){
  if(!present(subject.unitCount))add(reasons,'UNIT_COUNT_MISSING');
  if(!present(subject.buildingCount))add(reasons,'BUILDING_COUNT_MISSING');
 }
 if(type==='HOTEL'&&!present(subject.roomCount))add(reasons,'HOTEL_ROOM_COUNT_MISSING');
 if(SPECIALIST.has(type))add(reasons,'SPECIALIST_METHOD_REQUIRED');
 if(type==='MIXED_USE')add(reasons,'MIXED_USE_SEGMENT_VALUATION_REQUIRED');
 const salesQualified=Number(report?.eligibleSalesCount||0),rentQualified=Number(report?.eligibleRentalsCount||0);
 if(salesQualified<3)add(reasons,'NO_EXECUTED_SALE_COMPARABLES');
 if(INCOME_REQUIRED.has(type)&&rentQualified<3)add(notices,'NO_EXECUTED_RENT_COMPARABLES');
 if(report?.materialMethodGap)add(reasons,'METHODS_UNRECONCILED');
 if((report?.districtOnlySalesCount||0)>0||(report?.districtOnlyRentalsCount||0)>0)
  add(notices,'DISTRICT_APPROXIMATION_USED');
 const metadata={
  sales:(Array.isArray(sales)?sales:[]).slice(0,500).map(r=>evidenceRow(r,'SALE',d)),
  rents:(Array.isArray(rentals)?rentals:[]).slice(0,500).map(r=>evidenceRow(r,'RENT',d)),
 };
 add(notices,'SOURCE_INDEPENDENCE_NOT_VERIFIED');
 const legal=report?.rentRegulation||'SCOPE_VERIFICATION_REQUIRED';
 if(legal!=='EXPLICITLY_LEGALLY_REVIEWED')add(notices,'TENANCY_LEGAL_REVIEW_REQUIRED');
 const baseRent=Number.isFinite(report.marketAnnualRentPotentialSar)?report.marketAnnualRentPotentialSar:null;
 const unitRent=segmentedRent?.status==='PRELIMINARY_SEGMENTED_RENT_UNVERIFIED' &&
  Number.isFinite(segmentedRent.grossPotentialNewAnnualRentSar)?
   segmentedRent.grossPotentialNewAnnualRentSar:null;
 const rentGapPct=percentGap(baseRent,unitRent),rentConflict=rentGapPct!==null&&rentGapPct>=20;
 if(rentConflict)add(reasons,'RENT_ESTIMATES_UNRECONCILED');
 if(segmentedRent&&segmentedRent.status==='HOLD_INCOMPLETE_UNIT_EVIDENCE')
  add(notices,'RENT_CLASS_EVIDENCE_INCOMPLETE');
 const recommendedRent=rentConflict?null:unitRent!==null?unitRent:baseRent;
 const rentSource=rentConflict?'CONFLICT_REQUIRES_REVIEW':
  unitRent!==null?'SEGMENTED_EXECUTED_LEASE_COMPARABLES':
  baseRent!==null?'WHOLE_ASSET_EXECUTED_LEASE_COMPARABLES':'NO_SUPPORTED_RENT';
 const canShowSinglePrice=Boolean(!reasons.length&&
   !SPECIALIST.has(type)&&type!=='MIXED_USE'&&
   Number.isFinite(report.todayValueScenarioSar)&&report.todayValueScenarioSar>0);
 // Numeric amounts are preliminary indicators, not professional conclusions.
 const status=canShowSinglePrice?'PRELIMINARY_CALCULATION_UNVERIFIED':
   'HOLD_INSUFFICIENT_OR_CONFLICTING_EVIDENCE';
 return {
   status,methodPolicy:policy,asOf:d.toISOString(),issues:reasons,notices,
   issueDescriptions:reasons.map(x=>reasonText[x]||x),
   noticeDescriptions:notices.map(x=>reasonText[x]||x),
   preliminaryValueSar:canShowSinglePrice?report.todayValueScenarioSar:null,
   rawMarketIndicationSar:Number.isFinite(report.saleIndicationSar)?report.saleIndicationSar:null,
   rawIncomeIndicationSar:Number.isFinite(report.incomeIndicationSar)?report.incomeIndicationSar:null,
   methodGapPct:Number.isFinite(report.methodGapPct)?report.methodGapPct:null,
   newAnnualMarketRentSar:recommendedRent,rentSource,rentGapPct,
   historicAnnualRentUsed:false,
   legalAnnualRentSar:null,certifiedValueSar:null,
   hasPropertyLevelRightsProof:false,hasIndependentlyValidatedMarketTransactions:false,
   permittedExport:'PERSONAL_RESEARCH_DRAFT_ONLY',
   publishableProfessionalReport:false,
   evidenceCounts:{
    saleRows:Array.isArray(sales)?sales.length:0,
    leaseRows:Array.isArray(rentals)?rentals.length:0,
    salesQualifiedByExistingCalculator:salesQualified,
    rentalsQualifiedByExistingCalculator:rentQualified,
    districtOnlySales:report?.districtOnlySalesCount||0,
   },
   metadataSummary:{
    userAssertedExecutedSales:metadata.sales.filter(x=>x.tier==='USER_ASSERTED_EXECUTED_SALE'&&!x.stale).length,
    userAssertedSignedLeases:metadata.rents.filter(x=>x.tier==='USER_ASSERTED_SIGNED_RENT'&&!x.stale).length,
    sourceUrlsUnverified:true,reuseRightsUnverified:true,
   },
   calculationsNotProofOfMarketAccuracy:true,
 };
}
module.exports={ASSET_METHODS,reasonText,auditValuationReadiness,evidenceRow,percentGap};
