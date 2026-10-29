import React, { useCallback, useState } from 'react';
import LocalEvidenceJournalPanel from './LocalEvidenceJournalPanel.jsx';
import AppraisalAssuranceWorkbench from './AppraisalAssuranceWorkbench.jsx';
import LocalDocumentEvidenceIntakePanel from './LocalDocumentEvidenceIntakePanel.jsx';
import LocalEvidenceQualificationPanel from './LocalEvidenceQualificationPanel.jsx';
import LocalEvidenceVerificationPanel from './LocalEvidenceVerificationPanel.jsx';
const {useLocale}=require('../i18n/LocaleContext');
const {assuranceLabel}=require('../i18n/assurance-workflow-presentation');

export default function LocalDocumentEvidenceWorkspace() {
 const {locale,dir}=useLocale();
 const L=value=>assuranceLabel(value,locale);
  const [caseId,setCaseId]=useState('');
  const [intakeRecord, setIntakeRecord] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [verificationRecord, setVerificationRecord] = useState(null);
  const [selectedAtomId, setSelectedAtomId] = useState(null);

  const handleIntakeChange = useCallback((record, atomId = null) => {
    setIntakeRecord(record);
    setSelectedAtomId(atomId);
    setCandidate(null);
    setVerificationRecord(null);
  }, []);

  const handleCandidateChange = useCallback((nextCandidate) => {
    setCandidate(nextCandidate);
    setVerificationRecord(null);
  }, []);

  return (
    <div data-testid="local-document-evidence-workspace" dir={dir}>
      <label className="mx-auto mt-6 block max-w-7xl px-4 text-xs text-slate-200">{L("معرّف الحالة للمستندات المرتبطة — اختياري")}<input aria-label={L("معرّف الحالة للمستندات")} data-testid="document-case-id" maxLength="160" value={caseId} onChange={e=>setCaseId(e.target.value)} className="mt-2 block w-full rounded border border-slate-600 bg-slate-950 p-2"/></label>
      <LocalDocumentEvidenceIntakePanel caseId={caseId.trim()||null} onRecordChange={handleIntakeChange} />
      <LocalEvidenceQualificationPanel intakeRecord={intakeRecord} preferredAtomId={selectedAtomId} onCandidateChange={handleCandidateChange} />
      <LocalEvidenceVerificationPanel candidate={candidate} onVerificationRecordChange={setVerificationRecord} />
      <LocalEvidenceJournalPanel intakeRecord={intakeRecord} candidate={candidate} verificationRecord={verificationRecord}/>
      <AppraisalAssuranceWorkbench intakeRecord={intakeRecord} />
      <output data-testid="local-evidence-workflow-status" data-verification-status={verificationRecord?.verifiedFactEstablished ? 'VERIFIED_FACT_RECORDED_NOT_UNDERWRITING_READY' : 'VERIFICATION_NOT_COMPLETE'} className="sr-only">
        {verificationRecord?.verifiedFactEstablished ? 'VERIFIED_FACT_RECORDED_NOT_UNDERWRITING_READY' : 'VERIFICATION_NOT_COMPLETE'}
      </output>
    </div>
  );
}
