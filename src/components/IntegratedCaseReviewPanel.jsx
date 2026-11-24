import React, { useState } from 'react';
const { useLocale } = require('../i18n/LocaleContext.js');
const {
  UI_ROLE,
  REVIEW_DISPOSITION,
  buildIntegratedReviewPresentation,
  recordHumanReviewDisposition,
  createDraftReviewExport,
} = require('../presentation/integrated-case-review.js');

const MAX_REVIEW_BUNDLE_BYTES = 2 * 1024 * 1024;

function text(locale, ar, en) { return locale === 'en' ? en : ar; }
function safeName(value) { return String(value || 'case').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80); }
function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function dispositionLabel(locale, value) {
  const labels = {
    ACKNOWLEDGED: ['تم الاطلاع', 'Acknowledged'],
    RETURN_FOR_EVIDENCE: ['إعادة لاستكمال الأدلة', 'Return for evidence'],
    REJECT_DRAFT: ['رفض المسودة', 'Reject draft'],
  };
  const pair = labels[value];
  return pair ? (locale === 'en' ? pair[1] : pair[0]) : value;
}
function statusLabel(locale, value) {
  const labels = {
    READY_FOR_HUMAN_CASE_REVIEW: ['جاهز للمراجعة البشرية', 'Ready for human case review'],
    HOLD: ['معلّق', 'Hold'],
    NOT_EVALUATED: ['لم يتم التقييم', 'Not evaluated'],
  };
  const pair = labels[value];
  return pair ? (locale === 'en' ? pair[1] : pair[0]) : value;
}

