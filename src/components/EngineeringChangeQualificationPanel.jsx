import React, { useMemo } from 'react';
const {useLocale}=require('../i18n/LocaleContext');
const {assuranceLabel}=require('../i18n/assurance-workflow-presentation');
const {
  buildEngineeringChangeQualificationGate,
} = require('../decision-quality/engineering-change-qualification');

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{children}</span>;
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-100">{value}</div>
    </div>
  );
}

export default function EngineeringChangeQualificationPanel({
  projectId,
  caseId,
  changeControlRegistry,
  implementationEvidenceByProposalRef = {},
  calculationEvidenceByProposalRef = {},
  regressionEvidenceByProposalRef = {},
  rollbackEvidenceByProposalRef = {},
  independentReviewByProposalRef = {},
  qualificationDecisionByProposalRef = {},
}) {
 const {locale,dir}=useLocale();
 const L=value=>assuranceLabel(value,locale);
  const qualification = useMemo(() => {
    if (!projectId || !caseId || !changeControlRegistry) return null;
    return buildEngineeringChangeQualificationGate({
      projectId,
      caseId,
      changeControlRegistry,
      implementationEvidenceByProposalRef,
      calculationEvidenceByProposalRef,
      regressionEvidenceByProposalRef,
      rollbackEvidenceByProposalRef,
      independentReviewByProposalRef,
      qualificationDecisionByProposalRef,
    });
  }, [
    projectId,
    caseId,
    changeControlRegistry,
    implementationEvidenceByProposalRef,
    calculationEvidenceByProposalRef,
    regressionEvidenceByProposalRef,
    rollbackEvidenceByProposalRef,
    independentReviewByProposalRef,
    qualificationDecisionByProposalRef,
  ]);

  if (!qualification) return null;

  return (
    <aside data-testid="engineering-change-qualification-panel" dir={dir} className="mx-auto mt-6 w-full max-w-7xl px-4 pb-4">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-xl shadow-black/20 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{locale==='en'?'Engineering Change Qualification':'تأهيل التغيير الهندسي'}</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{L("تأهيل التغيير الهندسي قبل مراجعة الإصدار")}</h2>
            <div className="mt-1 text-[11px] text-slate-500">{locale==='en'?'Case:':'الحالة:'} <span data-user-content translate="no">{qualification.caseId}</span> · {locale==='en'?'Project:':'المشروع:'} <span data-user-content translate="no">{qualification.projectId}</span></div>
          </div>
          <Badge><code translate="no" dir="ltr" className="break-all">{qualification.status}</code></Badge>
        </div>

        {qualification.reasonCodes?.length ? (
          <div role="status" className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
            <code translate="no" dir="ltr" className="break-all">{qualification.reasonCodes.join(' · ')}</code>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric label={L("مقترحات هندسية")} value={qualification.proposals?.length ?? 0} />
          <Metric label={L("أدلة التنفيذ")} value={qualification.implementationEvidence?.length ?? 0} />
          <Metric label={L("مراجعات مستقلة مسجلة")} value={qualification.independentReviews?.length ?? 0} />
          <Metric label={L("مؤهلة لمراجعة الإصدار")} value={qualification.qualifiedForReleaseReviewCount ?? 0} />
        </div>

        <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-6 text-slate-400">
          <strong className="text-slate-200">{L("تسلسل الإثبات:")}</strong> {L("التنفيذ → مقارنة قبل/بعد للحسابات عند انطباقها → Regression → Rollback → مراجعة مستقلة عند وجوبها → قرار تأهيل بشري. لا يكفي وجود Commit أو PR منفرد للوصول إلى هذه المرحلة.")}
        </section>

        <section className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-6 text-slate-400">
          <strong className="text-slate-200">{L("حدود السلطة:")}</strong> {L("نتيجة")} <span dir="ltr">QUALIFIED_FOR_RELEASE_REVIEW_ONLY</span> {L("لا تعني اعتماد الإنتاج أو تفعيل معيار أو تغيير نموذج تلقائي، ولا تمنح صلاحية Release أو Merge أو Deployment أو Transaction. أصالة المراجعة المستقلة الخارجية ليست مثبتة بواسطة هذه الطبقة.")}
        </section>
      </div>
    </aside>
  );
}
