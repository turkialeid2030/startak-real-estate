import React, { useEffect, useMemo, useState } from "react";
const { useLocale } = require('../i18n/LocaleContext.js');
const {
  ZAKAT_INPUT_SOURCE,
  ZAKAT_LAYER_STATUS,
  buildUserEnteredZakatLayer,
} = require('../zakat/user-entered-zakat');

const C = {
  panel: '#141F35', panelRaised: '#1C2C4A', panelInput: '#18233C', hairline: '#2B3B5C',
  brass: '#C9A24C', parchment: '#EDE6D6', slate: '#8C97AC', slateDim: '#647089', caution: '#D08A3E',
};

function formatSar(value, t) {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}${Math.round(Math.abs(value)).toLocaleString('en-US')} ${t('units.sar')}`;
}

function formatPct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '—';
}

export function ZakatInputSection({ zakatCase, setZakatCase }) {
  const { t } = useLocale();
  const [raw, setRaw] = useState(zakatCase && Number.isFinite(zakatCase.annualAmount) ? String(zakatCase.annualAmount) : '');

  useEffect(() => {
    setRaw(zakatCase && Number.isFinite(zakatCase.annualAmount) ? String(zakatCase.annualAmount) : '');
  }, [zakatCase && zakatCase.annualAmount]);

  const amountProvided = Boolean(zakatCase && Number.isFinite(zakatCase.annualAmount));
  const sourceMissing = amountProvided && !zakatCase.source;

  const commitAmount = () => {
    const normalized = raw.trim();
    if (normalized === '') {
      setZakatCase(null);
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setRaw(amountProvided ? String(zakatCase.annualAmount) : '');
      return;
    }
    setZakatCase((prev) => ({ annualAmount: parsed, source: prev && prev.source ? prev.source : null }));
  };

  return (
    <div className="rounded-2xl mb-3 overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.hairline}` }}>
      <div className="px-4 py-3">
        <div className="text-[10px] tracking-widest" style={{ color: C.brass }}>{t('zakat.sectionEyebrow')}</div>
        <div className="text-sm font-semibold mb-3" style={{ color: C.parchment }}>{t('zakat.sectionTitle')}</div>
        <label className="block mb-3">
          <div className="text-xs mb-1" style={{ color: C.slate }}>{t('zakat.annualAmountLabel')}</div>
          <input type="text" inputMode="decimal" value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d.]/g, ''))}
            onBlur={commitAmount}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            className="w-full px-3 py-2 text-sm rounded-lg"
            style={{ background: C.panelInput, border: `1px solid ${C.hairline}`, color: C.parchment }}
            placeholder={t('zakat.amountPlaceholder')} />
          <div className="text-[10px] mt-1 leading-relaxed" style={{ color: C.slateDim }}>{t('zakat.amountNote')}</div>
        </label>
        <label className="block mb-2">
          <div className="text-xs mb-1" style={{ color: C.slate }}>{t('zakat.sourceLabel')}</div>
          <select value={zakatCase && zakatCase.source ? zakatCase.source : ''} disabled={!amountProvided}
            onChange={(e) => setZakatCase((prev) => ({ annualAmount: prev.annualAmount, source: e.target.value || null }))}
            className="w-full px-3 py-2 text-sm rounded-lg"
            style={{ background: C.panelInput, border: `1px solid ${sourceMissing ? C.caution : C.hairline}`, color: C.parchment, opacity: amountProvided ? 1 : 0.6 }}>
            <option value="">{t('zakat.sourcePlaceholder')}</option>
            <option value={ZAKAT_INPUT_SOURCE.ACCOUNTANT}>{t('zakat.sourceAccountant')}</option>
            <option value={ZAKAT_INPUT_SOURCE.ZAKAT_ADVISER}>{t('zakat.sourceZakatAdviser')}</option>
            <option value={ZAKAT_INPUT_SOURCE.INTERNAL_ESTIMATE}>{t('zakat.sourceInternalEstimate')}</option>
          </select>
          {sourceMissing ? <div className="text-[10px] mt-1" style={{ color: C.caution }}>{t('zakat.sourceRequired')}</div> : null}
        </label>
        <div className="text-[10px] leading-relaxed" style={{ color: C.slateDim }}>{t('zakat.platformBoundary')}</div>
      </div>
    </div>
  );
}