export default function IntegratedCaseReviewPanel() {
  const { locale } = useLocale();
  const [bundle, setBundle] = useState(null);
  const [presentation, setPresentation] = useState(null);
  const [reviewRecord, setReviewRecord] = useState(null);
  const [disposition, setDisposition] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const reset = () => {
    setBundle(null); setPresentation(null); setReviewRecord(null); setDisposition(''); setNote(''); setMessage(null);
  };

  const loadBundle = async (file) => {
    reset();
    if (!file) return;
    if (file.size > MAX_REVIEW_BUNDLE_BYTES) {
      setMessage({ ok: false, value: text(locale, 'تم رفض الملف: الحجم يتجاوز الحد المسموح.', 'File rejected: bundle exceeds the size limit.') });
      return;
    }
    setBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      const nextPresentation = await buildIntegratedReviewPresentation({ bundle: parsed, locale, asOf: new Date().toISOString() });
      setBundle(parsed);
      setPresentation(nextPresentation);
      if (!nextPresentation.trusted) {
        setMessage({ ok: false, value: text(locale, 'فشل التحقق. لم يتم عرض أي نتيجة موثوقة من الملف.', 'Validation failed. No trusted result was rendered from the bundle.') });
      } else {
        setMessage({ ok: true, value: text(locale, 'تم التحقق من الحزمة وربطها بحالة القضية والأدلة والصلاحية.', 'Bundle integrity, case context, evidence lineage, and access grant were verified.') });
      }
    } catch (error) {
      setBundle(null);
      setPresentation(null);
      setMessage({ ok: false, value: text(locale, `تعذر تحميل الحزمة: ${error.message || 'C26_UI_BUNDLE_LOAD_FAILED'}`, `Bundle load failed: ${error.message || 'C26_UI_BUNDLE_LOAD_FAILED'}`) });
    } finally {
      setBusy(false);
    }
  };

  const recordDisposition = async () => {
    if (!bundle || !presentation?.trusted || !disposition || !note.trim()) return;
    setBusy(true); setMessage(null);
    try {
      const record = await recordHumanReviewDisposition({
        bundle,
        presentation,
        subjectRef: bundle.accessGrant?.subjectRef,
        disposition,
        note: note.trim(),
        recordedAt: new Date().toISOString(),
      });
      setReviewRecord(record);
      setMessage({ ok: true, value: text(locale, 'تم تسجيل التصرف البشري دون تغيير حالة القرار أو إنشاء موافقة.', 'Human disposition recorded without changing deterministic state or creating approval authority.') });
    } catch (error) {
      setMessage({ ok: false, value: text(locale, `تم منع الإجراء: ${error.message || 'C26_UI_REVIEW_BLOCKED'}`, `Action blocked: ${error.message || 'C26_UI_REVIEW_BLOCKED'}`) });
    } finally { setBusy(false); }
  };

  const exportDraft = async () => {
    if (!bundle || !presentation?.trusted) return;
    setBusy(true); setMessage(null);
    try {
      const payload = await createDraftReviewExport({ bundle, presentation, reviewRecord, generatedAt: new Date().toISOString() });
      downloadJson(payload, `startak-case-review-draft-${safeName(bundle.caseId)}-${new Date().toISOString().slice(0, 10)}.json`);
      setMessage({ ok: true, value: text(locale, 'تم تصدير مسودة مراجعة فقط. لا تمثل موافقة أو تفويض معاملة.', 'Draft review exported. It is not an approval or transaction authorization.') });
    } catch (error) {
      setMessage({ ok: false, value: text(locale, `تم منع التصدير: ${error.message || 'C26_UI_EXPORT_BLOCKED'}`, `Export blocked: ${error.message || 'C26_UI_EXPORT_BLOCKED'}`) });
    } finally { setBusy(false); }
  };

  const trusted = presentation?.trusted === true;
  const reviewer = trusted && bundle?.accessGrant?.role === UI_ROLE.REVIEWER;
  const canExport = trusted && bundle?.accessGrant?.permissions?.includes('EXPORT_DRAFT_REVIEW');

  return (
    <section data-testid="integrated-case-review-panel" dir={locale === 'en' ? 'ltr' : 'rtl'} className="mx-auto mt-5 w-full max-w-7xl px-4">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 md:p-5 text-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] text-slate-500">{text(locale, 'مراجعة القضية المتكاملة المحكومة', 'Governed integrated case review')}</div>
            <h2 className="mt-1 text-base font-semibold">{text(locale, 'مساحة المراجعة البشرية المقيدة بالأدلة', 'Evidence-bound human review workspace')}</h2>
            <p className="mt-1 max-w-4xl text-[11px] leading-5 text-slate-400">
              {text(locale, 'تعرض هذه المساحة نتيجة الحالة الحتمية كما وردت، وتتحقق من البصمات وسلسلة الأدلة وصلاحية المستخدم قبل العرض. لا يمكن للواجهة إنشاء موافقة أو تفويض معاملة أو تشغيل عام للذكاء الاصطناعي.', 'This surface preserves the deterministic case state and validates hashes, evidence lineage, and user authorization before rendering. It cannot create approval, transaction authority, or Public AI authorization.')}
            </p>
          </div>
          <div className="rounded-full border border-amber-700/50 px-3 py-1 text-[11px] text-amber-200">
            {text(locale, 'الموقف التشغيلي: تعليق', 'Operational posture: HOLD')}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
          <label className="text-xs text-slate-300">
            {text(locale, 'تحميل حزمة مراجعة بصيغة جيسون', 'Load exact JSON review bundle')}
            <input data-testid="integrated-review-file-input" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => loadBundle(e.target.files?.[0])} className="mt-2 block w-full text-xs text-slate-400" />
          </label>
          <div className="mt-2 text-[10px] text-slate-500">{text(locale, 'لا تُستخدم قيم افتراضية لملء البيانات الناقصة. الملف غير الصحيح أو المعدّل يفشل بشكل مغلق.', 'Missing data is never backfilled with presentation defaults. Invalid or tampered bundles fail closed.')}</div>
        </div>

        {presentation && !trusted ? (
          <div data-testid="integrated-review-untrusted" className="mt-4 rounded-xl border border-red-800/60 bg-red-950/20 p-3">
            <div className="text-sm font-semibold text-red-200">{text(locale, 'الحزمة غير موثوقة — تم حجب النتيجة', 'Untrusted bundle — result suppressed')}</div>
            <div className="mt-2 flex flex-wrap gap-2">{(presentation.blockers || []).map((code) => <code key={code} className="rounded bg-black/30 px-2 py-1 text-[10px] text-red-200">{code}</code>)}</div>
          </div>
        ) : null}

        {trusted ? (
          <div data-testid="integrated-review-trusted" className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{text(locale, 'الحالة الحتمية', 'Deterministic state')}</div><div className="mt-1 text-sm">{statusLabel(locale, presentation.status)}</div></div>
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{text(locale, 'الدور', 'Role')}</div><code className="mt-1 block text-xs">{bundle.accessGrant.role}</code></div>
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{text(locale, 'معرّف القضية', 'Case ID')}</div><code className="mt-1 block break-all text-xs">{presentation.caseId}</code></div>
              <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{text(locale, 'مرجع العقار', 'Property reference')}</div><code className="mt-1 block break-all text-xs">{presentation.propertyRef}</code></div>
            </div>

            <div className="rounded-xl border border-slate-800 p-3">
              <div className="text-xs font-semibold">{text(locale, 'موانع الحالة', 'Case blockers')}</div>
              {presentation.blockers?.length ? <div className="mt-2 flex flex-wrap gap-2">{presentation.blockers.map((code) => <code key={code} className="rounded bg-amber-950/40 px-2 py-1 text-[10px] text-amber-200">{code}</code>)}</div> : <div className="mt-2 text-xs text-slate-500">{text(locale, 'لا توجد موانع مسجلة في نتيجة القضية.', 'No blockers are recorded in the case result.')}</div>}
            </div>

            <div className="rounded-xl border border-slate-800 p-3 overflow-x-auto">
              <div className="mb-2 text-xs font-semibold">{text(locale, 'ملخص المراحل', 'Stage summary')}</div>
              <table className="w-full min-w-[680px] text-xs"><thead className="text-slate-500"><tr><th className="p-2 text-start">{text(locale, 'المرحلة', 'Stage')}</th><th className="p-2 text-start">{text(locale, 'الحالة', 'Status')}</th><th className="p-2 text-start">{text(locale, 'بصمة الحزمة', 'Packet hash')}</th><th className="p-2 text-start">{text(locale, 'بصمة المخرج', 'Output hash')}</th></tr></thead><tbody>{presentation.stageSummary.map((stage) => <tr key={stage.stageId} className="border-t border-slate-800"><td className="p-2"><code>{stage.stageId}</code></td><td className="p-2"><code>{stage.status}</code></td><td className="p-2 break-all"><code>{stage.stagePacketHashSha256}</code></td><td className="p-2 break-all"><code>{stage.outputHashSha256}</code></td></tr>)}</tbody></table>
            </div>

            <div className="rounded-xl border border-slate-800 p-3">
              <div className="text-xs font-semibold">{text(locale, 'حدود الذكاء الاصطناعي', 'AI boundary')}</div>
              <div className="mt-2 text-[11px] text-amber-200">{text(locale, 'أي محتوى مولد يبقى مسودة تتطلب مراجعة بشرية.', 'Any generated content remains draft-only and requires human review.')}</div>
              <code className="mt-1 block text-[10px] text-amber-300">DRAFT / HUMAN REVIEW REQUIRED</code>
              {presentation.aiDraftBoundary?.visible && presentation.aiDraft ? <div className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-sm leading-6">{presentation.aiDraft.draftText}</div> : <div className="mt-3 text-xs text-slate-500">{text(locale, 'لا يوجد محتوى ذكاء اصطناعي مؤهل للعرض وفق شرط الإثبات.', 'No AI content is eligible for display under the grounding gate.')}</div>}
            </div>

            <details className="rounded-xl border border-slate-800 p-3">
              <summary className="cursor-pointer text-xs font-semibold">{text(locale, 'سجل بصمات الأدلة', 'Evidence hash register')}</summary>
              <div className="mt-2 max-h-48 overflow-auto space-y-1">{presentation.evidenceHashesSha256.map((hash) => <code key={hash} className="block break-all text-[10px] text-slate-400">{hash}</code>)}</div>
            </details>

            {reviewer && !reviewRecord ? (
              <div className="rounded-xl border border-slate-800 p-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">{text(locale, 'التصرف البشري', 'Human disposition')}<select data-testid="integrated-review-disposition" value={disposition} onChange={(e) => setDisposition(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="">{text(locale, 'اختر', 'Select')}</option>{Object.values(REVIEW_DISPOSITION).map((v) => <option key={v} value={v}>{dispositionLabel(locale, v)}</option>)}</select></label>
                <label className="text-xs text-slate-400">{text(locale, 'ملاحظة المراجع', 'Reviewer note')}<textarea data-testid="integrated-review-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" /></label>
                <div className="md:col-span-2 flex justify-end"><button data-testid="integrated-review-record" type="button" disabled={busy || !disposition || !note.trim()} onClick={recordDisposition} className="rounded-lg border border-slate-700 px-4 py-2 text-xs disabled:opacity-40">{text(locale, 'تسجيل التصرف', 'Record disposition')}</button></div>
              </div>
            ) : null}

            {reviewRecord ? (
              <div data-testid="integrated-review-recorded" className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs">
                <div>{text(locale, 'تم تسجيل:', 'Recorded:')} {dispositionLabel(locale, reviewRecord.disposition)}</div>
                <div className="mt-1">{text(locale, 'الحالة قبل وبعد:', 'State before/after:')} {statusLabel(locale, reviewRecord.deterministicStateBefore)} / {statusLabel(locale, reviewRecord.deterministicStateAfter)}</div>
                <code className="mt-2 block break-all text-[10px]">{reviewRecord.reviewRecordHashSha256}</code>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="text-[11px] text-slate-500">
                <div>{text(locale, 'الموافقة: غير منشأة', 'Approval: not established')}</div>
                <div>{text(locale, 'تفويض المعاملة: غير متاح', 'Transaction authority: false')}</div>
                <div>{text(locale, 'الذكاء الاصطناعي العام: غير مفعل', 'Public AI: false')}</div>
                <div>{text(locale, 'التشغيل التجاري: معلّق', 'Commercial go-live: HOLD')}</div>
              </div>
              <button data-testid="integrated-review-export" type="button" disabled={busy || !canExport} onClick={exportDraft} className="rounded-lg border border-slate-700 px-4 py-2 text-xs disabled:opacity-40">{text(locale, 'تصدير مسودة المراجعة', 'Export draft review')}</button>
            </div>
          </div>
        ) : null}

        {message ? <div data-testid="integrated-review-message" className={`mt-3 text-xs ${message.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{message.value}</div> : null}
      </div>
    </section>
  );
}

export { MAX_REVIEW_BUNDLE_BYTES };
