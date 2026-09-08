import React, { useMemo } from 'react';
const {
  buildLearningChangeControlRegistry,
} = require('../decision-quality/learning-change-control');

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{children}</span>;
}

function EmptyState({ children }) {
  return <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">{children}</div>;
}

export default function LearningChangeControlPanel({
  projectId,
  caseId,
  learningReview,
  humanDispositions = [],
  impactAssessmentsByProposalRef = {},
  changeApprovalsByProposalRef = {},
}) {
  const registry = useMemo(() => {
    if (!learningReview || !projectId || !caseId) return null;
    return buildLearningChangeControlRegistry({
      projectId,
      caseId,
      learningReview,
      humanDispositions,
      impactAssessmentsByProposalRef,
      changeApprovalsByProposalRef,
    });
  }, [
    projectId,
    caseId,
    learningReview,
    humanDispositions,
    impactAssessmentsByProposalRef,
    changeApprovalsByProposalRef,
  ]);

  if (!registry) return null;

  return (
    <aside data-testid="learning-change-control-panel" dir="rtl" className="mx-auto mt-6 w-full max-w-7xl px-4 pb-4">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-xl shadow-black/20 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Human Learning Disposition & Change Control</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">حوكمة الدروس المستفادة ومقترحات التغيير</h2>
            <div className="mt-1 text-[11px] text-slate-500">Case: {registry.caseId} · Project: {registry.projectId}</div>
          </div>
          <Badge>{registry.status}</Badge>
        </div>

        {registry.reasonCodes?.length ? (
          <div role="status" className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
            {registry.reasonCodes.join(' · ')}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-800 p-3">
            <div className="text-[11px] text-slate-500">مرشحات التعلّم</div>
            <div className="mt-1 text-sm text-slate-100">{learningReview.learningCandidateCount ?? learningReview.learningCandidates?.length ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-800 p-3">
            <div className="text-[11px] text-slate-500">قرارات بشرية مسجلة</div>
            <div className="mt-1 text-sm text-slate-100">{registry.dispositions?.length ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-800 p-3">
            <div className="text-[11px] text-slate-500">مقترحات تغيير</div>
            <div className="mt-1 text-sm text-slate-100">{registry.proposals?.length ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-800 p-3">
            <div className="text-[11px] text-slate-500">مقترحات مؤهلة للهندسة</div>
            <div className="mt-1 text-sm text-slate-100">{registry.engineeringProposalCount ?? 0}</div>
          </div>
        </div>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-100">سجل المقترحات</h3>
          <div className="space-y-2">
            {registry.proposals?.length ? registry.proposals.map((proposal) => (
              <article key={proposal.proposalRef} className="rounded-lg border border-slate-800 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-100">{proposal.changeSummary}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{proposal.proposalRef} · {proposal.changeKind} · {proposal.targetRef}</div>
                  </div>
                  <Badge>{proposal.proposalStatus}</Badge>
                </div>
                <div className="mt-2 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                  <div>مراجعة دورة حياة المعايير: {proposal.standardsLifecycleGovernanceRequired ? 'مطلوبة' : 'غير خاصة بهذا المقترح'}</div>
                  <div>حوكمة النموذج/السياسة: {proposal.modelPolicyGovernanceRequired ? 'مطلوبة' : 'غير خاصة بهذا المقترح'}</div>
                </div>
              </article>
            )) : <EmptyState>لم ينشأ أي مقترح تغيير. قبول درس مستفاد يتطلب قرارًا بشريًا صريحًا أولًا.</EmptyState>}
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-6 text-slate-400">
          <strong className="text-slate-200">فصل الصلاحيات:</strong> قبول الدرس لا يغيّر النموذج أو السياسة أو العتبة أو المعيار. حتى قرار <span dir="ltr">APPROVE_FOR_ENGINEERING</span> ينشئ مقترحًا هندسيًا فقط؛ التنفيذ والاختبارات وتفعيل المعايير والإصدار والدمج والنشر تبقى بوابات مستقلة، وجميع صلاحيات الإنتاج والمعاملات تظل مقفلة.
        </section>
      </div>
    </aside>
  );
}
