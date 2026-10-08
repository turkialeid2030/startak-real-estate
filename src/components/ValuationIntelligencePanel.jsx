import React from 'react';
import ValuationIntelligenceBasePanel from './ValuationIntelligenceBasePanel.jsx';
import ValuationAdvancedPanel from './ValuationAdvancedPanel.jsx';
import CriticalEvidenceRequirementsPanel from './CriticalEvidenceRequirementsPanel.jsx';
import GovernedDecisionOperationsPanel from './GovernedDecisionOperationsPanel.jsx';
import GovernedHumanReviewPanel from './GovernedHumanReviewPanel.jsx';
import SpecialistEvidenceIntakePanel from './SpecialistEvidenceIntakePanel.jsx';
import SpecialistDocumentHashPanel from './SpecialistDocumentHashPanel.jsx';

export default function ValuationIntelligencePanel(props) {
  const {
    locale = 'ar-SA',
    valuationCase = null,
    onChangeValuationCase,
  } = props;

  return (
    <>
      <ValuationIntelligenceBasePanel {...props} />
      <SpecialistEvidenceIntakePanel {...props} />
      <SpecialistDocumentHashPanel {...props} />
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
          />
          <GovernedHumanReviewPanel
            locale={locale}
            valuationCase={valuationCase}
          />
        </>
      ) : null}
    </>
  );
}
