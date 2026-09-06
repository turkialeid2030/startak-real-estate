from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise AssertionError(f'missing anchor: {label}')
    return text.replace(old, new, 1)

app_path = Path('src/app/App.jsx')
app = app_path.read_text()

app = replace_once(
    app,
    'import ValuationIntelligencePanel from "../components/ValuationIntelligencePanel.jsx";\n',
    'import ValuationIntelligencePanel from "../components/ValuationIntelligencePanel.jsx";\nimport { ZakatInputSection, ZakatCashFlowPanel } from "../components/ZakatLayerPanel.jsx";\n',
    'zakat component import',
)
app = replace_once(
    app,
    "const { isFiniteNumber } = require('../assumptions/ui-safe-formatters');\n",
    "const { isFiniteNumber } = require('../assumptions/ui-safe-formatters');\nconst { validateUserEnteredZakatCase } = require('../zakat/user-entered-zakat');\n",
    'zakat validator import',
)
app = replace_once(
    app,
    'function CashFlowTab({ mode, inputs, results }) {',
    'function CashFlowTab({ mode, inputs, results, zakatCase }) {',
    'cashflow signature',
)
app = replace_once(
    app,
    '''      <MetricGroup eyebrow={t("cashFlow.tableEyebrow")} title={t("cashFlow.tableTitle")}>
        <CashFlowTable cashflows={activeCashflows} />
      </MetricGroup>
''',
    '''      <MetricGroup eyebrow={t("cashFlow.tableEyebrow")} title={t("cashFlow.tableTitle")}>
        <CashFlowTable cashflows={activeCashflows} />
      </MetricGroup>
      <ZakatCashFlowPanel
        mode={mode}
        results={results}
        zakatCase={zakatCase}
        leverageView={showLevered && view === "levered"}
        discountRate={showLevered && view === "levered" ? results.equityDiscountRate : (mode === "building" ? inputs.discountRate : inputs.hurdleRate)}
      />
''',
    'cashflow panel',
)
app = replace_once(
    app,
    '  const [valuationCase, setValuationCase] = useState(null);\n',
    '  const [valuationCase, setValuationCase] = useState(null);\n  const [zakatCase, setZakatCase] = useState(null);\n',
    'zakat state',
)
app = replace_once(
    app,
    '''    setValuationCase(null);
    setActiveDealId(null);
''',
    '''    setValuationCase(null);
    setZakatCase(null);
    setActiveDealId(null);
''',
    'load built-in clears zakat',
)
app = replace_once(
    app,
    '''      setValuationCase(valuationCaseFromSavedDeal(record));
      setOperatingCaseMessage(null);
''',
    '''      setValuationCase(valuationCaseFromSavedDeal(record));
      setZakatCase(record.zakatCase ? validateUserEnteredZakatCase(record.zakatCase) : null);
      setOperatingCaseMessage(null);
''',
    'load saved zakat',
)
app = replace_once(
    app,
    '''    if (record.mode === "building" && residentialIncomeOperatingCase) {
      extended = { ...extended, operatingCase: residentialIncomeOperatingCase };
    }
    return withValuationCase(extended, valuationCase);
''',
    '''    if (record.mode === "building" && residentialIncomeOperatingCase) {
      extended = { ...extended, operatingCase: residentialIncomeOperatingCase };
    }
    if (zakatCase) {
      extended = { ...extended, zakatCase: validateUserEnteredZakatCase(zakatCase) };
    }
    return withValuationCase(extended, valuationCase);
''',
    'persist zakat envelope extension',
)

save_validation = '''    try { validateEngineInputs({ ...inputs, leverageEnabled: inputs.leverageEnabled }); }
    catch (e) { if (e.name === 'ValidationError') return; throw e; }
'''
save_validation_with_zakat = save_validation + '''    try { validateUserEnteredZakatCase(zakatCase); }
    catch (e) {
      setDealsError({ code: e.code || "ZAKAT_CASE_INVALID", message_ar: "أكمل مبلغ الزكاة ومصدره قبل الحفظ، أو امسح مبلغ الزكاة.", message_en: "Complete the Zakat amount and its source before saving, or clear the Zakat amount." });
      return;
    }
'''
if app.count(save_validation) != 2:
    raise AssertionError(f'expected two save validation anchors, found {app.count(save_validation)}')
app = app.replace(save_validation, save_validation_with_zakat, 2)

