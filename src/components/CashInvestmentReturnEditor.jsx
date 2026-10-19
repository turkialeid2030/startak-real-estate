import React from 'react';
import NumericDraftInput from './NumericDraftInput';
const cls='w-full min-w-0 rounded border border-slate-600 bg-slate-950 p-2 text-xs';
export default function CashInvestmentReturnEditor({value,onChange,dir}) {
  const t=(a,b)=>dir==='rtl'?a:b;
  const change=patch=>onChange({...value,...patch});
  const field=(key,label,type='text')=><label className="block" key={key}>{label}<input className={cls} data-testid={`cash-return-${key}`} type={type} required maxLength={500} value={value[key]} onChange={e=>change({[key]:e.target.value})}/></label>;
  const money=(key,label)=><label className="block" key={key}>{label}<NumericDraftInput className={cls} data-testid={`cash-return-${key}`} locale={dir==='rtl'?'ar-SA':'en'} min={0.01} required value={value[key]} onChange={e=>change({[key]:e.target.value})}/></label>;
  return <details className="rounded border border-slate-700 p-3" data-testid="cash-return-editor">
    <summary>{t('عائد مؤرخ من التدفقات المدخلة — اختياري','Dated return from entered flows — optional')}</summary>
    <label className="my-2 flex gap-2"><input data-testid="cash-return-enabled" type="checkbox" checked={value.enabled} onChange={e=>change({enabled:e.target.checked})}/>{t('إدراج سيناريو عائد غير ممول','Include an unlevered return scenario')}</label>
    {value.enabled&&<div className="space-y-2">
      <p>{t('مبلغ الشراء تدفق خارج في بداية تاريخ الحالة. أدخل ثمن الأصل دون رسوم ستُسجل منفصلة، وليس مساهمة حقوق ملكية بعد قرض. يجمع الحساب تحصيلات الإيجار ودفعات التشغيل والرأسمالي والضرائب والرسوم المدخلة بتواريخها؛ يستبعد الرصيد الافتتاحي والتمويل والتأمينات والاحتياطي والاستحقاقات والتحصيل التاريخي. وجود تدفق مصنف «أخرى» يحجب العائد حتى تصنيفه. راجع تغطية جميع البنود قبل الحساب.','Acquisition is an outflow at the case start. Enter the asset price excluding fees recorded separately, not equity after borrowing. The calculation uses entered dated rent receipts, operating/capital payments, taxes and fees; it excludes opening balance, financing, deposits, reserves, accruals and historical collections. An OTHER flow withholds the return until classified. Review every flow category before calculation.')}</p>
      {money('acquisitionAmount',t('ثمن شراء الأصل بالريال','Asset acquisition price SAR'))}
      {field('acquisitionSourceRef',t('مرجع ثمن الشراء وتاريخ الحالة','Acquisition price and case-date source'))}
      <label className="block">{t('معدل الخصم السنوي % — افتراض المستخدم','Annual discount rate % — user assumption')}<NumericDraftInput className={cls} data-testid="cash-return-discountPercent" locale={dir==='rtl'?'ar-SA':'en'} min={-100} required value={value.discountPercent} onChange={e=>change({discountPercent:e.target.value})}/></label>
      {field('discountSourceRef',t('مرجع افتراض معدل الخصم','Discount-rate assumption reference'))}
      <label className="block">{t('معالجة قيمة الأصل في نهاية السيناريو','Asset value treatment at scenario end')}<select className={cls} data-testid="cash-return-exitTreatment" value={value.exitTreatment} onChange={e=>change({exitTreatment:e.target.value})}><option value="NO_SALE_INCLUDED">{t('لا بيع ولا قيمة متبقية ضمن التدفقات','No sale or residual asset value in flows')}</option><option value="EXPLICIT_SALE">{t('صافي بيع صريح بتاريخ ومرجع','Explicit dated net sale with source')}</option></select></label>
      {value.exitTreatment==='EXPLICIT_SALE'&&<>
        {field('saleDate',t('تاريخ البيع — داخل الأفق وبعد تاريخ الحالة','Sale date — within horizon and after case date'),'date')}
        {money('netSaleAmount',t('صافي حصيلة البيع بعد تكاليفه وضرائبه بالريال','Net sale proceeds after sale costs and taxes SAR'))}
        {field('saleSourceRef',t('مرجع افتراض صافي البيع','Net sale assumption reference'))}
      </>}
      {field('reviewRef',t('مرجع المراجعة — مختلف عن مراجع المبالغ','Review reference distinct from amount sources'))}
      <p>{t('صافي البيع لا يُكرر ضمن التحصيل أو التدفقات الأخرى، ولا تُخصم تكاليف البيع مرة ثانية. حجب البيع يعني استبعاد قيمة الأصل المتبقية بالكامل؛ العائد المحسوب عندئذ يخص التدفقات الجزئية فقط. لا يغير الحساب عوائد الدراسة الرئيسية ولا يثبت صحة المصادر أو دقة توقع السوق أو تفويض الاستثمار.','Do not duplicate sale proceeds in receipts/other flows or deduct sale costs twice. Omitting sale excludes the retained asset value completely; any return then describes partial flows only. The calculation does not alter main-study returns or establish source validity, market accuracy or investment authority.')}</p>
    </div>}
  </details>;
}
