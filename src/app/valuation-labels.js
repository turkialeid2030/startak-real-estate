'use strict';

const {
  VALUATION_METHOD,
  VALUATION_STAGE_STATUS,
  METHOD_STATE,
  VALUATION_REASON_CODE,
} = require('../valuation-intelligence');

const SUPPORTED_PRESENTATION_LOCALES = Object.freeze(['ar-SA', 'en']);

const LABELS = Object.freeze({
  'ar-SA': Object.freeze({
    state: Object.freeze({
      [METHOD_STATE.AVAILABLE]: 'متاح',
      [METHOD_STATE.HOLD]: 'معلّق',
      [METHOD_STATE.UNAVAILABLE]: 'غير متاح',
    }),
    engineStatus: Object.freeze({
      [VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL]: 'جاهز لمرحلة ضبط القرار',
      [VALUATION_STAGE_STATUS.HOLD_INPUTS]: 'معلّق — نقص في المدخلات',
      [VALUATION_STAGE_STATUS.HOLD_EVIDENCE]: 'معلّق — فجوة أو تعارض في الأدلة',
      [VALUATION_STAGE_STATUS.HOLD_POLICY]: 'معلّق — سياسة تقييم مطلوبة',
      [VALUATION_STAGE_STATUS.UNAVAILABLE]: 'غير متاح لهذا النطاق',
    }),
    method: Object.freeze({
      [VALUATION_METHOD.MARKET_COMPARABLE]: 'منهج المقارنات السوقية',
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: 'رسملة الدخل المباشرة',
      [VALUATION_METHOD.INCOME_DCF]: 'التدفقات النقدية المخصومة',
      [VALUATION_METHOD.INCOME_OPERATING_BUSINESS]: 'منهج دخل النشاط التشغيلي',
      [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]: 'التكلفة الاستبدالية بعد الاستهلاك',
      [VALUATION_METHOD.RESIDUAL]: 'المنهج المتبقي',
    }),
    reason: Object.freeze({
      [VALUATION_REASON_CODE.METHOD_NOT_APPLICABLE]: 'المنهج غير منطبق على خصائص العقار الحالية.',
      [VALUATION_REASON_CODE.ASSET_ADAPTER_REQUIRED]: 'يتطلب هذا المنهج محولاً متخصصاً لنوع الأصل قبل التنفيذ.',
      [VALUATION_REASON_CODE.METHOD_INPUTS_REQUIRED]: 'مدخلات المنهج غير مكتملة.',
      [VALUATION_REASON_CODE.METHOD_INPUT_INVALID]: 'أحد مدخلات المنهج غير صالح وفق ضوابط المحرك.',
      [VALUATION_REASON_CODE.METHOD_EVIDENCE_CONFLICT]: 'يوجد تعارض في الأدلة يمنع تأهيل نتيجة المنهج.',
      [VALUATION_REASON_CODE.EVIDENCE_QUALITY_POLICY_REQUIRED]: 'يجب تحديد سياسة جودة الأدلة صراحة قبل تأهيل النتيجة.',
      [VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD]: 'جودة الأدلة لا تحقق السياسة المحددة.',
      [VALUATION_REASON_CODE.MIXED_USE_COMPONENTS_REQUIRED]: 'العقار متعدد الاستخدامات يحتاج مكونات واستخدامات محددة صراحة.',
      [VALUATION_REASON_CODE.NO_QUALIFIED_VALUATION_METHOD]: 'لا يوجد حالياً منهج تقييم مؤهل للاعتماد في هذه المرحلة.',
      [VALUATION_REASON_CODE.SINGLE_METHOD_ACCEPTANCE_POLICY_REQUIRED]: 'يوجد منهج مؤهل واحد فقط؛ يلزم اعتماد صريح لسياسة قبول منهج واحد.',
      [VALUATION_REASON_CODE.SINGLE_METHOD_ACCEPTANCE_POLICY_MISMATCH]: 'سياسة قبول المنهج الواحد لا تطابق المنهج المؤهل فعلياً.',
      [VALUATION_REASON_CODE.RECONCILIATION_POLICY_REQUIRED]: 'يلزم تحديد أوزان المصالحة وحد التشتت صراحة.',
      [VALUATION_REASON_CODE.RECONCILIATION_METHOD_SET_MISMATCH]: 'أوزان المصالحة لا تطابق مجموعة المناهج المؤهلة.',
      [VALUATION_REASON_CODE.RECONCILIATION_INPUT_METHOD_HOLD]: 'أحد المناهج الداخلة في المصالحة غير مؤهل.',
      [VALUATION_REASON_CODE.RECONCILIATION_BASIS_MISMATCH]: 'أساس القيمة مختلف بين نتائج المناهج.',
      [VALUATION_REASON_CODE.RECONCILIATION_CURRENCY_MISMATCH]: 'العملة مختلفة بين نتائج المناهج.',
      [VALUATION_REASON_CODE.RECONCILIATION_DATE_MISMATCH]: 'تاريخ التقييم مختلف بين نتائج المناهج.',
      [VALUATION_REASON_CODE.RECONCILIATION_DISPERSION_HOLD]: 'التشتت بين نتائج المناهج تجاوز الحد المسموح.',
      [VALUATION_REASON_CODE.RECONCILIATION_UNKNOWN_HOLD]: 'المصالحة متوقفة بسبب حالة غير مصنفة بعد.',
    }),
  }),
  en: Object.freeze({
    state: Object.freeze({
      [METHOD_STATE.AVAILABLE]: 'Available',
      [METHOD_STATE.HOLD]: 'Hold',
      [METHOD_STATE.UNAVAILABLE]: 'Unavailable',
    }),
    engineStatus: Object.freeze({
      [VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL]: 'Ready for decision control',
      [VALUATION_STAGE_STATUS.HOLD_INPUTS]: 'Hold — missing inputs',
      [VALUATION_STAGE_STATUS.HOLD_EVIDENCE]: 'Hold — evidence gap or conflict',
      [VALUATION_STAGE_STATUS.HOLD_POLICY]: 'Hold — valuation policy required',
      [VALUATION_STAGE_STATUS.UNAVAILABLE]: 'Unavailable for this scope',
    }),
    method: Object.freeze({
      [VALUATION_METHOD.MARKET_COMPARABLE]: 'Market comparables',
      [VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION]: 'Direct income capitalization',
      [VALUATION_METHOD.INCOME_DCF]: 'Discounted cash flow',
      [VALUATION_METHOD.INCOME_OPERATING_BUSINESS]: 'Operating-business income',
      [VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT]: 'Depreciated replacement cost',
      [VALUATION_METHOD.RESIDUAL]: 'Residual approach',
    }),
    reason: Object.freeze({
      [VALUATION_REASON_CODE.METHOD_NOT_APPLICABLE]: 'The method is not applicable to the current property characteristics.',
      [VALUATION_REASON_CODE.ASSET_ADAPTER_REQUIRED]: 'This method requires an asset-specific adapter before execution.',
      [VALUATION_REASON_CODE.METHOD_INPUTS_REQUIRED]: 'Required method inputs are incomplete.',
      [VALUATION_REASON_CODE.METHOD_INPUT_INVALID]: 'A method input is invalid under the engine rules.',
      [VALUATION_REASON_CODE.METHOD_EVIDENCE_CONFLICT]: 'An evidence conflict prevents the method indication from qualifying.',
      [VALUATION_REASON_CODE.EVIDENCE_QUALITY_POLICY_REQUIRED]: 'An explicit evidence-quality policy is required before the indication can qualify.',
      [VALUATION_REASON_CODE.EVIDENCE_QUALITY_HOLD]: 'The evidence does not satisfy the configured quality policy.',
      [VALUATION_REASON_CODE.MIXED_USE_COMPONENTS_REQUIRED]: 'A mixed-use property requires explicit component/use definitions.',
      [VALUATION_REASON_CODE.NO_QUALIFIED_VALUATION_METHOD]: 'No valuation method is currently qualified for this stage.',
      [VALUATION_REASON_CODE.SINGLE_METHOD_ACCEPTANCE_POLICY_REQUIRED]: 'Only one method is qualified; explicit single-method acceptance is required.',
      [VALUATION_REASON_CODE.SINGLE_METHOD_ACCEPTANCE_POLICY_MISMATCH]: 'The single-method acceptance policy does not match the method that actually qualified.',
      [VALUATION_REASON_CODE.RECONCILIATION_POLICY_REQUIRED]: 'Explicit reconciliation weights and a dispersion threshold are required.',
      [VALUATION_REASON_CODE.RECONCILIATION_METHOD_SET_MISMATCH]: 'The reconciliation weights do not match the qualified method set.',
      [VALUATION_REASON_CODE.RECONCILIATION_INPUT_METHOD_HOLD]: 'A method entering reconciliation is not qualified.',
      [VALUATION_REASON_CODE.RECONCILIATION_BASIS_MISMATCH]: 'The valuation basis differs across method indications.',
      [VALUATION_REASON_CODE.RECONCILIATION_CURRENCY_MISMATCH]: 'The currency differs across method indications.',
      [VALUATION_REASON_CODE.RECONCILIATION_DATE_MISMATCH]: 'The valuation date differs across method indications.',
      [VALUATION_REASON_CODE.RECONCILIATION_DISPERSION_HOLD]: 'Dispersion across method indications exceeds the permitted threshold.',
      [VALUATION_REASON_CODE.RECONCILIATION_UNKNOWN_HOLD]: 'Reconciliation is on hold for an as-yet unclassified condition.',
    }),
  }),
});

function dictionary(locale) {
  if (!SUPPORTED_PRESENTATION_LOCALES.includes(locale)) throw new Error(`Unsupported valuation presentation locale: ${locale}`);
  return LABELS[locale];
}

function requireLabel(group, value, locale) {
  const label = dictionary(locale)[group][value];
  if (!label) throw new Error(`Missing valuation ${group} label for ${value} in ${locale}`);
  return label;
}

function getValuationStateLabel(locale, state) {
  return requireLabel('state', state, locale);
}

function getValuationEngineStatusLabel(locale, status) {
  return requireLabel('engineStatus', status, locale);
}

function getValuationMethodLabel(locale, method) {
  return requireLabel('method', method, locale);
}

function getValuationReasonLabel(locale, reasonCode) {
  return requireLabel('reason', reasonCode, locale);
}

module.exports = {
  SUPPORTED_PRESENTATION_LOCALES,
  LABELS,
  getValuationStateLabel,
  getValuationEngineStatusLabel,
  getValuationMethodLabel,
  getValuationReasonLabel,
};
