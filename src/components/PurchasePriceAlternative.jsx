import React from 'react';
const { purchaseAlternativeMessage } = require('../assumptions/purchase-boundary-qualification');

export default function PurchasePriceAlternative({ alternative, locale = 'ar-SA', inputValid = true }) {
  if (!inputValid) return <p role="status" data-testid="building-price-review-invalid" className="text-xs text-amber-300">{locale === 'en' ? 'Current inputs are invalid; purchase price qualification is unavailable.' : 'المدخلات الحالية غير صالحة؛ فحص سعر الشراء غير متاح.'}</p>;
  if (!alternative || (alternative.status === 'NOT_SEARCHED' && alternative.price == null)) return null;
  const verified = alternative.status === 'VERIFIED_LOWER_PRICE'
    && Number.isFinite(alternative.price) && alternative.price > 0;
  return <div data-testid="building-price-alternative" className="mt-2 rounded border border-slate-600 p-3 text-xs text-slate-200">
    <p role="status" data-testid="building-price-alternative-status">{purchaseAlternativeMessage(alternative, locale)}</p>
    {verified && <p className="mt-2">
      {locale === 'en' ? 'Verified lower alternative: ' : 'السعر البديل الأقل المتحقق منه: '}
      <span data-testid="building-price-alternative-value" dir="ltr">{alternative.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {locale === 'en' ? 'SAR' : 'ر.س'}</span>
    </p>}
  </div>;
}
