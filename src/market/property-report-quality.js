'use strict';
const {extractCoordinates}=require('./instant-market-study');
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
const rows=Object.freeze([
 {id:'PURPOSE',label:'غرض التقييم وحدود الاستخدام',criterion:'حدد غرض الدراسة والقرار المستهدف'},
 {id:'VALUATION_DATE',label:'تاريخ القيمة المرجعية',criterion:'تاريخ تقييم محدد وليس تاريخ التقرير فقط'},
 {id:'RIGHTS',label:'الحق العقاري والملكية',criterion:'حق الملكية أو الانتفاع موصوف مع قابلية التوثيق'},
 {id:'PROPERTY_IDENTITY',label:'هوية العقار وموقعه',criterion:'المدينة والحي والإحداثيات المتاحة'},
 {id:'SITE_INSPECTION',label:'المعاينة وحالة العقار',criterion:'المعاينة الفعلية لا تُستنتج من صور أو خرائط'},
 {id:'ZONING',label:'الاستعمال والتنظيم العمراني',criterion:'تأكد من الاستخدام والقيود التنظيمية'},
 {id:'METHOD',label:'اختيار المنهجية حسب نوع الأصل',criterion:'منهج مناسب ونطاق تطبيق موضح'},
 {id:'COMPARABLES',label:'ملاءمة المقارنات الموثقة',criterion:'الصفقات والحق والمساحة وتواريخ المصدر'},
 {id:'RECONCILIATION',label:'تفسير اختلاف النتائج',criterion:'يُمنع تخطي تعارض المنهجيات جوهريًا'},
 {id:'RENT_LEGAL',label:'قابلية تطبيق الأجرة نظاميًا',criterion:'الإيجار النظري مستقل عن الإيجار المسموح عقديًا'},
 {id:'INDEPENDENT_REVIEW',label:'المراجعة المهنية المستقلة',criterion:'المراجع المؤهل يوقع فقط بعد الاطلاع على الأدلة'},
]);
function evaluateAppraisalReportQuality({subject={},marketReport={},readiness={},asOf=new Date()}={}){
 const asOfDate=asOf instanceof Date?asOf:new Date(asOf);
 if(!Number.isFinite(asOfDate.getTime()))throw Error('REPORT_AS_OF_INVALID');
 const inspected=subject.inspectionStatus==='ON_SITE'&&validDate(subject.inspectionDate)&&
  Date.parse(subject.inspectionDate+'T00:00:00Z')<=asOfDate.getTime();
 const predicates={
  PURPOSE:Boolean(String(subject.valuationPurpose||'').trim()),
  VALUATION_DATE:validDate(subject.valuationDate)&&
    Date.parse(subject.valuationDate+'T00:00:00Z')<=asOfDate.getTime(),
  RIGHTS:Boolean(String(subject.propertyRight||'').trim()&&String(subject.propertyRight)!=='UNKNOWN'),
  PROPERTY_IDENTITY:Boolean(subject.city&&subject.district&&extractCoordinates(String(subject.location||''))),
  SITE_INSPECTION:inspected,
  ZONING:Boolean(String(subject.zoningClassification||'').trim()),
  METHOD:Boolean(readiness.methodPolicy&&readiness.methodPolicy.primary),
  COMPARABLES:Boolean(readiness.evidenceCounts?.salesQualifiedByExistingCalculator>=3),
  RECONCILIATION:Boolean(!marketReport.materialMethodGap&&readiness.status==='PRELIMINARY_CALCULATION_UNVERIFIED'),
  RENT_LEGAL:false, // Market model cannot itself establish a legally permitted contract rent.
  INDEPENDENT_REVIEW:false, // Never auto-assert licensed professional reviewer.
 };
 const items=rows.map(item=>({...item,
  status:['RENT_LEGAL','INDEPENDENT_REVIEW'].includes(item.id)?'REQUIRES_EXTERNAL_REVIEW':
   predicates[item.id]?'PRESENT_USER_DECLARED':'MISSING_OR_UNVERIFIED',
 }));
 return {
  asOf:asOfDate.toISOString(),items,
  userDeclaredPresent:items.filter(x=>x.status==='PRESENT_USER_DECLARED').length,
  missingOrUnverified:items.filter(x=>x.status==='MISSING_OR_UNVERIFIED').length,
  requiresExternalReview:items.filter(x=>x.status==='REQUIRES_EXTERNAL_REVIEW').length,
  approved:false,independentlyValidated:false,
  certifiedReportExportAllowed:false,
  researchDraftOnly:true,
  professionalStatement:'Checklist reflects user-declared completeness only; independent source and valuation evidence review and applicable Saudi professional requirements must be assessed by a qualified reviewer.',
 };
}
module.exports={evaluateAppraisalReportQuality};
