import React from 'react';
const { PERSONAL_STATUS, evaluatePersonalResearchReadiness } = require('../governance/personal-research-readiness');

const AR_REASONS = Object.freeze({
  INPUT_OR_CALCULATION_NOT_AVAILABLE:'المدخلات الحالية غير صالحة أو الحساب غير متاح',
  STUDY_MODE_UNSUPPORTED:'نوع الدراسة غير مؤهل لهذا الفحص',
  MODEL_INCOMPLETE_OR_INVALID:'النموذج غير مكتمل أو نتائجه الاقتصادية غير مؤهلة',
  ACQUISITION_COST_ROLLUP:'مجموع تكلفة الاستحواذ غير متطابق',
  NOI_RECONCILIATION:'صافي الدخل التشغيلي غير متطابق مع الإيرادات والمصروفات',
  PROJECT_COST_ROLLUP:'مجموع تكاليف المشروع غير متطابق',
  STABILIZED_NOI_RECONCILIATION:'صافي الدخل التشغيلي المستقر غير متطابق',
  CASHFLOW_VALUES_FINITE:'يوجد تدفق نقدي غير صالح حسابياً',
  OPENING_INVESTMENT_CASHFLOW:'التدفق النقدي الأول لا يطابق تكلفة الاستحواذ',
  NPV_CASHFLOW_RECONCILIATION:'صافي القيمة الحالية لا يطابق التدفقات ومعدل الخصم',
  FINANCIAL_CRITERIA_COMPLETE:'معايير التقييم المالي غير مكتملة',
  FINANCIAL_HARD_GATES_NOT_MET:'لم تتحقق بعض القيود المالية الإلزامية',
  NPV_NOT_ESTABLISHED:'صافي القيمة الحالية غير متحقق',
  IRR_NOT_ESTABLISHED:'معدل العائد الداخلي غير متحقق',
  IRR_REQUIRES_MANUAL_REVIEW:'يتطلب معدل العائد الداخلي مراجعة مستقلة',
  EXIT_ANALYSIS_NOT_READY:'تحليل قيمة التخارج غير مكتمل',
});
export default function PersonalResearchReadinessPanel({mode, inputs, results, validationError, locale = 'ar-SA'}) {
  const data = evaluatePersonalResearchReadiness({mode, inputs, results, validationError});
  const ar = locale !== 'en';
  const hold = data.status === PERSONAL_STATUS.HOLD;
  const caution = data.status === PERSONAL_STATUS.CAUTION;
  const title = hold ? (ar ? 'توقف: راجع المدخلات وسلامة الحساب' : 'Hold: inputs or calculation integrity')
    : caution ? (ar ? 'مراجعة مالية مطلوبة' : 'Financial review required')
    : (ar ? 'التحقق الحسابي الأساسي ناجح' : 'Basic arithmetic checks passed');
  return (
    <section data-testid="personal-research-readiness" role="status" aria-live="polite"
      className="rounded-xl p-4 mb-4"
      style={{background:'#141F35',border:'1px solid ' + (hold?'#B4544A':caution?'#D08A3E':'#2B3B5C')}}>
      <div className="flex justify-between gap-3 items-center flex-wrap">
        <strong className="text-sm" style={{color:'#EDE6D6'}}>
          {ar?'الاستخدام الشخصي | سلامة الدراسة':'Personal research | Study integrity'}
        </strong>
        <span data-testid="personal-research-status" className="text-xs"
          style={{color:hold?'#E6A09B':caution?'#E7BE86':'#90CBA4'}}>{title}</span>
      </div>
      {data.reasonCodes.length > 0 && (
        <p data-testid="personal-research-reasons" className="text-xs mt-2" style={{color:'#E7BE86'}}>
          {ar ? data.reasonCodes.map(code => AR_REASONS[code] || 'توجد ملاحظة حسابية تتطلب مراجعة').join('؛ ') : data.reasonCodes.join(', ')}
        </p>
      )}
      <p className="text-xs mt-2" style={{color:'#BAC2D2'}}>
        {ar
          ? 'تطابق المجاميع والتدفقات داخل النموذج لا يثبت سعر السوق أو بيانات المقارنات. لا تعد النتيجة تصريحاً بالشراء أو تقرير تقييم معتمداً.'
          : 'Internally consistent model cashflows are not verified market prices. This is neither purchase authorization nor a certified valuation.'}
      </p>
      <p className="text-xs mt-1" style={{color:'#8C97AC'}}>
        {ar
          ? 'عند وجود خطأ في المدخلات تُحجب المؤشرات والنتائج المالية الحالية حتى تصحيح الخطأ وإعادة الحساب.'
          : 'When an input is invalid, current financial indicators and results are withheld until it is corrected and recalculated.'}
      </p>
    </section>
  );
}
