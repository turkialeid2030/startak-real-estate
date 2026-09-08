import React, { useEffect, useMemo, useState } from 'react';
import DecisionIntelligenceWorkspacePanel from './DecisionIntelligenceWorkspacePanel.jsx';
const { useLocale } = require('../i18n/LocaleContext.js');
const { createStorageProvider } = require('../storage/create-storage-provider');
const {
  createProjectProfile,
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('../project-model');
const {
  createCanonicalWorkspaceFromSavedDeal,
} = require('../runtime/saved-deal-canonical-workspace-bridge');

const SELECT_STYLE = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200';
const INPUT_STYLE = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600';

function values(object) {
  return Object.values(object);
}

function Label({ children }) {
  return <label className="block text-[11px] text-slate-400">{children}</label>;
}

function Select({ value, onChange, options, ariaLabel }) {
  return (
    <select className={SELECT_STYLE} value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function buildDecisionWorkspace(canonicalWorkspace) {
  const unresolved = canonicalWorkspace.orchestration?.unresolvedLifecycleSections || [];
  const reasonCodes = canonicalWorkspace.orchestration?.reasonCodes || [];
  return Object.freeze({
    projectId: canonicalWorkspace.projectId,
    caseId: canonicalWorkspace.caseId,
    status: unresolved.length ? 'HOLD_STUDY' : 'READY_FOR_REVIEW',
    reasonCodes,
    evidence: Object.freeze([]),
    assumptions: Object.freeze([]),
    decisionQuality: Object.freeze({
      status: unresolved.length ? 'HOLD_STUDY' : 'READY_FOR_REVIEW',
      reliability: 'UNQUALIFIED_FOR_PROFESSIONAL_RELEASE',
      nextBestDueDiligence: unresolved.length
        ? Object.freeze({ id: `LIFECYCLE:${unresolved[0]}`, priority: 'HIGH' })
        : null,
    }),
    ai: Object.freeze([]),
    humanDecisionRequired: true,
    transactionAuthorized: false,
  });
}

export default function CanonicalCaseWorkspacePanel() {
  const { locale } = useLocale();
  const en = locale === 'en';
  const [deals, setDeals] = useState([]);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [actorId, setActorId] = useState('');
  const [assetClass, setAssetClass] = useState(ASSET_CLASS.OTHER);
  const [customAssetClass, setCustomAssetClass] = useState('EXISTING_BUILDING_OR_DEVELOPMENT');
  const [lifecycleStage, setLifecycleStage] = useState(LIFECYCLE_STAGE.OTHER);
  const [customLifecycleStage, setCustomLifecycleStage] = useState('USER_SELECTED_CASE_STAGE');
  const [investmentStrategy, setInvestmentStrategy] = useState(INVESTMENT_STRATEGY.OTHER);
  const [customInvestmentStrategy, setCustomInvestmentStrategy] = useState('USER_SELECTED_STRATEGY');
  const [incomeModel, setIncomeModel] = useState(INCOME_MODEL.UNKNOWN);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assembling, setAssembling] = useState(false);

  const copy = useMemo(() => en ? {
    eyebrow: 'Canonical In-App Case Path',
    title: 'Canonical Case Workspace',
    note: 'Build a scoped case from a validated saved deal. Project classification and actor identity are explicit inputs and are not inferred from the deal name.',
    deal: 'Saved deal',
    workspaceId: 'Workspace ID',
    projectId: 'Project ID',
    caseId: 'Case ID',
    actorId: 'Analyst / actor ID',
    assetClass: 'Asset class',
    lifecycle: 'Lifecycle stage',
    strategy: 'Investment strategy',
    incomeModel: 'Income model',
    custom: 'Custom classification',
    assemble: 'Assemble canonical case',
    refresh: 'Refresh deals',
    noDeals: 'No saved deals are available. Save a deal in the main workspace first.',
    required: 'Select a saved deal and enter Workspace ID, Project ID, Case ID and actor ID.',
    selfAsserted: 'Actor attribution is self-asserted local metadata; it is not authenticated identity.',
    boundaries: 'No professional valuation, legal approval, release, deployment or transaction authority is granted by this workspace.',
    status: 'Workspace status',
    unresolved: 'Unresolved lifecycle sections',
  } : {
    eyebrow: 'المسار الداخلي للحالة المعيارية',
    title: 'مساحة الحالة الاستثمارية المعيارية',
    note: 'تجميع حالة مقيدة من صفقة محفوظة ومتحقق من بنيتها. تصنيف المشروع وهوية المحلل مدخلات صريحة ولا يتم استنتاجها من اسم الصفقة.',
    deal: 'الصفقة المحفوظة',
    workspaceId: 'معرّف مساحة العمل',
    projectId: 'معرّف المشروع',
    caseId: 'معرّف الحالة',
    actorId: 'معرّف المحلل / المستخدم',
    assetClass: 'فئة الأصل',
    lifecycle: 'مرحلة دورة الحياة',
    strategy: 'الاستراتيجية الاستثمارية',
    incomeModel: 'نموذج الدخل',
    custom: 'التصنيف المخصص',
    assemble: 'تجميع الحالة المعيارية',
    refresh: 'تحديث الصفقات',
    noDeals: 'لا توجد صفقات محفوظة. احفظ صفقة من مساحة العمل الرئيسية أولاً.',
    required: 'اختر صفقة محفوظة وأدخل معرّف مساحة العمل والمشروع والحالة والمحلل.',
    selfAsserted: 'هوية المحلل هنا بيانات محلية مُصرّح بها ذاتيًا وليست هوية موثقة بالمصادقة.',
    boundaries: 'هذه المساحة لا تمنح تقييمًا مهنيًا معتمدًا أو موافقة قانونية أو صلاحية إصدار أو نشر أو تنفيذ معاملة.',
    status: 'حالة مساحة العمل',
    unresolved: 'مراحل دورة الحياة غير المكتملة',
  }, [en]);

  async function loadDeals() {
    setLoading(true);
    setError(null);
    try {
      const storage = createStorageProvider();
      const raw = await storage.get('deals-index');
      if (!raw) {
        setDeals([]);
        setSelectedDealId('');
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('INVALID_DEALS_INDEX');
      const safeDeals = parsed.filter((item) => item && typeof item === 'object' && typeof item.id === 'string');
      setDeals(safeDeals);
      setSelectedDealId((current) => safeDeals.some((item) => item.id === current) ? current : (safeDeals[0]?.id || ''));
    } catch (loadError) {
      setDeals([]);
      setSelectedDealId('');
      setError(loadError?.code || loadError?.message || 'WORKSPACE_DEAL_INDEX_LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDeals();
  }, []);

  async function assemble() {
    if (!selectedDealId || !workspaceId.trim() || !projectId.trim() || !caseId.trim() || !actorId.trim()) {
      setError(copy.required);
      return;
    }
    setAssembling(true);
    setError(null);
    setWorkspace(null);
    try {
      const storage = createStorageProvider();
      const raw = await storage.get(`deal:${selectedDealId}`);
      if (!raw) throw new Error('SAVED_DEAL_NOT_FOUND');
      const savedDeal = JSON.parse(raw);
      const profile = createProjectProfile({
        projectId: projectId.trim(),
        projectName: typeof savedDeal.name === 'string' ? savedDeal.name : null,
        assetClasses: [assetClass],
        lifecycleStage,
        investmentStrategy,
        incomeModel,
        customAssetClass: assetClass === ASSET_CLASS.OTHER ? customAssetClass : null,
        customLifecycleStage: lifecycleStage === LIFECYCLE_STAGE.OTHER ? customLifecycleStage : null,
        customInvestmentStrategy: investmentStrategy === INVESTMENT_STRATEGY.OTHER ? customInvestmentStrategy : null,
        metadata: {
          classificationSource: 'EXPLICIT_IN_APP_USER_SELECTION',
          classificationInferredFromDealName: false,
        },
      });
      const assembled = createCanonicalWorkspaceFromSavedDeal({
        savedDeal,
        workspaceId: workspaceId.trim(),
        projectProfile: profile,
        caseId: caseId.trim(),
        attribution: {
          actorId: actorId.trim(),
          actorRole: 'SELF_ASSERTED_ANALYST',
          source: 'IN_APP_SAVED_DEAL_WORKSPACE',
        },
      });
      setWorkspace(assembled);
    } catch (assembleError) {
      setError(assembleError?.code || assembleError?.reasonCode || assembleError?.message || 'CANONICAL_CASE_ASSEMBLY_FAILED');
    } finally {
      setAssembling(false);
    }
  }

  const decisionWorkspace = workspace ? buildDecisionWorkspace(workspace) : null;

  return (
    <section data-testid="canonical-case-workspace-panel" dir={en ? 'ltr' : 'rtl'} className="mx-auto mt-6 w-full max-w-7xl px-4 pb-4">
      <div className="rounded-2xl border border-slate-800 bg-[#0D1526] p-4 shadow-xl shadow-black/20 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{copy.eyebrow}</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{copy.title}</h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">{copy.note}</p>
          </div>
          <button type="button" onClick={loadDeals} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-600">
            {copy.refresh}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label>{copy.deal}</Label>
            <select className={`${SELECT_STYLE} mt-1`} value={selectedDealId} onChange={(event) => setSelectedDealId(event.target.value)} disabled={loading || deals.length === 0}>
              {deals.length === 0 ? <option value="">{copy.noDeals}</option> : null}
              {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.name || deal.id} · {deal.mode}</option>)}
            </select>
          </div>
          <div>
            <Label>{copy.workspaceId}</Label>
            <input className={`${INPUT_STYLE} mt-1`} value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} placeholder="WS-..." />
          </div>
          <div>
            <Label>{copy.projectId}</Label>
            <input className={`${INPUT_STYLE} mt-1`} value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="PROJECT-..." />
          </div>
          <div>
            <Label>{copy.caseId}</Label>
            <input className={`${INPUT_STYLE} mt-1`} value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="CASE-..." />
          </div>
          <div>
            <Label>{copy.actorId}</Label>
            <input className={`${INPUT_STYLE} mt-1`} value={actorId} onChange={(event) => setActorId(event.target.value)} placeholder="ACTOR-..." />
          </div>
          <div>
            <Label>{copy.assetClass}</Label>
            <div className="mt-1"><Select value={assetClass} onChange={setAssetClass} options={values(ASSET_CLASS)} ariaLabel={copy.assetClass} /></div>
          </div>
          <div>
            <Label>{copy.lifecycle}</Label>
            <div className="mt-1"><Select value={lifecycleStage} onChange={setLifecycleStage} options={values(LIFECYCLE_STAGE)} ariaLabel={copy.lifecycle} /></div>
          </div>
          <div>
            <Label>{copy.strategy}</Label>
            <div className="mt-1"><Select value={investmentStrategy} onChange={setInvestmentStrategy} options={values(INVESTMENT_STRATEGY)} ariaLabel={copy.strategy} /></div>
          </div>
          <div>
            <Label>{copy.incomeModel}</Label>
            <div className="mt-1"><Select value={incomeModel} onChange={setIncomeModel} options={values(INCOME_MODEL)} ariaLabel={copy.incomeModel} /></div>
          </div>
          {assetClass === ASSET_CLASS.OTHER ? (
            <div>
              <Label>{copy.custom} · Asset</Label>
              <input className={`${INPUT_STYLE} mt-1`} value={customAssetClass} onChange={(event) => setCustomAssetClass(event.target.value)} />
            </div>
          ) : null}
          {lifecycleStage === LIFECYCLE_STAGE.OTHER ? (
            <div>
              <Label>{copy.custom} · Lifecycle</Label>
              <input className={`${INPUT_STYLE} mt-1`} value={customLifecycleStage} onChange={(event) => setCustomLifecycleStage(event.target.value)} />
            </div>
          ) : null}
          {investmentStrategy === INVESTMENT_STRATEGY.OTHER ? (
            <div>
              <Label>{copy.custom} · Strategy</Label>
              <input className={`${INPUT_STYLE} mt-1`} value={customInvestmentStrategy} onChange={(event) => setCustomInvestmentStrategy(event.target.value)} />
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-[11px] leading-5 text-amber-200">
          <div>{copy.selfAsserted}</div>
          <div>{copy.boundaries}</div>
        </div>

        {error ? <div className="mt-3 rounded-lg border border-rose-900/60 bg-rose-950/20 p-3 text-xs text-rose-200" role="alert">{String(error)}</div> : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={assemble} disabled={assembling || loading || deals.length === 0} className="rounded-lg border border-emerald-700/60 bg-emerald-950/30 px-4 py-2 text-xs font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">
            {assembling ? '…' : copy.assemble}
          </button>
          {workspace ? <span className="text-xs text-slate-400">{copy.status}: <strong className="text-slate-200">{workspace.status}</strong></span> : null}
        </div>

        {workspace ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-400">Project: <span className="text-slate-200">{workspace.projectId}</span></div>
            <div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-400">Case: <span className="text-slate-200">{workspace.caseId}</span></div>
            <div className="rounded-lg border border-slate-800 p-3 text-xs text-slate-400">{copy.unresolved}: <span className="text-slate-200">{workspace.orchestration.unresolvedLifecycleSections.length}</span></div>
          </div>
        ) : null}
      </div>

      {decisionWorkspace ? <DecisionIntelligenceWorkspacePanel workspace={decisionWorkspace} /> : null}
    </section>
  );
}