app = replace_once(
    app,
    '''        setValuationCase(null);
      }
''',
    '''        setValuationCase(null);
        setZakatCase(null);
      }
''',
    'delete active clears zakat',
)

# resetCurrent contains two explicit branches; clear Zakat once at function entry.
app = replace_once(
    app,
    '''  const resetCurrent = () => {
    if (activeDealId) {
''',
    '''  const resetCurrent = () => {
    setZakatCase(null);
    if (activeDealId) {
''',
    'reset clears zakat',
)

app = replace_once(
    app,
    '''              setValuationCase(null);
              setActiveTab("dashboard");
''',
    '''              setValuationCase(null);
              setZakatCase(null);
              setActiveTab("dashboard");
''',
    'mode switch clears zakat',
)

app = replace_once(
    app,
    '''            ) : (
              <LandInputPanel inputs={landInputs} setInputs={setLandInputs} />
            )}
          </aside>
''',
    '''            ) : (
              <LandInputPanel inputs={landInputs} setInputs={setLandInputs} />
            )}
            <ZakatInputSection zakatCase={zakatCase} setZakatCase={setZakatCase} />
          </aside>
''',
    'zakat input section',
)
app = replace_once(
    app,
    '{activeTab === "cashflow" && <CashFlowTab mode={mode} inputs={inputs} results={results} />}',
    '{activeTab === "cashflow" && <CashFlowTab mode={mode} inputs={inputs} results={results} zakatCase={zakatCase} />}',
    'cashflow zakat prop',
)
app_path.write_text(app)

zakat_module = r'''"use strict";

const { computeIRR, computeNPV } = require('../engines/financial');

const ZAKAT_INPUT_SOURCE = Object.freeze({
  ACCOUNTANT: 'ACCOUNTANT',
  ZAKAT_ADVISER: 'ZAKAT_ADVISER',
  INTERNAL_ESTIMATE: 'INTERNAL_ESTIMATE',
});

const ZAKAT_LAYER_STATUS = Object.freeze({
  NOT_PROVIDED: 'NOT_PROVIDED',
  USER_ENTERED: 'USER_ENTERED',
});

class ZakatLayerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ZakatLayerError';
    this.code = code;
  }
}

function validateUserEnteredZakatCase(candidate) {
  if (candidate === null || candidate === undefined) return null;
  if (typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new ZakatLayerError('ZAKAT_CASE_INVALID', 'Zakat case must be an object when provided.');
  }
  if (!Number.isFinite(candidate.annualAmount) || candidate.annualAmount < 0) {
    throw new ZakatLayerError('ZAKAT_ANNUAL_AMOUNT_INVALID', 'Annual Zakat amount must be a finite non-negative SAR amount.');
  }
  if (!Object.values(ZAKAT_INPUT_SOURCE).includes(candidate.source)) {
    throw new ZakatLayerError('ZAKAT_SOURCE_REQUIRED', 'A recognized source is required when an annual Zakat amount is supplied.');
  }
  return Object.freeze({ annualAmount: candidate.annualAmount, source: candidate.source });
}

function validateCashflows(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length === 0) {
    throw new ZakatLayerError('ZAKAT_CASHFLOWS_REQUIRED', 'Cash flows are required for the optional Zakat layer.');
  }
  cashflows.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new ZakatLayerError('ZAKAT_CASHFLOW_NON_FINITE', `Cash flow at index ${index} is not finite.`);
    }
  });
}

function buildUserEnteredZakatLayer({
  mode,
  cashflowsBeforeZakat,
  zakatCase,
  constructionYears = 0,
  operatingYears = null,
  discountRate = null,
  returnsReady = true,
}) {
  validateCashflows(cashflowsBeforeZakat);
  const before = [...cashflowsBeforeZakat];
  const validatedCase = validateUserEnteredZakatCase(zakatCase);

  if (!validatedCase) {
    return Object.freeze({
      status: ZAKAT_LAYER_STATUS.NOT_PROVIDED,
      platformCalculated: false,
      annualZakatAmount: null,
      annualZakatSource: null,
      cashflowsBeforeZakat: before,
      cashflowsAfterZakat: null,
      afterZakatIRR: null,
      afterZakatNPV: null,
      disclosureCode: 'ZAKAT_EFFECT_NOT_CALCULATED',
    });
  }

  const startIndex = mode === 'land' ? Math.max(0, Math.round(constructionYears)) + 1 : 1;
  const availableOperatingPeriods = Math.max(0, before.length - startIndex);
  const requestedOperatingPeriods = Number.isFinite(operatingYears)
    ? Math.max(0, Math.round(operatingYears))
    : availableOperatingPeriods;
  const periods = Math.min(availableOperatingPeriods, requestedOperatingPeriods);
  const after = [...before];
  for (let offset = 0; offset < periods; offset += 1) {
    const index = startIndex + offset;
    after[index] = before[index] - validatedCase.annualAmount;
  }

  const canCalculateReturns = returnsReady && Number.isFinite(discountRate);
  return Object.freeze({
    status: ZAKAT_LAYER_STATUS.USER_ENTERED,
    platformCalculated: false,
    annualZakatAmount: validatedCase.annualAmount,
    annualZakatSource: validatedCase.source,
    operatingStartIndex: startIndex,
    operatingPeriodsAffected: periods,
    cashflowsBeforeZakat: before,
    cashflowsAfterZakat: after,
    afterZakatIRR: canCalculateReturns ? computeIRR(after) : null,
    afterZakatNPV: canCalculateReturns ? computeNPV(discountRate, after) : null,
    disclosureCode: 'USER_ENTERED_ZAKAT_NOT_PLATFORM_CALCULATED',
  });
}

module.exports = {
  ZAKAT_INPUT_SOURCE,
  ZAKAT_LAYER_STATUS,
  ZakatLayerError,
  validateUserEnteredZakatCase,
  buildUserEnteredZakatLayer,
};
'''
Path('src/zakat').mkdir(parents=True, exist_ok=True)
Path('src/zakat/user-entered-zakat.js').write_text(zakat_module)

