'use strict';
// D07: Financial calculator state and optional valuation-stage completeness
// are two independent contracts, never one inferred "study complete" flag.
const FINANCIAL=Object.freeze({
 VALID:{ar:'الحساب المالي صالح حسابيًا وفق المدخلات الحالية',en:'Financial calculation is arithmetically valid for current inputs'},
 INPUTS_INVALID:{ar:'المدخلات المالية الحالية غير صالحة',en:'Current financial inputs are invalid'},
 INCOMPLETE_INPUTS:{ar:'المدخلات المالية غير مكتملة',en:'Financial inputs are incomplete'},
 INVALID_ECONOMIC_CASE:{ar:'الحالة الاقتصادية غير مكتملة أو غير مؤهلة',en:'Economic scenario is incomplete or not qualified'},
 FINANCIAL_INTEGRITY_HOLD:{ar:'إيقاف الحساب بسبب عدم تطابق مالي',en:'Financial calculation held for integrity mismatch'},
 COMPUTATION_FAILED:{ar:'تعذر تنفيذ الحساب المالي',en:'Financial computation failed'}
});
const VALUATION=Object.freeze({
 INPUTS_REQUIRED:{ar:'التقييم الإضافي يحتاج مدخلات وأدلة',en:'Additional valuation needs inputs and evidence'},
 PRELIMINARY_VALUE_CALCULATED:{ar:'مؤشر تقييم إضافي أولي غير معتمد',en:'Additional preliminary valuation indicator, not certified'},
 METHOD_INDICATIONS_ONLY:{ar:'مؤشرات مناهج تقييم إضافية فقط',en:'Additional valuation method indications only'},
 SPECIALIST_INPUTS_ONLY:{ar:'مدخلات تقييم متخصص أولية',en:'Preliminary specialist valuation inputs'}
});
function financialAndValuationLabels(draft,locale='ar-SA'){
 const ar=locale!=='en';
 const field=ar?'ar':'en';
 const financialStatus=draft?.financial?.status;
 const valuationStatus=draft?.reportStatus;
 const f=Object.prototype.hasOwnProperty.call(FINANCIAL,financialStatus)?
  FINANCIAL[financialStatus][field]:(ar?'الحساب المالي غير متحقق':'Financial computation not verified');
 const v=Object.prototype.hasOwnProperty.call(VALUATION,valuationStatus)?
  VALUATION[valuationStatus][field]:(ar?'حالة التقييم الإضافي غير مثبتة':'Additional valuation status not established');
 return Object.freeze({financialStatus:financialStatus||'NOT_INCLUDED',
  additionalValuationStatus:valuationStatus||'NOT_EVALUATED',
  financialLabel:f,additionalValuationLabel:v,
  certifiedMarketValue:false,professionalDecisionAuthorized:false,
  financialValid:financialStatus==='VALID',
  additionalValuationComplete:valuationStatus==='PRELIMINARY_VALUE_CALCULATED'});
}
module.exports={FINANCIAL,VALUATION,financialAndValuationLabels};
