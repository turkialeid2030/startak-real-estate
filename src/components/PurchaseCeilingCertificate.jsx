import React from 'react';
const { purchaseCeilingCertificateMessage } = require('../assumptions/purchase-ceiling-certificate');
const { purchaseBoundaryMessage } = require('../assumptions/purchase-boundary-qualification');

export default function PurchaseCeilingCertificate({ certificate, locale = 'ar-SA', inputValid = true }) {
  if (!inputValid || !certificate) return null;
  const proven = certificate.status === 'PROVEN_WITHIN_MODEL' && certificate.maximumProvenWithinModel === true
    && Number.isFinite(certificate.price) && certificate.price > 0;
  const money = value => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <details data-testid="building-price-certificate" data-status={certificate.status} className="mt-3 rounded border border-slate-600 p-3 text-xs text-slate-200">
    <summary>{locale === 'en' ? 'Purchase ceiling proof scope' : 'نطاق إثبات الحد الأعلى لسعر الشراء'}</summary>
    <p role="status" className="mt-2" data-testid="building-price-certificate-status">{purchaseCeilingCertificateMessage(certificate, locale)}</p>
    {proven && <>
      <dl className="mt-2 grid gap-1">
        <dt>{locale === 'en' ? 'Highest passing price within the model' : 'أعلى سعر مجتاز ضمن النموذج'}</dt>
        <dd dir="ltr" data-testid="building-price-certificate-value">{money(certificate.price)} {locale === 'en' ? 'SAR' : 'ر.س'}</dd>
        <dt>{locale === 'en' ? 'Next halala: excluded by a necessary gate' : 'السعر الأعلى بهللة: مستبعد بقيد لازم'}</dt>
        <dd dir="ltr" data-testid="building-price-certificate-next">{money(certificate.nextPrice)} {locale === 'en' ? 'SAR' : 'ر.س'}</dd>
      </dl>
      <p className="mt-2" data-testid="building-price-certificate-blockers">{purchaseBoundaryMessage({ failedCriteria: certificate.blockingCriteria }, locale)}</p>
      <p className="mt-2">{locale === 'en'
        ? 'The proof uses unchanged future income/exit flows and acquisition costs that rise with price. It applies only to the supported canonical model, these inputs and whole halalas; changing inputs requires a new proof. Full evidence is in the JSON financial report.'
        : 'يعتمد البرهان على ثبات دخل التشغيل والتخارج وزيادة تكلفة الاستحواذ مع السعر. يخص المحرك المدعوم وهذه المدخلات وأسعار الهللات الكاملة فقط؛ تغيير المدخلات يتطلب برهانًا جديدًا. يحفظ ملف بيانات التقرير المالي تفاصيل الإثبات.'}</p>
    </>}
  </details>;
}
