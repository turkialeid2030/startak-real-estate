import React from 'react';

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{children}</span>;
}

function EmptyState({ children }) {
  return <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">{children}</div>;
}

export default function OutcomeMonitoringPanel({ outcomeFeedback, learningReview = null, decisionRecord = null }) {
  if (!outcomeFeedback || typeof outcomeFeedback !== 'object') return null;
  const comparisons = outcomeFeedback.comparisons || [];
  const actions = outcomeFeedback.requiredActions || {};

  return (
    <aside data-testid="outcome-monitoring-panel" dir="rtl" className="mx-auto mt-6 w-full max-w-7xl px-4 pb-8">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-2xl shadow-black/20 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Outcome Monitoring & Decision Learning</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">متابعة النتائج والتعلّم من القرار</h2>
            <div className="mt-1 text-[11px] text-slate-500">Case: {outcomeFeedback.caseId || '—'} · Project: {outcomeFeedback.projectId || '—'}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{outcomeFeedback.status || 'UNKNOWN'}</Badge>
            <Badge>{outcomeFeedback.reanalysisRequired ? 'إعادة التحليل مطلوبة' : 'لا توجد إعادة تحليل إلزامية'}</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">قرار اللجنة المسجل</div><div className="mt-1 text-sm text-slate-100">{decisionRecord?.decision || outcomeFeedback.decision || '—'}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">عدد المقارنات</div><div className="mt-1 text-sm text-slate-100">{comparisons.length}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">الانحرافات الجوهرية</div><div className="mt-1 text-sm text-slate-100">{outcomeFeedback.materialVarianceCount ?? 0}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">دليل النتيجة</div><div className="mt-1 text-xs text-slate-300">{outcomeFeedback.outcomeSnapshot?.evidenceRef || '—'}</div></div>
        </div>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="outcome-comparisons-heading">
          <h3 id="outcome-comparisons-heading" className="mb-3 text-sm font-semibold text-slate-100">المخطط مقابل الفعلي</h3>
          <div className="space-y-2">
            {comparisons.length ? comparisons.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-800 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-100">{item.label}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{item.id} · {item.evidenceRef || 'دون مرجع مستقل'}</div>
                  </div>
                  <Badge>{item.materialVariance ? 'انحراف جوهري' : 'ضمن المتابعة'}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-slate-800 p-2 text-xs text-slate-300">المخطط: {item.plannedValue ?? '—'}</div>
                  <div className="rounded border border-slate-800 p-2 text-xs text-slate-300">الفعلي: {item.actualValue ?? '—'}</div>
                </div>
                {item.explanation ? <div className="mt-2 text-[11px] text-slate-400">{item.explanation}</div> : null}
              </article>
            )) : <EmptyState>لا توجد مقارنات نتائج مسجلة.</EmptyState>}
          </div>
        </section>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">إجراءات إعادة التحليل</h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div>مطابقة الأدلة: {actions.refreshEvidenceReconciliation ? 'مطلوبة' : 'غير مطلوبة'}</div>
              <div>التحليل المالي: {actions.refreshFinancialAnalysis ? 'مطلوب' : 'غير مطلوب'}</div>
              <div>جودة القرار: {actions.refreshDecisionQuality ? 'مطلوبة' : 'غير مطلوبة'}</div>
              <div>ملف الذكاء الاصطناعي: {actions.refreshAiDossier ? 'مطلوب' : 'غير مطلوب'}</div>
              <div>المراجعة البشرية: {actions.humanReviewRequired ? 'مطلوبة' : 'غير مطلوبة'}</div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">حلقة التعلّم</h3>
            {learningReview ? (
              <div className="space-y-2 text-xs text-slate-300">
                <div>الحالة: {learningReview.status || '—'}</div>
                <div>مرشحات التعلّم: {learningReview.learningCandidateCount ?? 0}</div>
                <div>المرشحات الجوهرية: {learningReview.materialLearningCandidateCount ?? 0}</div>
                <div className="text-[11px] text-slate-500">لا تحديث تلقائي للسياسات أو النماذج، ولا إعادة كتابة لقرار اللجنة.</div>
              </div>
            ) : <EmptyState>لا توجد مراجعة تعلّم مرتبطة بهذه النتيجة.</EmptyState>}
          </section>
        </div>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
          <strong className="text-slate-200">حدود الاستخدام:</strong> المتابعة تقارن بيانات مخططة بملاحظات فعلية موثقة كما زودها النظام المصدر. لا تستنتج السببية، ولا تعكس قرار اللجنة تلقائيًا، ولا تنفذ معاملة.
        </section>
      </div>
    </aside>
  );
}
