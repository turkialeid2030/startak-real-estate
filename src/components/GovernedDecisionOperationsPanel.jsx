import React, { useMemo, useState } from 'react';

const {
  governedDecisionOperationalContextFromValuationCase,
  governedHumanReviewContextFromValuationCase,
  buildGovernedDecisionOperationalExportFromValuationCase,
  buildGovernedReviewedDecisionExportFromValuationCase,
} = require('../app/valuation-saved-deal-bridge');
const { C6_REVIEW_RECOMMENDATION } = require('../contracts/governed-human-review');

function sar(value, locale) {
  if (!(typeof value === 'number' && Number.isFinite(value))) return '—';
  return `${Math.round(value).toLocaleString(locale === 'en' ? 'en-US' : 'ar-SA')} ${locale === 'en' ? 'SAR' : 'ر.س'}`;
}

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
      <div className="mt-1 text-sm text-slate-100 break-words">{value ?? '—'}</div>
    </div>
  );
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

export default function GovernedDecisionOperationsPanel({
  valuationCase,
  locale = 'ar-SA',
  onRecordGovernedHumanReview,
}) {
  const [exportMessage, setExportMessage] = useState(null);
  const [reviewMessage, setReviewMessage] = useState(null);
  const [reviewerId, setReviewerId] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [rationale, setRationale] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const context = useMemo(
    () => governedDecisionOperationalContextFromValuationCase(valuationCase, { asOf: new Date() }),
    [valuationCase],
  );
  const reviewContext = useMemo(
    () => governedHumanReviewContextFromValuationCase(valuationCase, { asOf: new Date() }),
    [valuationCase],
  );

  if (!context) return null;
  const vm = context.viewModel;
  const reviewVm = reviewContext?.viewModel || null;
  const ready = vm?.canExport === true;
  const canRecordReview = reviewVm?.canRecordReview === true && typeof onRecordGovernedHumanReview === 'function';
  const canExportReviewed = reviewVm?.canExportReviewedOutput === true;
  const recordedReview = reviewVm?.review || null;
  const rtl = locale !== 'en';

  const handleExport = () => {
    setExportMessage(null);
    if (!ready) return;
    try {
      const generatedAt = new Date();
      const reportId = `C5-${vm.caseId}-${generatedAt.toISOString()}`;
      const envelope = buildGovernedDecisionOperationalExportFromValuationCase(valuationCase, {
        reportId,
        generatedAt,
      });
      const date = generatedAt.toISOString().slice(0, 10);
      downloadJson(envelope, `startak-governed-decision-${safeFilePart(vm.caseId)}-${date}.json`);
      setExportMessage({
        ok: true,
        value: text(locale, 'تم تصدير المخرج التحليلي المحكوم. لا يمثل موافقة أو تفويض معاملة.', 'Governed analytical output exported. It is not an approval or transaction authorization.'),
      });
    } catch (error) {
      setExportMessage({
        ok: false,
        value: text(locale, `تم منع التصدير: ${error.code || 'C5_EXPORT_BLOCKED'}`, `Export blocked: ${error.code || 'C5_EXPORT_BLOCKED'}`),
      });
    }
  };

  const handleRecordReview = async () => {
    setReviewMessage(null);
    if (!canRecordReview || !reviewerId.trim() || !recommendation || !rationale.trim()) {
      setReviewMessage({ ok: false, value: text(locale, 'أكمل اسم/معرّف المراجع والتوصية والمبررات.', 'Complete reviewer ID, recommendation, and rationale.') });
      return;
    }
    setReviewSubmitting(true);
    try {
      await onRecordGovernedHumanReview({
        reviewerId: reviewerId.trim(),
        recommendation,
        rationale: rationale.trim(),
        reviewedAt: new Date().toISOString(),
      });
      setReviewMessage({
        ok: true,
        value: text(locale, 'تم تسجيل توصية المراجع وربطها ببصمة القرار وحالة الصفقة. لا تمثل موافقة.', 'Reviewer recommendation recorded and bound to the decision and deal-state hashes. It is not an approval.'),
      });
      setReviewerId('');
      setRecommendation('');
      setRationale('');
    } catch (error) {
      setReviewMessage({
        ok: false,
        value: text(locale, `تعذر تسجيل المراجعة: ${error.code || 'C6_REVIEW_BLOCKED'}`, `Review could not be recorded: ${error.code || 'C6_REVIEW_BLOCKED'}`),
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleReviewedExport = () => {
    setReviewMessage(null);
    if (!canExportReviewed) return;
    try {
      const generatedAt = new Date();
      const reportId = `C6-${vm.caseId}-${generatedAt.toISOString()}`;
      const envelope = buildGovernedReviewedDecisionExportFromValuationCase(valuationCase, { reportId, generatedAt });
      const date = generatedAt.toISOString().slice(0, 10);
      downloadJson(envelope, `startak-governed-reviewed-decision-${safeFilePart(vm.caseId)}-${date}.json`);
      setReviewMessage({
        ok: true,
        value: text(locale, 'تم تصدير المخرج المحكوم المتضمن توصية المراجع. لا يمثل موافقة أو تفويض معاملة.', 'Reviewed governed output exported. It is not an approval or transaction authorization.'),
      });
    } catch (error) {
      setReviewMessage({
        ok: false,
        value: text(locale, `تم منع تصدير المراجعة: ${error.code || 'C6_REVIEWED_EXPORT_BLOCKED'}`, `Reviewed export blocked: ${error.code || 'C6_REVIEWED_EXPORT_BLOCKED'}`),
      });
    }
  };

  return (
    <section
      data-testid="governed-decision-operations"
      dir={rtl ? 'rtl' : 'ltr'}
      className="mx-auto mt-5 w-full max-w-7xl px-4"
      aria-labelledby="c5-governed-decision-heading"
    >
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] tracking-[0.16em] text-slate-500">C5 · GOVERNED DECISION OPERATIONS</div>
            <h2 id="c5-governed-decision-heading" className="mt-1 text-base font-semibold text-slate-100">
              {text(locale, 'القرار التحليلي المحكوم والتصدير', 'Governed analytical decision & export')}
            </h2>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">
              {text(
                locale,
                'هذا العرض مرتبط بالنسخة المحفوظة التي تم تحميلها. التعديلات غير المحفوظة ليست جزءًا من هذا المخرج، وأي تحديث جوهري يمنع حمل اللقطة المحكومة إلى السجل المحدّث.',
                'This view is bound to the loaded saved record. Unsaved edits are not part of this output, and any material saved-deal update prevents the governed snapshot from being carried forward.',
              )}
            </p>
          </div>
          <StatusBadge ready={ready}>{vm?.status || 'UNKNOWN'}</StatusBadge>
        </div>

        {vm?.reasonCodes?.length ? (
          <div data-testid="c5-hold-reasons" className="mt-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200" role="status">
            {vm.reasonCodes.join(' · ')}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label={text(locale, 'معرّف الحالة', 'Case ID')} value={vm?.caseId} />
          <Metric label={text(locale, 'معرّف المشروع', 'Project ID')} value={vm?.projectId} />
          <Metric label={text(locale, 'مرجع العقار', 'Property ref')} value={vm?.propertyRef} />
          <Metric label={text(locale, 'حالة لقطة القرار', 'Decision snapshot status')} value={vm?.snapshotStatus} />
          <Metric label={text(locale, 'المؤشر التحليلي للقيمة', 'Analytical value indication')} value={sar(vm?.analyticalValueIndicationSar, locale)} />
          <Metric
            label={text(locale, 'النطاق التحليلي', 'Analytical range')}
            value={`${sar(vm?.analyticalRangeLowSar, locale)} – ${sar(vm?.analyticalRangeHighSar, locale)}`}
          />
          <Metric label={text(locale, 'الثقة التحليلية', 'Analytical confidence')} value={vm?.analyticalConfidenceClass} />
          <Metric label={text(locale, 'مناهج التقييم المؤهلة', 'Eligible approaches')} value={vm?.eligibleApproachFamilies?.join(' · ') || '—'} />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
            <div className="text-xs font-semibold text-slate-200">{text(locale, 'المراجعة البشرية في لقطة C4', 'Human review in C4 snapshot')}</div>
            <div className="mt-2 text-sm text-slate-100">{vm?.reviewerRecommendation || text(locale, 'لم تسجل توصية داخل لقطة C4', 'No recommendation recorded in C4 snapshot')}</div>
            {vm?.reviewerId ? <div className="mt-1 text-[11px] text-slate-500">{text(locale, 'المراجع', 'Reviewer')}: {vm.reviewerId}</div> : null}
            <div className="mt-3 text-[11px] leading-5 text-amber-300">
              {text(locale, 'توصية المراجع لا تساوي موافقة. حالة الموافقة: غير منشأة.', 'Reviewer recommendation does not equal approval. Approval status: not established.')}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
            <div className="text-xs font-semibold text-slate-200">{text(locale, 'حدود الصلاحية', 'Authority boundary')}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <span>COMMERCIAL_GO_LIVE</span><span className="text-amber-300">HOLD</span>
              <span>TRANSACTION_AUTHORITY</span><span>FALSE</span>
              <span>PUBLIC_AI</span><span>FALSE</span>
              <span>APPROVAL_AUTHORIZED</span><span>FALSE</span>
              <span>CERTIFIED_VALUATION</span><span>FALSE</span>
              <span>FINAL_VALUATION</span><span>FALSE</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="text-[11px] leading-5 text-slate-500">
            <div>{text(locale, 'التصنيف', 'Classification')}: NON_AUTHORIZING_ANALYTICAL_OUTPUT</div>
            <div>{text(locale, 'بصمة لقطة القرار', 'Decision snapshot hash')}: {vm?.snapshotHashSha256 || '—'}</div>
            <div>{text(locale, 'بصمة حالة الصفقة المحفوظة', 'Saved-deal state hash')}: {vm?.dealStateHashSha256 || context.sourceSavedDealStateHashSha256 || '—'}</div>
          </div>
          <button
            data-testid="c5-governed-export"
            type="button"
            onClick={handleExport}
            disabled={!ready}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {text(locale, 'تصدير المخرج التحليلي المحكوم', 'Export governed analytical output')}
          </button>
        </div>

        {exportMessage ? (
          <div data-testid="c5-export-message" className={`mt-3 text-xs ${exportMessage.ok ? 'text-emerald-300' : 'text-amber-300'}`} role="status">
            {exportMessage.value}
          </div>
        ) : null}

        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/40 p-4" data-testid="c6-human-review-workflow">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] tracking-[0.14em] text-slate-500">C6 · CONTROLLED HUMAN REVIEW</div>
              <div className="mt-1 text-sm font-semibold text-slate-100">{text(locale, 'مسار توصية المراجع المحكوم', 'Controlled reviewer recommendation workflow')}</div>
            </div>
            <StatusBadge ready={reviewVm?.status === 'REVIEW_RECORDED' || reviewVm?.status === 'READY_FOR_HUMAN_REVIEW'}>
              <span data-testid="c6-review-status">{reviewVm?.status || 'UNAVAILABLE'}</span>
            </StatusBadge>
          </div>

          {reviewVm?.reasonCodes?.length ? (
            <div data-testid="c6-review-hold-reasons" className="mt-3 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              {reviewVm.reasonCodes.join(' · ')}
            </div>
          ) : null}

          {recordedReview ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Metric label={text(locale, 'المراجع', 'Reviewer')} value={recordedReview.reviewerId} />
              <Metric label={text(locale, 'التوصية', 'Recommendation')} value={recommendationLabel(locale, recordedReview.recommendation)} />
              <Metric label={text(locale, 'وقت التسجيل', 'Reviewed at')} value={recordedReview.reviewedAt} />
              <Metric label={text(locale, 'بصمة المراجعة', 'Review hash')} value={recordedReview.reviewHashSha256} />
              <div className="md:col-span-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-[11px] text-slate-500">{text(locale, 'المبررات', 'Rationale')}</div>
                <div className="mt-1 text-sm text-slate-100">{recordedReview.rationale}</div>
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
                  disabled={!canRecordReview || reviewSubmitting}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-40"
                />
              </label>
              <label className="text-xs text-slate-400">
                {text(locale, 'التوصية', 'Recommendation')}
                <select
                  data-testid="c6-review-recommendation"
                  value={recommendation}
                  onChange={(event) => setRecommendation(event.target.value)}
                  disabled={!canRecordReview || reviewSubmitting}
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
                  disabled={!canRecordReview || reviewSubmitting}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-40"
                />
              </label>
              <div className="md:col-span-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-[11px] leading-5 text-amber-300">
                  {text(locale, 'هذا الإجراء يسجل توصية فقط. لا ينشئ موافقة ولا يجيز معاملة أو تشغيلًا تجاريًا.', 'This action records a recommendation only. It does not create approval, transaction authority, or commercial go-live.')}
                </div>
                <button
                  data-testid="c6-record-review"
                  type="button"
                  onClick={handleRecordReview}
                  disabled={!canRecordReview || reviewSubmitting}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reviewSubmitting ? text(locale, 'جارٍ التسجيل…', 'Recording…') : text(locale, 'تسجيل توصية المراجع', 'Record reviewer recommendation')}
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-800 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="text-[11px] leading-5 text-slate-500">
              <div>APPROVAL_STATUS: NOT_ESTABLISHED</div>
              <div>TRANSACTION_AUTHORITY: FALSE</div>
              <div>COMMERCIAL_GO_LIVE: HOLD</div>
            </div>
            <button
              data-testid="c6-reviewed-export"
              type="button"
              onClick={handleReviewedExport}
              disabled={!canExportReviewed}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {text(locale, 'تصدير المخرج بعد المراجعة', 'Export reviewed governed output')}
            </button>
          </div>

          {reviewMessage ? (
            <div data-testid="c6-review-message" className={`mt-3 text-xs ${reviewMessage.ok ? 'text-emerald-300' : 'text-amber-300'}`} role="status">
              {reviewMessage.value}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
