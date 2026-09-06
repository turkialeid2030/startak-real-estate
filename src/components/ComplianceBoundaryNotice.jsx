import React from 'react';
const { useLocale } = require('../i18n/LocaleContext.js');
const { SHORT_SCOPE_NOTICE, FULL_SCOPE_NOTICE } = require('../compliance/decision-support.js');

export default function ComplianceBoundaryNotice() {
  const { locale } = useLocale();
  const language = String(locale || '').toLowerCase().startsWith('en') ? 'en' : 'ar';

  return (
    <aside
      data-testid="compliance-boundary-notice"
      aria-label={language === 'ar' ? 'حدود نطاق أداة دعم القرار' : 'Decision-support scope boundary'}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 16px',
        background: '#101A2D',
        borderBottom: '1px solid #2B3B5C',
        color: '#D8D0BF',
        fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
        fontSize: '12px',
        lineHeight: 1.6,
      }}
    >
      <strong data-testid="compliance-short-notice" style={{ color: '#E7D3A0' }}>
        {SHORT_SCOPE_NOTICE[language]}
      </strong>
      <details style={{ marginTop: '4px' }}>
        <summary style={{ cursor: 'pointer' }}>
          {language === 'ar' ? 'عرض حدود النطاق كاملة' : 'View full scope boundary'}
        </summary>
        <div data-testid="compliance-full-notice" style={{ marginTop: '6px', maxWidth: '1200px' }}>
          {FULL_SCOPE_NOTICE[language]}
        </div>
      </details>
    </aside>
  );
}
