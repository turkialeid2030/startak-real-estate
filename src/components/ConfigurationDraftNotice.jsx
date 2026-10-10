import React from 'react';
import DiagnosticText from './DiagnosticText.jsx';

export default function ConfigurationDraftNotice({ code, locale }) {
  if (!code) return null;
  return <div role="alert" data-testid="valuation-draft-edit-error" className="mt-3 rounded-lg border border-amber-700 p-3 text-xs text-amber-200">
    <DiagnosticText code={code} locale={locale} />
  </div>;
}
