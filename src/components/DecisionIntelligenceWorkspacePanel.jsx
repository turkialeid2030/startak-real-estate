import React from 'react';

const STATUS_TONE = Object.freeze({
  READY_FOR_REVIEW: 'border-emerald-700/50 bg-emerald-950/20 text-emerald-200',
  HOLD_STUDY: 'border-amber-700/50 bg-amber-950/20 text-amber-200',
  HOLD_EVIDENCE: 'border-amber-700/50 bg-amber-950/20 text-amber-200',
  HOLD_AI_OUTPUTS: 'border-amber-700/50 bg-amber-950/20 text-amber-200',
});

function tone(status) {
  return STATUS_TONE[status] || 'border-slate-700 bg-slate-900/60 text-slate-200';
}

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">{children}</span>;
}

function EmptyState({ children }) {
  return <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">{children}</div>;
}

function EvidenceSection({ workspace }) {
  const evidence = workspace.evidence || [];
  const assumptions = workspace.assumptions || [];
  return (
    <section aria-labelledby="di-evidence-heading" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="di-evidence-heading" className="text-sm font-semibold text-slate-100">الأدلة والافتراضات</h3>
        <div className="flex gap-2 text-[11px] text-slate-400">
          <span>الأدلة: {evidence.length}</span>
          <span>الافتراضات: {assumptions.length}</span>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          {evidence.length ? evidence.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-100">{item.label}</div>
                  <div className="text-[11px] text-slate-500">{item.domain} · {item.sourceRef}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge>{item.status}</Badge>
                  {item.verified ? <Badge>موثق</Badge> : <Badge>غير موثق</Badge>}
                  {item.stale ? <Badge>متقادم</Badge> : null}
                  {item.conflict ? <Badge>متعارض</Badge> : null}
                </div>
              </div>
            </article>
          )) : <EmptyState>لا توجد سجلات أدلة متاحة في مساحة العمل الحالية.</EmptyState>}
        </div>
        <div className="space-y-2">
          {assumptions.length ? assumptions.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-800 p-3">
              <div className="text-sm text-slate-100">{item.label}</div>
              <div className="mt-1 text-xs text-slate-300">{item.valueDisplay}</div>
              <div className="mt-1 text-[11px] text-slate-500">{item.basis}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {item.material ? <Badge>جوهري</Badge> : null}
                {item.sensitivityRequired ? <Badge>يتطلب حساسية</Badge> : null}
                <Badge>{item.approved ? 'معتمد' : 'غير معتمد'}</Badge>
              </div>
            </article>
          )) : <EmptyState>لا توجد افتراضات مسجلة في مساحة العمل الحالية.</EmptyState>}
        </div>
      </div>
    </section>
  );
}

function DecisionQualitySection({ workspace }) {
  const quality = workspace.decisionQuality || {};
  const diligence = quality.nextBestDueDiligence;
  return (
    <section aria-labelledby="di-quality-heading" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h3 id="di-quality-heading" className="mb-3 text-sm font-semibold text-slate-100">موثوقية القرار والفحص التالي</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-800 p-3">
          <div className="text-[11px] text-slate-500">حالة جودة القرار</div>
          <div className="mt-1 text-sm text-slate-100">{quality.status || '—'}</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-3">
          <div className="text-[11px] text-slate-500">الموثوقية النوعية</div>
          <div className="mt-1 text-sm text-slate-100">{quality.reliability || '—'}</div>
        </div>
        <div className="rounded-lg border border-slate-800 p-3">
          <div className="text-[11px] text-slate-500">الفحص التالي</div>
          <div className="mt-1 text-sm text-slate-100">{diligence?.id || '—'}</div>
          {diligence?.priority ? <div className="mt-1 text-[11px] text-slate-400">الأولوية: {diligence.priority}</div> : null}
        </div>
      </div>
    </section>
  );
}

function AiSection({ workspace }) {
  const ai = workspace.ai || [];
  const roles = ['ANALYST', 'CHALLENGER', 'SYNTHESIZER'];
  return (
    <section aria-labelledby="di-ai-heading" className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="di-ai-heading" className="text-sm font-semibold text-slate-100">طبقة الذكاء الاصطناعي المقيدة</h3>
        <div className="text-[11px] text-slate-500">لا تتجاوز النتائج الحتمية · القرار البشري إلزامي</div>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {roles.map((role) => {
          const item = ai.find((entry) => entry.role === role);
          return (
            <article key={role} className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-200">{role}</div>
                <Badge>{item?.status || 'غير متاح'}</Badge>
              </div>
              {item?.narrative ? <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">{item.narrative}</p> : <div className="mt-3"><EmptyState>لا يوجد مخرج مقبول لهذا الدور.</EmptyState></div>}
              {item?.uncertainties?.length ? <div className="mt-3 text-[11px] text-amber-300">تحفظات: {item.uncertainties.join(' · ')}</div> : null}
              {item?.disagreements?.length ? <div className="mt-2 text-[11px] text-rose-300">اختلافات: {item.disagreements.join(' · ')}</div> : null}
              {item?.citedEvidenceRefs?.length ? <div className="mt-2 text-[11px] text-slate-500">الأدلة: {item.citedEvidenceRefs.join(', ')}</div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function DecisionIntelligenceWorkspacePanel({ workspace }) {
  if (!workspace || typeof workspace !== 'object') return null;

  return (
    <aside data-testid="decision-intelligence-workspace" dir="rtl" className="mx-auto mt-6 w-full max-w-7xl px-4 pb-8">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-2xl shadow-black/20 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Decision Intelligence Workspace</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">مساحة القرار والتحقق</h2>
            <div className="mt-1 text-[11px] text-slate-500">Case: {workspace.caseId || '—'} · Project: {workspace.projectId || '—'}</div>
          </div>
          <div className={`rounded-lg border px-3 py-2 text-xs ${tone(workspace.status)}`}>
            {workspace.status || 'UNKNOWN'}
          </div>
        </div>

        {workspace.reasonCodes?.length ? (
          <div className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200" role="status">
            {workspace.reasonCodes.join(' · ')}
          </div>
        ) : null}

        <div className="space-y-4">
          <EvidenceSection workspace={workspace} />
          <DecisionQualitySection workspace={workspace} />
          <AiSection workspace={workspace} />
          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
            <strong className="text-slate-200">حدود الاستخدام:</strong> لا تمثل هذه المساحة تقييمًا معتمدًا أو رأيًا قانونيًا أو تفويضًا لتنفيذ معاملة. المراجعة البشرية والمهنية تبقى مطلوبة وفق بوابات الدراسة.
          </section>
        </div>
      </div>
    </aside>
  );
}
