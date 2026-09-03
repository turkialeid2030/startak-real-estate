import React from 'react';

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatNumber(value, locale, digits = 0) {
  if (!finite(value)) return '—';
  return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPercent(value, locale, digits = 0) {
  if (!finite(value)) return '—';
  return `${formatNumber(value * 100, locale, digits)}%`;
}

function Metric({ label, value, note = null, testId = null }) {
  return (
    <div data-testid={testId || undefined} className="rounded-lg border border-slate-800 bg-slate-950/20 p-3">
      <div className="text-[11px] leading-5 text-slate-500">{label}</div>
      <div className="rf-num mt-1 text-base font-semibold text-slate-100">{value}</div>
      {note ? <div className="mt-1 text-[10px] leading-4 text-slate-500">{note}</div> : null}
    </div>
  );
}

function Section({ id, title, status, children, notice = null }) {
  return (
    <section data-testid={id} aria-labelledby={`${id}-title`} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${id}-title`} className="text-sm font-semibold text-slate-100">{title}</h3>
        {status ? <span className="rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-500">{status}</span> : null}
      </div>
      {children}
      {notice ? <div className="mt-3 text-[11px] leading-5 text-slate-500">{notice}</div> : null}
    </section>
  );
}

function IssueRows({ issues, emptyLabel }) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-500">{emptyLabel}</div>;
  }
  return (
    <div className="space-y-2">
      {issues.slice(0, 8).map((issue, index) => (
        <div key={`${issue.code || 'issue'}-${index}`} className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-3 text-xs text-amber-100/80">
          <div className="font-semibold">{issue.code || 'REVIEW_REQUIRED'}</div>
          {issue.scenarioId ? <div className="mt-1 text-[10px] text-slate-500">{issue.scenarioId}</div> : null}
        </div>
      ))}
      {issues.length > 8 ? <div className="text-[10px] text-slate-500">+{issues.length - 8}</div> : null}
    </div>
  );
}

function ScoreBar({ score }) {
  const width = finite(score) ? Math.max(0, Math.min(100, score)) : 0;
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900" aria-hidden="true">
      <div className="h-full rounded-full bg-slate-400" style={{ width: `${width}%` }} />
    </div>
  );
}

export default function ResidentialIncomeDecisionExtension({ viewModel, dir = 'rtl' }) {
  if (!viewModel || typeof viewModel !== 'object') return null;
  const ar = dir === 'rtl';
  const locale = ar ? 'ar-SA' : 'en-US';
  const intelligence = viewModel.lifecycleLocationUpside;
  const evidenceGovernance = intelligence?.evidenceGovernance;
  const subdivision = viewModel.subdivisionGate;
  const lifecycle = intelligence?.lifecycle;
  const location = intelligence?.location;
  const forward = intelligence?.forwardAttraction;
  const upside = intelligence?.upside;
  const score = viewModel.acquisitionAnalyticalScore;
  const integration = viewModel.scenarioIntegration;
  const committee = viewModel.investmentCommitteePack;

  if (!intelligence && !score && !integration && !committee) return null;

  const label = (arabic, english) => (ar ? arabic : english);
  const directionLabel = (value) => {
    if (value === 'POSITIVE') return label('إيجابي', 'Positive');
    if (value === 'NEGATIVE') return label('سلبي', 'Negative');
    if (value === 'NEUTRAL') return label('محايد', 'Neutral');
    return '—';
  };

  return (
    <div data-testid="riai-decision-extension" className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Lifecycle · Location · Upside · Decision Layer v1</div>
            <h3 className="mt-1 text-sm font-semibold text-slate-100">
              {label('ذكاء دورة حياة الأصل والموقع والجاذبية المستقبلية ومحفزات الزيادة', 'Asset lifecycle, location, forward attraction & upside intelligence')}
            </h3>
          </div>
          <span className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400">
            {viewModel.intelligenceExtensionStatus || 'LIFECYCLE_LOCATION_UPSIDE_AND_IC_V1'}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          {label(
            'طبقة تحليلية مساندة للقرار. لا تمثل تقييماً معتمداً أو رأياً قانونياً أو توصية شراء/بيع أو تفويضاً بتنفيذ صفقة.',
            'Analytical decision-support layer. It is not a certified valuation, legal opinion, buy/sell recommendation, or transaction authorization.',
          )}
        </p>
      </div>

      {evidenceGovernance || subdivision ? (
        <Section
          id="riai-strategic-evidence-governance"
          title={label('حوكمة الأدلة وأهلية التقسيم', 'Evidence Governance & Subdivision Eligibility')}
          status={evidenceGovernance?.status || subdivision?.status}
          notice={label(
            'المدخلات الاستراتيجية غير المرتبطة بمصدر واعتماد صالحين تُستبعد من الحساب. اجتياز فحوص التقسيم يسمح باختبار السيناريو فقط ولا يمثل موافقة نظامية.',
            'Strategic inputs without valid source and adoption lineage are excluded. Passing subdivision checks permits scenario testing only and is not authority approval.',
          )}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric label={label('تغطية الأدلة الاستراتيجية', 'Strategic evidence coverage')} value={formatPercent(evidenceGovernance?.evidenceCoverage, locale, 0)} testId="riai-strategic-evidence-coverage" />
            <Metric label={label('مدخلات صالحة', 'Usable adopted inputs')} value={formatNumber(evidenceGovernance?.usableAdoptedInputCount, locale)} />
            <Metric label={label('حالة التقسيم', 'Subdivision status')} value={subdivision?.status || '—'} testId="riai-subdivision-gate-status" />
            <Metric label={label('تغطية فحوص التقسيم', 'Subdivision check coverage')} value={formatPercent(subdivision?.evidenceCoverage, locale, 0)} />
            <Metric label={label('مؤهل لاختبار السيناريو', 'Scenario testing eligible')} value={subdivision?.scenarioTestingEligible ? label('نعم', 'Yes') : label('لا', 'No')} />
          </div>
          {evidenceGovernance?.issues?.length ? (
            <div className="mt-3">
              <IssueRows issues={evidenceGovernance.issues} emptyLabel={label('لا توجد فجوات أدلة استراتيجية.', 'No strategic evidence gaps.')} />
            </div>
          ) : null}
        </Section>
      ) : null}

      {lifecycle ? (
        <Section
          id="riai-lifecycle-intelligence"
          title={label('دورة حياة الأصل', 'Asset Lifecycle')}
          status={lifecycle.status}
          notice={label('احتياطي دورة الحياة المعروض تقدير تخطيطي فقط وليس تقديراً هندسياً معتمداً.', 'Lifecycle reserve is a planning proxy, not a certified engineering estimate.')}
        >
          {lifecycle.metrics ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label={label('درجة الحالة', 'Condition score')} value={formatNumber(lifecycle.metrics.weightedConditionScore, locale, 1)} testId="riai-lifecycle-condition" />
              <Metric label={label('CAPEX خلال 3 سنوات', '3Y replacement CAPEX')} value={formatNumber(lifecycle.metrics.knownReplacementCapex3y, locale)} />
              <Metric label={label('CAPEX خلال 5 سنوات', '5Y replacement CAPEX')} value={formatNumber(lifecycle.metrics.knownReplacementCapex5y, locale)} />
              <Metric label={label('عناصر حرجة خلال 3 سنوات', 'Critical items due in 3Y')} value={formatNumber(lifecycle.metrics.criticalComponentsDueWithin3y, locale)} />
              <Metric label={label('احتياطي سنوي تخطيطي', 'Annual reserve proxy')} value={formatNumber(lifecycle.metrics.annualizedLifecycleReserveProxy, locale)} />
            </div>
          ) : (
            <IssueRows issues={lifecycle.issues} emptyLabel={label('لا توجد بيانات كافية للحساب.', 'Insufficient lifecycle evidence.')} />
          )}
        </Section>
      ) : null}

      {location ? (
        <Section
          id="riai-location-intelligence"
          title={label('جودة الموقع الحالية', 'Current Location Intelligence')}
          status={location.status}
          notice={label('لا يتم استنتاج جودة الحي من الاسم فقط؛ النتيجة مبنية على مدخلات موثقة ومعتمدة للتحليل.', 'The engine does not infer neighborhood quality from a place name alone; the score uses adopted evidence-linked inputs.')}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label={label('درجة الموقع', 'Location score')} value={formatNumber(location.currentLocationScore, locale, 1)} testId="riai-current-location-score" />
            <Metric label={label('تغطية الأدلة', 'Evidence coverage')} value={formatPercent(location.evidenceCoverage, locale, 0)} />
            <Metric label={label('الأبعاد المحتسبة', 'Scored dimensions')} value={formatNumber(location.dimensions?.length, locale)} />
            <Metric label={label('فجوات البيانات', 'Data gaps')} value={formatNumber(location.issues?.length, locale)} />
          </div>
        </Section>
      ) : null}

      {forward ? (
        <Section
          id="riai-forward-attraction"
          title={label('الجاذبية المستقبلية', 'Forward Attraction')}
          status={forward.status}
          notice={label('الإشارات المستقبلية سياقية فقط ولا تعدّل تلقائياً نمو الإيجار أو الشغور أو معدل التخارج أو القيمة النهائية.', 'Forward signals are contextual only and do not automatically change rent growth, vacancy, exit cap rate, or terminal value.')}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric label={label('درجة الجاذبية', 'Attraction score')} value={formatNumber(forward.forwardAttractionScore, locale, 1)} testId="riai-forward-attraction-score" />
            <Metric label={label('الاتجاه', 'Direction')} value={directionLabel(forward.attractionDirection)} />
            <Metric label={label('ضغط نمو الإيجار', 'Rent growth pressure')} value={directionLabel(forward.rentGrowthPressure?.direction)} />
            <Metric label={label('ضغط الشغور', 'Vacancy pressure')} value={directionLabel(forward.vacancyPressure?.direction)} />
            <Metric label={label('سيولة التخارج', 'Exit liquidity pressure')} value={directionLabel(forward.exitLiquidityPressure?.direction)} />
          </div>
        </Section>
      ) : null}

      {upside ? (
        <Section
          id="riai-upside-intelligence"
          title={label('التقسيم ومحفزات الزيادة', 'Subdivision & Upside Catalysts')}
          status={upside.status}
          notice={label('الحالة «محتمل التنفيذ» تظل بحاجة إلى تحقق تنظيمي، ولا تعد موافقة نظامية.', 'POTENTIALLY_FEASIBLE remains Regulatory Verification Required and is not legal approval.')}
        >
          {upside.metrics ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label={label('المحفزات', 'Catalysts')} value={formatNumber(upside.metrics.catalystCount, locale)} />
              <Metric label={label('متحقق نظامياً', 'Verified feasible')} value={formatNumber(upside.metrics.verifiedFeasibleCount, locale)} />
              <Metric label={label('تحتاج تحققاً تنظيمياً', 'Regulatory verification')} value={formatNumber(upside.metrics.regulatoryVerificationRequiredCount, locale)} testId="riai-regulatory-verification-count" />
              <Metric label={label('محظورة', 'Prohibited')} value={formatNumber(upside.metrics.prohibitedCount, locale)} />
              <Metric label={label('NOI الإضافي المعدل بالاحتمال', 'Probability-adjusted incremental NOI')} value={formatNumber(upside.metrics.probabilityAdjustedIncrementalAnnualNoi, locale)} />
            </div>
          ) : (
            <IssueRows issues={upside.issues} emptyLabel={label('لا توجد محفزات قابلة للحساب.', 'No calculable upside catalysts.')} />
          )}
        </Section>
      ) : null}

      {integration ? (
        <Section
          id="riai-scenario-attribution"
          title={label('مراجعة إسناد القيمة ومنع الازدواج', 'Scenario Attribution & Double-counting Review')}
          status={integration.status}
          notice={label('لا يتم إدخال أي أثر مالي تلقائي من الموقع أو المحفزات إلى NPV/IRR أو Terminal Value.', 'No contextual signal is automatically financialized into NPV/IRR or terminal value.')}
        >
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Metric label={label('السيناريوهات', 'Scenarios')} value={formatNumber(integration.scenarios?.length, locale)} />
            <Metric label={label('مراجعة مطلوبة', 'Review required')} value={integration.reviewRequired ? label('نعم', 'Yes') : label('لا', 'No')} testId="riai-scenario-review-required" />
            <Metric label={label('التعديل المالي التلقائي', 'Automatic financialization')} value={integration.automaticFinancializationApplied ? label('مفعّل', 'Enabled') : label('غير مفعّل', 'Disabled')} />
          </div>
          <IssueRows issues={integration.issues} emptyLabel={label('لا توجد إشارات ازدواج ظاهرة في النطاق المحسوب.', 'No detected attribution conflicts in the calculated scope.')} />
        </Section>
      ) : null}

      {score ? (
        <Section
          id="riai-acquisition-analytical-score"
          title={label('مؤشر جاذبية الاستحواذ التحليلي', 'Acquisition Analytical Score')}
          status={score.status}
          notice={label('المؤشر حتمي وقابل للتفسير (وليس توصية AI). القرار الاستثماري يبقى للجهة المخولة.', 'The score is deterministic and explainable, not an AI investment recommendation. Investment authority remains human.')}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label={label('الدرجة', 'Score')} value={formatNumber(score.score, locale, 1)} testId="riai-acquisition-score" />
            <Metric label={label('تغطية الدرجة', 'Score coverage')} value={formatPercent(score.scoreCoverage, locale, 0)} />
            <Metric label={label('ثقة الأدلة', 'Evidence confidence')} value={formatPercent(score.evidenceConfidence, locale, 0)} />
            <Metric label={label('إشارات الخطر', 'Red flags')} value={formatNumber(score.redFlags?.length, locale)} />
          </div>
          <ScoreBar score={score.score} />
          {Array.isArray(score.redFlags) && score.redFlags.length ? (
            <div className="mt-3">
              <IssueRows issues={score.redFlags} emptyLabel="" />
            </div>
          ) : null}
        </Section>
      ) : null}

      {committee ? (
        <Section
          id="riai-investment-committee-pack"
          title={label('ملف لجنة الاستثمار', 'Investment Committee Pack')}
          status={committee.approved ? label('معتمد', 'Approved') : label('تحليلي — غير معتمد', 'Analytical — Not approved')}
          notice={label('الملف يفصل الوقائع والافتراضات ومخرجات النموذج وما يتطلب حكماً بشرياً؛ ولا ينشئ توصية أو اعتماداً تلقائياً.', 'The pack separates facts, assumptions, model outputs, and human-judgment items; it does not create an automatic recommendation or approval.')}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label={label('الوقائع', 'Facts')} value={formatNumber(committee.sections?.facts?.length, locale)} />
            <Metric label={label('الافتراضات', 'Assumptions')} value={formatNumber(committee.sections?.assumptions?.length, locale)} />
            <Metric label={label('مخرجات النموذج', 'Model outputs')} value={formatNumber(committee.sections?.modelOutputs?.length, locale)} />
            <Metric label={label('يتطلب حكم اللجنة', 'Judgment required')} value={formatNumber(committee.sections?.judgmentRequired?.length, locale)} testId="riai-committee-judgment-count" />
          </div>
          <div className="mt-3 grid gap-2 text-[11px] text-slate-500 md:grid-cols-3">
            <div>{label('توصية آلية', 'Automatic recommendation')}: <strong className="text-slate-300">{committee.recommendation ? label('نعم', 'Yes') : label('لا', 'No')}</strong></div>
            <div>{label('رأي قانوني', 'Legal opinion')}: <strong className="text-slate-300">{committee.legalOpinion ? label('نعم', 'Yes') : label('لا', 'No')}</strong></div>
            <div>{label('تفويض صفقة', 'Transaction authorization')}: <strong className="text-slate-300">{committee.transactionAuthorized ? label('نعم', 'Yes') : label('لا', 'No')}</strong></div>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