component = r'''import React, { useEffect, useMemo, useState } from "react";
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
'''
Path('src/components/ZakatLayerPanel.jsx').write_text(component)

schema_path = Path('src/validation/saved-deal-schema.js')
schema = schema_path.read_text()
schema = replace_once(
    schema,
    "const { ASSUMPTION_MODEL_VERSION } = require('../assumptions/assumption-model');\n",
    "const { ASSUMPTION_MODEL_VERSION } = require('../assumptions/assumption-model');\nconst { validateUserEnteredZakatCase } = require('../zakat/user-entered-zakat');\n",
    'saved deal Zakat import',
)
schema = replace_once(
    schema,
    '''  if (Object.prototype.hasOwnProperty.call(parsed, 'operatingCase')) {
''',
    '''  if (Object.prototype.hasOwnProperty.call(parsed, 'zakatCase')) {
    try {
      validateUserEnteredZakatCase(parsed.zakatCase);
    } catch (error) {
      throw new SavedDealValidationError('INVALID_ZAKAT_CASE', error.code || error.name || 'UNKNOWN');
    }
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'operatingCase')) {
''',
    'saved deal Zakat validation',
)
schema_path.write_text(schema)

ar_insert = r'''  zakat: {
    sectionEyebrow: "طبقة اختيارية بعد NOI",
    sectionTitle: "الزكاة — إدخال مستخدم",
    annualAmountLabel: "مبلغ الزكاة السنوي المخصص لهذا الأصل",
    amountPlaceholder: "اتركه فارغاً إذا لم تُدخل الزكاة",
    amountNote: "مبلغ سنوي بالريال فقط. لا تحوّل المنصة أي نسبة إلى مبلغ ولا تستنتج وعاءً زكوياً.",
    sourceLabel: "مصدر/جهة اعتماد المبلغ",
    sourcePlaceholder: "اختر المصدر",
    sourceAccountant: "محاسب",
    sourceZakatAdviser: "مستشار زكوي",
    sourceInternalEstimate: "تقدير داخلي",
    sourceRequired: "مصدر المبلغ إلزامي عند إدخال قيمة للزكاة.",
    platformBoundary: "STARTAK لا تحتسب الزكاة النظامية. هذه طبقة اختيارية لعرض أثر مبلغ يقدمه المستخدم أو مستشاره بعد NOI.",
    cashFlowBeforeLabel: "التدفق قبل الزكاة",
    beforeClarification: "التدفقات والمقاييس الأساسية في المنصة قبل الزكاة، ولا تُدمج الزكاة في صافي الدخل التشغيلي (NOI).",
    notCalculatedTitle: "الأثر الزكوي غير محتسب",
    notCalculated: "لم يُدخل مبلغ زكاة. تُعرض التدفقات قبل الزكاة فقط؛ لا تفترض المنصة صفراً ولا تستنتج مبلغاً.",
    userEnteredBadge: "زكاة مُدخَلة من المستخدم، غير محتسبة من المنصة",
    annualAmount: "المبلغ السنوي المدخل",
    source: "المصدر",
    afterTitle: "التدفق بعد الزكاة المدخلة",
    afterIrr: "IRR بعد الزكاة المدخلة",
    afterNpv: "NPV بعد الزكاة المدخلة",
    tableYear: "السنة",
    tableBefore: "قبل الزكاة",
    tableAfter: "بعد الزكاة المدخلة",
    invalidInput: "تعذر إنشاء طبقة الزكاة: أدخل مبلغاً صالحاً وحدد مصدره المعتمد.",
  },
'''
en_insert = r'''  zakat: {
    sectionEyebrow: "Optional post-NOI layer",
    sectionTitle: "Zakat — user-entered",
    annualAmountLabel: "Annual Zakat amount allocated to this asset",
    amountPlaceholder: "Leave blank if Zakat is not supplied",
    amountNote: "Annual SAR amount only. The platform does not convert a rate into an amount or infer a Zakat base.",
    sourceLabel: "Amount source / approver",
    sourcePlaceholder: "Select source",
    sourceAccountant: "Accountant",
    sourceZakatAdviser: "Zakat adviser",
    sourceInternalEstimate: "Internal estimate",
    sourceRequired: "A source is required when a Zakat amount is entered.",
    platformBoundary: "STARTAK does not calculate statutory Zakat. This optional layer shows the effect of an amount supplied by the user or adviser after NOI.",
    cashFlowBeforeLabel: "Cash flow before Zakat",
    beforeClarification: "Core platform cash flows and metrics are before Zakat; Zakat is never included in net operating income (NOI).",
    notCalculatedTitle: "Zakat effect not calculated",
    notCalculated: "No Zakat amount was entered. Only pre-Zakat cash flow is shown; the platform does not assume zero or infer an amount.",
    userEnteredBadge: "User-entered Zakat, not calculated by the platform",
    annualAmount: "Entered annual amount",
    source: "Source",
    afterTitle: "Cash flow after entered Zakat",
    afterIrr: "IRR after entered Zakat",
    afterNpv: "NPV after entered Zakat",
    tableYear: "Year",
    tableBefore: "Before Zakat",
    tableAfter: "After entered Zakat",
    invalidInput: "The Zakat layer could not be built: enter a valid amount and select its approved source.",
  },
'''
for path, insert in [(Path('src/i18n/locales/ar-SA.js'), ar_insert), (Path('src/i18n/locales/en.js'), en_insert)]:
    text = path.read_text()
    text = replace_once(text, '  financingInput: {\n', insert + '  financingInput: {\n', f'zakat i18n {path}')
    path.write_text(text)

