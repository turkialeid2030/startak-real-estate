import React from 'react';
const {useLocale}=require('../i18n/LocaleContext');
const {assuranceLabel}=require('../i18n/assurance-workflow-presentation');

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{children}</span>;
}

function EmptyState({ children }) {
  return <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">{children}</div>;
}

export default function OutcomeMonitoringPanel({ outcomeFeedback, learningReview = null, decisionRecord = null }) {
 const {locale,dir}=useLocale();
 const L=value=>assuranceLabel(value,locale);
  if (!outcomeFeedback || typeof outcomeFeedback !== 'object') return null;
  const comparisons = outcomeFeedback.comparisons || [];
  const actions = outcomeFeedback.requiredActions || {};

  return (
    <aside data-testid="outcome-monitoring-panel" dir={dir} className="mx-auto mt-6 w-full max-w-7xl px-4 pb-8">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-2xl shadow-black/20 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{locale==='en'?'Outcome Monitoring & Decision Learning':'متابعة النتائج والتعلم'}</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{L("متابعة النتائج والتعلّم من القرار")}</h2>
            <div className="mt-1 text-[11px] text-slate-500">{locale==='en'?'Case:':'الحالة:'} <span data-user-content translate="no">{outcomeFeedback.caseId || '—'}</span> · {locale==='en'?'Project:':'المشروع:'} <span data-user-content translate="no">{outcomeFeedback.projectId || '—'}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge><code translate="no" dir="ltr" className="break-all">{outcomeFeedback.status || 'UNKNOWN'}</code></Badge>
            <Badge>{outcomeFeedback.reanalysisRequired ? L('إعادة التحليل مطلوبة') : L('لا توجد إعادة تحليل إلزامية')}</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{L("قرار اللجنة المسجل")}</div><div className="mt-1 text-sm text-slate-100"><code translate="no" dir="ltr" className="break-all">{decisionRecord?.decision || outcomeFeedback.decision || '—'}</code></div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{L("عدد المقارنات")}</div><div className="mt-1 text-sm text-slate-100">{comparisons.length}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{L("الانحرافات الجوهرية")}</div><div className="mt-1 text-sm text-slate-100">{outcomeFeedback.materialVarianceCount ?? 0}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{L("دليل النتيجة")}</div><div className="mt-1 text-xs text-slate-300"><span data-user-content translate="no">{outcomeFeedback.outcomeSnapshot?.evidenceRef || '—'}</span></div></div>
        </div>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="outcome-comparisons-heading">
          <h3 id="outcome-comparisons-heading" className="mb-3 text-sm font-semibold text-slate-100">{L("المخطط مقابل الفعلي")}</h3>
          <div className="space-y-2">
            {comparisons.length ? comparisons.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-100"><span data-user-content translate="no">{item.label}</span></div>
                    <div className="mt-1 text-[11px] text-slate-500"><span data-user-content translate="no">{item.id}</span> · {item.evidenceRef?<span data-user-content translate="no">{item.evidenceRef}</span>:L('دون مرجع مستقل')}</div>
                  </div>
                  <Badge>{item.materialVariance ? L('انحراف جوهري') : L('ضمن المتابعة')}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-slate-800 p-2 text-xs text-slate-300">{L("المخطط:")} {item.plannedValue ?? '—'}</div>
                  <div className="rounded border border-slate-800 p-2 text-xs text-slate-300">{L("الفعلي:")} {item.actualValue ?? '—'}</div>
                </div>
                {item.explanation ? <div className="mt-2 text-[11px] text-slate-400"><span data-user-content translate="no">{item.explanation}</span></div> : null}
              </article>
            )) : <EmptyState>{L("لا توجد مقارنات نتائج مسجلة.")}</EmptyState>}
          </div>
        </section>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">{L("إجراءات إعادة التحليل")}</h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div>{L("مطابقة الأدلة:")} {actions.refreshEvidenceReconciliation ? L('مطلوبة') : L('غير مطلوبة')}</div>
              <div>{L("التحليل المالي:")} {actions.refreshFinancialAnalysis ? L('مطلوب') : L('غير مطلوب')}</div>
              <div>{L("جودة القرار:")} {actions.refreshDecisionQuality ? L('مطلوبة') : L('غير مطلوبة')}</div>
              <div>{L("ملف الذكاء الاصطناعي:")} {actions.refreshAiDossier ? L('مطلوب') : L('غير مطلوب')}</div>
              <div>{L("المراجعة البشرية:")} {actions.humanReviewRequired ? L('مطلوبة') : L('غير مطلوبة')}</div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">{L("حلقة التعلّم")}</h3>
            {learningReview ? (
              <div className="space-y-2 text-xs text-slate-300">
                <div>{L("الحالة:")} <code translate="no" dir="ltr" className="break-all">{learningReview.status || '—'}</code></div>
                <div>{L("مرشحات التعلّم:")} {learningReview.learningCandidateCount ?? 0}</div>
                <div>{L("المرشحات الجوهرية:")} {learningReview.materialLearningCandidateCount ?? 0}</div>
                <div className="text-[11px] text-slate-500">{L("لا تحديث تلقائي للسياسات أو النماذج، ولا إعادة كتابة لقرار اللجنة.")}</div>
              </div>
            ) : <EmptyState>{L("لا توجد مراجعة تعلّم مرتبطة بهذه النتيجة.")}</EmptyState>}
          </section>
        </div>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
          <strong className="text-slate-200">{L("حدود الاستخدام:")}</strong> {L("المتابعة تقارن بيانات مخططة بملاحظات فعلية موثقة كما زودها النظام المصدر. لا تستنتج السببية، ولا تعكس قرار اللجنة تلقائيًا، ولا تنفذ معاملة.")}
        </section>
      </div>
    </aside>
  );
}
