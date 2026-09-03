import React from 'react';
import ResidentialIncomeDecisionExtension from './ResidentialIncomeDecisionExtension';
import ResidentialIncomeAiAssistPanel from './ResidentialIncomeAiAssistPanel';

const STATUS_TONE = Object.freeze({
  READY_FOR_OPERATING_UNDERWRITING: 'border-emerald-700/50 bg-emerald-950/20 text-emerald-200',
  READY_WITH_ASSUMPTIONS: 'border-amber-700/50 bg-amber-950/20 text-amber-200',
  NEEDS_DUE_DILIGENCE: 'border-amber-700/50 bg-amber-950/20 text-amber-200',
  INSUFFICIENT_EVIDENCE: 'border-amber-700/50 bg-amber-950/20 text-amber-200',
  DECISION_BLOCKED: 'border-rose-700/50 bg-rose-950/20 text-rose-200',
});

function statusTone(status) {
  return STATUS_TONE[status] || 'border-slate-700 bg-slate-900/60 text-slate-300';
}

function CountCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="rf-num mt-1 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function number(value, locale, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function percent(value, locale) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${number(value * 100, locale, 1)}%`;
}

function IssueList({ title, items, emptyLabel }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">{title}</h3>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${item.code}-${item.field || 'none'}-${item.refId || 'none'}-${index}`} className="rounded-lg border border-slate-800 p-3 text-xs text-slate-300">
              <div className="font-semibold text-slate-100">{item.code}</div>
              {item.field ? <div className="mt-1 text-slate-500">{item.field}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">{emptyLabel}</div>
      )}
    </section>
  );
}

