import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, XCircle } from 'lucide-react';

const {
  BASIS_OF_VALUE,
  VALUATION_METHOD,
  EVIDENCE_GRADE,
  INPUT_STATUS,
  TRANSACTION_STATUS,
  WEIGHTING_POLICY,
} = require('../valuation-intelligence');
const {
  EVIDENCE_KEYS,
  RECONCILABLE_METHODS,
  emptyComparableDraft,
  advancedDraftFromValuationCase,
  applyAdvancedDraftToValuationCase,
} = require('../app/valuation-advanced-draft');
const { getValuationMethodLabel } = require('../app/valuation-labels');

const COLORS = Object.freeze({
  ink: '#0D1526',
  panelRaised: '#1C2C4A',
  panelInput: '#18233C',
  hairline: '#2B3B5C',
  hairlineSoft: '#20304E',
  brass: '#C9A24C',
  brassSoft: '#E7D3A0',
  parchment: '#EDE6D6',
  slate: '#8C97AC',
  slateDim: '#647089',
  negative: '#B4544A',
});

const COPY = Object.freeze({
  'ar-SA': Object.freeze({
    title: 'المدخلات المتقدمة والأدلة',
    subtitle: 'إعداد اختياري صريح للأدلة، المقارنات السوقية، منهج التكلفة وسياسة المصالحة. لا تُنشأ أوزان أو أدلة أو نسب تلقائياً.',
    open: 'فتح الإعدادات المتقدمة',
    close: 'إغلاق الإعدادات المتقدمة',
    apply: 'تطبيق المدخلات المتقدمة',
    applied: 'تم تطبيق المدخلات المتقدمة على الحالة الحالية.',
    error: 'تعذر تطبيق المدخلات المتقدمة',
    evidence: 'أدلة المدخلات',
    evidenceNote: 'عند عدم تفعيل دليل محدد، يستخدم محول المبنى وصفه الافتراضي كبيان مقدم من العميل وغير متحقق منه. لا تتم ترقية جودة الدليل تلقائياً.',
    enabled: 'مفعّل',
    grade: 'درجة الدليل',
    status: 'حالة المدخل',
    sourceType: 'نوع المصدر',
    sourceRef: 'مرجع المصدر',
    observedAt: 'تاريخ الرصد',
    note: 'ملاحظة',
    market: 'المقارنات السوقية',
    marketEnable: 'تفعيل منهج المقارنات السوقية',
    subjectArea: 'مساحة الأصل موضوع التقييم',
    basis: 'أساس القيمة',
    weighting: 'سياسة الأوزان',
    currency: 'العملة',
    valuationDate: 'تاريخ التقييم',
    comparables: 'المقارنات',
    addComparable: 'إضافة مقارنة',
    comparableId: 'معرّف المقارنة',
    unitValue: 'قيمة الوحدة',
    transactionStatus: 'حالة الصفقة/العرض',
    evidenceGrade: 'درجة دليل المقارنة',
    weight: 'الوزن',
    weightEqualNote: 'عند اختيار الأوزان المتساوية لا يلزم إدخال وزن للمقارنة.',
    transactionDate: 'تاريخ الصفقة/الرصد',
    adjustments: 'التعديلات JSON',
    metadata: 'البيانات الوصفية JSON',
    remove: 'حذف',
    cost: 'منهج التكلفة',
    costEnable: 'تفعيل منهج تكلفة الاستبدال المخصومة',
    depreciationRate: 'نسبة الاستهلاك (0–1)',
    indirectCosts: 'التكاليف غير المباشرة JSON',
    indirectCostsNote: 'صيغة مصفوفة، مثال بنيوي فقط: [{"label":"Professional fees","amount":500000}]',
    reconciliation: 'المصالحة بين المناهج',
    reconciliationEnable: 'تفعيل سياسة المصالحة',
    dispersionThreshold: 'حد التشتت الصريح',
    methodWeights: 'أوزان المناهج — يجب أن تجمع إلى 1',
    explicitSelection: 'اختر صراحة',
    optional: 'اختياري',
    sourceTypePlaceholder: 'مثال: LEASE_LEDGER / OFFICIAL_RECORD',
    sourceRefPlaceholder: 'معرّف أو رابط مرجعي داخلي',
    comparableIdPlaceholder: 'COMP-001',
    jsonArrayPlaceholder: '[]',
    jsonObjectPlaceholder: '{}',
    income: 'الدخل الفعلي/الفعال',
    expenses: 'المصروفات التشغيلية',
    capRate: 'معدل الرسملة',
    landValue: 'قيمة الأرض',
    replacementCost: 'تكلفة الاستبدال',
    depreciationRateEvidence: 'نسبة الاستهلاك',
  }),
  en: Object.freeze({
    title: 'Advanced Inputs & Evidence',
    subtitle: 'Optional explicit configuration for evidence, market comparables, cost approach and reconciliation. No weights, evidence or thresholds are created automatically.',
    open: 'Open advanced configuration',
    close: 'Close advanced configuration',
    apply: 'Apply advanced inputs',
    applied: 'Advanced inputs were applied to the current case.',
    error: 'Advanced inputs could not be applied',
    evidence: 'Input evidence',
    evidenceNote: 'If an evidence item is not enabled, the existing-building adapter keeps its default client-supplied unverified descriptor. Evidence quality is never upgraded automatically.',
    enabled: 'Enabled',
    grade: 'Evidence grade',
    status: 'Input status',
    sourceType: 'Source type',
    sourceRef: 'Source reference',
    observedAt: 'Observed at',
    note: 'Note',
    market: 'Market comparables',
    marketEnable: 'Enable market comparable approach',
    subjectArea: 'Subject asset area',
    basis: 'Basis of value',
    weighting: 'Weighting policy',
    currency: 'Currency',
    valuationDate: 'Valuation date',
    comparables: 'Comparables',
    addComparable: 'Add comparable',
    comparableId: 'Comparable ID',
    unitValue: 'Unit value',
    transactionStatus: 'Transaction / asking status',
    evidenceGrade: 'Comparable evidence grade',
    weight: 'Weight',
    weightEqualNote: 'No comparable weight is required when equal weighting is explicitly selected.',
    transactionDate: 'Transaction / observation date',
    adjustments: 'Adjustments JSON',
    metadata: 'Metadata JSON',
    remove: 'Remove',
    cost: 'Cost approach',
    costEnable: 'Enable depreciated replacement cost approach',
    depreciationRate: 'Depreciation ratio (0–1)',
    indirectCosts: 'Indirect costs JSON',
    indirectCostsNote: 'Array format; structural example only: [{"label":"Professional fees","amount":500000}]',
    reconciliation: 'Method reconciliation',
    reconciliationEnable: 'Enable reconciliation policy',
    dispersionThreshold: 'Explicit dispersion threshold',
    methodWeights: 'Method weights — must sum to 1',
    explicitSelection: 'Select explicitly',
    optional: 'Optional',
    sourceTypePlaceholder: 'Example: LEASE_LEDGER / OFFICIAL_RECORD',
    sourceRefPlaceholder: 'Internal reference ID or URL',
    comparableIdPlaceholder: 'COMP-001',
    jsonArrayPlaceholder: '[]',
    jsonObjectPlaceholder: '{}',
    income: 'Effective / actual income',
    expenses: 'Operating expenses',
    capRate: 'Capitalization rate',
    landValue: 'Land value',
    replacementCost: 'Replacement cost',
    depreciationRateEvidence: 'Depreciation rate',
  }),
});

