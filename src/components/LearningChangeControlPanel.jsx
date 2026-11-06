import React, { useMemo } from 'react';
import EngineeringChangeQualificationPanel from './EngineeringChangeQualificationPanel.jsx';
const {useLocale}=require('../i18n/LocaleContext');
const {assuranceLabel}=require('../i18n/assurance-workflow-presentation');
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
  implementationEvidenceByProposalRef = {},
  calculationEvidenceByProposalRef = {},
  regressionEvidenceByProposalRef = {},
  rollbackEvidenceByProposalRef = {},
  independentReviewByProposalRef = {},
  qualificationDecisionByProposalRef = {},
}) {
 const {locale,dir}=useLocale();
 const L=value=>assuranceLabel(value,locale);
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
    <>
      <aside data-testid="learning-change-control-panel" dir={dir} className="mx-auto mt-6 w-full max-w-7xl px-4 pb-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-xl shadow-black/20 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{locale==='en'?'Human Learning Disposition & Change Control':'القرار البشري وضبط التغيير'}</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">{L("حوكمة الدروس المستفادة ومقترحات التغيير")}</h2>
              <div className="mt-1 text-[11px] text-slate-500">{locale==='en'?'Case:':'الحالة:'} <span data-user-content translate="no">{registry.caseId}</span> · {locale==='en'?'Project:':'المشروع:'} <span data-user-content translate="no">{registry.projectId}</span></div>
            </div>
            <Badge><code translate="no" dir="ltr" className="break-all">{registry.status}</code></Badge>
          </div>

          {registry.reasonCodes?.length ? (
            <div role="status" className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              <code translate="no" dir="ltr" className="break-all">{registry.reasonCodes.join(' · ')}</code>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-800 p-3">
              <div className="text-[11px] text-slate-500">{L("مرشحات التعلّم")}</div>
              <div className="mt-1 text-sm text-slate-100">{learningReview.learningCandidateCount ?? learningReview.learningCandidates?.length ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-800 p-3">
              <div className="text-[11px] text-slate-500">{L("قرارات بشرية مسجلة")}</div>
              <div className="mt-1 text-sm text-slate-100">{registry.dispositions?.length ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-800 p-3">
              <div className="text-[11px] text-slate-500">{L("مقترحات تغيير")}</div>
              <div className="mt-1 text-sm text-slate-100">{registry.proposals?.length ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-800 p-3">
              <div className="text-[11px] text-slate-500">{L("مقترحات مؤهلة للهندسة")}</div>
              <div className="mt-1 text-sm text-slate-100">{registry.engineeringProposalCount ?? 0}</div>
            </div>
          </div>

          <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">{L("سجل المقترحات")}</h3>
            <div className="space-y-2">
              {registry.proposals?.length ? registry.proposals.map((proposal) => (
                <article key={proposal.proposalRef} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-100"><span data-user-content translate="no">{proposal.changeSummary}</span></div>
                      <div className="mt-1 text-[11px] text-slate-500"><code translate="no" dir="ltr" className="break-all">{proposal.proposalRef} · {proposal.changeKind} · {proposal.targetRef}</code></div>
                    </div>
                    <Badge><code translate="no" dir="ltr" className="break-all">{proposal.proposalStatus}</code></Badge>
                  </div>
                  <div className="mt-2 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                    <div>{L("مراجعة دورة حياة المعايير:")} {proposal.standardsLifecycleGovernanceRequired ? L('مطلوبة') : L('غير خاصة بهذا المقترح')}</div>
                    <div>{L("حوكمة النموذج/السياسة:")} {proposal.modelPolicyGovernanceRequired ? L('مطلوبة') : L('غير خاصة بهذا المقترح')}</div>
                  </div>
                </article>
              )) : <EmptyState>{L("لم ينشأ أي مقترح تغيير. قبول درس مستفاد يتطلب قرارًا بشريًا صريحًا أولًا.")}</EmptyState>}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-6 text-slate-400">
            <strong className="text-slate-200">{L("فصل الصلاحيات:")}</strong> {L("قبول الدرس لا يغيّر النموذج أو السياسة أو العتبة أو المعيار. حتى قرار")} <span dir="ltr">APPROVE_FOR_ENGINEERING</span> {L("ينشئ مقترحًا هندسيًا فقط؛ التنفيذ والاختبارات وتفعيل المعايير والإصدار والدمج والنشر تبقى بوابات مستقلة، وجميع صلاحيات الإنتاج والمعاملات تظل مقفلة.")}
          </section>
        </div>
      </aside>

      {registry.engineeringProposalCount > 0 ? (
        <EngineeringChangeQualificationPanel
          projectId={projectId}
          caseId={caseId}
          changeControlRegistry={registry}
          implementationEvidenceByProposalRef={implementationEvidenceByProposalRef}
          calculationEvidenceByProposalRef={calculationEvidenceByProposalRef}
          regressionEvidenceByProposalRef={regressionEvidenceByProposalRef}
          rollbackEvidenceByProposalRef={rollbackEvidenceByProposalRef}
          independentReviewByProposalRef={independentReviewByProposalRef}
          qualificationDecisionByProposalRef={qualificationDecisionByProposalRef}
        />
      ) : null}
    </>
  );
}