export default function ResidentialIncomeAcquisitionPanel({
  viewModel,
  t,
  dir = 'rtl',
  onImportOperatingCase,
  onExportOperatingCase,
  onClearOperatingCase,
  operatingCaseMessage = null,
}) {
  const fileInputRef = React.useRef(null);
  if (!viewModel || typeof viewModel !== 'object') return null;
  const loaded = viewModel.apiStatus === 'CASE_LOADED';
  const summary = viewModel.summary;
  const metrics = viewModel.operatingMetrics;
  const costs = viewModel.propertyCosts;
  const income = viewModel.incomeAnalysis;
  const acquisition = viewModel.acquisitionBasis;
  const reverse = viewModel.reverseUnderwriting;
  const exit = viewModel.exitStrategyComparison;
  const locale = dir === 'rtl' ? 'ar-SA' : 'en-US';

  return (
    <aside data-testid="residential-income-acquisition-panel" dir={dir} className="mt-6">
      <div className="rounded-2xl border border-slate-800 bg-[#111C30] p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Residential Income Acquisition Intelligence</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{t('riai.title')}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-6 text-slate-400">{t('riai.description')}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 text-xs ${statusTone(viewModel.readinessStatus)}`}>
            {viewModel.readinessStatus || t('riai.notLoadedStatus')}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="riai-operating-case-file-input"
            onChange={async (event) => {
              const file = event.target.files?.[0] || null;
              event.target.value = '';
              if (file) await onImportOperatingCase?.(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:border-slate-500"
          >
            {t('riai.importOperatingCase')}
          </button>
          {loaded ? (
            <>
              <button
                type="button"
                onClick={() => onExportOperatingCase?.()}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
              >
                {t('riai.exportOperatingCase')}
              </button>
              <button
                type="button"
                onClick={() => onClearOperatingCase?.()}
                className="rounded-lg border border-rose-900/70 px-3 py-2 text-xs text-rose-300 hover:border-rose-700"
              >
                {t('riai.clearOperatingCase')}
              </button>
            </>
          ) : null}
        </div>

        {operatingCaseMessage ? (
          <div
            role="status"
            className={`mt-3 rounded-lg border p-3 text-xs ${operatingCaseMessage.ok ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200' : 'border-rose-900/60 bg-rose-950/20 text-rose-200'}`}
          >
            {operatingCaseMessage.ok
              ? t(`riai.${operatingCaseMessage.code === 'EXPORTED' ? 'exportSuccess' : operatingCaseMessage.code === 'CLEARED' ? 'clearSuccess' : 'importSuccess'}`)
              : `${t('riai.importFailed')} (${operatingCaseMessage.code})`}
          </div>
        ) : null}

        {!loaded ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-xs leading-6 text-slate-400" role="status">
            {t('riai.emptyState')}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <CountCard label={t('riai.units')} value={summary.unitCount} />
              <CountCard label={t('riai.leases')} value={summary.leaseCount} />
              <CountCard label={t('riai.tenants')} value={summary.tenantCount} />
              <CountCard label={t('riai.evidence')} value={summary.evidenceLineageCount} />
            </div>
            {metrics?.status === 'CALCULATED' ? (
              <section aria-labelledby="riai-operating-metrics" className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="riai-operating-metrics" className="text-sm font-semibold text-slate-100">{t('riai.operatingMetrics')}</h3>
                  <span className="text-[11px] text-slate-500">{t('riai.asOfDate')}: {viewModel.asOfDate}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <CountCard label={t('riai.annualContractRent')} value={number(metrics.rentRoll.totals.totalAnnualContractRent, locale)} />
                  <CountCard label={t('riai.physicalOccupancyUnits')} value={percent(metrics.occupancy.physicalOccupancyByUnits, locale)} />
                  <CountCard label={t('riai.physicalOccupancyArea')} value={percent(metrics.occupancy.physicalOccupancyByArea, locale)} />
                  <CountCard label={t('riai.wale')} value={number(metrics.leaseTiming.waleYears, locale, 2)} />
                </div>
                <div className="mt-3 text-[11px] leading-5 text-slate-500">
                  {t('riai.economicOccupancyUnavailable')} · {t('riai.leaseCliffs')}: {metrics.leaseTiming.leaseCliffs.length}
                </div>
              </section>
            ) : metrics ? (
              <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 text-xs text-amber-200/80">
                {t('riai.metricsNotCalculable')} ({metrics.issues.length})
              </div>
            ) : null}
            {costs ? (
              <section aria-labelledby="riai-property-costs" className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="riai-property-costs" className="text-sm font-semibold text-slate-100">{t('riai.propertyCosts')}</h3>
                  <span className="text-[11px] text-slate-500">{costs.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <CountCard label={t('riai.normalizedOpex')} value={number(costs.operatingExpenses.totalsByBasis.normalizedAnnualOpex, locale)} />
                  <CountCard label={t('riai.opexToRent')} value={percent(costs.operatingExpenses.normalizedMetrics.opexToContractRent, locale)} />
                  <CountCard label={t('riai.knownImmediateCapex')} value={number(costs.capex.knownImmediateCapex, locale)} />
                  <CountCard label={t('riai.unknownCapexItems')} value={costs.capex.unknownCostCount} />
                </div>
                {costs.capex.criticalUnknownCostCount > 0 || costs.capex.lifeSafetyUnknownCostCount > 0 ? (
                  <div className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-200">
                    {t('riai.criticalUnknownCapex')}: {costs.capex.criticalOrLifeSafetyUnknownCostCount}
                  </div>
                ) : null}
              </section>
            ) : null}
            {income?.stabilizedNoiCalculated ? (
              <section aria-labelledby="riai-income-analysis" className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="riai-income-analysis" className="text-sm font-semibold text-slate-100">{t('riai.incomeAnalysis')}</h3>
                  <span className="text-[11px] text-slate-500">{income.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <CountCard label={t('riai.annualMarketRent')} value={number(income.markToMarket.totals.totalAnnualMarketRent, locale)} />
                  <CountCard label={t('riai.headlineMarkToMarket')} value={number(income.markToMarket.totals.headlineAnnualRentDelta, locale)} />
                  <CountCard label={t('riai.stabilizedNoi')} value={number(income.stabilizedIncome.stabilizedNoi, locale)} />
                  <CountCard label={t('riai.stabilizedNoiMargin')} value={percent(income.stabilizedIncome.stabilizedNoiMargin, locale)} />
                </div>
                <div className="mt-3 text-[11px] leading-5 text-slate-500">
                  {t('riai.realizableMarkToMarketUnavailable')}
                </div>
              </section>
            ) : income ? (
              <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 text-xs text-amber-200/80">
                {t('riai.incomeAnalysisNotCalculable')} ({income.issues.length})
              </div>
            ) : null}
            {acquisition?.acquisitionBasisCalculated ? (
              <section aria-labelledby="riai-acquisition-basis" className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="riai-acquisition-basis" className="text-sm font-semibold text-slate-100">{t('riai.acquisitionBasis')}</h3>
                  <span className="text-[11px] text-slate-500">{acquisition.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <CountCard label={t('riai.priceOnlyBasis')} value={number(acquisition.bases.priceOnlyBasis, locale)} />
                  <CountCard label={t('riai.allInBasis')} value={number(acquisition.bases.allInBasis, locale)} />
                  <CountCard label={t('riai.equityBasis')} value={number(acquisition.bases.equityBasis, locale)} />
                  <CountCard label={t('riai.nonPricePremium')} value={percent(acquisition.bases.nonPricePremiumRatio, locale)} />
                </div>
              </section>
            ) : acquisition ? (
              <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 text-xs text-amber-200/80">
                {t('riai.acquisitionBasisNotCalculable')} ({acquisition.issues.length})
              </div>
            ) : null}
            {reverse?.reverseUnderwritingCalculated ? (
              <section aria-labelledby="riai-reverse-underwriting" className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="riai-reverse-underwriting" className="text-sm font-semibold text-slate-100">{t('riai.reverseUnderwriting')}</h3>
                  <span className="text-[11px] text-slate-500">{reverse.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <CountCard label={t('riai.maximumJustifiedPrice')} value={number(reverse.maximumJustifiedPurchasePrice, locale)} />
                  <CountCard label={t('riai.currentPurchasePrice')} value={number(reverse.currentPriceAnalysis.purchasePrice, locale)} />
                  <CountCard label={t('riai.priceHeadroom')} value={number(reverse.currentPriceAnalysis.priceHeadroom, locale)} />
                  <CountCard label={t('riai.bindingConstraint')} value={reverse.bindingConstraint.code} />
                </div>
                <div className="mt-3 text-[11px] leading-5 text-slate-500">
                  {t('riai.reverseUnderwritingOutcome')}: {reverse.outcome} · {t('riai.nonBindingPriceBoundary')}
                </div>
              </section>
            ) : reverse ? (
              <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 text-xs text-amber-200/80">
                {t('riai.reverseUnderwritingNotCalculable')} ({reverse.issues.length})
              </div>
            ) : null}
            {exit?.exitStrategyComparisonCalculated ? (
              <section aria-labelledby="riai-exit-strategy" className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="riai-exit-strategy" className="text-sm font-semibold text-slate-100">{t('riai.exitStrategyComparison')}</h3>
                  <span className="text-[11px] text-slate-500">{exit.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <CountCard label={t('riai.exitScenarioCount')} value={exit.scenarioResults.length} />
                  <CountCard label={t('riai.exitBenchmark')} value={exit.benchmarkScenarioId} />
                  <CountCard label={t('riai.highestModeledNpvScenario')} value={exit.highestModeledNpvScenario.scenarioId} />
                  <CountCard label={t('riai.highestModeledNpv')} value={number(exit.highestModeledNpvScenario.npv, locale)} />
                </div>
                <div className="mt-3 text-[11px] leading-5 text-slate-500">
                  {t('riai.valueCreationVsBenchmark')}: {number(exit.highestModeledNpvScenario.valueCreationVsBenchmarkNpv, locale)} · {t('riai.exitRankingBoundary')}
                </div>
              </section>
            ) : exit ? (
              <div className="rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 text-xs text-amber-200/80">
                {t('riai.exitStrategyNotCalculable')} ({exit.issues.length})
              </div>
            ) : null}
            <ResidentialIncomeDecisionExtension viewModel={viewModel} dir={dir} />
            <ResidentialIncomeAiAssistPanel viewModel={viewModel} dir={dir} />
            <div className="grid gap-4 lg:grid-cols-3">
              <IssueList title={t('riai.blockers')} items={viewModel.blockers || []} emptyLabel={t('riai.noBlockers')} />
              <IssueList title={t('riai.evidenceGaps')} items={viewModel.evidenceGaps || []} emptyLabel={t('riai.noEvidenceGaps')} />
              <IssueList title={t('riai.dueDiligence')} items={viewModel.dueDiligence || []} emptyLabel={t('riai.noDueDiligence')} />
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-amber-900/50 bg-amber-950/10 p-3 text-xs leading-6 text-amber-200/80">
          <strong>{t('riai.boundaryTitle')}</strong> {t('riai.boundary')}
        </div>
      </div>
    </aside>
  );
}