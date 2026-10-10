'use strict';
const { ASSET_CLASS } = require('./project-profile');
const ROWS = [
  ['LAND','أرض وتطوير','Land and development','GENERAL_MODEL','نموذج تطوير عام؛ لا يثبت صلاحية المخطط أو حقوق البناء.','General development model; planning and building rights require evidence.'],
  ['RESIDENTIAL','سكني','Residential','GENERAL_MODEL','تدفقات إيجار مجمعة فقط؛ لا يوجد نموذج مستقل للوحدات والعقود.','Aggregated rental cashflows; no independently qualified unit or lease model.'],
  ['OFFICE','مكتبي','Office','GENERAL_MODEL','تدفقات إيجار مجمعة؛ بيانات الإيجار والشغور افتراضات المستخدم.','Aggregated rental cashflows using user rent and vacancy assumptions.'],
  ['RETAIL','تجزئة','Retail','GENERAL_MODEL','نموذج إيجار عام؛ لا يشمل إيجار المبيعات ومزيج المستأجرين المتخصص.','General lease model; turnover rent and specialist tenant mix are unavailable.'],
  ['MIXED_USE','متعدد الاستخدامات','Mixed use','GENERAL_MODEL','تدفق مجمع فقط؛ لم تؤهل محركات مستقلة لكل استخدام.','Aggregate cashflows; separate use-specific engines are not qualified.'],
  ['INDUSTRIAL_LOGISTICS','صناعي ولوجستي','Industrial and logistics','INTAKE_ONLY','جمع مدخلات؛ المحرك المتخصص غير متاح.','Intake only; specialist engine unavailable.'],
  ['HOSPITALITY','فندقي','Hospitality','INTAKE_ONLY','جمع مدخلات؛ لا يوجد محرك مؤهل لإيراد الغرف والتشغيل.','Intake only; no qualified room-revenue or operating engine.'],
  ['HEALTHCARE','صحي','Healthcare','INTAKE_ONLY','جمع مدخلات؛ التشغيل والتراخيص تحتاج نموذجًا ومراجعة متخصصين.','Intake only; operations and licensing need specialist qualification.'],
  ['EDUCATION','تعليمي','Education','INTAKE_ONLY','جمع مدخلات؛ التشغيل والتراخيص تحتاج نموذجًا ومراجعة متخصصين.','Intake only; operations and licensing need specialist qualification.'],
  ['PARKING','مواقف','Parking','INTAKE_ONLY','جمع مدخلات؛ لا يوجد محرك مؤهل للحركة والتعرفة.','Intake only; traffic and tariff engine unavailable.'],
  ['DATA_CENTER','مركز بيانات','Data center','INTAKE_ONLY','جمع مدخلات؛ الطاقة والعقود والسعة لم تؤهل ماليًا.','Intake only; power, capacity, and contracts are not qualified.'],
  ['SPECIAL_PURPOSE','غرض خاص','Special purpose','INTAKE_ONLY','جمع مدخلات؛ يلزم منهج مستقل بحسب الأصل.','Intake only; asset-specific methodology required.'],
  ['OTHER','أخرى','Other','INTAKE_ONLY','التصنيف وحده لا ينشئ محركًا أو قيمة مؤهلة.','Classification does not establish a qualified engine or value.'],
];
const ASSET_SUPPORT = Object.freeze(ROWS.map(([assetClass,ar,en,status,noteAr,noteEn])=>Object.freeze({assetClass,ar,en,status,noteAr,noteEn,specialistEngineQualified:false,professionalReleaseAuthorized:false})));
function assetSupport(assetClass) {
  if (!Object.values(ASSET_CLASS).includes(assetClass)) throw new Error('INVALID_ASSET_CLASS');
  return ASSET_SUPPORT.find(row=>row.assetClass===assetClass);
}
function financialModelScope(mode) {
  if (!['building','land'].includes(mode)) throw new Error('INVALID_FINANCIAL_MODE');
  return Object.freeze({version:'ASSET_SUPPORT_V1',mode,
    calculationScope:mode==='land'?'GENERAL_DEVELOPMENT_CASHFLOWS':'AGGREGATE_RENTAL_CASHFLOWS',
    assetClassificationInferred:false, marketInputsVerified:false,
    specialistEngineQualified:false,professionalReleaseAuthorized:false,supportMatrix:ASSET_SUPPORT});
}
module.exports={ASSET_SUPPORT,assetSupport,financialModelScope};
