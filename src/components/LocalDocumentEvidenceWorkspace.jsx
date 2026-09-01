import React, { useState } from 'react';
import LocalDocumentEvidenceIntakePanel from './LocalDocumentEvidenceIntakePanel.jsx';
import LocalEvidenceQualificationPanel from './LocalEvidenceQualificationPanel.jsx';

export default function LocalDocumentEvidenceWorkspace() {
  const [intakeRecord, setIntakeRecord] = useState(null);

  return (
    <div data-testid="local-document-evidence-workspace">
      <LocalDocumentEvidenceIntakePanel onRecordChange={setIntakeRecord} />
      <LocalEvidenceQualificationPanel intakeRecord={intakeRecord} />
    </div>
  );
}
