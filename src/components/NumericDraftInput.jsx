import React from 'react';
import { parseNumericText } from '../validation/numeric-text';

// Preserve the original text until the domain parser commits the draft. This
// supports Arabic/Persian digits without losing exact ledger minor units.
export default function NumericDraftInput({ value, onChange, locale = 'ar-SA', min = 0, ...props }) {
  const id = React.useId();
  const ref = React.useRef(null);
  const parsed = parseNumericText(value ?? '');
  const invalid = String(value ?? '').trim() !== '' && (!parsed.ok || (min !== null && parsed.value < min));
  const minimumEn = min === null ? '' : ` of at least ${min}`;
  const minimumAr = min === null ? '' : ` لا يقل عن ${min}`;
  const message = locale === 'en'
    ? `Enter a valid number${minimumEn}. Arabic, Persian and English digits are supported; scientific notation is not accepted.`
    : `أدخل رقمًا صحيح الصيغة${minimumAr}. تُقبل الأرقام العربية والفارسية والإنجليزية؛ الصيغة العلمية غير مقبولة.`;
  React.useEffect(() => { ref.current?.setCustomValidity(invalid ? message : ''); }, [invalid, message]);
  return <>
    <input {...props} ref={ref} type="text" inputMode="decimal" dir="ltr" value={value ?? ''} onChange={onChange}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={[props['aria-describedby'], invalid ? id : null].filter(Boolean).join(' ') || undefined} />
    {invalid && <span id={id} role="alert" className="block text-xs text-rose-300">{message}</span>}
  </>;
}
