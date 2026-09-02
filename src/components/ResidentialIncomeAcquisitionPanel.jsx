import React from 'react';

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

export default function ResidentialIncomeAcquisitionPanel({ viewModel, t, dir = 'rtl' }) {
  if (!viewModel || typeof viewModel !== 'object') return null;
  const loaded = viewModel.apiStatus === 'CASE_LOADED';
  const summary = viewModel.summary;
  const metrics = viewModel.operatingMetrics;
  const costs = viewModel.propertyCosts;
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