function copyForLocale(locale) {
  return COPY[locale] || COPY.en;
}

function inputStyle() {
  return {
    background: COLORS.panelInput,
    border: `1px solid ${COLORS.hairline}`,
    color: COLORS.brassSoft,
    borderRadius: '0.6rem',
  };
}

function Field({ label, children, note }) {
  return (
    <label className="block">
      <div className="text-[10px] mb-1" style={{ color: COLORS.slate }}>{label}</div>
      {children}
      {note ? <div className="text-[9px] leading-relaxed mt-1" style={{ color: COLORS.slateDim }}>{note}</div> : null}
    </label>
  );
}

function TextInput({ label, value, onChange, placeholder, type = 'text', note }) {
  return (
    <Field label={label} note={note}>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rf-input w-full px-3 py-2 text-xs"
        style={inputStyle()}
      />
    </Field>
  );
}

function SelectInput({ label, value, onChange, options, placeholder }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rf-input w-full px-3 py-2 text-xs" style={inputStyle()}>
        <option value="" style={{ background: COLORS.panelRaised }}>{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value} style={{ background: COLORS.panelRaised }}>{option.label}</option>)}
      </select>
    </Field>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="text-xs" style={{ color: COLORS.parchment }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-3 md:p-4" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
      <div className="text-xs font-semibold mb-3" style={{ color: COLORS.brass }}>{title}</div>
      {children}
    </div>
  );
}

function patchEvidence(setDraft, key, field, value) {
  setDraft((current) => ({
    ...current,
    evidence: {
      ...current.evidence,
      [key]: {
        ...current.evidence[key],
        [field]: value,
      },
    },
  }));
}

