import React from 'react';
const { describeDiagnostic } = require('../i18n/diagnostic-presentation');

export default function DiagnosticText({ code, locale = 'ar-SA' }) {
  const diagnostic = describeDiagnostic(code, locale);
  return <span data-diagnostic-content translate="no">
    <span>{diagnostic.message}</span>{' '}
    <code dir="ltr" className="break-all text-[10px]">{diagnostic.code}</code>
  </span>;
}
