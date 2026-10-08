import React, { useMemo, useState } from 'react';

const {
  governedDecisionOperationalContextFromValuationCase,
  buildGovernedDecisionOperationalExportFromValuationCase,
} = require('../app/valuation-saved-deal-bridge');

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

export default function GovernedDecisionOperationsPanel({ valuationCase, locale = 'ar-SA' }) {
  const [exportMessage, setExportMessage] = useState(null);
  const context = useMemo(
    () => governedDecisionOperationalContextFromValuationCase(valuationCase, { asOf: new Date() }),
    [valuationCase],
  );

  if (!context) return null;
  const vm = context.viewModel;
  const ready = vm?.canExport === true;
  const c71SpecialistHold = vm?.status === 'HOLD_SPECIALIST_METHOD_NOT_QUALIFIED';
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

        {c71SpecialistHold ? (
          <div data-testid="c71-specialist-export-hold" role="status" className="mt-3 rounded-lg border border-amber-700/70 bg-amber-950/20 p-3 text-xs text-amber-200">
            {text(locale,
              'تصدير التقارير التحليلية والمراجعة البشرية لهذا العقار المتخصص معلّق. لا يعمل حاليًا منهج تقييم متخصص معتمد، ولا تكفي المراجع النصية أو لقطة القرار لمنح أي صلاحية تقييم أو تصدير.',
              'Specialist analytical export and human review are ON HOLD. No qualified specialist valuation method is operational; textual references or a decision snapshot cannot establish an appraisal or report authority.')}
          </div>
        ) : null}

        {vm?.reasonCodes?.length ? (
          <div className="mt-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200" role="status">
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
            <div className="text-xs font-semibold text-slate-200">{text(locale, 'المراجعة البشرية', 'Human review')}</div>
            <div className="mt-2 text-sm text-slate-100">{vm?.reviewerRecommendation || text(locale, 'لم تسجل توصية بعد', 'No recommendation recorded')}</div>
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
            type="button"
            data-testid="c5-governed-analytical-export"
            onClick={handleExport}
            disabled={!ready}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {text(locale, 'تصدير المخرج التحليلي المحكوم', 'Export governed analytical output')}
          </button>
        </div>

        {exportMessage ? (
          <div className={`mt-3 text-xs ${exportMessage.ok ? 'text-emerald-300' : 'text-amber-300'}`} role="status">
            {exportMessage.value}
          </div>
        ) : null}
      </div>
    </section>
  );
}
