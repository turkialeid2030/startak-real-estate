'use strict';

const React = require('react');

// Keep editable inputs and the last valid calculation in memory for recovery,
// but never present that historical calculation as the current input's output.
function CurrentCalculationBoundary({ invalid, locale = 'ar-SA', children }) {
  if (!invalid) return children;
  const ar = locale !== 'en';
  return React.createElement('div', {
    role: 'status',
    'aria-live': 'polite',
    'data-testid': 'current-calculation-unavailable',
    className: 'rounded-xl border border-amber-500/50 bg-amber-950/30 p-4 mb-4 text-sm text-amber-100',
  }, ar
    ? 'النتائج الحالية محجوبة لأن أحد المدخلات غير صالح. صحّح الحقل لإعادة الحساب؛ لا تُعرض أرقام الدراسة السابقة بوصفها نتائج حالية.'
    : 'Current results are withheld because an input is invalid. Correct the field to recalculate; previous study figures are not shown as current results.');
}

module.exports = CurrentCalculationBoundary;
