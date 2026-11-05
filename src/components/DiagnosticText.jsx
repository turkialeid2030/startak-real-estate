import React from 'react';
const { describeDiagnostic } = require('../i18n/diagnostic-presentation');

export default function DiagnosticText({ code, locale = 'ar-SA' }) {
  const diagnostic = describeDiagnostic(code, locale);
  return <span data-diagnostic-content data-diagnostic-code={diagnostic.code}>
    <span>{diagnostic.message}</span>
  </span>;
}
