import DiagnosticText from './DiagnosticText.jsx';
import React, { useCallback, useEffect, useState } from 'react';
import {usePersonalCaseSession} from './PersonalCaseSessionContext.jsx';
import LocalEvidenceJournalPanel from './LocalEvidenceJournalPanel.jsx';
import AppraisalAssuranceWorkbench from './AppraisalAssuranceWorkbench.jsx';
import LocalDocumentEvidenceIntakePanel from './LocalDocumentEvidenceIntakePanel.jsx';
import LocalEvidenceQualificationPanel from './LocalEvidenceQualificationPanel.jsx';
import LocalEvidenceVerificationPanel from './LocalEvidenceVerificationPanel.jsx';
const {useLocale}=require('../i18n/LocaleContext');
const {assuranceLabel}=require('../i18n/assurance-workflow-presentation');

export default function LocalDocumentEvidenceWorkspace() {
 const {locale,dir}=useLocale();
 const {linkedCase}=usePersonalCaseSession();
 const L=value=>assuranceLabel(value,locale);
 const [manualCaseId,setManualCaseId]=useState('');
 const [manualOverride,setManualOverride]=useState(false);
 const caseId=manualOverride?manualCaseId.trim()||null:
   (linkedCase?.caseId||manualCaseId.trim()||null);
 useEffect(()=>{
   // A selected-deal switch always wins over an older manual override.
   setManualOverride(false);setManualCaseId('');
 },[linkedCase?.caseId]);
  const [intakeRecord, setIntakeRecord] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [verificationRecord, setVerificationRecord] = useState(null);
  const [selectedAtomId, setSelectedAtomId] = useState(null);
  useEffect(()=>{
    // A change of saved deal or manual case must invalidate every in-memory
    // candidate/verification, preventing cross-property evidence leakage.
    setIntakeRecord(null);setCandidate(null);
    setVerificationRecord(null);setSelectedAtomId(null);
  },[caseId]);

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
      <label className="mx-auto mt-6 block max-w-7xl px-4 text-xs text-slate-200">{L("معرّف الحالة للمستندات المرتبطة — اختياري")}
        <input aria-label={L("معرّف الحالة للمستندات")} data-testid="document-case-id" maxLength="160"
         value={manualOverride?manualCaseId:(linkedCase?.caseId||manualCaseId)}
         onChange={e=>{setManualOverride(true);setManualCaseId(e.target.value);}}
         className="mt-2 block w-full rounded border border-slate-600 bg-slate-950 p-2"/>
      </label>
      <p data-testid="document-linked-case"
       data-bound={linkedCase?(manualOverride?'manual-override':'saved-deal'):'manual-or-unlinked'}
       className="mx-auto max-w-7xl px-4 text-xs text-amber-200">
       {linkedCase ? (manualOverride
        ? (locale==='en'?'Manual case override: documents now use the case ID typed above, not the selected saved property.':'تم تعديل نطاق المستندات يدويًا؛ يُستخدم معرّف الحالة المكتوب لا الملف العقاري المحفوظ.')
        : (locale==='en'?'Documents initially follow the selected saved property. Edit the case ID only when intentionally using another case.':'المستندات مرتبطة مبدئيًا بالعقار المحفوظ المختار. غيّر معرّف الحالة فقط عند الرغبة في فتح حالة أخرى.'))
        : (locale==='en'?'No saved property selected. Enter a case ID to scope documents.':'لا يوجد ملف عقاري محفوظ مختار. أدخل معرّف حالة لربط المستندات.')}
      </p>
      <LocalDocumentEvidenceIntakePanel key={caseId||'unlinked'} caseId={caseId} onRecordChange={handleIntakeChange} />
      <LocalEvidenceQualificationPanel intakeRecord={intakeRecord} preferredAtomId={selectedAtomId} onCandidateChange={handleCandidateChange} />
      <LocalEvidenceVerificationPanel candidate={candidate} onVerificationRecordChange={setVerificationRecord} />
      <LocalEvidenceJournalPanel intakeRecord={intakeRecord} candidate={candidate} verificationRecord={verificationRecord}/>
      <AppraisalAssuranceWorkbench intakeRecord={intakeRecord} />
      <output data-testid="local-evidence-workflow-status" data-verification-status={verificationRecord?.verifiedFactEstablished ? 'VERIFIED_FACT_RECORDED_NOT_UNDERWRITING_READY' : 'VERIFICATION_NOT_COMPLETE'} className="sr-only">
        <DiagnosticText locale={locale} code={verificationRecord?.verifiedFactEstablished ? 'VERIFIED_FACT_RECORDED_NOT_UNDERWRITING_READY' : 'VERIFICATION_NOT_COMPLETE'}/>
      </output>
    </div>
  );
}