export function ZakatCashFlowPanel({ mode, results, zakatCase, leverageView, discountRate }) {
  const { t } = useLocale();
  const before = leverageView ? results.leveredCashflows : results.cashflows;
  const returnsReady = Array.isArray(before) && (mode !== 'building' || results.exitDependentAnalyticsReady !== false);
  const state = useMemo(() => {
    if (!Array.isArray(before)) return { layer: null, error: null };
    try {
      return { layer: buildUserEnteredZakatLayer({
        mode,
        cashflowsBeforeZakat: before,
        zakatCase,
        constructionYears: mode === 'land' ? results.constructionYears : 0,
        operatingYears: mode === 'land' ? results.operatingYears : Math.max(0, before.length - 1),
        discountRate,
        returnsReady,
      }), error: null };
    } catch (error) {
      return { layer: null, error };
    }
  }, [mode, before, zakatCase, results.constructionYears, results.operatingYears, discountRate, returnsReady]);

  if (!Array.isArray(before)) return null;
  const sourceLabel = (source) => ({
    [ZAKAT_INPUT_SOURCE.ACCOUNTANT]: t('zakat.sourceAccountant'),
    [ZAKAT_INPUT_SOURCE.ZAKAT_ADVISER]: t('zakat.sourceZakatAdviser'),
    [ZAKAT_INPUT_SOURCE.INTERNAL_ESTIMATE]: t('zakat.sourceInternalEstimate'),
  })[source] || '—';

  return (
    <div className="rounded-2xl mb-4 p-4" style={{ background: C.panel, border: `1px solid ${C.hairline}` }}>
      <div className="text-[10px] tracking-widest" style={{ color: C.brass }}>{t('zakat.cashFlowBeforeLabel')}</div>
      <div className="text-xs mt-1 mb-3 leading-relaxed" style={{ color: C.slate }}>{t('zakat.beforeClarification')}</div>
      {state.error ? (
        <div className="rounded-xl px-3 py-2 text-xs" style={{ background: C.panelRaised, border: `1px solid ${C.caution}`, color: C.caution }}>{t('zakat.invalidInput')}</div>
      ) : state.layer.status === ZAKAT_LAYER_STATUS.NOT_PROVIDED ? (
        <div className="rounded-xl px-3 py-3 text-xs leading-relaxed" style={{ background: C.panelRaised, border: `1px solid ${C.hairline}`, color: C.slate }}>
          <div className="font-semibold mb-1" style={{ color: C.parchment }}>{t('zakat.notCalculatedTitle')}</div>
          {t('zakat.notCalculated')}
        </div>
      ) : (
        <>
          <div className="rounded-xl px-3 py-3 mb-3" style={{ background: C.panelRaised, border: `1px solid ${C.brass}` }}>
            <div className="text-xs font-semibold" style={{ color: C.brass }}>{t('zakat.userEnteredBadge')}</div>
            <div className="text-[11px] mt-1" style={{ color: C.slate }}>{t('zakat.annualAmount')}: {formatSar(state.layer.annualZakatAmount, t)}</div>
            <div className="text-[11px]" style={{ color: C.slate }}>{t('zakat.source')}: {sourceLabel(state.layer.annualZakatSource)}</div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="rounded-xl px-3 py-2 flex-1 min-w-[150px]" style={{ background: C.panelRaised, border: `1px solid ${C.hairline}` }}>
              <div className="text-[10px]" style={{ color: C.slate }}>{t('zakat.afterIrr')}</div>
              <div className="text-sm font-bold" style={{ color: C.parchment }}>{formatPct(state.layer.afterZakatIRR)}</div>
              <div className="text-[9px] mt-1" style={{ color: C.slateDim }}>{t('zakat.userEnteredBadge')}</div>
            </div>
            <div className="rounded-xl px-3 py-2 flex-1 min-w-[150px]" style={{ background: C.panelRaised, border: `1px solid ${C.hairline}` }}>
              <div className="text-[10px]" style={{ color: C.slate }}>{t('zakat.afterNpv')}</div>
              <div className="text-sm font-bold" style={{ color: C.parchment }}>{formatSar(state.layer.afterZakatNPV, t)}</div>
              <div className="text-[9px] mt-1" style={{ color: C.slateDim }}>{t('zakat.userEnteredBadge')}</div>
            </div>
          </div>
          <div className="text-xs font-semibold mb-2" style={{ color: C.parchment }}>{t('zakat.afterTitle')}</div>
          <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.hairline}` }}>
            <table className="w-full text-xs"><thead><tr style={{ background: C.panelRaised }}>
              <th className="px-3 py-2 text-right font-normal" style={{ color: C.slate }}>{t('zakat.tableYear')}</th>
              <th className="px-3 py-2 text-right font-normal" style={{ color: C.slate }}>{t('zakat.tableBefore')}</th>
              <th className="px-3 py-2 text-right font-normal" style={{ color: C.slate }}>{t('zakat.tableAfter')}</th>
            </tr></thead><tbody>{state.layer.cashflowsAfterZakat.map((value, index) => (
              <tr key={index} style={{ borderTop: `1px solid ${C.hairline}` }}>
                <td className="px-3 py-2" style={{ color: C.slate }}>{index}</td>
                <td className="px-3 py-2" style={{ color: C.parchment }}>{formatSar(state.layer.cashflowsBeforeZakat[index], t)}</td>
                <td className="px-3 py-2" style={{ color: C.parchment }}>{formatSar(value, t)}</td>
              </tr>
            ))}</tbody></table>
          </div>
          <div className="text-[10px] mt-2 leading-relaxed" style={{ color: C.slateDim }}>{t('zakat.userEnteredBadge')}</div>
        </>
      )}
    </div>
  );
}