test = r'''"use strict";
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const {
  ZAKAT_INPUT_SOURCE,
  ZAKAT_LAYER_STATUS,
  validateUserEnteredZakatCase,
  buildUserEnteredZakatLayer,
} = require('../../src/zakat/user-entered-zakat');
const { validateSavedDealRecord } = require('../../src/validation/saved-deal-schema');
const ar = require('../../src/i18n/locales/ar-SA');
const en = require('../../src/i18n/locales/en');

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };
const eq = (actual, expected, message) => { assert.deepStrictEqual(actual, expected, message); checks += 1; };
const fixtureDir = path.join(__dirname, '..', 'characterization', 'fixtures');
const fixtureNames = ['RE-GOLD-001-U.json', 'RE-GOLD-001-L.json', 'RE-GOLD-002-U.json', 'RE-GOLD-002-L.json'];

for (const name of fixtureNames) {
  const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'));
  const inputs = JSON.parse(JSON.stringify(fixture.input_set));
  const studyType = fixture.study_type === 'building' ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT;
  const result = calculateInvestmentCase({
    studyType,
    inputs,
    leverageEnabled: inputs.leverageEnabled,
    assumptionModelVersion: fixture.study_type === 'building' ? 'V2' : undefined,
  });
  const beforeBytes = JSON.stringify(result);
  const layer = buildUserEnteredZakatLayer({
    mode: fixture.study_type,
    cashflowsBeforeZakat: result.cashflows,
    zakatCase: null,
    constructionYears: result.constructionYears || 0,
    operatingYears: result.operatingYears || Math.max(0, result.cashflows.length - 1),
    discountRate: fixture.study_type === 'building' ? inputs.discountRate : inputs.hurdleRate,
    returnsReady: fixture.study_type !== 'building' || result.exitDependentAnalyticsReady !== false,
  });
  eq(JSON.stringify(result), beforeBytes, `${name}: layer must not change one byte of engine output`);
  eq(layer.status, ZAKAT_LAYER_STATUS.NOT_PROVIDED, `${name}: no Zakat case means NOT_PROVIDED`);
  eq(layer.cashflowsAfterZakat, null, `${name}: no after-Zakat cash flow without an entered amount`);
  eq(layer.annualZakatAmount, null, `${name}: no implicit zero`);
}

// Existing-building fixture: demonstrate that the separate layer does not touch NOI.
// Use the fixture's established legacy engine contract; no new market assumption is introduced.
const buildingFixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'RE-GOLD-002-U.json'), 'utf8'));
const buildingInputs = JSON.parse(JSON.stringify(buildingFixture.input_set));
const buildingResult = calculateInvestmentCase({
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  inputs: buildingInputs,
  leverageEnabled: buildingInputs.leverageEnabled,
});
const noiBefore = buildingResult.NOI;
const enteredCase = { annualAmount: 100000, source: ZAKAT_INPUT_SOURCE.ACCOUNTANT };
const buildingLayer = buildUserEnteredZakatLayer({
  mode: 'building',
  cashflowsBeforeZakat: buildingResult.cashflows,
  zakatCase: enteredCase,
  operatingYears: buildingResult.cashflows.length - 1,
  discountRate: buildingInputs.discountRate,
});
eq(buildingResult.NOI, noiBefore, 'Entered Zakat must never alter NOI');
eq(buildingLayer.cashflowsAfterZakat[0], buildingResult.cashflows[0], 'Acquisition flow stays unchanged');
eq(buildingLayer.cashflowsAfterZakat[1], buildingResult.cashflows[1] - enteredCase.annualAmount, 'Annual entered amount applies only after NOI in operating cash flow');
ok(Number.isFinite(buildingLayer.afterZakatIRR), 'Complete entered case produces an after-entered-Zakat IRR');
ok(Number.isFinite(buildingLayer.afterZakatNPV), 'Complete entered case produces an after-entered-Zakat NPV');
eq(buildingLayer.platformCalculated, false, 'Platform explicitly declares statutory Zakat was not calculated');

assert.throws(
  () => validateUserEnteredZakatCase({ annualAmount: 100000, source: null }),
  (error) => error && error.code === 'ZAKAT_SOURCE_REQUIRED',
  'Source is mandatory when amount is supplied',
);
checks += 1;

// Saved Deal boundary rejects an incomplete Zakat extension rather than silently loading it.
assert.throws(
  () => validateSavedDealRecord({ mode: 'building', inputs: buildingInputs, savedAt: '2026-09-06T00:00:00.000Z', zakatCase: { annualAmount: 100000, source: null } }),
  (error) => error && error.reasonCode === 'INVALID_ZAKAT_CASE',
);
checks += 1;

// Land example proves construction/acquisition periods are untouched and Zakat begins only in operation.
const landFixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'RE-GOLD-001-U.json'), 'utf8'));
const landInputs = JSON.parse(JSON.stringify(landFixture.input_set));
const landResult = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: landInputs, leverageEnabled: landInputs.leverageEnabled });
const landCase = { annualAmount: 50000, source: ZAKAT_INPUT_SOURCE.ZAKAT_ADVISER };
const landLayer = buildUserEnteredZakatLayer({
  mode: 'land', cashflowsBeforeZakat: landResult.cashflows, zakatCase: landCase,
  constructionYears: landResult.constructionYears, operatingYears: landResult.operatingYears, discountRate: landInputs.hurdleRate,
});
for (let i = 0; i <= landResult.constructionYears; i += 1) {
  eq(landLayer.cashflowsAfterZakat[i], landResult.cashflows[i], `Land pre-operation period ${i} unchanged`);
}
eq(landLayer.cashflowsAfterZakat[landResult.constructionYears + 1], landResult.cashflows[landResult.constructionYears + 1] - landCase.annualAmount, 'Land Zakat begins only after construction');
ok(Number.isFinite(landLayer.afterZakatIRR), 'Land after-entered-Zakat IRR is available');
ok(Number.isFinite(landLayer.afterZakatNPV), 'Land after-entered-Zakat NPV is available');

function flattenKeys(obj, prefix = '') {
  return Object.keys(obj).flatMap((key) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]) ? flattenKeys(obj[key], next) : [next];
  }).sort();
}
eq(flattenKeys(ar.zakat), flattenKeys(en.zakat), 'Arabic/English Zakat translation key parity');
ok(!Object.keys(buildingLayer).some((key) => /rate|percent|base/i.test(key)), 'No rate/percentage/Zakat-base conversion surface exists');
console.log(`WAVE_B2_USER_ENTERED_ZAKAT_LAYER=PASS checks=${checks}`);
'''
Path('tests/zakat').mkdir(parents=True, exist_ok=True)
Path('tests/zakat/run_user_entered_zakat_layer.js').write_text(test)

