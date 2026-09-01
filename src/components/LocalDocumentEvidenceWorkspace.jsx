import React, { useCallback, useState } from 'react';
import LocalDocumentEvidenceIntakePanel from './LocalDocumentEvidenceIntakePanel.jsx';
import LocalEvidenceQualificationPanel from './LocalEvidenceQualificationPanel.jsx';
import LocalEvidenceVerificationPanel from './LocalEvidenceVerificationPanel.jsx';

export default function LocalDocumentEvidenceWorkspace() {
  const [intakeRecord, setIntakeRecord] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [verificationRecord, setVerificationRecord] = useState(null);

  const handleIntakeChange = useCallback((record) => {
    setIntakeRecord(record);
    setCandidate(null);
    setVerificationRecord(null);
  }, []);

  const handleCandidateChange = useCallback((nextCandidate) => {
    setCandidate(nextCandidate);
    setVerificationRecord(null);
  }, []);

  return (
    <div data-testid="local-document-evidence-workspace">
      <LocalDocumentEvidenceIntakePanel onRecordChange={handleIntakeChange} />
      <LocalEvidenceQualificationPanel intakeRecord={intakeRecord} onCandidateChange={handleCandidateChange} />
      <LocalEvidenceVerificationPanel candidate={candidate} onVerificationRecordChange={setVerificationRecord} />
      <output data-testid="local-evidence-workflow-status" className="sr-only">
        {verificationRecord?.verifiedFactEstablished ? 'VERIFIED_FACT_RECORDED_NOT_UNDERWRITING_READY' : 'VERIFICATION_NOT_COMPLETE'}
      </output>
    </div>
  );
}
