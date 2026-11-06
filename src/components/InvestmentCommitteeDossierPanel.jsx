const {governanceEvidenceLabel}=require('../i18n/governance-evidence-presentation');
const {useLocale}=require('../i18n/LocaleContext');
import DiagnosticText from './DiagnosticText.jsx';
import React from 'react';

function Badge({ children }) {
  const {locale}=useLocale();
  return <span data-code={typeof children==='string'?children:undefined} className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{typeof children==='string'?governanceEvidenceLabel(children,locale):children}</span>;
}

function EmptyState({ children }) {
  return <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">{children}</div>;
}

function ActionRegister({ dossier, actionReviewRegister }) {
  const {locale}=useLocale(); const t=(a,b)=>locale==='en'?b:a;
  const actions = dossier?.actionRegister?.actions || [];
  const reviewById = new Map((actionReviewRegister?.workflows || []).map((item) => [item.actionId, item]));
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="ic-actions-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="ic-actions-heading" className="text-sm font-semibold text-slate-100">{t("الإجراءات وشروط الإغلاق","Actions and closure conditions")}</h3>
        <div className="text-[11px] text-slate-500">{t("المفتوح:","Open:")} {dossier?.executiveSummary?.openActionCount ?? actions.length}</div>
      </div>
      <div className="space-y-2">
        {actions.length ? actions.map((action) => {
          const review = reviewById.get(action.actionId);
          return (
            <article key={action.actionId} className="rounded-lg border border-slate-800 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-100"><DiagnosticText code={action.description} locale={locale}/></div>
                  <div className="mt-1 text-[11px] text-slate-500"><span data-user-content translate="no">{action.actionId}</span> · <DiagnosticText code={action.type} locale={locale}/> · {t("المسؤول:","Owner:")} <span data-user-content translate="no">{action.ownerId}</span></div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge>{action.status}</Badge>
                  {review?.workflowStatus ? <Badge>{review.workflowStatus}</Badge> : null}
                </div>
              </div>
              {action.requiredEvidenceKeys?.length ? <div className="mt-2 text-[11px] text-slate-400">{t("الأدلة المطلوبة:","Required evidence:")} <code>{action.requiredEvidenceKeys.join(', ')}</code></div> : null}
              {review?.missingEvidenceKeys?.length ? <div className="mt-2 text-[11px] text-amber-300">{t("نواقص:","Missing:")} <code>{review.missingEvidenceKeys.join(', ')}</code></div> : null}
              {review?.canRequestHumanClosure ? <div className="mt-2 text-[11px] text-emerald-300">{t("جاهز لطلب مراجعة الإغلاق البشري.","Ready to request human closure review.")}</div> : null}
            </article>
          );
        }) : <EmptyState>{t("لا توجد إجراءات مرتبطة بملف اللجنة.","No actions are linked to this committee dossier.")}</EmptyState>}
      </div>
    </section>
  );
}

