const {governanceEvidenceLabel}=require('../i18n/governance-evidence-presentation');
import React, { useMemo } from 'react';
import DiagnosticText from './DiagnosticText.jsx';
const {useLocale}=require('../i18n/LocaleContext');
import OutcomeMonitoringPanel from './OutcomeMonitoringPanel.jsx';
import LearningChangeControlPanel from './LearningChangeControlPanel.jsx';
const { buildPostDecisionGovernanceWorkspace } = require('../runtime/post-decision-governance-workspace');

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{children}</span>;
}

function Stage({ label, state, note }) {
  const {locale}=useLocale();
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-100" data-code={state}>{governanceEvidenceLabel(state,locale)}</div>
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
  const {locale}=useLocale(); const t=(a,b)=>locale==='en'?b:a;
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
      <aside data-testid="post-decision-governance-panel" dir={locale==='en'?'ltr':'rtl'} className="mx-auto mt-6 w-full max-w-7xl px-4 pb-4">
        <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-xl shadow-black/20 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t('حوكمة ما بعد القرار المنضبطة','Controlled Post-Decision Governance')}</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">{t("مراجعة الإجراءات والنتائج والتعلّم","Action, outcome and learning review")}</h2>
              <div className="mt-1 text-[11px] text-slate-500">{locale==='en'?'Case':'الحالة'}: <span data-user-content translate="no">{pipeline.caseId}</span> · {locale==='en'?'Project':'المشروع'}: <span data-user-content translate="no">{pipeline.projectId}</span></div>
            </div>
            <Badge><DiagnosticText code={pipeline.status} locale={locale}/></Badge>
          </div>

          {pipeline.reasonCodes?.length ? (
            <div role="status" className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              {pipeline.reasonCodes.map(code=><div key={code}><DiagnosticText code={code} locale={locale}/></div>)}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Stage label={t("قرار اللجنة البشري","Human committee decision")} state={decisionState} note={t("لا ينشئ هذا المسار قرار لجنة ولا يقبل قرارًا آليًا.","This path does not create a committee decision or accept an automated decision.")} />
            <Stage label={t("مراجعة الإجراءات","Action review")} state={actionState} note={t("الإغلاق يتطلب سجل حالة وأدلة ومراجعة بشرية وفق نوع الإجراء.","Closure requires a state history, evidence and human review appropriate to the action.")} />
            <Stage label={t("تغذية النتائج","Outcome feedback")} state={outcomeState} note={t("لا تُقبل النتائج الفعلية دون Snapshot موثق ومرجع دليل.","Actual outcomes require a documented snapshot and evidence reference.")} />
            <Stage label={t("مراجعة التعلّم","Learning review")} state={learningState} note={t("المخرجات مرشحات مراجعة فقط ولا تعدّل نموذجًا أو سياسة تلقائيًا.","Outputs are review candidates only and do not automatically change a model or policy.")} />
          </div>

          <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-6 text-slate-400">
            <strong className="text-slate-200">{t("حدود السلطة:","Authority limits:")}</strong> {t("لا تحديث تلقائي للنموذج أو السياسات أو المعايير، ولا إعادة كتابة لقرار سابق، ولا اعتماد مهني أو قانوني، ولا صلاحية إصدار أو دمج أو نشر أو تنفيذ معاملة. أي انتقال جوهري يحتاج سجلًا مقيد النطاق ومراجعة بشرية صريحة.","No automatic model, policy or standards update, rewriting of prior decisions, professional or legal certification, or release, merge, deployment or transaction authority. Every material transition requires a scoped record and explicit human review.")}
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
