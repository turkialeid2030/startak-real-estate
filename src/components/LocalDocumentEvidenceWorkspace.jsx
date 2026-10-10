import React, { useCallback, useState } from 'react';
import LocalEvidenceJournalPanel from './LocalEvidenceJournalPanel.jsx';
import LocalDocumentEvidenceIntakePanel from './LocalDocumentEvidenceIntakePanel.jsx';
import LocalEvidenceQualificationPanel from './LocalEvidenceQualificationPanel.jsx';
import LocalEvidenceVerificationPanel from './LocalEvidenceVerificationPanel.jsx';

export default function LocalDocumentEvidenceWorkspace() {
  const [caseId,setCaseId]=useState('');
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
      <label className="mx-auto mt-6 block max-w-7xl px-4 text-xs text-slate-200">معرّف الحالة للمستندات المرتبطة — اختياري<input aria-label="معرّف الحالة للمستندات" data-testid="document-case-id" maxLength="160" value={caseId} onChange={e=>setCaseId(e.target.value)} className="mt-2 block w-full rounded border border-slate-600 bg-slate-950 p-2"/></label>
      <LocalDocumentEvidenceIntakePanel caseId={caseId.trim()||null} onRecordChange={handleIntakeChange} />
      <LocalEvidenceQualificationPanel intakeRecord={intakeRecord} onCandidateChange={handleCandidateChange} />
      <LocalEvidenceVerificationPanel candidate={candidate} onVerificationRecordChange={setVerificationRecord} />
      <LocalEvidenceJournalPanel intakeRecord={intakeRecord} candidate={candidate} verificationRecord={verificationRecord}/>
      <output data-testid="local-evidence-workflow-status" className="sr-only">
        {verificationRecord?.verifiedFactEstablished ? 'VERIFIED_FACT_RECORDED_NOT_UNDERWRITING_READY' : 'VERIFICATION_NOT_COMPLETE'}
      </output>
    </div>
  );
}
