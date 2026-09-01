import React, { useEffect, useMemo, useState } from 'react';

const { AUTHORITY_CLASS } = require('../document-intelligence/contracts');
const {
  EVIDENCE_VERIFICATION_GATE_STATUS,
  EVIDENCE_VERIFICATION_OUTCOME,
  EVIDENCE_VERIFICATION_DECISION_STATUS,
  buildEvidenceVerificationGate,
  recordEvidenceVerificationDecision,
} = require('../document-intelligence/evidence-verification-readiness');
const { useLocale } = require('../i18n/LocaleContext.js');

const AUTHORITY_OPTIONS = Object.values(AUTHORITY_CLASS).filter((value) => value !== AUTHORITY_CLASS.UNKNOWN);

function uniqueRefs(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
}

function Check({ checked, onChange, label, testId }) {
  return (
    <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/20 p-2 text-[11px] leading-5 text-slate-300">
      <input data-testid={testId} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{label}</span>{children}</label>;
}

const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200';

export default function LocalEvidenceVerificationPanel({ candidate, onVerificationRecordChange }) {
  const { locale, dir } = useLocale();
  const isAr = locale === 'ar-SA';
  const [attestationId, setAttestationId] = useState('');
  const [verifierRef, setVerifierRef] = useState('');
  const [verifierRole, setVerifierRole] = useState('');
  const [verifierIdentityEvidenceRef, setVerifierIdentityEvidenceRef] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('');
  const [verificationReference, setVerificationReference] = useState('');
  const [authorityClass, setAuthorityClass] = useState(AUTHORITY_CLASS.CONTRACTUAL);
  const [authorityEvidenceRef, setAuthorityEvidenceRef] = useState('');
  const [verifiedAt, setVerifiedAt] = useState('');
  const [sourceCheckedAgainstOriginal, setSourceCheckedAgainstOriginal] = useState(false);
  const [semanticMappingReviewed, setSemanticMappingReviewed] = useState(false);
  const [conflictDeclarationCompleted, setConflictDeclarationCompleted] = useState(false);
  const [gate, setGate] = useState(null);

  const [outcome, setOutcome] = useState(EVIDENCE_VERIFICATION_OUTCOME.DEFER);
  const [decisionId, setDecisionId] = useState('');
  const [decidedByRef, setDecidedByRef] = useState('');
  const [decisionEvidenceRef, setDecisionEvidenceRef] = useState('');
  const [decidedAt, setDecidedAt] = useState('');
  const [decisionConflictDeclared, setDecisionConflictDeclared] = useState(false);
  const [ackSource, setAckSource] = useState(false);
  const [ackSemantic, setAckSemantic] = useState(false);
  const [ackAuthority, setAckAuthority] = useState(false);
  const [ackMethod, setAckMethod] = useState(false);
  const [ackAccountability, setAckAccountability] = useState(false);
  const [verificationRecord, setVerificationRecord] = useState(null);

  const l = useMemo(() => isAr ? {
    eyebrow: 'EVIDENCE GOVERNANCE · HUMAN VERIFICATION',
    title: 'التحقق البشري من مرشح الدليل',
    intro: 'هذه المرحلة توثق حزمة تحقق وقرارًا بشريًا منفصلًا. اختيار فئة المصدر هنا لا يثبتها بذاته؛ يجب إدخال مرجع دليل السلطة والتحقق من الأصل.',
    empty: 'أنشئ مرشح دليل صالحًا في المرحلة السابقة لبدء التحقق.',
    packet: 'حزمة التحقق',
    attestationId: 'معرّف حزمة التحقق', verifierRef: 'مرجع منفذ التحقق', verifierRole: 'دور منفذ التحقق', identityRef: 'مرجع دليل هوية المنفذ', method: 'طريقة التحقق', reference: 'مرجع التحقق', authorityClass: 'فئة سلطة المصدر', authorityRef: 'مرجع دليل سلطة المصدر', verifiedAt: 'وقت التحقق',
    original: 'تمت المطابقة مع المصدر/المستند الأصلي.', semantic: 'تمت مراجعة الربط الدلالي والقيمة المستخرجة.', conflict: 'تم استكمال إقرار التعارض/تعارض المصالح.', assess: 'تقييم حزمة التحقق', gateStatus: 'حالة بوابة التحقق',
    decision: 'القرار البشري', outcome: 'النتيجة', decisionId: 'معرّف القرار', decidedBy: 'مرجع صاحب القرار', decisionRef: 'مرجع دليل القرار', decidedAt: 'وقت القرار', decisionConflict: 'تم استكمال إقرار التعارض للقرار.',
    ackSource: 'راجعت مرجع المصدر والأصل.', ackSemantic: 'راجعت المعنى الدلالي.', ackAuthority: 'راجعت دليل سلطة المصدر.', ackMethod: 'راجعت طريقة ومرجع التحقق.', ackAccountability: 'أتحمل مسؤولية القرار البشري المسجل.', record: 'تسجيل القرار البشري',
    truth: 'حالة الحقيقة', authority: 'السلطة', engine: 'المحرك المالي', notEligible: 'غير مؤهل تلقائيًا', boundary: 'VERIFIED_FACT هنا سجل تحقق داخلي مبني على الأدلة والمراجع المدخلة. لا يمثل شهادة خارجية أو تقييمًا مرخصًا، ولا يكتب أي مدخل مالي ولا يجيز معاملة.',
  } : {
    eyebrow: 'EVIDENCE GOVERNANCE · HUMAN VERIFICATION',
    title: 'Human verification of an evidence candidate',
    intro: 'This stage records a verification packet and a separate human decision. Selecting an authority class does not prove it; authority evidence and an original-source check are required.',
    empty: 'Create a valid evidence candidate in the previous stage to begin verification.',
    packet: 'Verification packet',
    attestationId: 'Attestation ID', verifierRef: 'Verifier reference', verifierRole: 'Verifier role', identityRef: 'Verifier identity-evidence ref', method: 'Verification method', reference: 'Verification reference', authorityClass: 'Source authority class', authorityRef: 'Authority-evidence ref', verifiedAt: 'Verified at',
    original: 'Checked against the original source/document.', semantic: 'Reviewed the semantic mapping and extracted value.', conflict: 'Completed the conflict / conflict-of-interest declaration.', assess: 'Assess verification packet', gateStatus: 'Verification gate status',
    decision: 'Human decision', outcome: 'Outcome', decisionId: 'Decision ID', decidedBy: 'Decision-maker reference', decisionRef: 'Decision evidence ref', decidedAt: 'Decided at', decisionConflict: 'Completed the decision conflict declaration.',
    ackSource: 'I reviewed the source reference and original.', ackSemantic: 'I reviewed the semantic meaning.', ackAuthority: 'I reviewed the authority evidence.', ackMethod: 'I reviewed the verification method/reference.', ackAccountability: 'I accept accountability for the recorded human decision.', record: 'Record human decision',
    truth: 'Truth status', authority: 'Authority', engine: 'Financial engine', notEligible: 'Not automatically eligible', boundary: 'VERIFIED_FACT here is an internal evidence-governance record based on supplied evidence and references. It is not external certification or a licensed valuation, does not write financial inputs, and does not authorize a transaction.',
  }, [isAr]);

  useEffect(() => {
    setGate(null);
    setVerificationRecord(null);
    onVerificationRecordChange?.(null);
  }, [candidate, onVerificationRecordChange]);

  const attestationRefs = uniqueRefs([
    candidate?.sourceProvenance?.sourceReference,
    candidate?.sourceProvenance?.reviewerRef,
    verifierRef,
    verifierIdentityEvidenceRef,
    verificationReference,
    authorityEvidenceRef,
  ]);

  const assess = () => {
    const result = buildEvidenceVerificationGate({
      candidate,
      verificationAttestation: {
        attestationId,
        verifierRef,
        verifierRole,
        verifierIdentityEvidenceRef,
        verificationMethod,
        verificationReference,
        authorityClass,
        authorityEvidenceRef,
        sourceCheckedAgainstOriginal,
        semanticMappingReviewed,
        conflictDeclarationCompleted,
        verifiedAt,
      },
      evidenceRefs: attestationRefs,
    });
    setGate(result);
    setVerificationRecord(null);
    onVerificationRecordChange?.(null);
  };

  const recordDecision = () => {
    const refs = uniqueRefs([...attestationRefs, decidedByRef, decisionEvidenceRef]);
    const result = recordEvidenceVerificationDecision({
      gate,
      decision: {
        decisionId,
        outcome,
        decidedByRef,
        decisionEvidenceRef,
        decidedAt,
        conflictDeclarationCompleted: decisionConflictDeclared,
        acknowledgements: {
          sourceReferenceReviewed: ackSource,
          semanticMappingReviewed: ackSemantic,
          authorityEvidenceReviewed: ackAuthority,
          verificationMethodReviewed: ackMethod,
          humanAccountabilityAccepted: ackAccountability,
        },
      },
      evidenceRefs: refs,
    });
    setVerificationRecord(result);
    onVerificationRecordChange?.(result);
  };

  if (!candidate || candidate.status !== 'CANDIDATE_REQUIRES_VERIFICATION') {
    return (
      <section data-testid="local-evidence-verification" dir={dir} className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8">
        <div className="rounded-2xl border border-violet-900/50 bg-[#101a2d] p-4 md:p-5">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-violet-300/80">{l.eyebrow}</div>
          <h2 className="mt-1 text-lg font-bold text-slate-100">{l.title}</h2>
          <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-500">{l.empty}</div>
        </div>
      </section>
    );
  }

  const gateReady = gate?.status === EVIDENCE_VERIFICATION_GATE_STATUS.READY_FOR_HUMAN_VERIFICATION_DECISION;
  const decisionRecorded = verificationRecord?.status === EVIDENCE_VERIFICATION_DECISION_STATUS.DECISION_RECORDED;

  return (
    <section data-testid="local-evidence-verification" dir={dir} className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8">
      <div className="rounded-2xl border border-violet-800/50 bg-[#101a2d] p-4 md:p-5">
        <div className="text-[10px] font-semibold tracking-[0.18em] text-violet-300/80">{l.eyebrow}</div>
        <h2 className="mt-1 text-lg font-bold text-slate-100">{l.title}</h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-300">{l.intro}</p>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-violet-200">{l.packet}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={l.attestationId}><input data-testid="verification-attestation-id" value={attestationId} onChange={(e) => setAttestationId(e.target.value)} className={inputClass} /></Field>
              <Field label={l.verifierRef}><input data-testid="verification-verifier-ref" value={verifierRef} onChange={(e) => setVerifierRef(e.target.value)} className={inputClass} /></Field>
              <Field label={l.verifierRole}><input data-testid="verification-verifier-role" value={verifierRole} onChange={(e) => setVerifierRole(e.target.value)} className={inputClass} /></Field>
              <Field label={l.identityRef}><input data-testid="verification-identity-ref" value={verifierIdentityEvidenceRef} onChange={(e) => setVerifierIdentityEvidenceRef(e.target.value)} className={inputClass} /></Field>
              <Field label={l.method}><input data-testid="verification-method" value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)} className={inputClass} /></Field>
              <Field label={l.reference}><input data-testid="verification-reference" value={verificationReference} onChange={(e) => setVerificationReference(e.target.value)} className={inputClass} /></Field>
              <Field label={l.authorityClass}><select data-testid="verification-authority-class" value={authorityClass} onChange={(e) => setAuthorityClass(e.target.value)} className={inputClass}>{AUTHORITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
              <Field label={l.authorityRef}><input data-testid="verification-authority-ref" value={authorityEvidenceRef} onChange={(e) => setAuthorityEvidenceRef(e.target.value)} className={inputClass} /></Field>
              <Field label={l.verifiedAt}><input data-testid="verification-verified-at" type="datetime-local" value={verifiedAt} onChange={(e) => setVerifiedAt(e.target.value)} className={inputClass} /></Field>
            </div>
            <div className="grid gap-2">
              <Check testId="verification-original-check" checked={sourceCheckedAgainstOriginal} onChange={setSourceCheckedAgainstOriginal} label={l.original} />
              <Check testId="verification-semantic-check" checked={semanticMappingReviewed} onChange={setSemanticMappingReviewed} label={l.semantic} />
              <Check testId="verification-conflict-check" checked={conflictDeclarationCompleted} onChange={setConflictDeclarationCompleted} label={l.conflict} />
            </div>
            <button data-testid="assess-verification-packet" type="button" onClick={assess} className="rounded-lg border border-violet-600/60 bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-200">{l.assess}</button>
            {gate ? <div data-testid="verification-gate-result" className={`rounded-lg border p-3 text-xs ${gateReady ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-200' : 'border-rose-800/60 bg-rose-950/20 text-rose-200'}`}><div className="text-[10px] opacity-70">{l.gateStatus}</div><div className="mt-1 font-semibold">{gate.status}</div>{gate.reasons?.length ? <div className="mt-2 text-[11px]">{gate.reasons.join(' · ')}</div> : null}</div> : null}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-violet-200">{l.decision}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={l.outcome}><select data-testid="verification-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} disabled={!gateReady} className={inputClass}><option value={EVIDENCE_VERIFICATION_OUTCOME.DEFER}>DEFER</option><option value={EVIDENCE_VERIFICATION_OUTCOME.VERIFY_FACT}>VERIFY_FACT</option><option value={EVIDENCE_VERIFICATION_OUTCOME.REJECT_CANDIDATE}>REJECT_CANDIDATE</option></select></Field>
              <Field label={l.decisionId}><input data-testid="verification-decision-id" value={decisionId} onChange={(e) => setDecisionId(e.target.value)} disabled={!gateReady} className={inputClass} /></Field>
              <Field label={l.decidedBy}><input data-testid="verification-decided-by" value={decidedByRef} onChange={(e) => setDecidedByRef(e.target.value)} disabled={!gateReady} className={inputClass} /></Field>
              <Field label={l.decisionRef}><input data-testid="verification-decision-ref" value={decisionEvidenceRef} onChange={(e) => setDecisionEvidenceRef(e.target.value)} disabled={!gateReady} className={inputClass} /></Field>
              <Field label={l.decidedAt}><input data-testid="verification-decided-at" type="datetime-local" value={decidedAt} onChange={(e) => setDecidedAt(e.target.value)} disabled={!gateReady} className={inputClass} /></Field>
            </div>
            <div className="grid gap-2">
              <Check testId="verification-decision-conflict" checked={decisionConflictDeclared} onChange={setDecisionConflictDeclared} label={l.decisionConflict} />
              <Check testId="verification-ack-source" checked={ackSource} onChange={setAckSource} label={l.ackSource} />
              <Check testId="verification-ack-semantic" checked={ackSemantic} onChange={setAckSemantic} label={l.ackSemantic} />
              <Check testId="verification-ack-authority" checked={ackAuthority} onChange={setAckAuthority} label={l.ackAuthority} />
              <Check testId="verification-ack-method" checked={ackMethod} onChange={setAckMethod} label={l.ackMethod} />
              <Check testId="verification-ack-accountability" checked={ackAccountability} onChange={setAckAccountability} label={l.ackAccountability} />
            </div>
            <button data-testid="record-verification-decision" type="button" onClick={recordDecision} disabled={!gateReady} className="rounded-lg border border-violet-600/60 bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-200 disabled:cursor-not-allowed disabled:opacity-40">{l.record}</button>

            {verificationRecord ? (
              <div data-testid="verification-decision-result" className={`rounded-xl border p-4 ${decisionRecorded ? 'border-slate-700 bg-slate-950/25' : 'border-rose-800/60 bg-rose-950/20'}`}>
                <div className="text-xs font-semibold text-slate-200">{verificationRecord.status}</div>
                {decisionRecorded ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div><div className="text-[10px] text-slate-500">{l.truth}</div><div data-testid="verified-truth-status" className="mt-1 text-xs text-slate-200">{verificationRecord.verifiedFact?.truthStatus || '—'}</div></div>
                    <div><div className="text-[10px] text-slate-500">{l.authority}</div><div data-testid="verified-authority-status" className="mt-1 text-xs text-slate-200">{verificationRecord.verifiedFact ? `${verificationRecord.verifiedFact.authorityClass} · verified=${String(verificationRecord.verifiedFact.authorityVerified)}` : '—'}</div></div>
                    <div><div className="text-[10px] text-slate-500">{l.engine}</div><div className="mt-1 text-xs text-amber-200">{l.notEligible}</div></div>
                  </div>
                ) : <div className="mt-2 text-[11px] text-rose-200">{verificationRecord.reasons?.join(' · ')}</div>}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-[11px] leading-5 text-amber-100/80">{l.boundary}</div>
      </div>
    </section>
  );
}