docs = r'''# STARTAK Real Estate — User-entered Zakat Layer (Wave B2)

STATUS: ENGINEERING_IMPLEMENTED_ON_FEATURE_BRANCH
VALID_AS_OF: 2026-09-06
SUPERSEDED_BY: none

## Deliberate design boundary

STARTAK Real Estate **does not calculate statutory Zakat**. This is an intentional design boundary, not an omitted formula. A statutory Zakat base is an entity-level quantity and cannot be derived reliably from a single-property underwriting model.

Wave B2 implements only an optional, separate post-NOI layer. The Zakat case is stored as envelope metadata (`zakatCase`), not as an engine economic input. It contains one annual SAR amount allocated to the asset and one mandatory source classification: accountant, Zakat adviser, or internal estimate.

The canonical engine remains pre-Zakat. Zakat is never included in NOI. If no amount is supplied, the platform shows only pre-Zakat cash flow, assumes no zero, and manufactures no after-Zakat result. There is no percentage-to-amount or amount-to-percentage conversion. Every derived output is explicitly labelled **User-entered Zakat, not calculated by the platform**.

The annual entered amount is deducted only from operating-period cash flows. Acquisition/construction-period flows are unchanged. For land development, deduction starts after construction. The terminal-value formula remains unchanged; the terminal operating-year cash flow carries the entered annual amount, but the exit valuation itself is not recomputed from Zakat.

## ZATCA source register supporting the design boundary

Official sources reviewed for the engineering boundary:

- ZATCA — Implementing Regulation for Zakat Collection (1445H), Minister of Finance Decision No. 1007 dated 19/8/1445H. Official regulation page: https://zatca.gov.sa/ar/RulesRegulations/Taxes/Pages/ZakatRegulations.aspx
- Official Arabic regulation PDF: https://www.zatca.gov.sa/ar/RulesRegulations/Taxes/Documents/ZakatRegulation_1445.pdf
- ZATCA announcement dated 22 March 2024: https://zatca.gov.sa/ar/MediaCenter/News/Pages/news-1218.aspx
- ZATCA General Zakat Guideline: https://zatca.gov.sa/ar/HelpCenter/guidelines/Documents/Zakat_General_1445H.pdf

### Verification status of B-1 citations

Verified against currently published ZATCA material during this implementation pass:

- Article 15: the stated Zakat percentage is applied to the **Zakat base**, not NOI.
- Articles 48 and 49: official deduction rules address non-current assets/properties held for use rather than resale.
- Article 73: official real-estate/construction treatment; the current text records an amendment under Minister of Finance Decision No. 1248 dated 11/10/1446H (3 April 2025).
- Decision No. 1007 dated 19/8/1445H: verified on ZATCA's official regulation page and announcement.
- Decision No. 1248 dated 11/10/1446H: verified from the amendment note attached to Article 73 in the current official regulation text.

Not independently re-verified article-by-article in this implementation pass and therefore **not relied upon by code or UI**: Articles 19, 20, 21, 23, 25 and 52. Status: `SPECIALIST_VERIFICATION_REQUIRED` before citation in a formal accounting/legal deliverable.

## Professional-review boundary

This document and software layer are engineering controls, not a Zakat opinion. Asset classification, deductibility, entity Zakat base, allocation of an entity-level Zakat charge to an asset, and the appropriateness of the entered amount require review by a qualified Saudi accountant/Zakat adviser where professional reliance is intended.
'''
Path('docs').mkdir(exist_ok=True)
Path('docs/ZAKAT_USER_ENTERED_LAYER_WAVE_B2.md').write_text(docs)

# Remove all bootstrap mechanics from the final implementation commit.
for temp in [
    Path('.github/workflows/wave-b2-apply.yml'),
    Path('tools/wave-b2-apply.py'),
    Path('tools/wave-b2-apply-v2.py'),
]:
    if temp.exists():
        temp.unlink()
