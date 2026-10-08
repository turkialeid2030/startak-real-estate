import React, { useMemo, useState } from 'react';

const {
  governedHumanReviewContextFromValuationCase,
  persistGovernedHumanReviewFromValuationCase,
  buildGovernedReviewedDecisionExportFromValuationCase,
} = require('../app/valuation-saved-deal-bridge');
const { C6_REVIEW_RECOMMENDATION } = require('../contracts/governed-human-review');

function text(locale, ar, en) {
  return locale === 'en' ? en : ar;
}

function safeFilePart(value) {
  return String(value || 'case').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function recommendationLabel(locale, value) {
  const labels = {
    CONTINUE_DUE_DILIGENCE: ['استمرار العناية الواجبة', 'Continue due diligence'],
    REQUEST_MODIFICATION: ['طلب تعديل', 'Request modification'],
    HOLD_FOR_EVIDENCE: ['تعليق لحين استكمال الأدلة', 'Hold for evidence'],
    DO_NOT_ADVANCE: ['عدم الاستمرار', 'Do not advance'],
  };
  const pair = labels[value];
  return pair ? (locale === 'en' ? pair[1] : pair[0]) : value || '—';
}

function StatusBadge({ ready, children }) {
  const classes = ready
    ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-200'
    : 'border-amber-700/60 bg-amber-950/30 text-amber-200';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] ${classes}`}>{children}</span>;
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm text-slate-100">{value ?? '—'}</div>
    </div>
  );
}

export default function GovernedHumanReviewPanel({ valuationCase, locale = 'ar-SA' }) {
  const [revision, setRevision] = useState(0);
  const [reviewerId, setReviewerId] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [rationale, setRationale] = useState('');
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const context = useMemo(
    () => governedHumanReviewContextFromValuationCase(valuationCase, { asOf: new Date() }),
    [valuationCase, revision],
  );

  if (!context) return null;
  const vm = context.viewModel;
  const review = vm?.review || null;
  const canRecord = vm?.canRecordReview === true;
  const c71SpecialistHold = vm?.c5Status === 'HOLD_SPECIALIST_METHOD_NOT_QUALIFIED';
  const canExport = vm?.canExportReviewedOutput === true;
  const rtl = locale !== 'en';

  const recordReview = async () => {
    setMessage(null);
    if (!canRecord || !reviewerId.trim() || !recommendation || !rationale.trim()) {
      setMessage({ ok: false, value: text(locale, 'أكمل معرّف المراجع والتوصية والمبررات.', 'Complete reviewer ID, recommendation, and rationale.') });
      return;
    }
    setSubmitting(true);
    try {
      await persistGovernedHumanReviewFromValuationCase(valuationCase, {
        reviewerId: reviewerId.trim(),
        recommendation,
        rationale: rationale.trim(),
        reviewedAt: new Date().toISOString(),
      });
      setReviewerId('');
      setRecommendation('');
      setRationale('');
      setRevision((value) => value + 1);
      setMessage({
        ok: true,
        value: text(locale, 'تم تسجيل توصية المراجع وربطها ببصمة القرار وحالة الصفقة. لا تمثل موافقة.', 'Reviewer recommendation recorded and hash-bound to the decision and saved-deal state. It is not an approval.'),
      });
    } catch (error) {
      setMessage({
        ok: false,
        value: text(locale, `تعذر تسجيل المراجعة: ${error.code || 'C6_REVIEW_BLOCKED'}`, `Review could not be recorded: ${error.code || 'C6_REVIEW_BLOCKED'}`),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const exportReviewed = () => {
    setMessage(null);
    if (!canExport) return;
    try {
      const generatedAt = new Date();
      const envelope = buildGovernedReviewedDecisionExportFromValuationCase(valuationCase, {
        reportId: `C6-${vm.caseId}-${generatedAt.toISOString()}`,
        generatedAt,
      });
      downloadJson(
        envelope,
        `startak-governed-reviewed-decision-${safeFilePart(vm.caseId)}-${generatedAt.toISOString().slice(0, 10)}.json`,
      );
      setMessage({
        ok: true,
        value: text(locale, 'تم تصدير المخرج المحكوم بعد المراجعة. لا يمثل موافقة أو تفويض معاملة.', 'Reviewed governed output exported. It is not an approval or transaction authorization.'),
      });
    } catch (error) {
      setMessage({
        ok: false,
        value: text(locale, `تم منع التصدير: ${error.code || 'C6_REVIEWED_EXPORT_BLOCKED'}`, `Reviewed export blocked: ${error.code || 'C6_REVIEWED_EXPORT_BLOCKED'}`),
      });
    }
  };

  return (
    <section
      data-testid="c6-human-review-workflow"
      dir={rtl ? 'rtl' : 'ltr'}
      className="mx-auto mt-5 w-full max-w-7xl px-4"
      aria-labelledby="c6-human-review-heading"
    >
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] tracking-[0.16em] text-slate-500">C6 · CONTROLLED HUMAN REVIEW</div>
            <h2 id="c6-human-review-heading" className="mt-1 text-base font-semibold text-slate-100">
              {text(locale, 'مسار توصية المراجع المحكوم', 'Controlled reviewer recommendation workflow')}
            </h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">
              {text(
                locale,
                'يسجل هذا المسار توصية بشرية واحدة غير قابلة للاستبدال مرتبطة ببصمة لقطة القرار وبصمة الحالة المادية للصفقة. التوصية لا تنشئ موافقة ولا صلاحية معاملة.',
                'This workflow records one immutable human recommendation bound to the decision-snapshot hash and material saved-deal-state hash. The recommendation does not create approval or transaction authority.',
              )}
            </p>
          </div>
          <StatusBadge ready={vm?.status === 'READY_FOR_HUMAN_REVIEW' || vm?.status === 'REVIEW_RECORDED'}>
            <span data-testid="c6-review-status">{vm?.status || 'UNAVAILABLE'}</span>
          </StatusBadge>
        </div>

        {c71SpecialistHold ? (
          <div data-testid="c71-specialist-export-hold" role="status" className="mt-3 rounded-lg border border-amber-700/70 bg-amber-950/20 p-3 text-xs text-amber-200">
            {text(locale,
              'تصدير التقارير التحليلية والمراجعة البشرية لهذا العقار المتخصص معلّق. لا يعمل حاليًا منهج تقييم متخصص معتمد، ولا تكفي المراجع النصية أو لقطة القرار لمنح أي صلاحية تقييم أو تصدير.',
              'Specialist analytical export and human review are ON HOLD. No qualified specialist valuation method is operational; textual references or a decision snapshot cannot establish an appraisal or report authority.')}
          </div>
        ) : null}

        {vm?.reasonCodes?.length ? (
          <div data-testid="c6-review-hold-reasons" className="mt-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200" role="status">
            {vm.reasonCodes.join(' · ')}
          </div>
        ) : null}

        {review ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Metric label={text(locale, 'المراجع', 'Reviewer')} value={review.reviewerId} />
            <Metric label={text(locale, 'التوصية', 'Recommendation')} value={recommendationLabel(locale, review.recommendation)} />
            <Metric label={text(locale, 'وقت المراجعة', 'Reviewed at')} value={review.reviewedAt} />
            <Metric label={text(locale, 'بصمة المراجعة', 'Review hash')} value={review.reviewHashSha256} />
            <Metric label={text(locale, 'بصمة لقطة القرار', 'Decision snapshot hash')} value={review.decisionSnapshotHashSha256} />
            <Metric label={text(locale, 'بصمة حالة الصفقة', 'Saved-deal state hash')} value={review.savedDealStateHashSha256} />
            <div className="md:col-span-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-[11px] text-slate-500">{text(locale, 'المبررات', 'Rationale')}</div>
              <div className="mt-1 text-sm text-slate-100">{review.rationale}</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-400">
              {text(locale, 'اسم أو معرّف المراجع', 'Reviewer ID')}
              <input
                data-testid="c6-reviewer-id"
                value={reviewerId}
                onChange={(event) => setReviewerId(event.target.value)}
                disabled={!canRecord || submitting}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-40"
              />
            </label>
            <label className="text-xs text-slate-400">
              {text(locale, 'التوصية', 'Recommendation')}
              <select
                data-testid="c6-review-recommendation"
                value={recommendation}
                onChange={(event) => setRecommendation(event.target.value)}
                disabled={!canRecord || submitting}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-40"
              >
                <option value="">{text(locale, 'اختر التوصية', 'Select recommendation')}</option>
                {Object.values(C6_REVIEW_RECOMMENDATION).map((value) => (
                  <option key={value} value={value}>{recommendationLabel(locale, value)}</option>
                ))}
              </select>
            </label>
            <label className="md:col-span-2 text-xs text-slate-400">
              {text(locale, 'المبررات', 'Rationale')}
              <textarea
                data-testid="c6-review-rationale"
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
                disabled={!canRecord || submitting}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-40"
              />
            </label>
            <div className="md:col-span-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-[11px] leading-5 text-amber-300">
                {text(locale, 'توصية المراجع لا تساوي موافقة. الموافقة وصلاحية المعاملة غير منشأتين.', 'Reviewer recommendation does not equal approval. Approval and transaction authority remain unestablished.')}
              </div>
              <button
                data-testid="c6-record-review"
                type="button"
                onClick={recordReview}
                disabled={!canRecord || submitting}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? text(locale, 'جارٍ التسجيل…', 'Recording…') : text(locale, 'تسجيل توصية المراجع', 'Record reviewer recommendation')}
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="text-[11px] leading-5 text-slate-500">
            <div>APPROVAL_STATUS: NOT_ESTABLISHED</div>
            <div>TRANSACTION_AUTHORITY: FALSE</div>
            <div>PUBLIC_AI: FALSE</div>
            <div>COMMERCIAL_GO_LIVE: HOLD</div>
          </div>
          <button
            data-testid="c6-reviewed-export"
            type="button"
            onClick={exportReviewed}
            disabled={!canExport}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {text(locale, 'تصدير المخرج بعد المراجعة', 'Export reviewed governed output')}
          </button>
        </div>

        {message ? (
          <div data-testid="c6-review-message" className={`mt-3 text-xs ${message.ok ? 'text-emerald-300' : 'text-amber-300'}`} role="status">
            {message.value}
          </div>
        ) : null}
      </div>
    </section>
  );
}
