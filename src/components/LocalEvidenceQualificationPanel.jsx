import React, { useEffect, useMemo, useState } from 'react';

const { MATERIALITY } = require('../document-intelligence/contracts');
const {
  PARSED_EVIDENCE_QUALIFICATION_STATUS,
  buildParsedEvidenceCandidate,
} = require('../document-intelligence/parsed-evidence-qualification');
const { useLocale } = require('../i18n/LocaleContext.js');

const VALUE_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE'];

function shortValue(value, max = 100) {
  const text = value === null || value === undefined ? '' : String(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function LocalEvidenceQualificationPanel({ intakeRecord, onCandidateChange }) {
  const { locale, dir } = useLocale();
  const isAr = locale === 'ar-SA';
  const atoms = intakeRecord?.result?.status === 'PARSED' && Array.isArray(intakeRecord.result.atoms)
    ? intakeRecord.result.atoms.slice(0, 50)
    : [];

  const [atomId, setAtomId] = useState('');
  const [semanticKey, setSemanticKey] = useState('');
  const [valueType, setValueType] = useState('STRING');
  const [unit, setUnit] = useState('');
  const [materiality, setMateriality] = useState(MATERIALITY.SUPPORTING);
  const [sourceReference, setSourceReference] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [reviewerRef, setReviewerRef] = useState('');
  const [reviewerNote, setReviewerNote] = useState('');
  const [candidate, setCandidate] = useState(null);

  const l = useMemo(() => isAr ? {
    eyebrow: 'EVIDENCE QUALIFICATION · HUMAN SEMANTIC MAPPING',
    title: 'تأهيل المحتوى المستخرج كمرشح دليل',
    intro: 'اختر عنصرًا مستخرجًا ثم عرّف معناه ومصدره يدويًا. هذه الخطوة لا تجعل المحتوى حقيقة موثقة ولا تسمح باستخدامه تلقائيًا في المحرك المالي.',
    noParsed: 'لا يوجد ملف محلل بنجاح يحتوي على عناصر قابلة للتأهيل. ارفع ملف XLSX أو PPTX صالحًا أعلاه أولًا.',
    atom: 'العنصر المستخرج',
    semanticKey: 'المفتاح الدلالي',
    semanticPlaceholder: 'مثال: market_rent_per_sqm',
    valueType: 'نوع القيمة',
    unit: 'الوحدة (اختياري)',
    materiality: 'الأهمية',
    sourceReference: 'مرجع المصدر',
    sourcePlaceholder: 'رابط/رقم مستند/مرجع داخلي يحدد المصدر',
    sourceDate: 'تاريخ المصدر (اختياري)',
    reviewerRef: 'مرجع المراجع البشري',
    reviewerPlaceholder: 'معرّف داخلي للمراجع — لا يعد مصادقة هوية',
    reviewerNote: 'ملاحظة المراجع',
    reviewerNotePlaceholder: 'لماذا يمثل هذا العنصر المفتاح الدلالي المحدد؟',
    create: 'إنشاء مرشح دليل',
    status: 'حالة المرشح',
    truth: 'حالة الحقيقة',
    verification: 'التحقق',
    authority: 'سلطة المصدر',
    sourceHash: 'بصمة المصدر',
    locator: 'موضع المصدر',
    engine: 'الأهلية للمحرك المالي',
    notEligible: 'غير مؤهل',
    boundary: 'يتطلب تحققًا منفصلًا من المصدر/السلطة قبل الانتقال إلى VERIFIED_FACT أو READY_FOR_UNDERWRITING_INPUT.',
  } : {
    eyebrow: 'EVIDENCE QUALIFICATION · HUMAN SEMANTIC MAPPING',
    title: 'Qualify parsed content as an evidence candidate',
    intro: 'Select a parsed atom and explicitly define its meaning and provenance. This step does not make the content a verified fact and never feeds it into the financial engine automatically.',
    noParsed: 'No successfully parsed document with qualifiable atoms is available. Upload a valid XLSX or PPTX above first.',
    atom: 'Parsed atom',
    semanticKey: 'Semantic key',
    semanticPlaceholder: 'Example: market_rent_per_sqm',
    valueType: 'Value type',
    unit: 'Unit (optional)',
    materiality: 'Materiality',
    sourceReference: 'Source reference',
    sourcePlaceholder: 'URL/document number/internal reference identifying the source',
    sourceDate: 'Source date (optional)',
    reviewerRef: 'Human reviewer reference',
    reviewerPlaceholder: 'Internal reviewer reference — not identity authentication',
    reviewerNote: 'Reviewer note',
    reviewerNotePlaceholder: 'Why does this atom represent the selected semantic key?',
    create: 'Create evidence candidate',
    status: 'Candidate status',
    truth: 'Truth status',
    verification: 'Verification',
    authority: 'Source authority',
    sourceHash: 'Source hash',
    locator: 'Source locator',
    engine: 'Financial-engine eligibility',
    notEligible: 'Not eligible',
    boundary: 'Separate source/authority verification is required before VERIFIED_FACT or READY_FOR_UNDERWRITING_INPUT can be established.',
  }, [isAr]);

  useEffect(() => {
    setCandidate(null);
    onCandidateChange?.(null);
  }, [intakeRecord, atomId, semanticKey, valueType, unit, materiality, sourceReference, sourceDate, reviewerRef, reviewerNote, onCandidateChange]);

  const selectedAtom = atoms.find((atom) => atom.atomId === atomId) || null;

  const createCandidate = () => {
    const result = buildParsedEvidenceCandidate({
      intakeRecord,
      atomId,
      semanticKey,
      valueType,
      unit,
      materiality,
      sourceReference,
      sourceDate,
      reviewerRef,
      reviewerNote,
      capturedAt: new Date().toISOString(),
    });
    setCandidate(result);
    onCandidateChange?.(result);
  };

  return (
    <section data-testid="local-evidence-qualification" dir={dir} className="mx-auto w-full max-w-7xl px-4 pb-8 md:px-8">
      <div className="rounded-2xl border border-sky-800/50 bg-[#101a2d] p-4 md:p-5">
        <div className="text-[10px] font-semibold tracking-[0.18em] text-sky-300/80">{l.eyebrow}</div>
        <h2 className="mt-1 text-lg font-bold text-slate-100">{l.title}</h2>
        <p className="mt-2 max-w-4xl text-xs leading-6 text-slate-300">{l.intro}</p>

        {!atoms.length ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-500">{l.noParsed}</div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-xs text-slate-300">
                <span className="mb-1 block text-[11px] text-slate-500">{l.atom}</span>
                <select data-testid="evidence-atom-select" value={atomId} onChange={(e) => setAtomId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
                  <option value="">—</option>
                  {atoms.map((atom) => <option key={atom.atomId} value={atom.atomId}>{shortValue(atom.rawValue)} · {atom.location?.kind || '—'}</option>)}
                </select>
              </label>

              {selectedAtom ? <div data-testid="selected-atom-preview" className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-xs text-slate-300">{shortValue(selectedAtom.rawValue, 260)}</div> : null}

              <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{l.semanticKey}</span><input data-testid="semantic-key-input" value={semanticKey} onChange={(e) => setSemanticKey(e.target.value)} placeholder={l.semanticPlaceholder} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200" /></label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{l.valueType}</span><select value={valueType} onChange={(e) => setValueType(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">{VALUE_TYPES.map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{l.unit}</span><input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200" /></label>
                <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{l.materiality}</span><select value={materiality} onChange={(e) => setMateriality(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200"><option value={MATERIALITY.SUPPORTING}>SUPPORTING</option><option value={MATERIALITY.MATERIAL}>MATERIAL</option></select></label>
              </div>
              <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{l.sourceReference}</span><input data-testid="source-reference-input" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder={l.sourcePlaceholder} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200" /></label>
              <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{l.sourceDate}</span><input type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200" /></label>
              <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{l.reviewerRef}</span><input data-testid="reviewer-reference-input" value={reviewerRef} onChange={(e) => setReviewerRef(e.target.value)} placeholder={l.reviewerPlaceholder} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200" /></label>
              <label className="block"><span className="mb-1 block text-[11px] text-slate-500">{l.reviewerNote}</span><textarea data-testid="reviewer-note-input" value={reviewerNote} onChange={(e) => setReviewerNote(e.target.value)} placeholder={l.reviewerNotePlaceholder} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200" /></label>
              <button data-testid="create-evidence-candidate" type="button" onClick={createCandidate} disabled={!atomId} className="rounded-lg border border-sky-600/60 bg-sky-400/10 px-4 py-2 text-xs font-semibold text-sky-200 disabled:cursor-not-allowed disabled:opacity-40">{l.create}</button>
            </div>

            <div>
              {candidate ? (
                <div data-testid="evidence-candidate-result" className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/25 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><div className="text-[10px] text-slate-500">{l.status}</div><div className="mt-1 text-xs text-sky-200">{candidate.status}</div></div>
                    <div><div className="text-[10px] text-slate-500">{l.engine}</div><div className="mt-1 text-xs text-rose-200">{candidate.financialEngineEligible ? 'YES' : l.notEligible}</div></div>
                  </div>
                  {candidate.status === PARSED_EVIDENCE_QUALIFICATION_STATUS.CANDIDATE_REQUIRES_VERIFICATION ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div><div className="text-[10px] text-slate-500">{l.truth}</div><div data-testid="candidate-truth-status" className="mt-1 text-xs text-slate-200">{candidate.fact.truthStatus}</div></div>
                        <div><div className="text-[10px] text-slate-500">{l.verification}</div><div data-testid="candidate-verification-status" className="mt-1 text-xs text-amber-200">{candidate.verificationStatus}</div></div>
                        <div><div className="text-[10px] text-slate-500">{l.authority}</div><div className="mt-1 text-xs text-slate-200">{candidate.fact.authorityClass} · verified={String(candidate.authorityVerified)}</div></div>
                      </div>
                      <div><div className="text-[10px] text-slate-500">{l.sourceHash}</div><div className="mt-1 break-all font-mono text-[10px] text-slate-300">{candidate.documentHashSha256}</div></div>
                      <div><div className="text-[10px] text-slate-500">{l.locator}</div><pre className="mt-1 overflow-auto whitespace-pre-wrap text-[10px] text-slate-300">{JSON.stringify(candidate.fact.sourceLocator, null, 2)}</pre></div>
                      <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-3 text-[11px] leading-5 text-amber-100/80">{l.boundary}</div>
                    </>
                  ) : (
                    <div role="alert" className="rounded-lg border border-rose-800/50 bg-rose-950/20 p-3 text-xs text-rose-200">{candidate.reasons.join(' · ')}</div>
                  )}
                </div>
              ) : <div className="rounded-xl border border-dashed border-slate-700 p-4 text-xs text-slate-500">{l.boundary}</div>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