function patchSection(setDraft, section, field, value) {
  setDraft((current) => ({
    ...current,
    [section]: {
      ...current[section],
      [field]: value,
    },
  }));
}

function EvidenceEditor({ locale, draft, setDraft }) {
  const text = copyForLocale(locale);
  const labels = {
    income: text.income,
    expenses: text.expenses,
    capRate: text.capRate,
    landValue: text.landValue,
    replacementCost: text.replacementCost,
    depreciationRate: text.depreciationRateEvidence,
  };
  const gradeOptions = Object.values(EVIDENCE_GRADE).map((value) => ({ value, label: value }));
  const statusOptions = Object.values(INPUT_STATUS).map((value) => ({ value, label: value }));

  return (
    <Section title={text.evidence}>
      <div className="text-[9px] leading-relaxed mb-3" style={{ color: COLORS.slateDim }}>{text.evidenceNote}</div>
      <div className="space-y-3">
        {EVIDENCE_KEYS.map((key) => {
          const item = draft.evidence[key];
          return (
            <div key={key} className="rounded-lg p-3" style={{ border: `1px solid ${COLORS.hairline}` }}>
              <Toggle label={labels[key]} checked={item.enabled} onChange={(value) => patchEvidence(setDraft, key, 'enabled', value)} />
              {item.enabled ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-2">
                  <SelectInput label={text.grade} value={item.grade} onChange={(value) => patchEvidence(setDraft, key, 'grade', value)} options={gradeOptions} placeholder={text.explicitSelection} />
                  <SelectInput label={text.status} value={item.status} onChange={(value) => patchEvidence(setDraft, key, 'status', value)} options={statusOptions} placeholder={text.explicitSelection} />
                  <TextInput label={text.sourceType} value={item.sourceType} onChange={(value) => patchEvidence(setDraft, key, 'sourceType', value)} placeholder={text.sourceTypePlaceholder} />
                  <TextInput label={text.sourceRef} value={item.sourceRef} onChange={(value) => patchEvidence(setDraft, key, 'sourceRef', value)} placeholder={text.sourceRefPlaceholder} />
                  <TextInput label={text.observedAt} value={item.observedAt} onChange={(value) => patchEvidence(setDraft, key, 'observedAt', value)} type="date" />
                  <TextInput label={text.note} value={item.note} onChange={(value) => patchEvidence(setDraft, key, 'note', value)} placeholder={text.optional} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function MarketComparableEditor({ locale, draft, setDraft }) {
  const text = copyForLocale(locale);
  const section = draft.marketComparable;
  const basisOptions = [BASIS_OF_VALUE.MARKET_VALUE, BASIS_OF_VALUE.FAIR_VALUE, BASIS_OF_VALUE.MARKET_RENT].map((value) => ({ value, label: value }));
  const weightingOptions = Object.values(WEIGHTING_POLICY).map((value) => ({ value, label: value }));
  const transactionOptions = Object.values(TRANSACTION_STATUS).map((value) => ({ value, label: value }));
  const gradeOptions = Object.values(EVIDENCE_GRADE).map((value) => ({ value, label: value }));

  const patchComparable = (index, field, value) => {
    setDraft((current) => ({
      ...current,
      marketComparable: {
        ...current.marketComparable,
        comparables: current.marketComparable.comparables.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row),
      },
    }));
  };

  const addComparable = () => {
    setDraft((current) => ({
      ...current,
      marketComparable: {
        ...current.marketComparable,
        comparables: [...current.marketComparable.comparables, emptyComparableDraft()],
      },
    }));
  };

  const removeComparable = (index) => {
    setDraft((current) => ({
      ...current,
      marketComparable: {
        ...current.marketComparable,
        comparables: current.marketComparable.comparables.filter((_, rowIndex) => rowIndex !== index),
      },
    }));
  };

  return (
    <Section title={text.market}>
      <Toggle label={text.marketEnable} checked={section.enabled} onChange={(value) => patchSection(setDraft, 'marketComparable', 'enabled', value)} />
      {section.enabled ? (
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            <TextInput label={text.subjectArea} value={section.subjectArea} onChange={(value) => patchSection(setDraft, 'marketComparable', 'subjectArea', value)} />
            <SelectInput label={text.basis} value={section.basis} onChange={(value) => patchSection(setDraft, 'marketComparable', 'basis', value)} options={basisOptions} placeholder={text.explicitSelection} />
            <SelectInput label={text.weighting} value={section.weightingPolicy} onChange={(value) => patchSection(setDraft, 'marketComparable', 'weightingPolicy', value)} options={weightingOptions} placeholder={text.explicitSelection} />
            <TextInput label={text.currency} value={section.currency} onChange={(value) => patchSection(setDraft, 'marketComparable', 'currency', value.toUpperCase())} />
            <TextInput label={text.valuationDate} value={section.valuationDate} onChange={(value) => patchSection(setDraft, 'marketComparable', 'valuationDate', value)} type="date" />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold" style={{ color: COLORS.parchment }}>{text.comparables}</div>
            <button type="button" onClick={addComparable} className="text-[10px] px-2 py-1.5 rounded-lg flex items-center gap-1" style={{ border: `1px solid ${COLORS.hairline}`, color: COLORS.brassSoft }}>
              <Plus size={11} /> {text.addComparable}
            </button>
          </div>

          {section.weightingPolicy === WEIGHTING_POLICY.EQUAL ? <div className="text-[9px]" style={{ color: COLORS.slateDim }}>{text.weightEqualNote}</div> : null}

          <div className="space-y-3">
            {section.comparables.map((row, index) => (
              <div key={`${row.comparableId || 'new'}-${index}`} className="rounded-lg p-3" style={{ border: `1px solid ${COLORS.hairline}` }}>
                <div className="flex justify-end mb-2">
                  <button type="button" onClick={() => removeComparable(index)} className="text-[10px] flex items-center gap-1" style={{ color: COLORS.negative }}>
                    <Trash2 size={11} /> {text.remove}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                  <TextInput label={text.comparableId} value={row.comparableId} onChange={(value) => patchComparable(index, 'comparableId', value)} placeholder={text.comparableIdPlaceholder} />
                  <TextInput label={text.unitValue} value={row.unitValue} onChange={(value) => patchComparable(index, 'unitValue', value)} />
                  <SelectInput label={text.transactionStatus} value={row.transactionStatus} onChange={(value) => patchComparable(index, 'transactionStatus', value)} options={transactionOptions} placeholder={text.explicitSelection} />
                  <SelectInput label={text.evidenceGrade} value={row.evidenceGrade} onChange={(value) => patchComparable(index, 'evidenceGrade', value)} options={gradeOptions} placeholder={text.explicitSelection} />
                  <TextInput label={text.weight} value={row.weight} onChange={(value) => patchComparable(index, 'weight', value)} note={section.weightingPolicy === WEIGHTING_POLICY.EQUAL ? text.weightEqualNote : undefined} />
                  <TextInput label={text.transactionDate} value={row.transactionDate} onChange={(value) => patchComparable(index, 'transactionDate', value)} type="date" />
                  <TextInput label={text.sourceRef} value={row.sourceRef} onChange={(value) => patchComparable(index, 'sourceRef', value)} placeholder={text.sourceRefPlaceholder} />
                  <TextInput label={text.adjustments} value={row.adjustmentsJson} onChange={(value) => patchComparable(index, 'adjustmentsJson', value)} placeholder={text.jsonArrayPlaceholder} />
                  <TextInput label={text.metadata} value={row.metadataJson} onChange={(value) => patchComparable(index, 'metadataJson', value)} placeholder={text.jsonObjectPlaceholder} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function CostEditor({ locale, draft, setDraft }) {
  const text = copyForLocale(locale);
  const section = draft.cost;
  const basisOptions = [BASIS_OF_VALUE.MARKET_VALUE, BASIS_OF_VALUE.FAIR_VALUE, BASIS_OF_VALUE.INVESTMENT_VALUE].map((value) => ({ value, label: value }));
  return (
    <Section title={text.cost}>
      <Toggle label={text.costEnable} checked={section.enabled} onChange={(value) => patchSection(setDraft, 'cost', 'enabled', value)} />
      {section.enabled ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-2">
          <TextInput label={text.depreciationRate} value={section.depreciationRate} onChange={(value) => patchSection(setDraft, 'cost', 'depreciationRate', value)} />
          <SelectInput label={text.basis} value={section.basis} onChange={(value) => patchSection(setDraft, 'cost', 'basis', value)} options={basisOptions} placeholder={text.explicitSelection} />
          <TextInput label={text.currency} value={section.currency} onChange={(value) => patchSection(setDraft, 'cost', 'currency', value.toUpperCase())} />
          <TextInput label={text.valuationDate} value={section.valuationDate} onChange={(value) => patchSection(setDraft, 'cost', 'valuationDate', value)} type="date" />
          <label className="block md:col-span-2 xl:col-span-3">
            <div className="text-[10px] mb-1" style={{ color: COLORS.slate }}>{text.indirectCosts}</div>
            <textarea
              rows={3}
              value={section.indirectCostsJson}
              onChange={(event) => patchSection(setDraft, 'cost', 'indirectCostsJson', event.target.value)}
              placeholder={text.jsonArrayPlaceholder}
              className="rf-input w-full px-3 py-2 text-xs font-mono"
              style={inputStyle()}
            />
            <div className="text-[9px] mt-1" style={{ color: COLORS.slateDim }}>{text.indirectCostsNote}</div>
          </label>
        </div>
      ) : null}
    </Section>
  );
}

function ReconciliationEditor({ locale, draft, setDraft }) {
  const text = copyForLocale(locale);
  const section = draft.reconciliation;
  const patchWeight = (method, value) => {
    setDraft((current) => ({
      ...current,
      reconciliation: {
        ...current.reconciliation,
        methodWeights: {
          ...current.reconciliation.methodWeights,
          [method]: value,
        },
      },
    }));
  };
  return (
    <Section title={text.reconciliation}>
      <Toggle label={text.reconciliationEnable} checked={section.enabled} onChange={(value) => patchSection(setDraft, 'reconciliation', 'enabled', value)} />
      {section.enabled ? (
        <div className="mt-2 space-y-3">
          <TextInput label={text.dispersionThreshold} value={section.dispersionThreshold} onChange={(value) => patchSection(setDraft, 'reconciliation', 'dispersionThreshold', value)} />
          <div>
            <div className="text-[10px] mb-2" style={{ color: COLORS.slate }}>{text.methodWeights}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {RECONCILABLE_METHODS.map((method) => (
                <TextInput
                  key={method}
                  label={getValuationMethodLabel(locale, method)}
                  value={section.methodWeights[method] || ''}
                  onChange={(value) => patchWeight(method, value)}
                  placeholder={text.optional}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

export default function ValuationAdvancedPanel({ locale = 'ar-SA', valuationCase, onChangeValuationCase }) {
  const text = copyForLocale(locale);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => advancedDraftFromValuationCase(valuationCase));
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setDraft(advancedDraftFromValuationCase(valuationCase));
    setMessage(null);
  }, [valuationCase]);

  const activeCount = useMemo(() => {
    let count = EVIDENCE_KEYS.filter((key) => draft.evidence[key]?.enabled).length;
    if (draft.marketComparable.enabled) count += 1;
    if (draft.cost.enabled) count += 1;
    if (draft.reconciliation.enabled) count += 1;
    return count;
  }, [draft]);

  const apply = () => {
    try {
      const next = applyAdvancedDraftToValuationCase(valuationCase, draft);
      onChangeValuationCase(next);
      setMessage({ ok: true, text: text.applied });
    } catch (error) {
      setMessage({
        ok: false,
        text: `${text.error}: ${error?.reasonCode || error?.name || 'INVALID_CONFIGURATION'}${error?.field ? ` — ${error.field}` : ''}`,
      });
    }
  };

  return (
    <div className="mt-4 rounded-xl p-3 md:p-4" style={{ border: `1px solid ${COLORS.hairline}`, background: 'rgba(28,44,74,0.45)' }}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full flex items-start justify-between gap-3 text-start">
        <div>
          <div className="text-xs font-semibold" style={{ color: COLORS.parchment }}>{text.title}</div>
          <div className="text-[9px] leading-relaxed mt-1" style={{ color: COLORS.slateDim }}>{text.subtitle}</div>
          {activeCount > 0 ? <div className="text-[9px] mt-1" style={{ color: COLORS.brass }}>{activeCount}</div> : null}
        </div>
        {open ? <ChevronUp size={15} style={{ color: COLORS.slate }} /> : <ChevronDown size={15} style={{ color: COLORS.slate }} />}
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          <EvidenceEditor locale={locale} draft={draft} setDraft={setDraft} />
          <MarketComparableEditor locale={locale} draft={draft} setDraft={setDraft} />
          <CostEditor locale={locale} draft={draft} setDraft={setDraft} />
          <ReconciliationEditor locale={locale} draft={draft} setDraft={setDraft} />

          {message ? (
            <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ border: `1px solid ${message.ok ? COLORS.hairline : COLORS.negative}`, color: message.ok ? COLORS.brassSoft : COLORS.negative }}>
              {!message.ok ? <XCircle size={13} style={{ flexShrink: 0 }} /> : null}
              <div className="text-[10px] leading-relaxed">{message.text}</div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="button" onClick={apply} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: COLORS.brass, color: COLORS.ink }}>
              {text.apply}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
