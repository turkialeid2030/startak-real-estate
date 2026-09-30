import React from 'react';
import ValuationIntelligenceBasePanel from './ValuationIntelligenceBasePanel.jsx';
import ValuationAdvancedPanel from './ValuationAdvancedPanel.jsx';
import CriticalEvidenceRequirementsPanel from './CriticalEvidenceRequirementsPanel.jsx';
import GovernedDecisionOperationsPanel from './GovernedDecisionOperationsPanel.jsx';

export default function ValuationIntelligencePanel(props) {
  const {
    locale = 'ar-SA',
    valuationCase = null,
    onChangeValuationCase,
    onRecordGovernedHumanReview,
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
          <CriticalEvidenceRequirementsPanel
            locale={locale}
            valuationCase={valuationCase}
            onChangeValuationCase={onChangeValuationCase}
          />
          <GovernedDecisionOperationsPanel
            locale={locale}
            valuationCase={valuationCase}
            onRecordGovernedHumanReview={onRecordGovernedHumanReview}
          />
        </>
      ) : null}
    </>
  );
}
