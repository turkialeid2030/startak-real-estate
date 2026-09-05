import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ShieldCheck, XCircle } from 'lucide-react';

const {
  VALUATION_METHOD,
  BASIS_OF_VALUE,
} = require('../valuation-intelligence');
const {
  ASSET_CLASS,
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('../project-model/project-profile');
const { EXPENSE_TREATMENT } = require('../valuation-intelligence/income-capitalization');
const {
  emptyValuationCaseDraft,
  draftFromValuationCase,
  buildValuationCaseFromDraft,
} = require('../app/valuation-case-draft');
const {
  getValuationStateLabel,
  getValuationEngineStatusLabel,
  getValuationMethodLabel,
  getValuationReasonLabel,
} = require('../app/valuation-labels');
const { VALUATION_RUNTIME_MODE } = require('../app/existing-building-valuation-runtime');

const COLORS = Object.freeze({
  ink: '#0D1526',
  panel: '#141F35',
  panelRaised: '#1C2C4A',
  panelInput: '#18233C',
  hairline: '#2B3B5C',
  hairlineSoft: '#20304E',
  brass: '#C9A24C',
  brassSoft: '#E7D3A0',
  brassDim: '#8A7440',
  parchment: '#EDE6D6',
  slate: '#8C97AC',
  slateDim: '#647089',
  positive: '#4F9D6E',
  caution: '#D08A3E',
  negative: '#B4544A',
});

const COPY = Object.freeze({
  'ar-SA': Object.freeze({
    title: 'ذكاء التقييم العقاري',
    subtitle: 'طبقة تقييم إضافية لا تستبدل محرك الدراسة الحالي ولا تعيد حساب الصفقات القديمة تلقائياً.',
    legacyTitle: 'المسار الحالي فقط',
    legacyBody: 'لم يتم تفعيل Valuation V1 لهذه الحالة. تستمر نتائج الدراسة الحالية كما هي دون ترحيل أو افتراضات تلقائية.',
    configure: 'تهيئة Valuation V1',
    editConfiguration: 'تعديل الإعدادات',
    closeConfiguration: 'إغلاق الإعدادات',
    applyConfiguration: 'تطبيق الإعدادات',
    disable: 'العودة للمسار الحالي فقط',
    disableConfirm: 'سيتم إلغاء تفعيل Valuation V1 للحالة الحالية فقط. لن يتم حذف نتائج المحرك الحالي. هل تريد المتابعة؟',
    configuration: 'إعدادات التقييم',
    configurationNote: 'لا توجد قيم اقتصادية افتراضية مخفية. الحقول المطلوبة يجب تحديدها صراحة.',
    projectId: 'معرّف المشروع',
    assetClass: 'فئة الأصل',
    lifecycleStage: 'مرحلة دورة الحياة',
    investmentStrategy: 'الاستراتيجية الاستثمارية',
    incomeModel: 'نموذج الدخل',
    expenseTreatment: 'معالجة المصروفات التشغيلية',
    basis: 'أساس القيمة',
    currency: 'العملة',
    valuationDate: 'تاريخ التقييم',
    evidencePolicy: 'تفعيل سياسة جودة الأدلة',
    minEvidenceCount: 'الحد الأدنى لعدد الأدلة',
    maxAssumptionBurdenRatio: 'الحد الأقصى لنسبة عبء الافتراضات',
    maxLowGradeRatio: 'الحد الأقصى لنسبة الأدلة منخفضة الدرجة',
    singleMethodPolicy: 'السماح الصريح بمنهج واحد مؤهل',
    allowedMethod: 'المنهج المسموح',
    justification: 'مبرر الاعتماد المهني',
    requiredPlaceholder: 'اختر صراحة',
    currencyPlaceholder: 'مثال: SAR',
    projectPlaceholder: 'مثال: PROJECT-001',
    justificationPlaceholder: 'اكتب مبرراً مهنياً واضحاً لقبول منهج واحد فقط',
    configError: 'تعذر تطبيق إعدادات التقييم',
    runtimeError: 'تعذر تشغيل طبقة التقييم لهذه الحالة. بقيت الدراسة الأساسية دون تغيير.',
    currentStatus: 'حالة التقييم',
    finalValue: 'القيمة النهائية المؤهلة',
    reasons: 'أسباب التعليق / عدم الإتاحة',
    evidenceGaps: 'فجوات الأدلة أو المدخلات',
    methods: 'المناهج',
    evidenceGrade: 'أضعف درجة دليل',
    evidenceQuality: 'جودة الأدلة',
    noFinalValue: 'لا توجد قيمة نهائية مؤهلة حالياً',
    noReasons: 'لا توجد أسباب تعليق حالياً',
    noGaps: 'لا توجد فجوات مسجلة حالياً',
    advancedPreserved: 'إعدادات متقدمة محفوظة',
    advancedPreservedNote: 'توجد مدخلات متقدمة في الحالة المحفوظة. هذا الجزء يحافظ عليها ولا يعدلها تلقائياً.',
    advancedNone: 'لا توجد إعدادات متقدمة مرفقة حالياً.',
    singleMethodAccepted: 'تم استخدام سياسة قبول منهج واحد',
    singleMethodJustification: 'المبرر',
    governanceNote: 'جاهزية التقييم لا تعني اعتماد الصفقة أو تفويض أي معاملة. يبقى القرار البشري والحوكمة المطلوبة إلزاميين.',
    legacyOnlyBadge: 'Legacy Only',
    valuationV1Badge: 'Valuation V1',
    available: 'متاح',
    hold: 'معلّق',
    unavailable: 'غير متاح',
    selectOffice: 'مكاتب',
    selectRetail: 'تجزئة',
    selectResidential: 'سكني',
    selectExistingOperating: 'قائم ومشغّل',
    selectStabilized: 'مستقر',
    selectExistingVacant: 'قائم وشاغر',
    selectRenovation: 'تجديد',
    selectRedevelopment: 'إعادة تطوير',
    selectAcquireHold: 'استحواذ واحتفاظ',
    selectCoreIncome: 'دخل أساسي',
    selectValueAdd: 'قيمة مضافة',
    selectRefinance: 'إعادة تمويل',
    selectDisposal: 'تخارج',
    selectSaleLeaseback: 'بيع وإعادة استئجار',
    selectLeaseIncome: 'دخل إيجاري',
    selectActualOpex: 'مصروفات فعلية على المالك',
    selectMarketOpex: 'تقدير سوقي للمصروفات',
    selectTenantConfirmed: 'المصروفات على المستأجر — مؤكدة',
    selectTenantAssumed: 'المصروفات على المستأجر — مفترضة',
    selectMarketValue: 'القيمة السوقية',
    selectFairValue: 'القيمة العادلة',
    selectInvestmentValue: 'القيمة الاستثمارية',
  }),
  en: Object.freeze({
    title: 'Valuation Intelligence',
    subtitle: 'An additive valuation layer that does not replace the current study engine or automatically recalculate legacy deals.',
    legacyTitle: 'Current path only',
    legacyBody: 'Valuation V1 is not enabled for this case. The existing study results remain unchanged with no automatic migration or inferred policy.',
    configure: 'Configure Valuation V1',
    editConfiguration: 'Edit configuration',
    closeConfiguration: 'Close configuration',
    applyConfiguration: 'Apply configuration',
    disable: 'Use current path only',
    disableConfirm: 'This will disable Valuation V1 for the current case only. Existing engine results will not be deleted. Continue?',
    configuration: 'Valuation configuration',
    configurationNote: 'There are no hidden economic defaults. Required fields must be selected explicitly.',
    projectId: 'Project ID',
    assetClass: 'Asset class',
    lifecycleStage: 'Lifecycle stage',
    investmentStrategy: 'Investment strategy',
    incomeModel: 'Income model',
    expenseTreatment: 'Operating-expense treatment',
    basis: 'Basis of value',
    currency: 'Currency',
    valuationDate: 'Valuation date',
    evidencePolicy: 'Enable evidence-quality policy',
    minEvidenceCount: 'Minimum evidence count',
    maxAssumptionBurdenRatio: 'Maximum assumption-burden ratio',
    maxLowGradeRatio: 'Maximum low-grade evidence ratio',
    singleMethodPolicy: 'Explicitly allow one qualified method',
    allowedMethod: 'Allowed method',
    justification: 'Professional justification',
    requiredPlaceholder: 'Select explicitly',
    currencyPlaceholder: 'Example: SAR',
    projectPlaceholder: 'Example: PROJECT-001',
    justificationPlaceholder: 'Enter a clear professional justification for accepting only one method',
    configError: 'Valuation configuration could not be applied',
    runtimeError: 'The valuation layer could not run for this case. The base study remains unchanged.',
    currentStatus: 'Valuation status',
    finalValue: 'Qualified final value',
    reasons: 'Hold / unavailability reasons',
    evidenceGaps: 'Evidence or input gaps',
    methods: 'Methods',
    evidenceGrade: 'Weakest evidence grade',
    evidenceQuality: 'Evidence quality',
    noFinalValue: 'No qualified final value is currently available',
    noReasons: 'No hold reasons are currently recorded',
    noGaps: 'No evidence gaps are currently recorded',
    advancedPreserved: 'Advanced configuration preserved',
    advancedPreservedNote: 'Advanced inputs exist in the saved case. This panel preserves them and does not silently edit them.',
    advancedNone: 'No advanced configuration is currently attached.',
    singleMethodAccepted: 'Single-method acceptance policy used',
    singleMethodJustification: 'Justification',
    governanceNote: 'Valuation readiness does not approve the transaction or authorize execution. Human decision authority and required governance remain mandatory.',
    legacyOnlyBadge: 'Legacy Only',
    valuationV1Badge: 'Valuation V1',
    available: 'Available',
    hold: 'Hold',
    unavailable: 'Unavailable',
    selectOffice: 'Office',
    selectRetail: 'Retail',
    selectResidential: 'Residential',
    selectExistingOperating: 'Existing operating',
    selectStabilized: 'Stabilized',
    selectExistingVacant: 'Existing vacant',
    selectRenovation: 'Renovation',
    selectRedevelopment: 'Redevelopment',
    selectAcquireHold: 'Acquire & hold',
    selectCoreIncome: 'Core income',
    selectValueAdd: 'Value add',
    selectRefinance: 'Refinance',
    selectDisposal: 'Disposal',
    selectSaleLeaseback: 'Sale & leaseback',
    selectLeaseIncome: 'Lease income',
    selectActualOpex: 'Actual landlord OPEX',
    selectMarketOpex: 'Market-estimated OPEX',
    selectTenantConfirmed: 'Tenant-borne OPEX — confirmed',
    selectTenantAssumed: 'Tenant-borne OPEX — assumed',
    selectMarketValue: 'Market value',
    selectFairValue: 'Fair value',
    selectInvestmentValue: 'Investment value',
  }),
});

const ADVANCED_FIELDS = Object.freeze([
  'marketComparableInput',
  'costPolicy',
  'evidence',
  'criticalEvidenceRequirements',
  'reconciliationPolicy',
]);

function copyForLocale(locale) {
  return COPY[locale] || COPY.en;
}

function money(value, locale) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(locale === 'ar-SA' ? 'ar-SA' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function inputStyle() {
  return {
    background: COLORS.panelInput,
    border: `1px solid ${COLORS.hairline}`,
    color: COLORS.brassSoft,
    borderRadius: '0.6rem',
  };
}

function SectionTitle({ children }) {
  return <div className="text-[11px] font-semibold tracking-wide mb-2" style={{ color: COLORS.brass }}>{children}</div>;
}

function TextInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block">
      <div className="text-[11px] mb-1" style={{ color: COLORS.slate }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rf-input w-full px-3 py-2 text-xs"
        style={inputStyle()}
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, placeholder, options }) {
  return (
    <label className="block">
      <div className="text-[11px] mb-1" style={{ color: COLORS.slate }}>{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rf-input w-full px-3 py-2 text-xs"
        style={inputStyle()}
      >
        <option value="" style={{ background: COLORS.panel }}>{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} style={{ background: COLORS.panel }}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="text-xs" style={{ color: COLORS.parchment }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function setNestedDraft(setDraft, group, field, value) {
  setDraft((current) => ({
    ...current,
    [group]: {
      ...current[group],
      [field]: value,
    },
  }));
}

function MethodRow({ locale, method }) {
  const label = getValuationMethodLabel(locale, method.method);
  const state = getValuationStateLabel(locale, method.state);
  const reason = method.reasonCode ? getValuationReasonLabel(locale, method.reasonCode) : null;
  const value = money(method.indicationValue, locale);
  const stateColor = method.state === 'AVAILABLE'
    ? COLORS.positive
    : method.state === 'HOLD'
      ? COLORS.caution
      : COLORS.slateDim;

  return (
    <div className="rounded-xl px-3 py-3" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold" style={{ color: COLORS.parchment }}>{label}</div>
        <div className="text-[10px] font-semibold" style={{ color: stateColor }}>{state}</div>
      </div>
      {value ? <div className="rf-num text-sm mt-1" style={{ color: COLORS.brassSoft }}>{value}</div> : null}
      {reason ? <div className="text-[10px] leading-relaxed mt-1" style={{ color: COLORS.slate }}>{reason}</div> : null}
      {method.weakestEvidenceGrade ? (
        <div className="text-[10px] mt-1" style={{ color: COLORS.slateDim }}>{method.weakestEvidenceGrade}</div>
      ) : null}
    </div>
  );
}

export default function ValuationIntelligencePanel({
  locale = 'ar-SA',
  valuationCase = null,
  onChangeValuationCase,
  runtime = null,
  runtimeError = null,
}) {
  const text = copyForLocale(locale);
  const [expanded, setExpanded] = useState(Boolean(valuationCase));
  const [draft, setDraft] = useState(() => draftFromValuationCase(valuationCase));
  const [draftError, setDraftError] = useState(null);

  useEffect(() => {
    setDraft(draftFromValuationCase(valuationCase));
    setDraftError(null);
  }, [valuationCase]);

  const advancedFields = useMemo(
    () => ADVANCED_FIELDS.filter((field) => valuationCase && Object.prototype.hasOwnProperty.call(valuationCase, field)),
    [valuationCase],
  );

  const apply = () => {
    try {
      const next = buildValuationCaseFromDraft(draft);
      onChangeValuationCase(next);
      setDraftError(null);
      setExpanded(false);
    } catch (error) {
      setDraftError({
        reasonCode: error?.reasonCode || error?.name || 'INVALID_CONFIGURATION',
        field: error?.field || null,
      });
    }
  };

  const disable = () => {
    const accepted = typeof window === 'undefined' ? true : window.confirm(text.disableConfirm);
    if (!accepted) return;
    onChangeValuationCase(null);
    setDraft(emptyValuationCaseDraft());
    setDraftError(null);
    setExpanded(false);
  };

  const presentation = runtime?.presentation || null;
  const stage = runtime?.stage || null;
  const isLegacyOnly = !valuationCase || runtime?.mode === VALUATION_RUNTIME_MODE.LEGACY_ONLY;
  const finalValue = presentation ? money(presentation.finalValue, locale) : null;

  const assetOptions = [
    { value: ASSET_CLASS.OFFICE, label: text.selectOffice },
    { value: ASSET_CLASS.RETAIL, label: text.selectRetail },
    { value: ASSET_CLASS.RESIDENTIAL, label: text.selectResidential },
  ];
  const lifecycleOptions = [
    { value: LIFECYCLE_STAGE.EXISTING_OPERATING, label: text.selectExistingOperating },
    { value: LIFECYCLE_STAGE.STABILIZED, label: text.selectStabilized },
    { value: LIFECYCLE_STAGE.EXISTING_VACANT, label: text.selectExistingVacant },
    { value: LIFECYCLE_STAGE.RENOVATION, label: text.selectRenovation },
    { value: LIFECYCLE_STAGE.REDEVELOPMENT, label: text.selectRedevelopment },
  ];
  const strategyOptions = [
    { value: INVESTMENT_STRATEGY.ACQUIRE_HOLD, label: text.selectAcquireHold },
    { value: INVESTMENT_STRATEGY.CORE_INCOME, label: text.selectCoreIncome },
    { value: INVESTMENT_STRATEGY.VALUE_ADD, label: text.selectValueAdd },
    { value: INVESTMENT_STRATEGY.REFINANCE, label: text.selectRefinance },
    { value: INVESTMENT_STRATEGY.DISPOSAL, label: text.selectDisposal },
    { value: INVESTMENT_STRATEGY.SALE_LEASEBACK, label: text.selectSaleLeaseback },
  ];
  const incomeOptions = [{ value: INCOME_MODEL.LEASE_INCOME, label: text.selectLeaseIncome }];
  const expenseOptions = [
    { value: EXPENSE_TREATMENT.ACTUAL_LANDLORD_OPEX, label: text.selectActualOpex },
    { value: EXPENSE_TREATMENT.MARKET_ESTIMATE, label: text.selectMarketOpex },
    { value: EXPENSE_TREATMENT.TENANT_BORNE_CONFIRMED, label: text.selectTenantConfirmed },
    { value: EXPENSE_TREATMENT.TENANT_BORNE_ASSUMED, label: text.selectTenantAssumed },
  ];
  const basisOptions = [
    { value: BASIS_OF_VALUE.MARKET_VALUE, label: text.selectMarketValue },
    { value: BASIS_OF_VALUE.FAIR_VALUE, label: text.selectFairValue },
    { value: BASIS_OF_VALUE.INVESTMENT_VALUE, label: text.selectInvestmentValue },
  ];
  const methodOptions = [
    VALUATION_METHOD.MARKET_COMPARABLE,
    VALUATION_METHOD.INCOME_DIRECT_CAPITALIZATION,
    VALUATION_METHOD.COST_DEPRECIATED_REPLACEMENT,
  ].map((method) => ({ value: method, label: getValuationMethodLabel(locale, method) }));

  return (
    <section className="mt-6 rounded-2xl p-4 md:p-5" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5"><ShieldCheck size={18} style={{ color: COLORS.brass }} /></div>
          <div>
            <div className="rf-display text-sm font-bold" style={{ color: COLORS.parchment }}>{text.title}</div>
            <div className="text-[11px] leading-relaxed mt-1 max-w-3xl" style={{ color: COLORS.slate }}>{text.subtitle}</div>
          </div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{
          color: isLegacyOnly ? COLORS.slate : COLORS.brassSoft,
          border: `1px solid ${isLegacyOnly ? COLORS.hairline : COLORS.brassDim}`,
          background: COLORS.panelRaised,
        }}>
          {isLegacyOnly ? text.legacyOnlyBadge : text.valuationV1Badge}
        </span>
      </div>

      {runtimeError ? (
        <div className="mt-4 rounded-xl px-3 py-3 flex gap-2" style={{ border: `1px solid ${COLORS.negative}`, background: 'rgba(180,84,74,0.12)' }}>
          <XCircle size={16} style={{ color: COLORS.negative, flexShrink: 0 }} />
          <div>
            <div className="text-xs font-semibold" style={{ color: COLORS.negative }}>{text.runtimeError}</div>
            <div className="text-[10px] mt-1" style={{ color: COLORS.slate }}>{runtimeError.code || runtimeError.name || 'VALUATION_RUNTIME_ERROR'}</div>
          </div>
        </div>
      ) : null}

      {isLegacyOnly ? (
        <div className="mt-4 rounded-xl px-3 py-3" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
          <div className="text-xs font-semibold" style={{ color: COLORS.parchment }}>{text.legacyTitle}</div>
          <div className="text-[10px] leading-relaxed mt-1" style={{ color: COLORS.slate }}>{text.legacyBody}</div>
        </div>
      ) : presentation ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl px-3 py-3" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
              <div className="text-[10px] mb-1" style={{ color: COLORS.slateDim }}>{text.currentStatus}</div>
              <div className="text-xs font-semibold flex items-center gap-2" style={{ color: presentation.readyForDecisionControl ? COLORS.positive : COLORS.caution }}>
                {presentation.readyForDecisionControl ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {getValuationEngineStatusLabel(locale, presentation.engineStatus)}
              </div>
            </div>
            <div className="rounded-xl px-3 py-3" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
              <div className="text-[10px] mb-1" style={{ color: COLORS.slateDim }}>{text.finalValue}</div>
              <div className="rf-num text-sm font-semibold" style={{ color: finalValue ? COLORS.brassSoft : COLORS.slate }}>{finalValue || text.noFinalValue}</div>
            </div>
          </div>

          <div>
            <SectionTitle>{text.methods}</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {presentation.methods.map((method) => <MethodRow key={method.method} locale={locale} method={method} />)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl px-3 py-3" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
              <SectionTitle>{text.reasons}</SectionTitle>
              {presentation.reasonCodes.length === 0 ? (
                <div className="text-[10px]" style={{ color: COLORS.slateDim }}>{text.noReasons}</div>
              ) : (
                <ul className="space-y-1.5">
                  {presentation.reasonCodes.map((code) => (
                    <li key={code} className="text-[10px] leading-relaxed" style={{ color: COLORS.slate }}>{getValuationReasonLabel(locale, code)}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl px-3 py-3" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
              <SectionTitle>{text.evidenceGaps}</SectionTitle>
              {presentation.evidenceGaps.length === 0 ? (
                <div className="text-[10px]" style={{ color: COLORS.slateDim }}>{text.noGaps}</div>
              ) : (
                <ul className="space-y-1">
                  {presentation.evidenceGaps.map((gap) => <li key={gap} className="text-[10px] font-mono" style={{ color: COLORS.slate }}>{gap}</li>)}
                </ul>
              )}
            </div>
          </div>

          {presentation.singleMethodAcceptance ? (
            <div className="rounded-xl px-3 py-3" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.brassDim}` }}>
              <div className="text-xs font-semibold" style={{ color: COLORS.brassSoft }}>{text.singleMethodAccepted}</div>
              <div className="text-[10px] mt-1" style={{ color: COLORS.slate }}>{getValuationMethodLabel(locale, presentation.singleMethodAcceptance.method)}</div>
              <div className="text-[10px] mt-1 leading-relaxed" style={{ color: COLORS.slateDim }}>{text.singleMethodJustification}: {presentation.singleMethodAcceptance.justification}</div>
            </div>
          ) : null}

          <div className="text-[10px] leading-relaxed" style={{ color: COLORS.slateDim }}>{text.governanceNote}</div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5"
          style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.parchment }}
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? text.closeConfiguration : valuationCase ? text.editConfiguration : text.configure}
        </button>
        {valuationCase ? (
          <button
            type="button"
            onClick={disable}
            className="px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: 'transparent', border: `1px solid ${COLORS.negative}`, color: COLORS.negative }}
          >
            {text.disable}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.hairlineSoft}` }}>
          <div className="mb-4">
            <div className="rf-display text-sm font-semibold" style={{ color: COLORS.parchment }}>{text.configuration}</div>
            <div className="text-[10px] leading-relaxed mt-1" style={{ color: COLORS.slateDim }}>{text.configurationNote}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextInput
              label={text.projectId}
              value={draft.projectId}
              onChange={(value) => setDraft((current) => ({ ...current, projectId: value }))}
              placeholder={text.projectPlaceholder}
            />
            <SelectInput
              label={text.assetClass}
              value={draft.classification.assetClass}
              onChange={(value) => setNestedDraft(setDraft, 'classification', 'assetClass', value)}
              placeholder={text.requiredPlaceholder}
              options={assetOptions}
            />
            <SelectInput
              label={text.lifecycleStage}
              value={draft.classification.lifecycleStage}
              onChange={(value) => setNestedDraft(setDraft, 'classification', 'lifecycleStage', value)}
              placeholder={text.requiredPlaceholder}
              options={lifecycleOptions}
            />
            <SelectInput
              label={text.investmentStrategy}
              value={draft.classification.investmentStrategy}
              onChange={(value) => setNestedDraft(setDraft, 'classification', 'investmentStrategy', value)}
              placeholder={text.requiredPlaceholder}
              options={strategyOptions}
            />
            <SelectInput
              label={text.incomeModel}
              value={draft.classification.incomeModel}
              onChange={(value) => setNestedDraft(setDraft, 'classification', 'incomeModel', value)}
              placeholder={text.requiredPlaceholder}
              options={incomeOptions}
            />
            <SelectInput
              label={text.expenseTreatment}
              value={draft.incomePolicy.expenseTreatment}
              onChange={(value) => setNestedDraft(setDraft, 'incomePolicy', 'expenseTreatment', value)}
              placeholder={text.requiredPlaceholder}
              options={expenseOptions}
            />
            <SelectInput
              label={text.basis}
              value={draft.incomePolicy.basis}
              onChange={(value) => setNestedDraft(setDraft, 'incomePolicy', 'basis', value)}
              placeholder={text.requiredPlaceholder}
              options={basisOptions}
            />
            <TextInput
              label={text.currency}
              value={draft.incomePolicy.currency}
              onChange={(value) => setNestedDraft(setDraft, 'incomePolicy', 'currency', value.toUpperCase())}
              placeholder={text.currencyPlaceholder}
            />
            <TextInput
              label={text.valuationDate}
              value={draft.incomePolicy.valuationDate}
              onChange={(value) => setNestedDraft(setDraft, 'incomePolicy', 'valuationDate', value)}
              type="date"
            />
          </div>

          <div className="mt-4 rounded-xl px-3 py-2" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
            <ToggleRow
              label={text.evidencePolicy}
              checked={draft.evidencePolicy.enabled}
              onChange={(value) => setNestedDraft(setDraft, 'evidencePolicy', 'enabled', value)}
            />
            {draft.evidencePolicy.enabled ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-2">
                <TextInput label={text.minEvidenceCount} value={draft.evidencePolicy.minEvidenceCount} onChange={(value) => setNestedDraft(setDraft, 'evidencePolicy', 'minEvidenceCount', value)} />
                <TextInput label={text.maxAssumptionBurdenRatio} value={draft.evidencePolicy.maxAssumptionBurdenRatio} onChange={(value) => setNestedDraft(setDraft, 'evidencePolicy', 'maxAssumptionBurdenRatio', value)} />
                <TextInput label={text.maxLowGradeRatio} value={draft.evidencePolicy.maxLowGradeRatio} onChange={(value) => setNestedDraft(setDraft, 'evidencePolicy', 'maxLowGradeRatio', value)} />
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-xl px-3 py-2" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
            <ToggleRow
              label={text.singleMethodPolicy}
              checked={draft.singleMethodPolicy.enabled}
              onChange={(value) => setNestedDraft(setDraft, 'singleMethodPolicy', 'enabled', value)}
            />
            {draft.singleMethodPolicy.enabled ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                <SelectInput
                  label={text.allowedMethod}
                  value={draft.singleMethodPolicy.allowedMethod}
                  onChange={(value) => setNestedDraft(setDraft, 'singleMethodPolicy', 'allowedMethod', value)}
                  placeholder={text.requiredPlaceholder}
                  options={methodOptions}
                />
                <label className="block md:col-span-1">
                  <div className="text-[11px] mb-1" style={{ color: COLORS.slate }}>{text.justification}</div>
                  <textarea
                    value={draft.singleMethodPolicy.justification}
                    onChange={(event) => setNestedDraft(setDraft, 'singleMethodPolicy', 'justification', event.target.value)}
                    placeholder={text.justificationPlaceholder}
                    rows={3}
                    className="rf-input w-full px-3 py-2 text-xs"
                    style={inputStyle()}
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="mt-3 rounded-xl px-3 py-3" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairlineSoft}` }}>
            <div className="text-xs font-semibold" style={{ color: COLORS.parchment }}>{text.advancedPreserved}</div>
            {advancedFields.length > 0 ? (
              <>
                <div className="text-[10px] mt-1 leading-relaxed" style={{ color: COLORS.slate }}>{text.advancedPreservedNote}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {advancedFields.map((field) => <span key={field} className="text-[9px] px-2 py-1 rounded-full" style={{ border: `1px solid ${COLORS.hairline}`, color: COLORS.slate }}>{field}</span>)}
                </div>
              </>
            ) : (
              <div className="text-[10px] mt-1" style={{ color: COLORS.slateDim }}>{text.advancedNone}</div>
            )}
          </div>

          {draftError ? (
            <div className="mt-3 rounded-xl px-3 py-3 flex gap-2" style={{ border: `1px solid ${COLORS.negative}`, background: 'rgba(180,84,74,0.12)' }}>
              <XCircle size={15} style={{ color: COLORS.negative, flexShrink: 0 }} />
              <div className="text-[10px]" style={{ color: COLORS.negative }}>
                {text.configError}: {draftError.reasonCode}{draftError.field ? ` — ${draftError.field}` : ''}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={apply}
              className="px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: COLORS.brass, color: COLORS.ink }}
            >
              {text.applyConfiguration}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