function AiReview({ dossier }) {
  const {locale}=useLocale(); const t=(a,b)=>locale==='en'?b:a;
  const items = [
    ['ANALYST', dossier?.aiReview?.analyst],
    ['CHALLENGER', dossier?.aiReview?.challenger],
    ['SYNTHESIZER', dossier?.aiReview?.synthesizer],
  ];
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-labelledby="ic-ai-heading">
      <h3 id="ic-ai-heading" className="mb-3 text-sm font-semibold text-slate-100">{t("مراجعة الذكاء الاصطناعي المقيدة","Constrained AI review")}</h3>
      <div className="grid gap-3 xl:grid-cols-3">
        {items.map(([role, item]) => (
          <article key={role} className="rounded-lg border border-slate-800 p-3">
            <div className="flex items-center justify-between gap-2"><div className="text-xs font-semibold text-slate-200">{governanceEvidenceLabel(role,locale)}</div><Badge>{item?.status || t('غير متاح','Unavailable')}</Badge></div>
            {item?.narrative ? <p data-user-content translate="no" className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">{item.narrative}</p> : <div className="mt-3"><EmptyState>{t("لا يوجد مخرج معتمد لهذا الدور.","No accepted output is available for this role.")}</EmptyState></div>}
            {item?.uncertainties?.length ? <div className="mt-2 text-[11px] text-amber-300">{t("تحفظات:","Uncertainties:")} <span data-user-content translate="no">{item.uncertainties.join(' · ')}</span></div> : null}
            {item?.disagreements?.length ? <div className="mt-2 text-[11px] text-rose-300">{t("اختلافات:","Disagreements:")} <span data-user-content translate="no">{item.disagreements.join(' · ')}</span></div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function InvestmentCommitteeDossierPanel({ dossier, actionReviewRegister = null }) {
  const {locale}=useLocale(); const t=(a,b)=>locale==='en'?b:a;
  if (!dossier || typeof dossier !== 'object') return null;
  const summary = dossier.executiveSummary || {};
  const attachments = dossier.analyticalAttachments || {};
  const evidence = dossier.evidenceAndAssumptions?.evidence || [];
  const assumptions = dossier.evidenceAndAssumptions?.assumptions || [];

  return (
    <aside data-testid="investment-committee-dossier" data-dossier-status={dossier.status} dir={locale==='en'?'ltr':'rtl'} className="mx-auto mt-6 w-full max-w-7xl px-4 pb-8">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-2xl shadow-black/20 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t('ملف قرار لجنة الاستثمار','Investment Committee Decision Dossier')}</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{t("ملف قرار لجنة الاستثمار","Investment committee decision dossier")}</h2>
            <div className="mt-1 text-[11px] text-slate-500">{locale==='en'?'Case':'الحالة'}: <span data-user-content translate="no">{dossier.caseId || '—'}</span> · {locale==='en'?'Project':'المشروع'}: <span data-user-content translate="no">{dossier.projectId || '—'}</span></div>
          </div>
          <div className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200">{governanceEvidenceLabel(dossier.status || 'UNKNOWN',locale)}</div>
        </div>

        {dossier.reasonCodes?.length ? <div role="status" className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">{dossier.reasonCodes.map(reason => <div key={reason}><DiagnosticText code={reason} locale={locale} /></div>)}</div> : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{t("الموثوقية النوعية","Qualitative reliability")}</div><div className="mt-1 text-sm text-slate-100">{governanceEvidenceLabel(summary.decisionReliability,locale)}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{t("الإجراءات المفتوحة","Open actions")}</div><div className="mt-1 text-sm text-slate-100">{summary.openActionCount ?? '—'}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{t("الأدلة / الافتراضات","Evidence / assumptions")}</div><div className="mt-1 text-sm text-slate-100">{evidence.length} / {assumptions.length}</div></div>
          <div className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{t("جاهزية اللجنة البشرية","Human committee readiness")}</div><div className="mt-1 text-sm text-slate-100">{dossier.readyForHumanCommittee ? t('جاهز للتحضير','Ready for preparation') : t('معلّق','Held')}</div></div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {['decisionThresholds', 'scenarioRisk', 'valuation', 'financial'].map((key) => (
            <div key={key} className="rounded-lg border border-slate-800 p-3"><div className="text-[11px] text-slate-500">{({decisionThresholds:t('حدود القرار','Decision thresholds'),scenarioRisk:t('مخاطر السيناريو','Scenario risk'),valuation:t('التقييم','Valuation'),financial:t('التحليل المالي','Financial analysis')})[key]}</div><div className="mt-1 text-xs text-slate-300">{attachments[key] ? t('مرفق تحليلي متاح','Analytical attachment available') : t('غير مرفق','Not attached')}</div></div>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          <ActionRegister dossier={dossier} actionReviewRegister={actionReviewRegister} />
          <AiReview dossier={dossier} />
          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
            <strong className="text-slate-200">{t("حدود الحوكمة:","Governance limits:")}</strong> {t("هذا الملف للتحضير والمراجعة البشرية فقط. لا يصدر تصويتًا آليًا، ولا تقييمًا معتمدًا، ولا رأيًا قانونيًا، ولا تفويضًا لتنفيذ معاملة.","This dossier supports preparation and human review only. It does not cast an automatic vote, issue a certified valuation or legal opinion, or authorize a transaction.")}
          </section>
        </div>
      </div>
    </aside>
  );
}
