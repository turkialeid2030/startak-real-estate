import React, { useMemo } from 'react';
import OutcomeMonitoringPanel from './OutcomeMonitoringPanel.jsx';
import LearningChangeControlPanel from './LearningChangeControlPanel.jsx';
const { buildPostDecisionGovernanceWorkspace } = require('../runtime/post-decision-governance-workspace');

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{children}</span>;
}

function Stage({ label, state, note }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-100">{state}</div>
      {note ? <div className="mt-1 text-[11px] leading-5 text-slate-400">{note}</div> : null}
    </div>
  );
}

export default function PostDecisionGovernancePanel({
  canonicalWorkspace,
  decisionRecord = null,
  actionRegister = null,
  actionHistories = [],
  evidenceByActionId = {},
  professionalReviewByActionId = {},
  outcomeSnapshot = null,
  comparisonItems = [],
  learningDispositions = [],
  impactAssessmentsByProposalRef = {},
  changeApprovalsByProposalRef = {},
}) {
  const pipeline = useMemo(() => {
    if (!canonicalWorkspace) return null;
    return buildPostDecisionGovernanceWorkspace({
      canonicalWorkspace,
      decisionRecord,
      actionRegister,
      actionHistories,
      evidenceByActionId,
      professionalReviewByActionId,
      outcomeSnapshot,
      comparisonItems,
    });
  }, [
    canonicalWorkspace,
    decisionRecord,
    actionRegister,
    actionHistories,
    evidenceByActionId,
    professionalReviewByActionId,
    outcomeSnapshot,
    comparisonItems,
  ]);

  if (!pipeline) return null;

  const decisionState = pipeline.decisionRecord?.humanDecisionConfirmed === true
    ? 'RECORDED_HUMAN_DECISION'
    : 'WAITING_FOR_HUMAN_COMMITTEE_DECISION';
  const actionState = pipeline.actionReviewRegister
    ? (pipeline.actionReviewRegister.allClosed ? 'ACTION_REVIEW_CLOSED' : 'ACTION_REVIEW_OPEN')
    : 'NOT_STARTED';
  const outcomeState = pipeline.outcomeFeedback?.status || 'NOT_STARTED';
  const learningState = pipeline.learningReview?.status || 'NOT_STARTED';

  return (
    <>
      <aside data-testid="post-decision-governance-panel" dir="rtl" className="mx-auto mt-6 w-full max-w-7xl px-4 pb-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-xl shadow-black/20 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Controlled Post-Decision Governance</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">مراجعة الإجراءات والنتائج والتعلّم</h2>
              <div className="mt-1 text-[11px] text-slate-500">Case: {pipeline.caseId} · Project: {pipeline.projectId}</div>
            </div>
            <Badge>{pipeline.status}</Badge>
          </div>

          {pipeline.reasonCodes?.length ? (
            <div role="status" className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              {pipeline.reasonCodes.join(' · ')}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stage label="قرار اللجنة البشري" state={decisionState} note="لا ينشئ هذا المسار قرار لجنة ولا يقبل قرارًا آليًا." />
            <Stage label="مراجعة الإجراءات" state={actionState} note="الإغلاق يتطلب سجل حالة وأدلة ومراجعة بشرية وفق نوع الإجراء." />
            <Stage label="تغذية النتائج" state={outcomeState} note="لا تُقبل النتائج الفعلية دون Snapshot موثق ومرجع دليل." />
            <Stage label="مراجعة التعلّم" state={learningState} note="المخرجات مرشحات مراجعة فقط ولا تعدّل نموذجًا أو سياسة تلقائيًا." />
          </div>

          <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-6 text-slate-400">
            <strong className="text-slate-200">حدود السلطة:</strong> لا تحديث تلقائي للنموذج أو السياسات أو المعايير، ولا إعادة كتابة لقرار سابق، ولا اعتماد مهني أو قانوني، ولا صلاحية إصدار أو دمج أو نشر أو تنفيذ معاملة. أي انتقال جوهري يحتاج سجلًا مقيد النطاق ومراجعة بشرية صريحة.
          </section>
        </div>
      </aside>

      {pipeline.outcomeFeedback ? (
        <OutcomeMonitoringPanel
          outcomeFeedback={pipeline.outcomeFeedback}
          learningReview={pipeline.learningReview}
          decisionRecord={pipeline.decisionRecord}
        />
      ) : null}

      {pipeline.learningReview ? (
        <LearningChangeControlPanel
          projectId={pipeline.projectId}
          caseId={pipeline.caseId}
          learningReview={pipeline.learningReview}
          humanDispositions={learningDispositions}
          impactAssessmentsByProposalRef={impactAssessmentsByProposalRef}
          changeApprovalsByProposalRef={changeApprovalsByProposalRef}
        />
      ) : null}
    </>
  );
}
