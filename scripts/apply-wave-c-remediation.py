from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise RuntimeError(f'anchor not found in {path}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def append_once(path, marker, block):
    text = read(path)
    if marker in text:
        return
    write(path, text.rstrip() + '\n\n' + block.rstrip() + '\n')


# -----------------------------------------------------------------------------
# C.1 — financial diagnostics, defensive validation, UI exposure, storage, a11y
# -----------------------------------------------------------------------------
write('src/engines/financial/irr-diagnostics.js', r'''\
'use strict';

const precision = require('./precision');

const IRR_RELIABILITY = Object.freeze({
  RELIABLE: 'RELIABLE',
  NOT_COMPUTABLE: 'NOT_COMPUTABLE',
  MULTIPLE_ROOT_RISK: 'MULTIPLE_ROOT_RISK',
  OUT_OF_SOLVER_RANGE: 'OUT_OF_SOLVER_RANGE',
});

function finiteNumbers(cashflows) {
  return Array.isArray(cashflows) && cashflows.length >= 2
    && cashflows.every((value) => Number.isFinite(value));
}

function countSignChanges(cashflows) {
  if (!Array.isArray(cashflows)) return 0;
  let changes = 0;
  let previousSign = 0;
  for (const value of cashflows) {
    if (!Number.isFinite(value) || value === 0) continue;
    const sign = value > 0 ? 1 : -1;
    if (previousSign !== 0 && sign !== previousSign) changes += 1;
    previousSign = sign;
  }
  return changes;
}

function computeMIRR(cashflows, { financeRate, reinvestRate } = {}) {
  if (!finiteNumbers(cashflows)) return NaN;
  const fRate = Number.isFinite(financeRate) ? financeRate : 0;
  const rRate = Number.isFinite(reinvestRate) ? reinvestRate : fRate;
  if (fRate <= -1 || rRate <= -1) return NaN;
  const n = cashflows.length - 1;
  if (n < 1) return NaN;

  let pvNegative = 0;
  let fvPositive = 0;
  for (let t = 0; t <= n; t += 1) {
    const flow = cashflows[t];
    if (flow < 0) pvNegative += flow / Math.pow(1 + fRate, t);
    else if (flow > 0) fvPositive += flow * Math.pow(1 + rRate, n - t);
  }
  if (pvNegative === 0 || fvPositive <= 0) return NaN;
  const ratio = fvPositive / -pvNegative;
  if (!Number.isFinite(ratio) || ratio <= 0) return NaN;
  return Math.pow(ratio, 1 / n) - 1;
}

function analyzeIRR(cashflows, { financeRate, reinvestRate } = {}) {
  const signChanges = countSignChanges(cashflows);
  const mirr = computeMIRR(cashflows, { financeRate, reinvestRate });

  if (!finiteNumbers(cashflows) || signChanges === 0) {
    return Object.freeze({
      schemaVersion: 1,
      irr: NaN,
      mirr: Number.isFinite(mirr) ? mirr : NaN,
      signChanges,
      multipleRootRisk: false,
      reliability: IRR_RELIABILITY.NOT_COMPUTABLE,
      presentationMetric: null,
      reasonCode: signChanges === 0 ? 'NO_SIGN_CHANGE_NO_IRR_EXISTS' : 'NON_FINITE_CASHFLOWS',
    });
  }

  let irr;
  try { irr = precision.preciseIRR(cashflows); } catch (_) { irr = NaN; }
  const multipleRootRisk = signChanges > 1;

  if (multipleRootRisk) {
    return Object.freeze({
      schemaVersion: 1,
      irr: Number.isFinite(irr) ? irr : NaN,
      mirr,
      signChanges,
      multipleRootRisk: true,
      reliability: IRR_RELIABILITY.MULTIPLE_ROOT_RISK,
      presentationMetric: Number.isFinite(mirr) ? 'MIRR' : null,
      reasonCode: 'NON_CONVENTIONAL_CASHFLOW_MULTIPLE_IRR_POSSIBLE',
    });
  }

  if (!Number.isFinite(irr)) {
    return Object.freeze({
      schemaVersion: 1,
      irr: NaN,
      mirr,
      signChanges,
      multipleRootRisk: false,
      reliability: IRR_RELIABILITY.OUT_OF_SOLVER_RANGE,
      presentationMetric: Number.isFinite(mirr) ? 'MIRR' : null,
      reasonCode: 'IRR_OUTSIDE_SOLVER_BRACKET',
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    irr,
    mirr,
    signChanges,
    multipleRootRisk: false,
    reliability: IRR_RELIABILITY.RELIABLE,
    presentationMetric: 'IRR',
    reasonCode: null,
  });
}

module.exports = { IRR_RELIABILITY, countSignChanges, computeMIRR, analyzeIRR };
''')

replace_once('src/engines/financial/index.js',
"const monthlyDebt = require('./monthly-debt');\nconst constructionDebt = require('./construction-debt');",
"const monthlyDebt = require('./monthly-debt');\nconst irrDiagnostics = require('./irr-diagnostics');\nconst constructionDebt = require('./construction-debt');")
replace_once('src/engines/financial/index.js',
"  precision,\n  ...monthlyDebt,",
"  precision,\n  ...irrDiagnostics,\n  ...monthlyDebt,")

replace_once('src/contracts/financial-result.js',
"  irr: { present: 'BOTH', type: 'number (may be NaN when no root exists)' },\n  npv: { present: 'BOTH', type: 'number' },",
"  irr: { present: 'BOTH', type: 'number (may be NaN when no root exists)' },\n  npv: { present: 'BOTH', type: 'number' },\n  irrDiagnostics: { present: 'BOTH', type: 'object (frozen IRR reliability verdict)' },\n  leveredIrrDiagnostics: { present: 'BOTH', type: 'object (frozen IRR reliability verdict)' },\n  irrReliability: { present: 'BOTH', type: 'RELIABLE | MULTIPLE_ROOT_RISK | OUT_OF_SOLVER_RANGE | NOT_COMPUTABLE' },\n  leveredIrrReliability: { present: 'BOTH', type: 'RELIABLE | MULTIPLE_ROOT_RISK | OUT_OF_SOLVER_RANGE | NOT_COMPUTABLE' },\n  irrMultipleRootRisk: { present: 'BOTH', type: 'boolean' },\n  irrSignChanges: { present: 'BOTH', type: 'number' },\n  mirr: { present: 'BOTH', type: 'number (may be NaN)' },\n  leveredMirr: { present: 'BOTH', type: 'number (may be NaN)' },")

for path, discount_expr in [
    ('src/engines/valuation/existing-building.js', 'inp.discountRate'),
    ('src/engines/valuation/land-development.js', 'inp.hurdleRate'),
]:
    text = read(path)
    text = text.replace(
        "const { computeNPV, computeIRR, amortizationSchedule } = require('../financial');",
        "const { computeNPV, computeIRR, amortizationSchedule, analyzeIRR } = require('../financial');",
        1,
    )
    text = text.replace(
        "const { tierVerdict } = require('../recommendation');",
        "const { tierVerdict } = require('../recommendation');\nconst { validateEngineInputs } = require('../../validation/numeric-safety');",
        1,
    )
    fn = 'calcExistingBuilding' if 'existing-building' in path else 'calcLandDevelopment'
    text = text.replace(f"function {fn}(inp) {{", f"function {fn}(inp) {{\n  validateEngineInputs(inp);", 1)
    npv_line = f"  const npv = computeNPV({discount_expr}, cashflows);"
    text = text.replace(npv_line, npv_line + f"\n  const irrDiagnostics = analyzeIRR(cashflows, {{ financeRate: {discount_expr}, reinvestRate: {discount_expr} }});", 1)
    text = text.replace(
        "  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);",
        "  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);\n  const leveredIrrDiagnostics = analyzeIRR(leveredCashflows, { financeRate: equityDiscountRate, reinvestRate: equityDiscountRate });",
        1,
    )
    text = text.replace(
        "    financialModelVersion: FINANCIAL_MODEL_VERSION,\n    financialModelStatus,",
        "    financialModelVersion: FINANCIAL_MODEL_VERSION,\n    financialModelStatus,\n    irrDiagnostics,\n    leveredIrrDiagnostics,\n    irrReliability: irrDiagnostics.reliability,\n    irrMultipleRootRisk: irrDiagnostics.multipleRootRisk,\n    irrSignChanges: irrDiagnostics.signChanges,\n    mirr: irrDiagnostics.mirr,\n    leveredMirr: leveredIrrDiagnostics.mirr,\n    leveredIrrReliability: leveredIrrDiagnostics.reliability,",
        1,
    )
    write(path, text)

numeric = read('src/validation/numeric-safety.js')
numeric = numeric.replace("""const PERCENTAGE_FIELDS_0_TO_1 = [
  'occupancyRate', 'ltv', 'loanRate', 'minYieldThreshold', 'discountRate', 'hurdleRate',
  'rentGrowthRate', 'vatRate', 'marketCapRate', 'exitCapRate', 'variableOpexRate',
  'managementFeeRate', 'insuranceRateOnReplacementCost', 'opexGrowthRate',
  'replacementCostGrowthRate',
];
""", """const PERCENTAGE_FIELDS_0_TO_1 = [
  'occupancyRate', 'ltv', 'loanRate', 'minYieldThreshold', 'discountRate', 'hurdleRate',
  'vatRate', 'marketCapRate', 'exitCapRate', 'variableOpexRate',
  'managementFeeRate', 'insuranceRateOnReplacementCost',
  'commissionRate', 'transferFeeRate', 'landCommissionRate', 'landTransferFeeRate',
  'exitTransferFeeRate', 'serviceIncomeRate', 'maintenanceRate', 'insuranceRate',
  'equityRiskSpread', 'buildableRatio', 'servicesRatioPerFloor', 'efficiencyRatio',
  'opexRate',
];

const GROWTH_RATE_FIELDS = ['rentGrowthRate', 'opexGrowthRate', 'replacementCostGrowthRate'];
const GROWTH_RATE_MIN = -0.5;
const GROWTH_RATE_MAX = 0.5;
const NON_NEGATIVE_FIELDS = [
  'fixedOpexPerSqm', 'replacementReservePerSqm', 'inspectionCost', 'valuationCost',
  'engineeringCost', 'landValuationCost',
];
const VALID_LEASE_STATUS = ['مؤجر', '3 أشهر', '6 أشهر', '9 أشهر', 'سنة'];
""", 1)
numeric = numeric.replace("""  if ('occupancyRate' in inputs) requireRange('occupancyRate', inputs.occupancyRate, 0, 1);
  if ('ltv' in inputs) requireRange('ltv', inputs.ltv, 0, 1);

  for (const field of [
    'commissionRate', 'transferFeeRate', 'landCommissionRate', 'landTransferFeeRate',
    'exitTransferFeeRate', 'serviceIncomeRate', 'maintenanceRate', 'insuranceRate',
    'variableOpexRate', 'managementFeeRate', 'insuranceRateOnReplacementCost',
  ]) {
    if (field in inputs) requireRange(field, inputs[field], 0, 1);
  }
""", """  for (const field of PERCENTAGE_FIELDS_0_TO_1) {
    if (field in inputs) requireRange(field, inputs[field], 0, 1);
  }

  for (const field of GROWTH_RATE_FIELDS) {
    if (field in inputs) requireRange(field, inputs[field], GROWTH_RATE_MIN, GROWTH_RATE_MAX);
  }

  for (const field of NON_NEGATIVE_FIELDS) {
    if (field in inputs && inputs[field] < 0) {
      throw new ValidationError(field, inputs[field], 'NON_NEGATIVE_REQUIRED',
        `قيمة حقل "${field}" (${inputs[field]}) يجب ألا تكون سالبة`,
        `Field "${field}" value ${inputs[field]} must not be negative`);
    }
  }

  if ('leaseStatus' in inputs && inputs.leaseStatus !== undefined && inputs.leaseStatus !== null
      && !VALID_LEASE_STATUS.includes(inputs.leaseStatus)) {
    throw new ValidationError('leaseStatus', inputs.leaseStatus, 'UNKNOWN_CONTROLLED_VALUE',
      'قيمة حالة الإيجار غير معروفة؛ لا يجوز افتراض عدم وجود شاغر ضمنياً',
      'Unknown leaseStatus value; a zero-vacancy assumption must never be inferred silently');
  }
""", 1)
numeric = numeric.replace(
"  PERCENTAGE_FIELDS_0_TO_1,\n  STRICTLY_POSITIVE_DIVISOR_FIELDS,",
"  PERCENTAGE_FIELDS_0_TO_1,\n  GROWTH_RATE_FIELDS,\n  NON_NEGATIVE_FIELDS,\n  VALID_LEASE_STATUS,\n  STRICTLY_POSITIVE_DIVISOR_FIELDS,",
1)
write('src/validation/numeric-safety.js', numeric)

storage = read('src/storage/browser-local-storage-provider.js')
storage = storage.replace("""async function set(key, value) {
  window.localStorage.setItem(NAMESPACE + key, value);
}
""", """class StorageQuotaExceededError extends Error {
  constructor(cause) {
    super('Browser storage quota exceeded');
    this.name = 'StorageQuotaExceededError';
    this.code = 'STORAGE_QUOTA_EXCEEDED';
    this.message_ar = 'امتلأت مساحة التخزين في المتصفح. صدِّر نسخة احتياطية من الصفقات ثم احذف صفقات قديمة قبل الحفظ مرة أخرى.';
    this.message_en = 'Browser storage is full. Export a backup of your deals and delete older deals before saving again.';
    this.cause = cause;
  }
}
function isQuotaError(error) {
  if (!error) return false;
  return error.name === 'QuotaExceededError'
    || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error.code === 22
    || error.code === 1014;
}
async function set(key, value) {
  try {
    window.localStorage.setItem(NAMESPACE + key, value);
  } catch (error) {
    if (isQuotaError(error)) throw new StorageQuotaExceededError(error);
    throw error;
  }
}
""", 1)
storage = storage.replace(
"module.exports = { isAvailable, get, set, delete: del, providerName, NAMESPACE };",
"module.exports = { isAvailable, get, set, delete: del, providerName, NAMESPACE, StorageQuotaExceededError, isQuotaError };",
1)
write('src/storage/browser-local-storage-provider.js', storage)

app = read('src/app/App.jsx')
app = app.replace("  maintenanceRate: 0.05, insuranceRate: 0.005,\n  marketCapRate: 0.07, discountRate: 0.08, holdPeriod: 5, rentGrowthRate: 0,",
"  maintenanceRate: 0.05, insuranceRate: 0.005,\n  managementFeeRate: 0, fixedOpexPerSqm: 0, replacementReservePerSqm: 0, opexGrowthRate: 0,\n  exitCapRate: 0.07,\n  marketCapRate: 0.07, discountRate: 0.08, holdPeriod: 5, rentGrowthRate: 0,", 1)
app = app.replace("        value={value}\n        onChange={(e) => {", "        value={value}\n        aria-invalid={warning ? \"true\" : undefined}\n        onChange={(e) => {", 1)
app = app.replace("        value={Number((value * 100).toFixed(4))}\n        onChange={(e) => {", "        value={Number((value * 100).toFixed(4))}\n        aria-invalid={warning ? \"true\" : undefined}\n        onChange={(e) => {", 1)
app = app.replace("""        <PercentField label={t("inputBuilding.maintenanceRate")} note={t("inputBuilding.maintenanceRateNote")} value={inputs.maintenanceRate} onChange={(v) => patch("maintenanceRate", v)} />
        <PercentField label={t("inputBuilding.insuranceRate")} note={t("inputBuilding.insuranceRateNote")} value={inputs.insuranceRate} onChange={(v) => patch("insuranceRate", v)} />
""", """        <PercentField label={t("inputBuilding.maintenanceRate")} note={t("inputBuilding.maintenanceRateNote")} value={inputs.maintenanceRate} onChange={(v) => patch("maintenanceRate", v)} />
        <PercentField label={t("inputBuilding.insuranceRate")} note={t("inputBuilding.insuranceRateNote")} value={inputs.insuranceRate} onChange={(v) => patch("insuranceRate", v)} />
        <PercentField label={t("inputBuilding.managementFeeRate")} note={t("inputBuilding.managementFeeRateNote")} value={inputs.managementFeeRate} onChange={(v) => patch("managementFeeRate", v)} warnAbove={0.10} />
        <NumField label={t("inputBuilding.fixedOpexPerSqm")} unit={t("inputBuilding.unitSarSqm")} note={t("inputBuilding.fixedOpexPerSqmNote")} value={inputs.fixedOpexPerSqm} onChange={(v) => patch("fixedOpexPerSqm", v)} min={0} />
        <NumField label={t("inputBuilding.replacementReservePerSqm")} unit={t("inputBuilding.unitSarSqm")} note={t("inputBuilding.replacementReservePerSqmNote")} value={inputs.replacementReservePerSqm} onChange={(v) => patch("replacementReservePerSqm", v)} min={0} />
        <PercentField label={t("inputBuilding.opexGrowthRate")} note={t("inputBuilding.opexGrowthRateNote")} value={inputs.opexGrowthRate} onChange={(v) => patch("opexGrowthRate", v)} warnAbove={0.10} />
""", 1)
app = app.replace(
"        <PercentField label={t(\"inputBuilding.marketCapRate\")} value={inputs.marketCapRate} onChange={(v) => patch(\"marketCapRate\", v)} warnBelow={0.04} warnAbove={0.12} />",
"        <PercentField label={t(\"inputBuilding.marketCapRate\")} value={inputs.marketCapRate} onChange={(v) => patch(\"marketCapRate\", v)} warnBelow={0.04} warnAbove={0.12} />\n        <PercentField label={t(\"inputBuilding.exitCapRate\")} note={t(\"inputBuilding.exitCapRateNote\")} value={inputs.exitCapRate} onChange={(v) => patch(\"exitCapRate\", v)} warnBelow={0.04} warnAbove={0.14} />",
1)
app = app.replace("function KPIChip({ label, value, icon: Icon, accent, sub }) {", "function KPIChip({ label, value, icon: Icon, accent, sub, warning }) {", 1)
app = app.replace("style={{ background: COLORS.panelRaised, border: `1px solid ${accent ? COLORS.brassDim : COLORS.hairline}` }}", "style={{ background: COLORS.panelRaised, border: `1px solid ${warning ? COLORS.caution : (accent ? COLORS.brassDim : COLORS.hairline)}` }}", 1)
app = app.replace("{Icon ? <Icon size={12} style={{ color: accent ? COLORS.brass : COLORS.slate }} /> : null}", "{Icon ? <Icon size={12} style={{ color: warning ? COLORS.caution : (accent ? COLORS.brass : COLORS.slate) }} /> : null}", 1)
app = app.replace("<div className=\"rf-num text-base font-bold\" style={{ color: accent ? COLORS.brass : COLORS.parchment }}>{value}</div>\n      {sub ? <div className=\"text-[10px] mt-0.5\" style={{ color: COLORS.slateDim }}>{sub}</div> : null}", "<div className=\"rf-num text-base font-bold\" style={{ color: warning ? COLORS.caution : (accent ? COLORS.brass : COLORS.parchment) }}>{value}</div>\n      {sub ? <div className=\"text-[10px] mt-0.5 flex items-center gap-1\" style={{ color: warning ? COLORS.caution : COLORS.slateDim }}>{warning ? <AlertTriangle size={10} /> : null}<span>{sub}</span></div> : null}", 1)
app = app.replace("""  const irrLabel = leverageEnabled ? t("kpi.irrLevered") : t("kpi.irrUnlevered");
  const irrValue = leverageEnabled ? r.leveredIRR : r.irr;
""", """  const irrReliability = leverageEnabled ? r.leveredIrrReliability : r.irrReliability;
  const irrIsUnreliable = irrReliability === "MULTIPLE_ROOT_RISK" || irrReliability === "OUT_OF_SOLVER_RANGE";
  const mirrValue = leverageEnabled ? r.leveredMirr : r.mirr;
  const rawIrrValue = leverageEnabled ? r.leveredIRR : r.irr;
  const irrLabel = irrIsUnreliable ? t("kpi.mirrLabel") : (leverageEnabled ? t("kpi.irrLevered") : t("kpi.irrUnlevered"));
  const irrValue = irrIsUnreliable ? mirrValue : rawIrrValue;
  const irrSub = irrIsUnreliable ? t("kpi.irrUnreliableNote") : (leverageEnabled ? t("kpi.unleveredSub", { value: fmtPct(r.irr) }) : undefined);
""", 1)
app = app.replace("      style={{ background: `${COLORS.panel}F2`, backdropFilter: \"blur(8px)\", border: `1px solid ${COLORS.hairline}` }}\n    >", "      style={{ background: `${COLORS.panel}F2`, backdropFilter: \"blur(8px)\", border: `1px solid ${COLORS.hairline}` }}\n      role=\"status\"\n      aria-live=\"polite\"\n      aria-atomic=\"false\"\n      aria-label={t(\"kpi.regionLabel\")}\n    >", 1)
app = app.replace("<KPIChip label={irrLabel} value={fmtPct(irrValue)} icon={TrendingUp} accent sub={leverageEnabled ? t(\"kpi.unleveredSub\", { value: fmtPct(r.irr) }) : undefined} />", "<KPIChip label={irrLabel} value={fmtPct(irrValue)} icon={TrendingUp} accent={!irrIsUnreliable} warning={irrIsUnreliable} sub={irrSub} />", 1)
insert_marker = "// ============================================================\n// SAVED DEALS PANEL (multi-deal persistence)"
app = app.replace(insert_marker, """function storageFailureMessage(error, fallback) {
  if (error && error.code === "STORAGE_QUOTA_EXCEEDED") {
    return { code: error.code, message_ar: error.message_ar, message_en: error.message_en };
  }
  return fallback;
}

""" + insert_marker, 1)
app = app.replace('setDealsError({ code: "DEAL_SAVE_FAILED", message_ar: "تعذّر الحفظ، حاول مرة أخرى", message_en: "Save failed, please try again" });', 'setDealsError(storageFailureMessage(e, { code: "DEAL_SAVE_FAILED", message_ar: "تعذّر الحفظ، حاول مرة أخرى", message_en: "Save failed, please try again" }));', 1)
app = app.replace('setDealsError({ code: "DEAL_UPDATE_FAILED", message_ar: "تعذّر تحديث الصفقة", message_en: "The deal could not be updated" });', 'setDealsError(storageFailureMessage(e, { code: "DEAL_UPDATE_FAILED", message_ar: "تعذّر تحديث الصفقة", message_en: "The deal could not be updated" }));', 1)
write('src/app/App.jsx', app)

for path, replacements in {
    'src/i18n/locales/ar-SA.js': [
        ('maintenanceRate: "إدارة وصيانة وتشغيل وأمن ونظافة", maintenanceRateNote: "نسبة من إجمالي الدخل السنوي",\n    insuranceRate: "التأمين على المبنى", insuranceRateNote: "نسبة من إجمالي الدخل السنوي",',
         'maintenanceRate: "إدارة وصيانة وتشغيل وأمن ونظافة", maintenanceRateNote: "نسبة من إجمالي الدخل السنوي (مصروف متغير)",\n    insuranceRate: "التأمين على المبنى", insuranceRateNote: "نسبة من قيمة الإحلال الإنشائية للمباني — وليست نسبة من الدخل (مصروف ثابت)",\n    managementFeeRate: "أتعاب إدارة الأملاك", managementFeeRateNote: "نسبة من إجمالي الإيراد التشغيلي. صفر = لا تُحتسب أتعاب إدارة",\n    fixedOpexPerSqm: "مصروف تشغيلي ثابت للمتر", fixedOpexPerSqmNote: "ريال/م² سنوياً من المساحة التأجيرية — لا يتغير مع الإشغال",\n    replacementReservePerSqm: "احتياطي الإحلال الرأسمالي", replacementReservePerSqmNote: "ريال/م² سنوياً. يُخصم بعد المصروفات التشغيلية للوصول إلى صافي دخل قابل للتوزيع",\n    opexGrowthRate: "معدل نمو المصروفات السنوي", opexGrowthRateNote: "يُطبّق على المصروف الثابت واحتياطي الإحلال",\n    exitCapRate: "معدل رسملة الخروج", exitCapRateNote: "يُستخدم لتقدير قيمة البيع. تركه مساوياً لمعدل الرسملة السوقي افتراض غير متحفظ",'),
        ('  kpi: {\n', '  kpi: {\n    regionLabel: "مؤشرات الأداء المحدَّثة",\n'),
        ('    unleveredSub: "غير مرفوع: {{value}}",\n', '    unleveredSub: "غير مرفوع: {{value}}",\n    mirrLabel: "معدل العائد المعدَّل (MIRR)",\n    irrUnreliableNote: "معدل العائد الداخلي غير فريد لهذه التدفقات؛ يُعرض MIRR بدلاً منه",\n'),
    ],
    'src/i18n/locales/en.js': [
        ('maintenanceRate: "Management, Maintenance, Operations, Security & Cleaning", maintenanceRateNote: "Percentage of total annual income",\n    insuranceRate: "Building Insurance", insuranceRateNote: "Percentage of total annual income",',
         'maintenanceRate: "Management, Maintenance, Operations, Security & Cleaning", maintenanceRateNote: "Percentage of total annual income (variable expense)",\n    insuranceRate: "Building Insurance", insuranceRateNote: "Percentage of building replacement construction value — NOT a percentage of income (fixed expense)",\n    managementFeeRate: "Property Management Fee", managementFeeRateNote: "Percentage of total operating revenue. Zero = no management fee charged",\n    fixedOpexPerSqm: "Fixed Operating Expense per Sqm", fixedOpexPerSqmNote: "SAR/sqm/year of net leasable area — does not vary with occupancy",\n    replacementReservePerSqm: "Capital Replacement Reserve", replacementReservePerSqmNote: "SAR/sqm/year. Deducted after operating expenses to reach distributable net income",\n    opexGrowthRate: "Annual Expense Growth Rate", opexGrowthRateNote: "Applied to fixed expense and replacement reserve",\n    exitCapRate: "Exit Capitalization Rate", exitCapRateNote: "Used to estimate sale value. Leaving it equal to the market cap rate is a non-conservative assumption",'),
        ('  kpi: {\n', '  kpi: {\n    regionLabel: "Updated key performance indicators",\n'),
        ('    unleveredSub: "Unlevered: {{value}}",\n', '    unleveredSub: "Unlevered: {{value}}",\n    mirrLabel: "Modified Rate of Return (MIRR)",\n    irrUnreliableNote: "IRR is not unique for these cash flows; MIRR is shown instead",\n'),
    ],
}.items():
    text = read(path)
    for old, new in replacements:
        if old not in text:
            raise RuntimeError(f'i18n anchor missing: {path}: {old[:60]}')
        text = text.replace(old, new, 1)
    write(path, text)

replace_once('tests/i18n/run_r5a_full_closure.js',
"check('DICT-PARITY', JSON.stringify(arKeys.sort())===JSON.stringify(enKeys.sort()) && arKeys.length===65, `ar=${arKeys.length} en=${enKeys.length}`);",
"check('DICT-PARITY', JSON.stringify(arKeys.sort())===JSON.stringify(enKeys.sort()) && arKeys.length===75, `ar=${arKeys.length} en=${enKeys.length}`);")
replace_once('tests/i18n/run_r6c_full_closure.js',
"check('PRODUCERS-5', producerCount === 5, `${producerCount} ValidationError throw sites found`);",
"check('PRODUCERS-7', producerCount === 7, `${producerCount} ValidationError throw sites found`);")

# -----------------------------------------------------------------------------
# C.2 — AI gateway guardrails, audit, rate limiting, data discipline
# -----------------------------------------------------------------------------
write('functions/api/riai/_guardrails.mjs', r'''\
const SNAPSHOT_TOKEN_PATTERN = /^[A-Za-z0-9_.:*+\-/]{1,200}$/;
const SNAPSHOT_LIMITS = Object.freeze({ maxBytes: 16384, maxDepth: 8, maxNodes: 2000, maxStringLength: 200 });

function fail(code, path = null) { return Object.freeze({ ok: false, code, path }); }

function enforceSnapshotDataDiscipline(snapshot, limits = SNAPSHOT_LIMITS) {
  let serialized;
  try { serialized = JSON.stringify(snapshot); } catch (_) { return fail('SNAPSHOT_NOT_SERIALIZABLE'); }
  if (typeof serialized !== 'string') return fail('SNAPSHOT_NOT_SERIALIZABLE');
  if (new TextEncoder().encode(serialized).length > limits.maxBytes) return fail('SNAPSHOT_EXCEEDS_DATA_BUDGET');
  let nodes = 0;
  const stack = [{ value: snapshot, depth: 0, path: '' }];
  while (stack.length) {
    const { value, depth, path } = stack.pop();
    nodes += 1;
    if (nodes > limits.maxNodes) return fail('SNAPSHOT_EXCEEDS_NODE_BUDGET', path);
    if (depth > limits.maxDepth) return fail('SNAPSHOT_EXCEEDS_DEPTH_BUDGET', path);
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return fail('SNAPSHOT_NON_FINITE_NUMBER', path);
      continue;
    }
    if (typeof value === 'string') {
      if (value.length > limits.maxStringLength) return fail('SNAPSHOT_STRING_TOO_LONG', path);
      if (!SNAPSHOT_TOKEN_PATTERN.test(value)) return fail('SNAPSHOT_FREE_TEXT_NOT_PERMITTED', path);
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => stack.push({ value: item, depth: depth + 1, path: `${path}[${index}]` }));
      continue;
    }
    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (!SNAPSHOT_TOKEN_PATTERN.test(key)) return fail('SNAPSHOT_KEY_NOT_PERMITTED', path ? `${path}.${key}` : key);
        stack.push({ value: child, depth: depth + 1, path: path ? `${path}.${key}` : key });
      }
      continue;
    }
    return fail('SNAPSHOT_UNSUPPORTED_VALUE_TYPE', path);
  }
  return Object.freeze({ ok: true, nodes, bytes: new TextEncoder().encode(serialized).length });
}

const RATE_LIMIT_DEFAULTS = Object.freeze({ perSubjectPerMinute: 6, perSubjectPerDay: 60, globalPerDay: 2000, ttlSeconds: 90000 });
function positiveInt(raw, fallback) { const value = Number(raw); return Number.isInteger(value) && value > 0 ? value : fallback; }
function resolveRateLimitConfig(env = {}) {
  return Object.freeze({
    perSubjectPerMinute: positiveInt(env.RIAI_AI_RATE_PER_MINUTE, RATE_LIMIT_DEFAULTS.perSubjectPerMinute),
    perSubjectPerDay: positiveInt(env.RIAI_AI_RATE_PER_DAY, RATE_LIMIT_DEFAULTS.perSubjectPerDay),
    globalPerDay: positiveInt(env.RIAI_AI_RATE_GLOBAL_PER_DAY, RATE_LIMIT_DEFAULTS.globalPerDay),
    ttlSeconds: positiveInt(env.RIAI_AI_RATE_TTL_SECONDS, RATE_LIMIT_DEFAULTS.ttlSeconds),
  });
}
function minuteBucket(now) { return Math.floor(now / 60000); }
function dayBucket(now) { return Math.floor(now / 86400000); }
async function readCounter(store, key) { const raw = await store.get(key); const value = Number(raw); return Number.isFinite(value) && value >= 0 ? value : 0; }

async function checkAndConsumeRateLimit({ store, subjectKey, now = Date.now(), config } = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') return Object.freeze({ allowed: false, code: 'AI_RATE_LIMIT_STORE_UNAVAILABLE', status: 503 });
  if (typeof subjectKey !== 'string' || !subjectKey) return Object.freeze({ allowed: false, code: 'AI_RATE_LIMIT_SUBJECT_MISSING', status: 401 });
  const limits = config || RATE_LIMIT_DEFAULTS;
  const minuteKey = `rl:min:${subjectKey}:${minuteBucket(now)}`;
  const dayKey = `rl:day:${subjectKey}:${dayBucket(now)}`;
  const globalKey = `rl:day:__global__:${dayBucket(now)}`;
  const [minuteCount, dayCount, globalCount] = await Promise.all([readCounter(store, minuteKey), readCounter(store, dayKey), readCounter(store, globalKey)]);
  if (minuteCount >= limits.perSubjectPerMinute) return Object.freeze({ allowed: false, code: 'AI_RATE_LIMIT_EXCEEDED_PER_MINUTE', status: 429, retryAfterSeconds: 60 - Math.floor((now % 60000) / 1000) });
  if (dayCount >= limits.perSubjectPerDay) return Object.freeze({ allowed: false, code: 'AI_RATE_LIMIT_EXCEEDED_PER_DAY', status: 429, retryAfterSeconds: 3600 });
  if (globalCount >= limits.globalPerDay) return Object.freeze({ allowed: false, code: 'AI_SPEND_BUDGET_EXHAUSTED', status: 429, retryAfterSeconds: 3600 });
  const options = { expirationTtl: limits.ttlSeconds };
  await Promise.all([
    store.put(minuteKey, String(minuteCount + 1), options),
    store.put(dayKey, String(dayCount + 1), options),
    store.put(globalKey, String(globalCount + 1), options),
  ]);
  return Object.freeze({ allowed: true, code: null, remainingThisMinute: limits.perSubjectPerMinute - minuteCount - 1, remainingToday: limits.perSubjectPerDay - dayCount - 1 });
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildAuditRecord({ subjectKey, subjectSalt, snapshot, model, outcome, reasonCode = null, tokenLimit = null, accessMode = null, latencyMs = null, resultSummary = null, now = Date.now() } = {}) {
  const subjectHash = await sha256Hex(`${subjectSalt || ''}:${subjectKey || ''}`);
  const snapshotHash = await sha256Hex(JSON.stringify(snapshot === undefined ? null : snapshot));
  const resultHash = resultSummary == null ? null : await sha256Hex(JSON.stringify(resultSummary));
  return Object.freeze({ schemaVersion: 1, recordType: 'RIAI_AI_ASSIST_INVOCATION', timestamp: new Date(now).toISOString(), subjectHash, snapshotHash, resultHash, model: model || null, accessMode, outcome, reasonCode, tokenLimit, latencyMs, payloadStored: false });
}

async function writeAuditRecord({ store, record, ttlSeconds = 34560000 } = {}) {
  if (!store || typeof store.put !== 'function') return Object.freeze({ written: false, code: 'AI_AUDIT_STORE_UNAVAILABLE' });
  const key = `audit:${record.timestamp}:${record.snapshotHash.slice(0, 12)}`;
  try { await store.put(key, JSON.stringify(record), { expirationTtl: ttlSeconds }); return Object.freeze({ written: true, key }); }
  catch (_) { return Object.freeze({ written: false, code: 'AI_AUDIT_WRITE_FAILED' }); }
}

export { SNAPSHOT_TOKEN_PATTERN, SNAPSHOT_LIMITS, enforceSnapshotDataDiscipline, RATE_LIMIT_DEFAULTS, resolveRateLimitConfig, checkAndConsumeRateLimit, sha256Hex, buildAuditRecord, writeAuditRecord };
''')

ai = read('functions/api/riai/ai-assist.js')
ai = "import { enforceSnapshotDataDiscipline, resolveRateLimitConfig, checkAndConsumeRateLimit, buildAuditRecord, writeAuditRecord } from './_guardrails.mjs';\n\n" + ai
ai = ai.replace("""const FORBIDDEN_DECISION_PATTERNS = [
  /\\b(buy|sell|approve|reject|invest|proceed|do not proceed)\\b/i,
  /(?<![\\p{L}\\p{N}_])(?:اشتر|اشتري|بع|بيع|وافق|ارفض|استثمر|نفذ الصفقة|لا تنفذ الصفقة)(?![\\p{L}\\p{N}_])/u,
];
""", """const FORBIDDEN_DECISION_PATTERNS = [
  /\\b(buy|sell|approve|reject|invest|proceed|do not proceed)\\b/i,
  /(?<![\\p{L}\\p{N}_])(?:اشتر|اشتري|بع|بيع|وافق|ارفض|استثمر|نفذ الصفقة|لا تنفذ الصفقة)(?![\\p{L}\\p{N}_])/u,
  /\\b(?:we recommend|recommendation is to|it is advisable to|favorable opportunity to)\\b[^.\\n]{0,60}\\b(?:buy|purchase|acquire|acquisition|invest|proceed)\\b/i,
  /(?<![\\p{L}\\p{N}_])(?:نوصي|نقترح|يوصى|يُنصح|الأنسب|من الأفضل)(?:\\s+\\S+){0,4}?\\s*(?:بالشراء|بالبيع|بالاستحواذ|بالتملك|بالاستثمار|بتنفيذ\\s+الصفقة|بالمضي\\s+في\\s+الصفقة|بإتمام\\s+الصفقة)/u,
  /(?<![\\p{L}\\p{N}_])(?:فرصة|الفرصة)(?:\\s+\\S+){0,4}?\\s*مواتية(?:\\s+\\S+){0,4}?\\s*(?:للشراء|للتملك|للاستحواذ|للاستثمار|للمضي\\s+في\\s+الصفقة)/u,
];
""", 1)
ai = ai.replace('function json(body, status = 200) {', 'function json(body, status = 200, extraHeaders) {', 1)
ai = ai.replace("      'referrer-policy': 'no-referrer',\n", "      'referrer-policy': 'no-referrer',\n      ...(extraHeaders || {}),\n", 1)
helper_anchor = "function trimText(value, max = MAX_TEXT) {"
helpers = r'''async function recordAudit(context, { access, snapshot, outcome, reasonCode = null, model = null, resultSummary = null, startedAt }) {
  try {
    const store = context.env && context.env.RIAI_AUDIT_KV;
    if (!store) return { written: false, code: 'AI_AUDIT_STORE_UNAVAILABLE' };
    const record = await buildAuditRecord({
      subjectKey: (access && access.subject) || 'UNKNOWN',
      subjectSalt: (context.env && context.env.RIAI_AUDIT_SUBJECT_SALT) || '',
      snapshot,
      model,
      outcome,
      reasonCode,
      accessMode: access && access.mode,
      latencyMs: Number.isFinite(startedAt) ? Date.now() - startedAt : null,
      resultSummary,
    });
    return await writeAuditRecord({ store, record });
  } catch (_) {
    return { written: false, code: 'AI_AUDIT_UNEXPECTED_FAILURE' };
  }
}

function summarizeSeverity(result) {
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const bucket of ['riskFlags']) {
    for (const item of (result && Array.isArray(result[bucket]) ? result[bucket] : [])) {
      if (item && ALLOWED_SEVERITY.has(item.severity)) counts[item.severity] += 1;
    }
  }
  return counts;
}

'''
ai = ai.replace(helper_anchor, helpers + helper_anchor, 1)
ai = ai.replace("if (localDevelopment) return { ok: true, mode: 'LOCAL_DEVELOPMENT' };", "if (localDevelopment) return { ok: true, mode: 'LOCAL_DEVELOPMENT', subject: 'LOCAL_DEVELOPMENT' };", 1)
ai = ai.replace("return { ok: true, mode: 'CLOUDFLARE_ACCESS', subjectPresent: Boolean(payload.sub) };", "return { ok: true, mode: 'CLOUDFLARE_ACCESS', subjectPresent: Boolean(payload.sub), subject: trimText(payload.sub, 256) || trimText(payload.email, 256) || null };", 1)
start = ai.index('export async function onRequestPost(context) {')
end = ai.index('\nexport async function onRequest(context) {', start)
new_handler = r'''export async function onRequestPost(context) {
  const request = context.request;
  const startedAt = Date.now();
  const access = await verifyCloudflareAccess(request, context.env || {});
  if (!access.ok) return json({ ok: false, code: access.code, aiModelUsed: false }, access.status);

  const rateLimitResult = await checkAndConsumeRateLimit({
    store: context.env && context.env.RIAI_RATE_LIMIT_KV,
    subjectKey: access.subject,
    config: resolveRateLimitConfig(context.env || {}),
  });
  if (!rateLimitResult.allowed) {
    await recordAudit(context, { access, snapshot: null, outcome: 'RATE_LIMITED', reasonCode: rateLimitResult.code, startedAt });
    const headers = rateLimitResult.retryAfterSeconds ? { 'retry-after': String(rateLimitResult.retryAfterSeconds) } : undefined;
    return json({ ok: false, code: rateLimitResult.code, aiModelUsed: false }, rateLimitResult.status, headers);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return json({ ok: false, code: 'JSON_CONTENT_TYPE_REQUIRED' }, 415);
  const lengthHeader = Number(request.headers.get('content-length'));
  if (Number.isFinite(lengthHeader) && lengthHeader > MAX_REQUEST_BYTES) return json({ ok: false, code: 'REQUEST_TOO_LARGE' }, 413);

  let text;
  try { text = await request.text(); } catch (_) { return json({ ok: false, code: 'REQUEST_READ_FAILED' }, 400); }
  if (new TextEncoder().encode(text).length > MAX_REQUEST_BYTES) return json({ ok: false, code: 'REQUEST_TOO_LARGE' }, 413);

  let body;
  try { body = JSON.parse(text); } catch (_) { return json({ ok: false, code: 'INVALID_JSON' }, 400); }
  const snapshotError = validateSnapshot(body && body.decisionSnapshot);
  if (snapshotError) {
    await recordAudit(context, { access, snapshot: body && body.decisionSnapshot, outcome: 'REJECTED', reasonCode: snapshotError, startedAt });
    return json({ ok: false, code: snapshotError }, 400);
  }
  const disciplineResult = enforceSnapshotDataDiscipline(body.decisionSnapshot);
  if (!disciplineResult.ok) {
    await recordAudit(context, { access, snapshot: body.decisionSnapshot, outcome: 'REJECTED', reasonCode: disciplineResult.code, startedAt });
    return json({ ok: false, code: disciplineResult.code }, 400);
  }

  const provider = allowedProviderUrl(context.env || {});
  if (provider.error) return json({ ok: false, code: provider.error, aiModelUsed: false }, 503);
  const apiKey = trimText(context.env.RIAI_AI_PROVIDER_KEY, 4096);
  const model = trimText(context.env.RIAI_AI_MODEL, 200);
  if (!apiKey || !model) return json({ ok: false, code: 'AI_PROVIDER_NOT_CONFIGURED', aiModelUsed: false }, 503);
  const outputBudget = providerOutputBudget(context.env || {});
  if (outputBudget.error) return json({ ok: false, code: outputBudget.error, aiModelUsed: false }, 503);

  const providerRequest = {
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: JSON.stringify(body.decisionSnapshot) },
    ],
  };
  providerRequest[outputBudget.field] = outputBudget.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let providerResponse;
  try {
    providerResponse = await fetch(provider.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(providerRequest),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const code = error && error.name === 'AbortError' ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNREACHABLE';
    await recordAudit(context, { access, snapshot: body.decisionSnapshot, outcome: 'PROVIDER_FAILED', reasonCode: code, model, startedAt });
    return json({ ok: false, code, aiModelUsed: false }, 502);
  }
  clearTimeout(timer);

  if (!providerResponse.ok) {
    await recordAudit(context, { access, snapshot: body.decisionSnapshot, outcome: 'PROVIDER_FAILED', reasonCode: 'AI_PROVIDER_REJECTED_REQUEST', model, startedAt });
    return json({ ok: false, code: 'AI_PROVIDER_REJECTED_REQUEST', providerStatus: providerResponse.status, aiModelUsed: false }, 502);
  }
  const providerText = await providerResponse.text();
  if (new TextEncoder().encode(providerText).length > MAX_PROVIDER_BYTES) {
    await recordAudit(context, { access, snapshot: body.decisionSnapshot, outcome: 'PROVIDER_FAILED', reasonCode: 'AI_PROVIDER_RESPONSE_TOO_LARGE', model, startedAt });
    return json({ ok: false, code: 'AI_PROVIDER_RESPONSE_TOO_LARGE', aiModelUsed: false }, 502);
  }
  let providerPayload;
  try { providerPayload = JSON.parse(providerText); } catch (_) {
    await recordAudit(context, { access, snapshot: body.decisionSnapshot, outcome: 'PROVIDER_FAILED', reasonCode: 'AI_PROVIDER_RESPONSE_INVALID_JSON', model, startedAt });
    return json({ ok: false, code: 'AI_PROVIDER_RESPONSE_INVALID_JSON', aiModelUsed: false }, 502);
  }
  const extracted = extractProviderJson(providerPayload);
  if (extracted.error) {
    await recordAudit(context, { access, snapshot: body.decisionSnapshot, outcome: 'PROVIDER_FAILED', reasonCode: extracted.error, model, startedAt });
    return json({ ok: false, code: extracted.error, aiModelUsed: false }, 502);
  }
  const sanitized = sanitizeProviderOutput(extracted.value);
  if (sanitized.error) {
    await recordAudit(context, { access, snapshot: body.decisionSnapshot, outcome: 'OUTPUT_REJECTED', reasonCode: sanitized.error, model, startedAt });
    return json({ ok: false, code: sanitized.error, aiModelUsed: false }, 502);
  }

  await recordAudit(context, {
    access,
    snapshot: body.decisionSnapshot,
    outcome: 'SUCCESS',
    model,
    startedAt,
    resultSummary: { severityCounts: summarizeSeverity(sanitized.value) },
  });

  return json({
    ok: true,
    schemaVersion: 1,
    aiModelUsed: true,
    model,
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    deterministicScoreRemainsAuthoritative: true,
    accessMode: access.mode,
    outputTokenLimit: outputBudget.value,
    result: sanitized.value,
  });
}
'''
ai = ai[:start] + new_handler + ai[end:]
write('functions/api/riai/ai-assist.js', ai)

append_once('RIAI_AI_GATEWAY_V1.md', '## Wave C application-level guardrails', r'''## Wave C application-level guardrails

Wave C adds a fail-closed KV-backed rate limiter before provider invocation, an independent server-side token-shape privacy discipline over the decision snapshot, and a best-effort hash-only audit trail.

Required Cloudflare bindings/secrets before production AI activation:
- `RIAI_RATE_LIMIT_KV` — required; missing binding returns `503 AI_RATE_LIMIT_STORE_UNAVAILABLE`.
- `RIAI_AUDIT_KV` — recommended; audit is best-effort and does not block the user response.
- `RIAI_AUDIT_SUBJECT_SALT` — set as a real secret in production.
- Optional limits: `RIAI_AI_RATE_PER_MINUTE` (default 6), `RIAI_AI_RATE_PER_DAY` (default 60), `RIAI_AI_RATE_GLOBAL_PER_DAY` (default 2000).

Workers KV counters are eventually consistent and are a spend guard, not a strict security boundary. Keep account-level Cloudflare WAF/rate limiting in front of this endpoint; use a Durable Object if atomic counting becomes mandatory.
''')

# -----------------------------------------------------------------------------
# Tests: focused runtime checks added to canonical test discovery
# -----------------------------------------------------------------------------
write('tests/architecture/run_wave_c_remediation_v1.js', r'''\
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { analyzeIRR, IRR_RELIABILITY } = require('../../src/engines/financial');
const { calcExistingBuilding } = require('../../src/engines/valuation/existing-building');
const ar = require('../../src/i18n/locales/ar-SA');
const en = require('../../src/i18n/locales/en');

let checks = 0;
function ok(condition, message) { checks += 1; assert.ok(condition, message); }
const diag = analyzeIRR([-100, 300, -250, 80], { financeRate: 0.08, reinvestRate: 0.08 });
ok(diag.reliability === IRR_RELIABILITY.MULTIPLE_ROOT_RISK, 'multiple-root risk must be disclosed');
ok(diag.presentationMetric === 'MIRR' && Number.isFinite(diag.mirr), 'MIRR fallback must be calculable');
ok(analyzeIRR([-100, 150]).reliability === IRR_RELIABILITY.RELIABLE, 'conventional IRR remains reliable');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'characterization', 'fixtures', 'RE-GOLD-002-U.json'), 'utf8')).input_set;
for (const override of [{ occupancyRate: 5 }, { rentGrowthRate: 2 }, { loanRate: -0.05 }, { managementFeeRate: 1.5 }, { fixedOpexPerSqm: -10 }]) {
  let blocked = false;
  try { calcExistingBuilding({ ...fixture, ...override }); } catch (error) { blocked = error && error.name === 'ValidationError'; }
  ok(blocked, `invalid input must fail closed: ${JSON.stringify(override)}`);
}
ok(ar.inputBuilding.managementFeeRate && en.inputBuilding.managementFeeRate, 'expense model fields must be translated');
ok(ar.inputBuilding.insuranceRateNote.includes('الإحلال'), 'Arabic insurance base must disclose replacement value');
const app = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'App.jsx'), 'utf8');
ok(app.includes('aria-live="polite"') && app.includes('aria-invalid={warning'), 'a11y live/invalid state must be wired');
ok(app.includes('irrIsUnreliable') && app.includes('mirrValue'), 'KPI ribbon must consume IRR reliability');
ok(app.includes('storageFailureMessage'), 'quota-specific save error must be routed');
console.log(`WAVE_C_CHECKS=${checks} FAILED=0`);
''')

write('tests/architecture/run_riai_ai_gateway_guardrails_unit_v1.js', r'''\
'use strict';
const assert = require('assert');
const path = require('path');
class FakeKV { constructor(){ this.map=new Map(); } async get(k){ return this.map.get(k) ?? null; } async put(k,v){ this.map.set(k,v); } }
(async () => {
  const g = await import(path.join(__dirname, '..', '..', 'functions/api/riai/_guardrails.mjs'));
  const valid = { schemaVersion:1, capability:'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST', governance:{ rawOperatingCaseIncluded:false, tenantNamesIncluded:false, evidenceDocumentTextIncluded:false, automaticInvestmentRecommendationAllowed:false, legalConclusionAllowed:false, transactionAuthorizationAllowed:false } };
  assert.equal(g.enforceSnapshotDataDiscipline(valid).ok, true);
  const spoof = JSON.parse(JSON.stringify(valid)); spoof.note = 'Tenant: Ahmed Al-Otaibi';
  assert.equal(g.enforceSnapshotDataDiscipline(spoof).code, 'SNAPSHOT_FREE_TEXT_NOT_PERMITTED');
  const noKv = await g.checkAndConsumeRateLimit({ store:null, subjectKey:'u' });
  assert.equal(noKv.code, 'AI_RATE_LIMIT_STORE_UNAVAILABLE');
  const kv = new FakeKV(); const cfg={perSubjectPerMinute:2,perSubjectPerDay:10,globalPerDay:100,ttlSeconds:90000}; const now=Date.now();
  assert.equal((await g.checkAndConsumeRateLimit({store:kv,subjectKey:'u',now,config:cfg})).allowed,true);
  assert.equal((await g.checkAndConsumeRateLimit({store:kv,subjectKey:'u',now,config:cfg})).allowed,true);
  assert.equal((await g.checkAndConsumeRateLimit({store:kv,subjectKey:'u',now,config:cfg})).code,'AI_RATE_LIMIT_EXCEEDED_PER_MINUTE');
  const record = await g.buildAuditRecord({subjectKey:'user-1',subjectSalt:'pepper',snapshot:valid,outcome:'SUCCESS'});
  assert.equal(record.payloadStored,false); assert.ok(!JSON.stringify(record).includes('user-1')); assert.match(record.subjectHash,/^[0-9a-f]{64}$/);
  console.log('RIAI_GUARDRAILS_UNIT=PASS');
})().catch((e)=>{ console.error(e); process.exit(1); });
''')

write('tests/architecture/run_riai_ai_gateway_integration_v1.js', r'''\
'use strict';
const assert = require('assert');
const path = require('path');
class FakeKV { constructor(){ this.map=new Map(); } async get(k){ return this.map.get(k) ?? null; } async put(k,v){ this.map.set(k,v); } }
const SNAPSHOT={schemaVersion:1,capability:'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST',asOfDate:'2026-09-03',readinessStatus:'NEEDS_DUE_DILIGENCE',readiness:{blockers:[{code:'TITLE_EVIDENCE_REQUIRED',field:'propertyInterest.title'}]},acquisitionScore:{status:'CALCULATED_WITH_GAPS',redFlags:[{code:'PRICE_HIGH',severity:'HIGH'}]},governance:{rawOperatingCaseIncluded:false,tenantNamesIncluded:false,evidenceDocumentTextIncluded:false,automaticInvestmentRecommendationAllowed:false,legalConclusionAllowed:false,transactionAuthorizationAllowed:false}};
function env(overrides={}){return{RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED:'true',RIAI_AI_PROVIDER_URL:'https://api.example-provider.com/v1/chat/completions',RIAI_AI_ALLOWED_HOSTS:'api.example-provider.com',RIAI_AI_PROVIDER_KEY:'test-key',RIAI_AI_MODEL:'test-model',RIAI_RATE_LIMIT_KV:new FakeKV(),RIAI_AUDIT_KV:new FakeKV(),RIAI_AUDIT_SUBJECT_SALT:'salt',...overrides};}
function req(snapshot){return new Request('http://localhost/api/riai/ai-assist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decisionSnapshot:snapshot})});}
function provider(boundary='This output is advisory analysis only and does not constitute an investment or legal recommendation.'){return{choices:[{message:{content:JSON.stringify({executiveObservations:['NOI_WITHIN_RANGE'],riskFlags:[{code:'LEASE_RISK',severity:'MEDIUM',rationale:'CONCENTRATION_RISK'}],evidenceGaps:['MARKET_RENT_MISSING'],dueDiligenceQuestions:['CONFIRM_TITLE'],scenarioChecks:['STRESS_TEST'],earlyWarningIndicators:[{indicator:'DSCR_DECLINING',whyItMatters:'COVERAGE_NARROWING'}],decisionBoundary:boundary})}}]};}
(async()=>{
 const {onRequestPost}=await import(path.join(__dirname,'..','..','functions/api/riai/ai-assist.js'));
 let called=false; global.fetch=async()=>{called=true;return new Response(JSON.stringify(provider()),{status:200});};
 let r=await onRequestPost({request:req(SNAPSHOT),env:env({RIAI_RATE_LIMIT_KV:undefined})}); assert.equal(r.status,503); assert.equal(called,false);
 const e=env(); r=await onRequestPost({request:req(SNAPSHOT),env:e}); const b=await r.json(); assert.equal(r.status,200); assert.equal(b.ok,true); assert.equal(e.RIAI_AUDIT_KV.map.size,1);
 const spoof=JSON.parse(JSON.stringify(SNAPSHOT)); spoof.readiness.blockers[0].field='Tenant: Ahmed Al-Otaibi, Unit 14B'; called=false; r=await onRequestPost({request:req(spoof),env:env()}); const sb=await r.json(); assert.equal(r.status,400); assert.equal(sb.code,'SNAPSHOT_FREE_TEXT_NOT_PERMITTED'); assert.equal(called,false);
 console.log('RIAI_GATEWAY_INTEGRATION=PASS');
})().catch((e)=>{console.error(e);process.exit(1);});
''')

write('tests/architecture/run_riai_decision_language_paraphrase_v1.js', r'''\
'use strict';
const assert=require('assert'); const path=require('path');
class FakeKV{constructor(){this.map=new Map();}async get(k){return this.map.get(k)??null;}async put(k,v){this.map.set(k,v);}}
const SNAPSHOT={schemaVersion:1,capability:'RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST',asOfDate:'2026-09-03',readinessStatus:'OK',governance:{rawOperatingCaseIncluded:false,tenantNamesIncluded:false,evidenceDocumentTextIncluded:false,automaticInvestmentRecommendationAllowed:false,legalConclusionAllowed:false,transactionAuthorizationAllowed:false}};
function env(){return{RIAI_AI_ALLOW_LOCAL_UNAUTHENTICATED:'true',RIAI_AI_PROVIDER_URL:'https://api.example-provider.com/v1/chat/completions',RIAI_AI_ALLOWED_HOSTS:'api.example-provider.com',RIAI_AI_PROVIDER_KEY:'x',RIAI_AI_MODEL:'m',RIAI_RATE_LIMIT_KV:new FakeKV(),RIAI_AUDIT_KV:new FakeKV()};}
function req(){return new Request('http://localhost/api/riai/ai-assist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decisionSnapshot:SNAPSHOT})});}
function body(boundary){return{choices:[{message:{content:JSON.stringify({executiveObservations:['OK'],riskFlags:[],evidenceGaps:[],dueDiligenceQuestions:[],scenarioChecks:[],earlyWarningIndicators:[],decisionBoundary:boundary})}}]};}
(async()=>{const {onRequestPost}=await import(path.join(__dirname,'..','..','functions/api/riai/ai-assist.js'));
 const cases=[['نوصي بالاستحواذ على العقار.',true],['الفرصة الحالية مواتية للتملك.',true],['Based on the analysis, we recommend proceeding with the acquisition promptly.',true],['نوصي بمراجعة سجل الملكية والتحقق من الرهون قبل أي إجراء.',false],['This output is advisory analysis only and does not constitute an investment or legal recommendation.',false]];
 for(const [text,block] of cases){global.fetch=async()=>new Response(JSON.stringify(body(text)),{status:200}); const r=await onRequestPost({request:req(),env:env()}); const b=await r.json(); const got=r.status===502&&b.code==='AUTOMATIC_DECISION_LANGUAGE_PROHIBITED'; assert.equal(got,block,text);}
 console.log('RIAI_DECISION_LANGUAGE_PARAPHRASE=PASS');
})().catch((e)=>{console.error(e);process.exit(1);});
''')

# Marker for idempotent workflow gate
write('WAVE_C_APPLIED', 'C.1+C.2+C.3 remediation applied by scripts/apply-wave-c-remediation.py\n')
print('WAVE_C_REMEDIATION_APPLICATOR=PASS')
