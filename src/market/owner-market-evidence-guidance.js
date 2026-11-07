'use strict';
// Non-authoritative, localized presentation of reason codes produced by the
// canonical market-readiness engines. Never upgrades source verification,
// financial readiness, property rights, report licensing or release status.
const MESSAGES=Object.freeze({
 MARKET_SUBJECT_REQUIRED:['أدخل بيانات العقار الأساسية.','Enter the property details.'],
 MARKET_PURPOSE_REQUIRED:['حدد غرض دراسة السوق.','Select the market-study purpose.'],
 VALUATION_DATE_REQUIRED_OR_INVALID:['أدخل تاريخ تقييم صحيحًا.','Enter a valid valuation date.'],
 FUTURE_VALUATION_DATE_NOT_SUPPORTED:['لا تستخدم تاريخ تقييم مستقبلي.','Do not use a future valuation date.'],
 PROPERTY_RIGHT_DECLARATION_REQUIRED:['حدد نوع الحق العقاري المعلن للمراجعة.','Declare the property interest for review.'],
 MARKET_SUBJECT_NAME_REQUIRED:['أدخل اسم العقار.','Enter the property name.'],
 ASSET_TYPE_UNSUPPORTED:['تحقق من نوع العقار المدعوم.','Confirm a supported property category.'],
 LOCATION_EVIDENCE_MISSING:['أدخل إحداثيات العقار أو رابط خرائط يحدد موقعه.','Add parcel coordinates or a map link showing the location.'],
 VALUATION_DATE_INVALID:['تاريخ التقييم غير صالح.','The valuation date is invalid.'],
 LAND_AREA_MISSING:['أدخل مساحة الأرض موثقة الأساس.','Enter the source-based land area.'],
 BUILT_AREA_MISSING:['أدخل إجمالي المساحة المبنية.','Enter the total built area.'],
 RENTABLE_AREA_MISSING:['أدخل المساحة التأجيرية.','Enter the rentable area.'],
 BUILDING_COUNT_MISSING:['أدخل عدد المباني.','Enter the building count.'],
 UNIT_COUNT_MISSING:['أدخل عدد الوحدات.','Enter the unit count.'],
 HOTEL_ROOM_COUNT_MISSING:['أدخل عدد غرف الفندق.','Enter the number of hotel rooms.'],
 SPECIALIST_METHOD_REQUIRED:['هذا القطاع يحتاج منهج تقييم متخصصًا؛ لا تعتمد نموذج الإيجار العام.','This sector requires specialist valuation; do not use the general rent model.'],
 MIXED_USE_SEGMENT_VALUATION_REQUIRED:['قيّم شرائح الاستخدام المختلط على حدة.','Value each mixed-use segment separately.'],
 NO_EXECUTED_SALE_COMPARABLES:['يلزم ثلاث مقارنات بيع منفذة مؤهلة على الأقل وفق ضوابط المحرك.','At least three engine-qualified executed sale comparables are required.'],
 NO_EXECUTED_RENT_COMPARABLES:['يلزم ثلاثة عقود إيجار منفذة مؤهلة على الأقل وفق ضوابط المحرك.','At least three engine-qualified executed leases are required.'],
 METHODS_UNRECONCILED:['يوجد تعارض جوهري بين مؤشري السوق والدخل يتطلب تسوية.','A material market-versus-income discrepancy requires reconciliation.'],
 RENT_ESTIMATES_UNRECONCILED:['تعارض جوهري بين إيجار الأصل وإيجار شرائح الوحدات يحتاج تسوية.','A material whole-asset versus unit-segment rent gap requires reconciliation.'],
 APPRAISAL_AUDIT_HOLD:['تدقيق تقرير التقييم مرتبط بحالة إيقاف.','A linked appraisal review blocks this indication.'],
 APPRAISAL_REVIEW_PENDING:['مراجعة تقرير التقييم الأولية لم تُعتمد.','The preliminary appraisal review has not been approved.'],
 SOURCE_INDEPENDENCE_NOT_VERIFIED:['مصادر الصفقات والحقوق لم تتحقق منها جهة مستقلة.','Transaction sources and property rights remain independently unverified.'],
 DISTRICT_APPROXIMATION_USED:['بعض المقارنات مؤهلة على مستوى الحي، لا موقع القطعة.','Some comparables are district-only, not parcel-located.'],
 TENANCY_LEGAL_REVIEW_REQUIRED:['الأجرة النظامية تتطلب مراجعة مستقلة للعقود والضوابط.','Legally collectible rent requires independent lease and rules review.'],
 RENT_CLASS_EVIDENCE_INCOMPLETE:['مقارنات شرائح الوحدات أو مساحاتها غير مكتملة.','Unit-segment rental evidence or areas are incomplete.']
});
// Navigation is strictly a convenience: a button never changes an evidence
// decision, a market value, a transaction or the linked professional review.
const TARGETS=Object.freeze({
 MARKET_PURPOSE_REQUIRED:{step:0,key:'valuationPurpose'},
 VALUATION_DATE_REQUIRED_OR_INVALID:{step:0,key:'valuationDate'},
 FUTURE_VALUATION_DATE_NOT_SUPPORTED:{step:0,key:'valuationDate'},
 VALUATION_DATE_INVALID:{step:0,key:'valuationDate'},
 PROPERTY_RIGHT_DECLARATION_REQUIRED:{step:1,key:'owner-property-right'},
 MARKET_SUBJECT_NAME_REQUIRED:{step:1,key:'owner-market-name'},
 ASSET_TYPE_UNSUPPORTED:{step:1,key:'owner-market-asset-type'},
 LOCATION_EVIDENCE_MISSING:{step:1,key:'owner-market-location'},
 LAND_AREA_MISSING:{step:1,key:'owner-market-land-area'},
 BUILT_AREA_MISSING:{step:1,key:'owner-market-built-area'},
 RENTABLE_AREA_MISSING:{step:1,key:'owner-market-rentable-area'},
 BUILDING_COUNT_MISSING:{step:1,key:'owner-market-building-count'},
 UNIT_COUNT_MISSING:{step:1,key:'owner-market-unit-count'},
 HOTEL_ROOM_COUNT_MISSING:{step:1,key:'owner-market-room-count'},
 NO_EXECUTED_SALE_COMPARABLES:{step:2,key:'market-comparables-sale'},
 NO_EXECUTED_RENT_COMPARABLES:{step:2,key:'market-comparables-rent'},
});
function ownerMarketEvidenceGuidance(summary,locale='ar-SA'){
 const english=locale==='en';
 if(!summary||typeof summary!=='object'||!Array.isArray(summary.issues)||!Array.isArray(summary.notices)){
  return {available:false,items:[],unverified:true};
 }
 const list=[...(Array.isArray(summary.identityIssues)?summary.identityIssues:[]),
   ...summary.issues,...summary.notices];
 const seen=new Set(),items=[];
 for(const reason of list){
  if(typeof reason!=='string'||seen.has(reason))continue;
  seen.add(reason);
  const m=MESSAGES[reason];
  // Unknown codes are never leaked as cryptic identifiers to the customer;
  // they still surface a conservative generic warning rather than vanish.
  const message=m?m[english?1:0]:
    (english?'Additional market review requirement remains unresolved.':'يوجد شرط إضافي لمراجعة الدراسة السوقية لم يُستوفَ.');
  items.push({key:reason,description:message,target:TARGETS[reason]||null,
    kind:summary.issues.includes(reason)||
    (Array.isArray(summary.identityIssues)&&summary.identityIssues.includes(reason))?'hold':'review'});
 }
 return {available:true,items,unverified:summary.marketDataIndependentlyVerified!==true};
}
module.exports={ownerMarketEvidenceGuidance};
