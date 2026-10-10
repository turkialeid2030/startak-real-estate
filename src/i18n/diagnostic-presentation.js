'use strict';
const { LABELS } = require('../app/valuation-labels');
const { ARABIC_VALUE_LABELS } = require('./strict-arabic-presentation');

const REASONS = Object.freeze({
  NO_QUALIFIED_VALUATION_STAGE: ['لا يوجد منهج تقييم مؤهل بالبيانات الحالية.', 'No qualified valuation stage is available.'],
  PERSONAL_VALUATION_CONFIGURATION_REQUIRED: ['أكمل إعداد التقييم إذا أردت مؤشر قيمة؛ يمكنك حفظ الدراسة المالية الحالية.', 'Complete valuation configuration for a value indication; the financial study may still be saved.'],
  LEGACY_INPUT_VALIDATION_HOLD: ['صحّح المدخل المالي غير الصالح قبل إعادة حساب التقييم.', 'Correct invalid financial inputs before recalculating valuation.'],
  VALUATION_RUNTIME_ERROR: ['تعذر تشغيل التقييم؛ راجع إعداداته والرمز المرفق.', 'Valuation could not run; review its configuration and the attached code.'],
  REQUIRED_FIELD: ['أكمل الحقل المطلوب المحدد في الرسالة.', 'Complete the required field identified in the message.'],
  INVALID_ENUM: ['اختر قيمة مدعومة للحقل المحدد.', 'Select a supported value for the identified field.'],
  INVALID_NUMBER: ['أدخل رقمًا صالحًا للحقل المحدد.', 'Enter a valid number for the identified field.'],
  OUT_OF_RANGE: ['القيمة خارج نطاق الحقل المسموح؛ صححها.', 'The value is outside the permitted field range.'],
  INVALID_CONFIGURATION: ['راجع الحقول المطلوبة ونطاقاتها في إعداد التقييم.', 'Review required configuration fields and ranges.'],
  INVALID_VALUATION_EDITOR_DRAFT: ['تعذر حفظ هذا التغيير في المسودة. قلّل طول النص أو عدد الصفوف؛ احتُفظ بالقيم السابقة.', 'This draft edit could not be saved. Reduce the text length or row count; previous values were retained.'],
  SPECIALIST_HOTEL_ADAPTER_NOT_IMPLEMENTED: ['محرك تقييم الفنادق المتخصص غير متاح؛ البيانات محفوظة كمسودة.', 'A specialist hotel valuation adapter is unavailable; inputs remain a draft.'],
  SPECIALIST_INDUSTRIAL_ADAPTER_NOT_IMPLEMENTED: ['محرك تقييم العقار الصناعي المتخصص غير متاح؛ البيانات محفوظة كمسودة.', 'A specialist industrial valuation adapter is unavailable; inputs remain a draft.'],
  FINANCIAL_INPUTS_INVALID: ['المدخلات المالية غير صالحة؛ لم تُصدر نتائج من حالة سابقة.', 'Financial inputs are invalid; no previous results were exported.'],
  FINANCIAL_COMPUTATION_FAILED: ['تعذر الحساب المالي؛ راجع الرمز المرفق. لم تُصدر نتائج من حالة سابقة.', 'Financial computation failed; review the attached code. No previous results were exported.'],
  CASHFLOWS_UNAVAILABLE: ['التدفقات غير متاحة لحساب أثر الزكاة بالمدخلات الحالية.', 'Cashflows are unavailable to calculate the Zakat effect.'],
  NOT_PROVIDED: ['لم يُدخل مبلغ زكاة؛ لم تحسب المنصة أثرًا مفترضًا.', 'No Zakat amount was supplied; the platform did not assume an effect.'],
  SCENARIO_INPUTS_INVALID: ['هذا السيناريو تجاوز حدود المدخلات المدعومة؛ لم تحسب له نتائج.', 'This scenario exceeds supported input bounds; no results were calculated.'],
  MISSING_EXIT_CAP_RATE: ['أدخل معدل رسملة التخارج لاحتساب التدفقات التي تشمل البيع.', 'Enter the exit capitalization rate to calculate sale-dependent returns.'],
  MISSING_EXIT_TRANSFER_FEE_RATE: ['حدد افتراض تكلفة التخارج صراحة، بما فيها الصفر عند انطباقه.', 'Explicitly specify the exit transaction-cost assumption, including zero where applicable.'],
  CONTRACTUAL_LEASE_COVERAGE_INSUFFICIENT: ['فترة التغطية التعاقدية لا تغطي أفق الدراسة المطلوب.', 'Contractual lease coverage does not cover the required study horizon.'],
});

function describeDiagnostic(value, locale = 'ar-SA') {
  const code = String(value ?? '').slice(0, 400);
  const ar = locale !== 'en';
  const catalog = LABELS[ar ? 'ar-SA' : 'en'];
  const known = catalog?.reason?.[code] || catalog?.method?.[code] || catalog?.state?.[code] || catalog?.engineStatus?.[code] || REASONS[code]?.[ar ? 0 : 1]
    || (ar ? ARABIC_VALUE_LABELS[code] : null);
  return Object.freeze({ code, message: known || (ar
    ? 'تحتاج هذه الحالة إلى مراجعة تفصيلية وفق الرمز المرفق؛ لم يُحذف السبب الأصلي.'
    : 'Review this condition using the attached code; the original reason is retained.') });
}
module.exports = { describeDiagnostic, REASONS };
