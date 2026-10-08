'use strict';
// Presentation-only: no translation, sanitization or user claims may modify
// stored source codes, financial assumptions, block decisions or evidence hashes.
const { getValuationMethodLabel } = require('./valuation-labels');

const AR=Object.freeze({
  C62_INDEPENDENT_SOURCE_AND_PROFESSIONAL_AUTHORITY_NOT_ESTABLISHED:'لم تُثبت أصالة مصادر البيانات واعتماد المراجع المهني المستقل.',
  C62_UNDERLYING_VALUATION_STAGE_NOT_READY:'المنهج الحسابي الأساسي لم يستوف شروط الجاهزية.',
  C62_NO_AVAILABLE_METHOD:'لا يوجد منهج تقييم مؤهل للحساب في هذه الحالة.',
  C62_EXTERNAL_SOURCE_AUTHENTICITY_NOT_PROVEN:'لم يُتحقق من أصالة مصدر الصفقة أو المستند بواسطة جهة مستقلة.',
  C62_AUTHORITY_CANNOT_BE_SELF_DECLARED:'لا يجوز اعتماد صلاحية المراجع من إقرار المستخدم أو مستند غير موثق.',
  C62_SIGNED_METHOD_EVIDENCE_PACKET_REQUIRED:'يلزم ملف أدلة للمقارنات أو الإيراد أو التكلفة مع سلسلة مصدر قابلة للتحقق.',
  C62_C59_COST_ENGINE_VALUE_MISMATCH:'نتيجة منهج التكلفة لا تطابق سجل توزيع الاستهلاك والتقادم.',
  C62_LEGACY_RESIDUAL_TIMING_METHOD_MISMATCH:'منهج القيمة المتبقية القديم لا يتوافق مع التدفقات المالية المؤرخة.',
  C62_METHOD_EXECUTOR_UNSUPPORTED:'المسار التشغيلي لهذا المنهج غير مكتمل.',
  C62_METHOD_EVIDENCE_VALIDATION_ERROR:'تعذر فحص الأدلة المقدمة لهذا المنهج.',
  C62_SPECIALIST_EVIDENCE_REQUIRED:'يلزم توثيق متخصص لعقار الضيافة أو العقار الصناعي.',
  C62_SPECIALIST_EVIDENCE_ERROR:'تعذر التحقق من حزمة الأدلة الفنية المتخصصة.',
  C62_REAL_SPECIALIST_EVIDENCE_NOT_EXTERNALLY_AUTHENTICATED:'لم تعتمد جهة متخصصة مستقلة صحة أدلة العقار.',
  PREDECLARED_RATE_STRESS_AND_EVIDENCE_POLICY_REQUIRED:'يلزم تحديد سياسة موثقة لمصادر معدلات الرسملة والخصم واختبارات الضغط.',
  INSUFFICIENT_QUALIFIED_INCOME_COMPARABLES:'عدد الصفقات المنفذة المؤهلة لا يحقق الحد الأدنى.',
  HOTEL_REAL_PROPERTY_NOI_BRIDGE_INCOMPLETE:'لم تتم مطابقة دخل الفندق المنسوب للعقار مع دخل النشاط التشغيلي.',
  NO_QUALIFIED_VALUATION_METHOD:'لا توجد منهجية تقييم مؤهلة.',
});
const EN=Object.freeze({
  C62_INDEPENDENT_SOURCE_AND_PROFESSIONAL_AUTHORITY_NOT_ESTABLISHED:'Independent source provenance and professional review authority are not established.',
  C62_UNDERLYING_VALUATION_STAGE_NOT_READY:'The underlying valuation stage is not qualified.',
  C62_NO_AVAILABLE_METHOD:'No qualified valuation method is available.',
  C62_EXTERNAL_SOURCE_AUTHENTICITY_NOT_PROVEN:'Source authenticity has not been independently verified.',
  C62_AUTHORITY_CANNOT_BE_SELF_DECLARED:'Self-declared professional authority is not independently verified.',
  C62_SIGNED_METHOD_EVIDENCE_PACKET_REQUIRED:'An independently reviewable method evidence dossier is required.',
  C62_C59_COST_ENGINE_VALUE_MISMATCH:'Cost indication does not match component depreciation attribution.',
  C62_LEGACY_RESIDUAL_TIMING_METHOD_MISMATCH:'Legacy residual timing differs from dated project cash flows.',
  C62_METHOD_EXECUTOR_UNSUPPORTED:'This method is not integrated into the operational route.',
  C62_METHOD_EVIDENCE_VALIDATION_ERROR:'The method evidence validation failed.',
  C62_SPECIALIST_EVIDENCE_REQUIRED:'Specialist property evidence is required.',
  C62_SPECIALIST_EVIDENCE_ERROR:'Specialist evidence validation failed.',
  C62_REAL_SPECIALIST_EVIDENCE_NOT_EXTERNALLY_AUTHENTICATED:'Independent specialist source authentication is outstanding.',
  PREDECLARED_RATE_STRESS_AND_EVIDENCE_POLICY_REQUIRED:'The predeclared market rate policy and evidence are missing.',
  INSUFFICIENT_QUALIFIED_INCOME_COMPARABLES:'Too few executed comparable income-property transactions qualify.',
});
const CODE=/^[A-Z][A-Z0-9_]+$/;
function parseBlocker(blocker){
 if(typeof blocker!=='string'||blocker.length>500)return {code:'UNKNOWN',method:null};
 const pos=blocker.indexOf(':');
 const possibleMethod=pos>0?blocker.slice(0,pos):null;
 const raw=pos>0?blocker.slice(pos+1):blocker;
 const code=raw.split(':',1)[0];
 return {code:CODE.test(code)?code:'UNKNOWN',method:possibleMethod};
}
function displayBlocker(blocker,locale='ar-SA'){
 const ar=locale==='ar-SA';const {code,method}=parseBlocker(blocker);
 const message=(ar?AR:EN)[code]||(ar?
  'يوجد متطلب إضافي غير مصنف، ويجب الرجوع إلى السجل التدقيقي لاستكماله.':
  'An additional unclassified requirement must be reviewed in the audit record.');
 let prefix='';
 if(method){
  try{prefix=getValuationMethodLabel(locale,method)+': ';}
  catch{prefix=ar?'متطلب خاص بأحد المناهج: ':'Method-specific requirement: ';}
 }
 return prefix+message;
}
function institutionalStatusText(locale='ar-SA'){
 return locale==='ar-SA'?'الاعتماد المؤسسي معلّق إلى حين التحقق الخارجي':'Institutional approval is on hold pending independent verification';
}
function institutionalCountLabel(n,locale='ar-SA'){
 const count=Number.isInteger(n)&&n>=0?n:0;
 return locale==='ar-SA'?'عدد متطلبات التعليق: '+count:'Outstanding institutional requirements: '+count;
}
function displayEvidenceGap(index,locale='ar-SA'){
 const ordinal=Number.isInteger(index)&&index>=0?index+1:1;
 return locale==='ar-SA'
  ? 'دليل أو مدخل مطلوب للمراجعة، البند '+ordinal+'. تُحفظ التفاصيل الأصلية في سجل الحالة.'
  : 'Evidence or input requires review, item '+ordinal+'. Original detail remains in case records.';
}
module.exports={AR,EN,displayBlocker,institutionalStatusText,institutionalCountLabel,displayEvidenceGap};
