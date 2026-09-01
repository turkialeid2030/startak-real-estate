import React from 'react';

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{children}</span>;
}

function EmptyState({ children }) {
  return <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">{children}</div>;
}

function ActionRegister({ dossier, actionReviewRegister }) {
  const actions = dossier?.actionRegister?.actions || [];
  const reviewById = new Map((actionReviewRegister?.workflows || []).map((item) => [item.actionId, item]));
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="ic-actions-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="ic-actions-heading" className="text-sm font-semibold text-slate-100">الإجراءات وشروط الإغلاق</h3>
        <div className="text-[11px] text-slate-500">المفتوح: {dossier?.executiveSummary?.openActionCount ?? actions.length}</div>
      </div>
      <div className="space-y-2">
        {actions.length ? actions.map((action) => {
          const review = reviewById.get(action.actionId);
          return (
            <article key={action.actionId} className="rounded-lg border border-slate-800 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-100">{action.description}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{action.actionId} · {action.type} · المسؤول: {action.ownerId}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge>{action.status}</Badge>
                  {review?.workflowStatus ? <Badge>{review.workflowStatus}</Badge> : null}
                </div>
              </div>
              {action.requiredEvidenceKeys?.length ? <div className="mt-2 text-[11px] text-slate-400">الأدلة المطلوبة: {action.requiredEvidenceKeys.join(', ')}</div> : null}
              {review?.missingEvidenceKeys?.length ? <div className="mt-2 text-[11px] text-amber-300">نواقص: {review.missingEvidenceKeys.join(', ')}</div> : null}
              {review?.canRequestHumanClosure ? <div className="mt-2 text-[11px] text-emerald-300">جاهز لطلب مراجعة الإغلاق البشري.</div> : null}
            </article>
          );
        }) : <EmptyState>لا توجد إجراءات مرتبطة بملف اللجنة.</EmptyState>}
      </div>
    </section>
  );
}

function AiReview({ dossier }) {
  const items = [
    ['ANALYST', dossier?.aiReview?.analyst],
    ['CHALLENGER', dossier?.aiReview?.challenger],
    ['SYNTHESIZER', dossier?.aiReview?.synthesizer],
  ];
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="ic-ai-heading">
      <h3 id="ic-ai-heading" className="mb-3 text-sm font-semibold text-slate-100">مراجعة الذكاء الاصطناعي المقيدة</h3>
      <div className="grid gap-3 xl:grid-cols-3">
        {items.map(([role, item]) => (
          <article key={role} className="rounded-lg border border-slate-800 p-3">
            <div className="flex items-center justify-between gap-2"><div className="text-xs font-semibold text-slate-200">{role}</div><Badge>{item?.status || 'غير متاح'}</Badge></div>
            {item?.narrative ? <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">{item.narrative}</p> : <div className="mt-3"><EmptyState>لا يوجد مخرج معتمد لهذا الدور.</EmptyState></div>}
            {item?.uncertainties?.length ? <div className="mt-2 text-[11px] text-amber-300">تحفظات: {item.uncertainties.join(' · ')}</div> : null}
            {item?.disagreements?.length ? <div className="mt-2 text-[11px] text-rose-300">اختلافات: {item.disagreements.join(' · ')}</div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function InvestmentCommitteeDossierPanel({ dossier, actionReviewRegister = null }) {
  if (!dossier || typeof dossier !== 'object') return null;
  const summary = dossier.executiveSummary || {};
  const attachments = dossier.analyticalAttachments || {};
  const evidence = dossier.evidenceAndAssumptions?.evidence || [];
  const assumptions = dossier.evidenceAndAssumptions?.assumptions || [];

  return (
    <aside data-testid="investment-committee-dossier" dir="rtl" className="mx-auto mt-6 w-full max-w-7xl px-4 pb-8">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-2xl shadow-black/20 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Investment Committee Decision Dossier</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">ملف قرار لجنة الاستثمار</h2>
            <div className="mt-1 text-[11px] text-slate-500">Case: {dossier.caseId || '—'} · Project: {dossier.projectId || '—'}</div>
          </div>
          <div className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200">{dossier.status || 'UNKNOWN'}</div>
        </div>

        {dossier.reasonCodes?.length ? <div role="status" className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">{dossier.reasonCodes.join(' · ')}</div> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">الموثوقية النوعية</div><div className="mt-1 text-sm text-slate-100">{summary.decisionReliability || '—'}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">الإجراءات المفتوحة</div><div className="mt-1 text-sm text-slate-100">{summary.openActionCount ?? '—'}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">الأدلة / الافتراضات</div><div className="mt-1 text-sm text-slate-100">{evidence.length} / {assumptions.length}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">جاهزية اللجنة البشرية</div><div className="mt-1 text-sm text-slate-100">{dossier.readyForHumanCommittee ? 'جاهز للتحضير' : 'معلّق'}</div></div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {['decisionThresholds', 'scenarioRisk', 'valuation', 'financial'].map((key) => (
            <div key={key} className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{key}</div><div className="mt-1 text-xs text-slate-300">{attachments[key] ? 'مرفق تحليلي متاح' : 'غير مرفق'}</div></div>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          <ActionRegister dossier={dossier} actionReviewRegister={actionReviewRegister} />
          <AiReview dossier={dossier} />
          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
            <strong className="text-slate-200">حدود الحوكمة:</strong> هذا الملف للتحضير والمراجعة البشرية فقط. لا يصدر تصويتًا آليًا، ولا تقييمًا معتمدًا، ولا رأيًا قانونيًا، ولا تفويضًا لتنفيذ معاملة.
          </section>
        </div>
      </div>
    </aside>
  );
}
