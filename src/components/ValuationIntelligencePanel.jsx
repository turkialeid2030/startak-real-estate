import React from 'react';
import ValuationIntelligenceBasePanel from './ValuationIntelligenceBasePanel.jsx';
import PersonalInvestmentResearchPanel from './PersonalInvestmentResearchPanel.jsx';
import ValuationAdvancedPanel from './ValuationAdvancedPanel.jsx';
import CriticalEvidenceRequirementsPanel from './CriticalEvidenceRequirementsPanel.jsx';

export default function ValuationIntelligencePanel(props) {
  const {
    locale = 'ar-SA',
    valuationCase = null,
    onChangeValuationCase,
    valuationEditorDraft = null,
    onChangeValuationEditorDraft,
    hidePersonalReport = false,
  } = props;

  return (
    <>
      <ValuationIntelligenceBasePanel {...props}
        onChangeValuationCase={next => onChangeValuationCase?.(next, 'base')}
        editorDraft={valuationEditorDraft?.base}
        onChangeEditorDraft={draft => onChangeValuationEditorDraft?.('base', draft)} />
      {!hidePersonalReport && <PersonalInvestmentResearchPanel {...props} />}
      {valuationCase ? (
        <>
          <ValuationAdvancedPanel
            locale={locale}
            valuationCase={valuationCase}
            onChangeValuationCase={next => onChangeValuationCase?.(next, 'advanced')}
            editorDraft={valuationEditorDraft?.advanced}
            onChangeEditorDraft={draft => onChangeValuationEditorDraft?.('advanced', draft)}
          />
          <CriticalEvidenceRequirementsPanel
            locale={locale}
            valuationCase={valuationCase}
            onChangeValuationCase={next => onChangeValuationCase?.(next, 'critical')}
            editorDraft={valuationEditorDraft?.critical}
            onChangeEditorDraft={draft => onChangeValuationEditorDraft?.('critical', draft)}
          />
        </>
      ) : null}
    </>
  );
}
