import React from 'react';
import ValuationIntelligenceBasePanel from './ValuationIntelligenceBasePanel.jsx';
import ValuationAdvancedPanel from './ValuationAdvancedPanel.jsx';
import CriticalEvidenceRequirementsPanel from './CriticalEvidenceRequirementsPanel.jsx';
import DataFreshnessPanel from './DataFreshnessPanel.jsx';

export default function ValuationIntelligencePanel(props) {
  const {
    locale = 'ar-SA',
    valuationCase = null,
    onChangeValuationCase,
  } = props;

  return (
    <>
      <ValuationIntelligenceBasePanel {...props} />
      {valuationCase ? (
        <>
          <ValuationAdvancedPanel
            locale={locale}
            valuationCase={valuationCase}
            onChangeValuationCase={onChangeValuationCase}
          />
          <DataFreshnessPanel
            locale={locale}
            valuationCase={valuationCase}
          />
          <CriticalEvidenceRequirementsPanel
            locale={locale}
            valuationCase={valuationCase}
            onChangeValuationCase={onChangeValuationCase}
          />
        </>
      ) : null}
    </>
  );
}
