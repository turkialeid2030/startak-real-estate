import React from 'react';
import {
  updateVerifiedLeaseTerms,
  addVerifiedRentCollection,
} from '../residential-income-acquisition/operating-case-editor';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[#C9A24C]';

function Field({ label, children }) {
  return (
    <label className="block text-[11px] text-slate-400">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function amount(value, locale) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString(locale, { maximumFractionDigits: 0 })
    : '—';
}

function ratio(value, locale) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${(value * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`
    : '—';
}

export default function RentRollCollectionsWorkspace({ operatingCase, metrics, t, dir, onReplaceOperatingCase }) {
  const locale = dir === 'rtl' ? 'ar-SA' : 'en-US';
  const [leaseDraft, setLeaseDraft] = React.useState({ leaseId: '', baseRent: '', endDate: '', sourceRef: '', adoptionDecisionRef: '', confirmed: false });
  const [collectionDraft, setCollectionDraft] = React.useState({
    collectionId: '', unitId: '', leaseId: '', periodStart: '', periodEnd: '', contractualRentDue: '', collectedRent: '', potentialGrossRent: '', concessions: '0', sourceRef: '', adoptionDecisionRef: '', confirmed: false,
  });
  const [feedback, setFeedback] = React.useState(null);
  if (!operatingCase || !metrics) return null;

  const activeLeases = operatingCase.leases.filter((lease) => lease.lifecycleStatus === 'ACTIVE');
  const selectCollectionUnit = (unitId) => {
    const activeLease = activeLeases.find((lease) => lease.unitId === unitId);
    setCollectionDraft({ ...collectionDraft, unitId, leaseId: activeLease ? activeLease.leaseId : '' });
  };
  const selectLease = (leaseId) => {
    const lease = operatingCase.leases.find((item) => item.leaseId === leaseId);
    setLeaseDraft((current) => ({
      ...current,
      leaseId,
      baseRent: lease ? String(lease.baseRent.value ?? '') : '',
      endDate: lease ? String(lease.endDate || '').slice(0, 10) : '',
      confirmed: false,
    }));
  };
  const replaceCase = async (candidate, successCode) => {
    const result = await onReplaceOperatingCase?.(candidate, successCode);
    if (result && result.ok === false) throw new Error(result.code || 'OPERATING_CASE_UPDATE_REJECTED');
    setFeedback({ ok: true, code: successCode });
  };
  const submitLease = async (event) => {
    event.preventDefault();
    try {
      const candidate = updateVerifiedLeaseTerms(operatingCase, leaseDraft);
      await replaceCase(candidate, 'LEASE_UPDATED');
      setLeaseDraft((current) => ({ ...current, sourceRef: '', adoptionDecisionRef: '', confirmed: false }));
    } catch (error) {
      setFeedback({ ok: false, code: String(error.message || error).slice(0, 160) });
    }
  };
  const submitCollection = async (event) => {
    event.preventDefault();
    try {
      const candidate = addVerifiedRentCollection(operatingCase, collectionDraft);
      await replaceCase(candidate, 'COLLECTION_ADDED');
      setCollectionDraft((current) => ({ ...current, collectionId: '', contractualRentDue: '', collectedRent: '', potentialGrossRent: '', concessions: '0', sourceRef: '', adoptionDecisionRef: '', confirmed: false }));
    } catch (error) {
      setFeedback({ ok: false, code: String(error.message || error).slice(0, 160) });
    }
  };

  const collections = metrics.collectionsReconciliation;
  return (
    <section data-testid="riai-rent-roll-collections-workspace" aria-labelledby="riai-rent-roll-title" className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="riai-rent-roll-title" className="text-sm font-semibold text-slate-100">{t('riai.rentRollWorkspace')}</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">{t('riai.rentRollWorkspaceDescription')}</p>
        </div>
        <span className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-400">{collections.status}</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-[900px] w-full text-xs">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 text-start">{t('riai.unitId')}</th>
              <th className="px-3 py-2 text-start">{t('riai.unitStatus')}</th>
              <th className="px-3 py-2 text-start">{t('riai.areaSqm')}</th>
              <th className="px-3 py-2 text-start">{t('riai.leaseId')}</th>
              <th className="px-3 py-2 text-start">{t('riai.tenantId')}</th>
              <th className="px-3 py-2 text-start">{t('riai.leaseEnd')}</th>
              <th className="px-3 py-2 text-start">{t('riai.annualContractRent')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {metrics.rentRoll.rows.map((row) => (
              <tr key={row.unitId}>
                <td className="px-3 py-2 font-medium text-slate-100">{row.unitId}</td>
                <td className="px-3 py-2">{row.operatingStatus}</td>
                <td className="px-3 py-2 rf-num">{amount(row.rentableAreaSqm, locale)}</td>
                <td className="px-3 py-2">{row.leaseId || '—'}</td>
                <td className="px-3 py-2">{row.tenantId || '—'}</td>
                <td className="px-3 py-2">{row.leaseEndDate || '—'}</td>
                <td className="px-3 py-2 rf-num">{amount(row.currentAnnualContractRent, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{t('riai.collectionRecords')}</div><div className="rf-num mt-1 text-base text-slate-100">{collections.recordCount}</div></div>
        <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{t('riai.rentCollected')}</div><div className="rf-num mt-1 text-base text-slate-100">{amount(collections.totals.rentCollected, locale)}</div></div>
        <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{t('riai.collectionRate')}</div><div className="rf-num mt-1 text-base text-slate-100">{ratio(collections.collectionRate, locale)}</div></div>
        <div className="rounded-lg border border-slate-800 p-3"><div className="text-[10px] text-slate-500">{t('riai.economicOccupancy')}</div><div className="rf-num mt-1 text-base text-slate-100">{ratio(collections.economicOccupancy, locale)}</div></div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <form onSubmit={submitLease} className="rounded-lg border border-slate-800 p-3" data-testid="riai-lease-editor">
          <h4 className="text-xs font-semibold text-slate-200">{t('riai.leaseEditor')}</h4>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">{t('riai.leaseEditorBoundary')}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label={t('riai.leaseId')}>
              <select className={INPUT_CLASS} value={leaseDraft.leaseId} onChange={(event) => selectLease(event.target.value)} required>
                <option value="">—</option>
                {activeLeases.map((lease) => <option key={lease.leaseId} value={lease.leaseId}>{lease.leaseId} · {lease.unitId}</option>)}
              </select>
            </Field>
            <Field label={t('riai.periodicBaseRent')}><input className={INPUT_CLASS} type="number" min="0" step="0.01" value={leaseDraft.baseRent} onChange={(event) => setLeaseDraft({ ...leaseDraft, baseRent: event.target.value })} required /></Field>
            <Field label={t('riai.leaseEnd')}><input className={INPUT_CLASS} type="date" value={leaseDraft.endDate} onChange={(event) => setLeaseDraft({ ...leaseDraft, endDate: event.target.value })} required /></Field>
            <Field label={t('riai.sourceRef')}><input className={INPUT_CLASS} type="text" value={leaseDraft.sourceRef} onChange={(event) => setLeaseDraft({ ...leaseDraft, sourceRef: event.target.value })} required /></Field>
            <Field label={t('riai.adoptionRef')}><input className={INPUT_CLASS} type="text" value={leaseDraft.adoptionDecisionRef} onChange={(event) => setLeaseDraft({ ...leaseDraft, adoptionDecisionRef: event.target.value })} required /></Field>
          </div>
          <label className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-slate-400"><input type="checkbox" checked={leaseDraft.confirmed} onChange={(event) => setLeaseDraft({ ...leaseDraft, confirmed: event.target.checked })} />{t('riai.verificationConfirmation')}</label>
          <button type="submit" className="mt-3 rounded-lg border border-[#8A7440] bg-[#C9A24C]/10 px-3 py-2 text-xs text-[#E7D3A0]">{t('riai.applyLeaseUpdate')}</button>
        </form>

        <form onSubmit={submitCollection} className="rounded-lg border border-slate-800 p-3" data-testid="riai-collection-editor">
          <h4 className="text-xs font-semibold text-slate-200">{t('riai.collectionEditor')}</h4>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">{t('riai.collectionEditorBoundary')}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label={t('riai.collectionId')}><input className={INPUT_CLASS} type="text" value={collectionDraft.collectionId} onChange={(event) => setCollectionDraft({ ...collectionDraft, collectionId: event.target.value })} required /></Field>
            <Field label={t('riai.unitAndLease')}>
              <select className={INPUT_CLASS} value={collectionDraft.unitId} onChange={(event) => selectCollectionUnit(event.target.value)} required>
                <option value="">—</option>
                {operatingCase.units.map((unit) => {
                  const lease = activeLeases.find((item) => item.unitId === unit.unitId);
                  return <option key={unit.unitId} value={unit.unitId}>{unit.unitId} · {lease ? lease.leaseId : t('riai.noActiveLease')}</option>;
                })}
              </select>
            </Field>
            <Field label={t('riai.periodStart')}><input className={INPUT_CLASS} type="date" value={collectionDraft.periodStart} onChange={(event) => setCollectionDraft({ ...collectionDraft, periodStart: event.target.value })} required /></Field>
            <Field label={t('riai.periodEnd')}><input className={INPUT_CLASS} type="date" value={collectionDraft.periodEnd} onChange={(event) => setCollectionDraft({ ...collectionDraft, periodEnd: event.target.value })} required /></Field>
            <Field label={t('riai.contractualRentDue')}><input className={INPUT_CLASS} type="number" min="0" step="0.01" value={collectionDraft.contractualRentDue} onChange={(event) => setCollectionDraft({ ...collectionDraft, contractualRentDue: event.target.value })} required /></Field>
            <Field label={t('riai.rentCollected')}><input className={INPUT_CLASS} type="number" min="0" step="0.01" value={collectionDraft.collectedRent} onChange={(event) => setCollectionDraft({ ...collectionDraft, collectedRent: event.target.value })} required /></Field>
            <Field label={t('riai.potentialGrossRent')}><input className={INPUT_CLASS} type="number" min="0" step="0.01" value={collectionDraft.potentialGrossRent} onChange={(event) => setCollectionDraft({ ...collectionDraft, potentialGrossRent: event.target.value })} required /></Field>
            <Field label={t('riai.concessions')}><input className={INPUT_CLASS} type="number" min="0" step="0.01" value={collectionDraft.concessions} onChange={(event) => setCollectionDraft({ ...collectionDraft, concessions: event.target.value })} required /></Field>
            <Field label={t('riai.sourceRef')}><input className={INPUT_CLASS} type="text" value={collectionDraft.sourceRef} onChange={(event) => setCollectionDraft({ ...collectionDraft, sourceRef: event.target.value })} required /></Field>
            <Field label={t('riai.adoptionRef')}><input className={INPUT_CLASS} type="text" value={collectionDraft.adoptionDecisionRef} onChange={(event) => setCollectionDraft({ ...collectionDraft, adoptionDecisionRef: event.target.value })} required /></Field>
          </div>
          <label className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-slate-400"><input type="checkbox" checked={collectionDraft.confirmed} onChange={(event) => setCollectionDraft({ ...collectionDraft, confirmed: event.target.checked })} />{t('riai.verificationConfirmation')}</label>
          <button type="submit" className="mt-3 rounded-lg border border-[#8A7440] bg-[#C9A24C]/10 px-3 py-2 text-xs text-[#E7D3A0]">{t('riai.addCollectionRecord')}</button>
        </form>
      </div>

      {feedback ? (
        <div role="status" className={`mt-3 rounded-lg border p-2 text-[10px] ${feedback.ok ? 'border-emerald-900/60 text-emerald-300' : 'border-rose-900/60 text-rose-300'}`}>
          {feedback.ok ? t(`riai.${feedback.code === 'LEASE_UPDATED' ? 'leaseUpdateSuccess' : 'collectionAddSuccess'}`) : `${t('riai.workspaceUpdateFailed')} (${feedback.code})`}
        </div>
      ) : null}
      <p className="mt-3 text-[10px] leading-5 text-slate-500">{t('riai.collectionsNoNoiWrite')}</p>
    </section>
  );
}
