#!/usr/bin/env python3
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel, text):
    (ROOT / rel).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# 1) Canonical input-integrity boundary
# -----------------------------------------------------------------------------
path = "src/validation/numeric-safety.js"
s = read(path)
s = replace_once(
    s,
    "  'managementFeeRate', 'insuranceRateOnReplacementCost',\n",
    "  'managementFeeRate', 'insuranceRateOnReplacementCost', 'maintenanceRate', 'insuranceRate',\n",
    "percentage aliases",
)
s = replace_once(
    s,
    "const NON_NEGATIVE_FIELDS = [\n  'fixedOpexPerSqm', 'replacementReservePerSqm', 'inspectionCost', 'valuationCost',\n  'engineeringCost', 'landValuationCost',\n];",
    "const NON_NEGATIVE_FIELDS = [\n  'fixedOpexPerSqm', 'replacementReservePerSqm', 'inspectionCost', 'valuationCost',\n  'engineeringCost', 'landValuationCost', 'buildingAge', 'basementCount',\n  'basementAreaEach', 'netLeasableOverride', 'serviceElevators',\n  'basementConstructionCostPerSqm', 'floorConstructionCostPerSqm',\n  'currentLandPricePerSqm', 'marketRentPerSqm', 'rentPerSqm',\n  'basementFloorCount', 'leaseUpMonths',\n];",
    "non-negative economic fields",
)
s = replace_once(
    s,
    "const STRICTLY_POSITIVE_DIVISOR_FIELDS = [\n  'maxPaybackThreshold',\n  'buildingPrice',\n  'marketCapRate',\n  'exitCapRate',\n];",
    "const STRICTLY_POSITIVE_DIVISOR_FIELDS = [\n  'maxPaybackThreshold',\n  'buildingPrice',\n  'marketCapRate',\n  'exitCapRate',\n  'landLength',\n  'landWidth',\n  'parkingAreaPerSpot',\n  'floorCount',\n  'floorAreaEach',\n  'holdPeriod',\n  'buildingUsefulLife',\n  'landPricePerSqm',\n  'officeFloorCount',\n  'constructionCostPerSqm',\n  'constructionPeriod',\n  'operatingPeriod',\n  'loanTenor',\n  'minDscrThreshold',\n];\n\nconst INTEGER_PERIOD_OR_COUNT_FIELDS = [\n  'basementCount', 'floorCount', 'serviceElevators', 'officeFloorCount',\n  'basementFloorCount', 'constructionPeriod', 'operatingPeriod', 'holdPeriod',\n  'buildingUsefulLife', 'leaseYears', 'gracePeriodMonths',\n];",
    "strict positive and integer fields",
)
anchor = """  for (const field of STRICTLY_POSITIVE_DIVISOR_FIELDS) {
    if (field in inputs && inputs[field] <= 0) {
      throw new ValidationError(field, inputs[field], 'STRICTLY_POSITIVE_REQUIRED',
        `قيمة حقل \"${field}\" (${inputs[field]}) يجب أن تكون أكبر من صفر`,
        `Field \"${field}\" value ${inputs[field]} must be strictly positive (it is used as a divisor)`);
    }
  }

  if ('leaseUpMonths' in inputs && inputs.leaseUpMonths < 0) {
"""
replacement = """  for (const field of STRICTLY_POSITIVE_DIVISOR_FIELDS) {
    if (field in inputs && inputs[field] <= 0) {
      throw new ValidationError(field, inputs[field], 'STRICTLY_POSITIVE_REQUIRED',
        `قيمة حقل \"${field}\" (${inputs[field]}) يجب أن تكون أكبر من صفر`,
        `Field \"${field}\" value ${inputs[field]} must be strictly positive`);
    }
  }

  for (const field of INTEGER_PERIOD_OR_COUNT_FIELDS) {
    if (field in inputs && !Number.isInteger(inputs[field])) {
      throw new ValidationError(field, inputs[field], 'INTEGER_REQUIRED',
        `قيمة حقل \"${field}\" (${inputs[field]}) يجب أن تكون عدداً صحيحاً`,
        `Field \"${field}\" value ${inputs[field]} must be an integer`);
    }
  }

  if ('leverageEnabled' in inputs && typeof inputs.leverageEnabled !== 'boolean') {
    throw new ValidationError('leverageEnabled', inputs.leverageEnabled, 'BOOLEAN_REQUIRED',
      'حقل تفعيل التمويل يجب أن يكون قيمة منطقية صحيحة',
      'leverageEnabled must be a boolean');
  }

  if ('servicesRatioPerFloor' in inputs && inputs.servicesRatioPerFloor >= 1) {
    throw new ValidationError('servicesRatioPerFloor', inputs.servicesRatioPerFloor, 'STRICTLY_LESS_THAN_ONE_REQUIRED',
      'نسبة الخدمات لكل دور يجب أن تكون أقل من 100٪ حتى تبقى مساحة تأجيرية موجبة',
      'servicesRatioPerFloor must be below 1 so net leasable area remains positive');
  }

  if ('efficiencyRatio' in inputs) {
    const hasPositiveOverride = Number.isFinite(inputs.netLeasableOverride) && inputs.netLeasableOverride > 0;
    if (!hasPositiveOverride && inputs.efficiencyRatio <= 0) {
      throw new ValidationError('efficiencyRatio', inputs.efficiencyRatio, 'STRICTLY_POSITIVE_REQUIRED',
        'نسبة الكفاءة التأجيرية يجب أن تكون أكبر من صفر عند عدم إدخال مساحة تأجيرية صريحة',
        'efficiencyRatio must be positive when no explicit net leasable area override is supplied');
    }
  }

  if ('netLeasableOverride' in inputs && Number.isFinite(inputs.netLeasableOverride) && inputs.netLeasableOverride > 0
      && Number.isFinite(inputs.floorCount) && Number.isFinite(inputs.floorAreaEach)) {
    const totalFloorArea = inputs.floorCount * inputs.floorAreaEach;
    if (inputs.netLeasableOverride > totalFloorArea) {
      throw new ValidationError('netLeasableOverride', inputs.netLeasableOverride, 'AREA_CONSTRAINT_VIOLATION',
        'المساحة التأجيرية الصريحة لا يجوز أن تتجاوز إجمالي مساحة الأدوار',
        'netLeasableOverride cannot exceed total floor area');
    }
  }

  if ('leaseUpMonths' in inputs && inputs.leaseUpMonths < 0) {
"""
s = replace_once(s, anchor, replacement, "validation semantic constraints")
s = replace_once(
    s,
    "  STRICTLY_POSITIVE_DIVISOR_FIELDS,\n};",
    "  STRICTLY_POSITIVE_DIVISOR_FIELDS,\n  INTEGER_PERIOD_OR_COUNT_FIELDS,\n};",
    "validation exports",
)
write(path, s)


# -----------------------------------------------------------------------------
# 2) User-facing semantic parity, period clarity, governed assumption visibility
# -----------------------------------------------------------------------------
path = "src/app/App.jsx"
s = read(path)

s = replace_once(
    s,
    """          const raw = e.target.value.replace(/[^\\d.\\-]/g, \"\");
          const parsed = parseFloat(raw);
          onChange(isNaN(parsed) ? 0 : (min !== undefined ? Math.max(min, parsed) : parsed));
""",
    """          const raw = e.target.value.replace(/[^\\d.\\-]/g, \"\");
          if (raw === \"\" || raw === \"-\" || raw === \".\" || raw === \"-.\") return;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) return;
          onChange(min !== undefined ? Math.max(min, parsed) : parsed);
""",
    "NumField no silent blank-to-zero",
)
s = replace_once(
    s,
    """          const raw = e.target.value.replace(/[^\\d.\\-]/g, \"\");
          const parsed = parseFloat(raw);
          onChange(isNaN(parsed) ? 0 : parsed / 100);
""",
    """          const raw = e.target.value.replace(/[^\\d.\\-]/g, \"\");
          if (raw === \"\" || raw === \"-\" || raw === \".\" || raw === \"-.\") return;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) return;
          onChange(parsed / 100);
""",
    "PercentField no silent blank-to-zero",
)

s = replace_once(
    s,
    "  marketRentPerSqm: 1800, occupancyRate: 1.0, serviceIncomeRate: 0.12, opexRate: 0.05,\n",
    "  marketRentPerSqm: 1800, occupancyRate: 1.0, serviceIncomeRate: 0.12, opexRate: 0.05, leaseUpMonths: 0,\n",
    "land explicit lease-up default",
)

# Physical/economic input floor guards in the UI. Canonical validation remains authoritative.
for old, new, label in [
    ('<NumField label={t("inputBuilding.landLength")} unit={t("inputBuilding.unitMeterLinear")} value={inputs.landLength} onChange={(v) => patch("landLength", v)} />', '<NumField label={t("inputBuilding.landLength")} unit={t("inputBuilding.unitMeterLinear")} value={inputs.landLength} onChange={(v) => patch("landLength", v)} min={0.01} />', 'building land length min'),
    ('<NumField label={t("inputBuilding.landWidth")} unit={t("inputBuilding.unitMeterLinear")} value={inputs.landWidth} onChange={(v) => patch("landWidth", v)} />', '<NumField label={t("inputBuilding.landWidth")} unit={t("inputBuilding.unitMeterLinear")} value={inputs.landWidth} onChange={(v) => patch("landWidth", v)} min={0.01} />', 'building land width min'),
    ('<NumField label={t("inputBuilding.basementAreaEach")} unit={t("inputBuilding.unitSqm")} value={inputs.basementAreaEach} onChange={(v) => patch("basementAreaEach", v)} />', '<NumField label={t("inputBuilding.basementAreaEach")} unit={t("inputBuilding.unitSqm")} value={inputs.basementAreaEach} onChange={(v) => patch("basementAreaEach", v)} min={0} />', 'building basement area min'),
    ('<NumField label={t("inputBuilding.parkingAreaPerSpot")} unit={t("inputBuilding.unitSqmSpot")} value={inputs.parkingAreaPerSpot} onChange={(v) => patch("parkingAreaPerSpot", v)} />', '<NumField label={t("inputBuilding.parkingAreaPerSpot")} unit={t("inputBuilding.unitSqmSpot")} value={inputs.parkingAreaPerSpot} onChange={(v) => patch("parkingAreaPerSpot", v)} min={0.01} />', 'parking area min'),
    ('<NumField label={t("inputBuilding.floorAreaEach")} unit={t("inputBuilding.unitSqm")} value={inputs.floorAreaEach} onChange={(v) => patch("floorAreaEach", v)} />', '<NumField label={t("inputBuilding.floorAreaEach")} unit={t("inputBuilding.unitSqm")} value={inputs.floorAreaEach} onChange={(v) => patch("floorAreaEach", v)} min={0.01} />', 'building floor area min'),
    ('<NumField label={t("inputBuilding.buildingPrice")} unit={t("inputBuilding.unitSar")} value={inputs.buildingPrice} onChange={(v) => patch("buildingPrice", v)} />', '<NumField label={t("inputBuilding.buildingPrice")} unit={t("inputBuilding.unitSar")} value={inputs.buildingPrice} onChange={(v) => patch("buildingPrice", v)} min={0.01} />', 'building price min'),
    ('<NumField label={t("inputBuilding.inspectionCost")} unit={t("inputBuilding.unitSar")} value={inputs.inspectionCost} onChange={(v) => patch("inspectionCost", v)} />', '<NumField label={t("inputBuilding.inspectionCost")} unit={t("inputBuilding.unitSar")} value={inputs.inspectionCost} onChange={(v) => patch("inspectionCost", v)} min={0} />', 'inspection cost min'),
    ('<NumField label={t("inputBuilding.valuationCost")} unit={t("inputBuilding.unitSar")} value={inputs.valuationCost} onChange={(v) => patch("valuationCost", v)} />', '<NumField label={t("inputBuilding.valuationCost")} unit={t("inputBuilding.unitSar")} value={inputs.valuationCost} onChange={(v) => patch("valuationCost", v)} min={0} />', 'valuation cost min'),
    ('<NumField label={t("inputBuilding.rentPerSqm")} unit={t("inputBuilding.unitSarSqmYear")} value={inputs.rentPerSqm} onChange={(v) => patch("rentPerSqm", v)} />', '<NumField label={t("inputBuilding.rentPerSqm")} unit={t("inputBuilding.unitSarSqmYear")} value={inputs.rentPerSqm} onChange={(v) => patch("rentPerSqm", v)} min={0} />', 'rent min'),
    ('<NumField label={t("inputBuilding.basementConstructionCostPerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.basementConstructionCostPerSqm} onChange={(v) => patch("basementConstructionCostPerSqm", v)} />', '<NumField label={t("inputBuilding.basementConstructionCostPerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.basementConstructionCostPerSqm} onChange={(v) => patch("basementConstructionCostPerSqm", v)} min={0} />', 'basement construction min'),
    ('<NumField label={t("inputBuilding.floorConstructionCostPerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.floorConstructionCostPerSqm} onChange={(v) => patch("floorConstructionCostPerSqm", v)} />', '<NumField label={t("inputBuilding.floorConstructionCostPerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.floorConstructionCostPerSqm} onChange={(v) => patch("floorConstructionCostPerSqm", v)} min={0} />', 'floor construction min'),
    ('<NumField label={t("inputBuilding.currentLandPricePerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.currentLandPricePerSqm} onChange={(v) => patch("currentLandPricePerSqm", v)} />', '<NumField label={t("inputBuilding.currentLandPricePerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.currentLandPricePerSqm} onChange={(v) => patch("currentLandPricePerSqm", v)} min={0} />', 'current land price min'),
    ('<NumField label={t("inputLand.landLength")} unit={t("inputLand.unitMeter")} value={inputs.landLength} onChange={(v) => patch("landLength", v)} />', '<NumField label={t("inputLand.landLength")} unit={t("inputLand.unitMeter")} value={inputs.landLength} onChange={(v) => patch("landLength", v)} min={0.01} />', 'land length min'),
    ('<NumField label={t("inputLand.landWidth")} unit={t("inputLand.unitMeter")} value={inputs.landWidth} onChange={(v) => patch("landWidth", v)} />', '<NumField label={t("inputLand.landWidth")} unit={t("inputLand.unitMeter")} value={inputs.landWidth} onChange={(v) => patch("landWidth", v)} min={0.01} />', 'land width min'),
    ('<NumField label={t("inputLand.landPricePerSqm")} unit={t("inputLand.unitSarSqm")} value={inputs.landPricePerSqm} onChange={(v) => patch("landPricePerSqm", v)} />', '<NumField label={t("inputLand.landPricePerSqm")} unit={t("inputLand.unitSarSqm")} value={inputs.landPricePerSqm} onChange={(v) => patch("landPricePerSqm", v)} min={0.01} />', 'land price min'),
    ('          onChange={(v) => patch("constructionCostPerSqm", v)}\n          note={t("inputLand.constructionCostPerSqmNote")}', '          onChange={(v) => patch("constructionCostPerSqm", v)}\n          min={0.01}\n          note={t("inputLand.constructionCostPerSqmNote")}', 'construction cost min'),
    ('<NumField label={t("inputLand.engineeringCost")} unit={t("inputLand.unitSar")} value={inputs.engineeringCost} onChange={(v) => patch("engineeringCost", v)} />', '<NumField label={t("inputLand.engineeringCost")} unit={t("inputLand.unitSar")} value={inputs.engineeringCost} onChange={(v) => patch("engineeringCost", v)} min={0} />', 'engineering cost min'),
    ('<NumField label={t("inputLand.landValuationCost")} unit={t("inputLand.unitSar")} value={inputs.landValuationCost} onChange={(v) => patch("landValuationCost", v)} />', '<NumField label={t("inputLand.landValuationCost")} unit={t("inputLand.unitSar")} value={inputs.landValuationCost} onChange={(v) => patch("landValuationCost", v)} min={0} />', 'land valuation min'),
    ('<NumField label={t("inputLand.marketRentPerSqm")} unit={t("inputBuilding.unitSarSqmYear")} value={inputs.marketRentPerSqm} onChange={(v) => patch("marketRentPerSqm", v)} />', '<NumField label={t("inputLand.marketRentPerSqm")} unit={t("inputBuilding.unitSarSqmYear")} value={inputs.marketRentPerSqm} onChange={(v) => patch("marketRentPerSqm", v)} min={0} />', 'market rent min'),
]:
    s = replace_once(s, old, new, label)

# Recommendation card is analytical decision support, not a transaction recommendation.
s = replace_once(
    s,
    '<div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>{t("recommendation.finalSectionHeading")}</div>',
    '<div className="text-[10px] tracking-widest mb-1" style={{ color: COLORS.brass }}>{t("recommendation.analyticalSectionHeading")}</div>\n        <div className="text-[10px] mb-3 leading-relaxed" style={{ color: COLORS.slateDim }}>{t("recommendation.scopeNote")}</div>',
    "analytical recommendation heading",
)

# Incomplete-input state must not be rendered as a negative/no-buy seal.
s = replace_once(
    s,
    '  const isGo = verdict === "يوصى بالشراء";\n  const isConditional = verdict === "يوصى بالشراء بشروط";\n  const color = isGo ? COLORS.positive : isConditional ? COLORS.caution : COLORS.negative;\n  const dim = size === "large" ? 132 : 64;\n  const Icon = isGo ? CheckCircle2 : isConditional ? AlertTriangle : XCircle;',
    '  const isIncomplete = verdict === "INCOMPLETE_INPUTS";\n  const isGo = verdict === "يوصى بالشراء";\n  const isConditional = verdict === "يوصى بالشراء بشروط";\n  const color = isIncomplete ? COLORS.caution : isGo ? COLORS.positive : isConditional ? COLORS.caution : COLORS.negative;\n  const dim = size === "large" ? 132 : 64;\n  const Icon = isIncomplete ? AlertTriangle : isGo ? CheckCircle2 : isConditional ? AlertTriangle : XCircle;',
    "incomplete verdict seal",
)
s = replace_once(
    s,
    '<div className="text-[10px] mt-1 rf-num" style={{ color: COLORS.slate }}>{metCount}/{totalCriteria} {t("recommendation.criteriaMet")}</div>',
    '{Number.isInteger(metCount) && Number.isInteger(totalCriteria)\n              ? <div className="text-[10px] mt-1 rf-num" style={{ color: COLORS.slate }}>{metCount}/{totalCriteria} {t("recommendation.criteriaMet")}</div>\n              : <div className="text-[10px] mt-1" style={{ color: COLORS.caution }}>{t("recommendation.pendingCriteria")}</div>}',
    "pending criteria display",
)

# Neutral rendering for unavailable/null criteria.
s = replace_once(
    s,
    'function CriteriaRow({ ok, label, actual, target }) {\n  const { t } = useLocale();\n  return (\n    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg mb-2"\n      style={{ background: ok ? COLORS.positiveSoft : COLORS.negativeSoft, border: `1px solid ${ok ? COLORS.positive : COLORS.negative}33` }}>\n      <div className="flex items-center gap-2">\n        {ok ? <CheckCircle2 size={16} style={{ color: COLORS.positive }} /> : <XCircle size={16} style={{ color: COLORS.negative }} />}\n        <span className="text-xs" style={{ color: COLORS.parchment }}>{label}</span>\n      </div>',
    'function CriteriaRow({ ok, label, actual, target }) {\n  const { t } = useLocale();\n  const unavailable = ok === null || ok === undefined;\n  const background = unavailable ? COLORS.cautionSoft : ok ? COLORS.positiveSoft : COLORS.negativeSoft;\n  const borderColor = unavailable ? COLORS.caution : ok ? COLORS.positive : COLORS.negative;\n  return (\n    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg mb-2"\n      style={{ background, border: `1px solid ${borderColor}33` }}>\n      <div className="flex items-center gap-2">\n        {unavailable ? <AlertTriangle size={16} style={{ color: COLORS.caution }} /> : ok ? <CheckCircle2 size={16} style={{ color: COLORS.positive }} /> : <XCircle size={16} style={{ color: COLORS.negative }} />}\n        <span className="text-xs" style={{ color: COLORS.parchment }}>{label}</span>\n      </div>',
    "criteria neutral state",
)

# KPI ribbon must use the same cost-basis metrics that drive the canonical decision criteria.
s = replace_once(
    s,
    '  const yieldLabel = mode === "building" ? t("kpi.yieldOnPrice") : t("kpi.yieldOnCost");\n  const yieldValue = mode === "building" ? r.netYieldOnPrice : r.capRateOnCost;\n  const paybackValue = mode === "building" ? r.paybackOnPrice : r.simplePaybackYears;',
    '  const yieldLabel = t("kpi.yieldOnCost");\n  const yieldValue = mode === "building" ? r.netYieldOnCost : r.capRateOnCost;\n  const paybackValue = mode === "building" ? r.paybackOnCost : r.simplePaybackYears;',
    "KPI decision-basis parity",
)

# Existing-building income disclosure: separate first-year lease-up effects from stabilized economics.
s = replace_once(
    s,
    '          <MetricRow label={t("metricRowR2B2.grossRentalIncome")} value={formatRecommendationCurrency(r.grossRentalIncome)} />\n          <MetricRow label={t("metricRowR2B2.vacancyDeduction")} value={formatRecommendationCurrency(r.vacancyDeduction)} />\n          <MetricRow label={t("metricRowR2B2.serviceIncomeAfterLease")} value={formatRecommendationCurrency(r.serviceIncome)} />\n          <MetricRow label={t("metricRowR2B2.totalAnnualIncome")} value={formatRecommendationCurrency(r.totalAnnualIncome)} strong />\n          <MetricRow label={t("metricRowR2B2.vatCollected")} value={formatRecommendationCurrency(r.vatCollected)} note={t("metricRowR2B2.vatCollectedNote")} />',
    '          <MetricRow label={t("metricRowR2B2.grossRentalIncomeStabilized")} value={formatRecommendationCurrency(r.stabilizedGrossRentalIncome)} />\n          <MetricRow label={t("metricRowR2B2.vacancyDeductionFirstYear")} value={formatRecommendationCurrency(r.vacancyDeduction)} />\n          <MetricRow label={t("metricRowR2B2.rentalIncomeFirstYear")} value={formatRecommendationCurrency(r.rentalIncomeAfterVacancy)} />\n          <MetricRow label={t("metricRowR2B2.serviceIncomeFirstYear")} value={formatRecommendationCurrency(r.firstYearServiceIncome)} />\n          <MetricRow label={t("metricRowR2B2.totalIncomeFirstYear")} value={formatRecommendationCurrency(r.firstYearTotalAnnualIncome)} strong />\n          <MetricRow label={t("metricRowR2B2.serviceIncomeStabilized")} value={formatRecommendationCurrency(r.serviceIncome)} />\n          <MetricRow label={t("metricRowR2B2.totalIncomeStabilized")} value={formatRecommendationCurrency(r.totalAnnualIncome)} strong />\n          <MetricRow label={t("metricRowR2B2.vatCollectedFirstYear")} value={formatRecommendationCurrency(r.vatCollected)} note={t("metricRowR2B2.vatCollectedNote")} />',
    "building period-consistent income rows",
)
s = replace_once(
    s,
    '          <MetricRow label={t("metricRowR2B2.totalOpex")} value={formatRecommendationCurrency(r.opexAmount)} />\n          <MetricRow label={t("metricRowR2B2.noiBuilding")} value={formatRecommendationCurrency(r.NOI)} strong />',
    '          <MetricRow label={t("metricRowR2B2.totalOpexStabilized")} value={formatRecommendationCurrency(r.opexAmount)} />\n          <MetricRow label={t("metricRowR2B2.firstYearNoiBuilding")} value={formatRecommendationCurrency(r.firstYearNOI)} />\n          <MetricRow label={t("metricRowR2B2.noiBuildingStabilized")} value={formatRecommendationCurrency(r.NOI)} strong />',
    "building NOI period clarity",
)

# Full engine/UI criterion parity for existing building.
s = replace_once(
    s,
    '''          { ok: r.c1, label: t("recommendation.criteria.ebNetYield", { value: fmtPct(inputs.minYieldThreshold, 1) }), actual: fmtPct(r.netYieldOnPrice), target: fmtPct(inputs.minYieldThreshold, 1) },
          { ok: r.c2, label: t("recommendation.criteria.ebPayback", { years: inputs.maxPaybackThreshold }), actual: formatRecommendationYears(r.paybackOnPrice), target: `${inputs.maxPaybackThreshold} ${t("units.years")}` },
          { ok: r.c3, label: t("recommendation.criteria.ebIrrVsDiscount"), actual: fmtPct(r.irr), target: fmtPct(inputs.discountRate) },
          { ok: r.c4, label: t("recommendation.criteria.ebMarketValueVsCost"), actual: formatRecommendationCurrency(r.marketValueByIncomeCap), target: formatRecommendationCurrency(r.totalPurchaseCost) },
          ...(inputs.leverageEnabled
            ? [{ ok: r.c5, label: t("recommendation.criteria.dscr", { value: fmtX(inputs.minDscrThreshold) }), actual: r.dscrMin !== null ? fmtX(r.dscrMin) : "—", target: fmtX(inputs.minDscrThreshold) }]
              : []),''',
    '''          { ok: r.c0, label: t("recommendation.criteria.noiPositive"), actual: formatRecommendationCurrency(r.NOI), target: `> 0 ${t("units.sar")}` },
          { ok: r.c1, label: t("recommendation.criteria.ebNetYieldOnCost", { value: fmtPct(inputs.minYieldThreshold, 1) }), actual: fmtPct(r.netYieldOnCost), target: fmtPct(inputs.minYieldThreshold, 1) },
          { ok: r.c2, label: t("recommendation.criteria.ebPaybackOnCost", { years: inputs.maxPaybackThreshold }), actual: formatRecommendationYears(r.paybackOnCost), target: `${inputs.maxPaybackThreshold} ${t("units.years")}` },
          { ok: r.c3, label: t("recommendation.criteria.ebIrrVsDiscount"), actual: fmtPct(r.irr), target: fmtPct(inputs.discountRate) },
          { ok: r.c6, label: t("recommendation.criteria.npvNonNegative"), actual: formatRecommendationCurrency(r.npv), target: `≥ 0 ${t("units.sar")}` },
          { ok: r.c4, label: t("recommendation.criteria.ebMarketValueVsCost"), actual: formatRecommendationCurrency(r.marketValueByIncomeCap), target: formatRecommendationCurrency(r.totalPurchaseCost) },
          ...(inputs.leverageEnabled
            ? [
                { ok: r.c5, label: t("recommendation.criteria.dscr", { value: fmtX(inputs.minDscrThreshold) }), actual: r.dscrMin !== null ? fmtX(r.dscrMin) : "—", target: fmtX(inputs.minDscrThreshold) },
                { ok: r.c7, label: t("recommendation.criteria.leveredNpvNonNegative"), actual: formatRecommendationCurrency(r.leveredNPV), target: `≥ 0 ${t("units.sar")}` },
              ]
              : []),''',
    "building criteria semantic parity",
)

# Full engine/UI criterion parity for land development.
s = replace_once(
    s,
    '''          { ok: r.c1, label: t("recommendation.criteria.ldPayback", { years: inputs.maxPaybackThreshold }), actual: formatRecommendationYears(r.simplePaybackYears), target: `${inputs.maxPaybackThreshold} ${t("units.years")}` },
          { ok: r.c2, label: t("recommendation.criteria.ldReturnOnCost"), actual: fmtPct(r.capRateOnCost), target: fmtPct(1 / inputs.maxPaybackThreshold) },
          { ok: r.c3, label: t("recommendation.criteria.ldIrrVsHurdle"), actual: fmtPct(r.irr), target: fmtPct(inputs.hurdleRate) },
          { ok: r.c4, label: t("recommendation.criteria.ldMarketValueVsCost"), actual: formatRecommendationCurrency(r.marketValueAfterCompletion), target: formatRecommendationCurrency(r.totalProjectCost) },
          ...(inputs.leverageEnabled
            ? [{ ok: r.c5, label: t("recommendation.criteria.dscr", { value: fmtX(inputs.minDscrThreshold) }), actual: r.dscrMin !== null ? fmtX(r.dscrMin) : "—", target: fmtX(inputs.minDscrThreshold) }]
              : []),''',
    '''          { ok: r.c0, label: t("recommendation.criteria.noiPositive"), actual: formatRecommendationCurrency(r.stabilizedNOI), target: `> 0 ${t("units.sar")}` },
          { ok: r.c1, label: t("recommendation.criteria.ldPayback", { years: inputs.maxPaybackThreshold }), actual: formatRecommendationYears(r.simplePaybackYears), target: `${inputs.maxPaybackThreshold} ${t("units.years")}` },
          { ok: r.c2, label: t("recommendation.criteria.npvNonNegative"), actual: formatRecommendationCurrency(r.npv), target: `≥ 0 ${t("units.sar")}` },
          { ok: r.c3, label: t("recommendation.criteria.ldIrrVsHurdle"), actual: fmtPct(r.irr), target: fmtPct(inputs.hurdleRate) },
          { ok: r.c4, label: t("recommendation.criteria.ldMarketValueVsCost"), actual: formatRecommendationCurrency(r.marketValueAfterCompletion), target: formatRecommendationCurrency(r.totalProjectCost) },
          ...(inputs.leverageEnabled
            ? [
                { ok: r.c5, label: t("recommendation.criteria.dscr", { value: fmtX(inputs.minDscrThreshold) }), actual: r.dscrMin !== null ? fmtX(r.dscrMin) : "—", target: fmtX(inputs.minDscrThreshold) },
                { ok: r.c6, label: t("recommendation.criteria.leveredNpvNonNegative"), actual: formatRecommendationCurrency(r.leveredNPV), target: `≥ 0 ${t("units.sar")}` },
              ]
              : []),''',
    "land criteria semantic parity",
)

# Financing structures are proxies, not exact Murabaha/Ijarah contract models.
financing_row = '<MetricRow label={t("metricRowR2B3.leveredNpv")} value={formatRecommendationCurrency(r.leveredNPV)} note={t("metricRowR2B3.leveredNpvNoteBuilding", { rate: fmtPct(r.equityDiscountRate) })} />'
s = replace_once(s, financing_row, financing_row + '\n            <div className="text-[10px] mt-2 leading-relaxed" style={{ color: COLORS.caution }}>{t("financingInput.proxyBoundaryNote")}</div>', "building financing boundary note")
financing_row_land = '<MetricRow label={t("metricRowR2B3.leveredNpv")} value={formatRecommendationCurrency(r.leveredNPV)} note={t("metricRowR2B3.leveredNpvNoteLand", { rate: fmtPct(r.equityDiscountRate) })} />'
s = replace_once(s, financing_row_land, financing_row_land + '\n          <div className="text-[10px] mt-2 leading-relaxed" style={{ color: COLORS.caution }}>{t("financingInput.proxyBoundaryNote")}</div>', "land financing boundary note")

# Land V2 governed assumptions must be visible. They remain read-only in V2.
s = replace_once(
    s,
    'function LandInputPanel({ inputs, setInputs }) {\n  const { t } = useLocale();\n  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));',
    'function LandInputPanel({ inputs, setInputs, assumptionModelVersion }) {\n  const { t, locale } = useLocale();\n  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));\n  const v2Governed = assumptionModelVersion === ASSUMPTION_MODEL_VERSION.V2;\n  const governedNote = v2Governed ? (locale === "en" ? "Governed by Assumption Model V2." : "محكوم بواسطة نموذج الافتراضات V2.") : null;',
    "land governed assumption context",
)
s = replace_once(
    s,
    '<PercentField label={t("inputLand.opexRate")} value={inputs.opexRate} onChange={(v) => patch("opexRate", v)} />',
    '<PercentField label={t("inputLand.opexRate")} value={inputs.opexRate} onChange={(v) => patch("opexRate", v)} />\n        <PercentField label={t("inputLand.managementFeeRate")} note={governedNote} value={inputs.managementFeeRate} onChange={(v) => patch("managementFeeRate", v)} disabled={v2Governed} />\n        <NumField label={t("inputLand.fixedOpexPerSqm")} unit={t("inputLand.unitSarSqm")} note={governedNote} value={inputs.fixedOpexPerSqm} onChange={(v) => patch("fixedOpexPerSqm", v)} min={0} disabled={v2Governed} />\n        <NumField label={t("inputLand.replacementReservePerSqm")} unit={t("inputLand.unitSarSqm")} note={governedNote} value={inputs.replacementReservePerSqm} onChange={(v) => patch("replacementReservePerSqm", v)} min={0} disabled={v2Governed} />\n        <PercentField label={t("inputLand.opexGrowthRate")} note={governedNote} value={inputs.opexGrowthRate} onChange={(v) => patch("opexGrowthRate", v)} disabled={v2Governed} />\n        <NumField label={t("inputLand.leaseUpMonths")} unit={t("inputLand.unitMonth")} value={inputs.leaseUpMonths || 0} onChange={(v) => patch("leaseUpMonths", v)} min={0} />',
    "land visible expense assumptions",
)
s = replace_once(
    s,
    '<LandInputPanel inputs={landInputs} setInputs={setLandInputs} />',
    '<LandInputPanel inputs={landInputs} setInputs={setLandInputs} assumptionModelVersion={landAssumptionModelVersion} />',
    "land assumption version prop",
)

# Land dashboard expense decomposition makes the actual cost basis auditable.
s = replace_once(
    s,
    '<MetricRow label={t("metricRowR2B2.operatingExpenses")} value={formatRecommendationCurrency(r.operatingExpenses)} />\n        <MetricRow label={t("metricRowR2B2.stabilizedNoi")} value={formatRecommendationCurrency(r.stabilizedNOI)} strong />',
    '<MetricRow label={t("metricRowR2B2.variableOperatingExpense")} value={formatRecommendationCurrency(r.variableOperatingExpense)} />\n        <MetricRow label={t("metricRowR2B2.fixedOperatingExpense")} value={formatRecommendationCurrency(r.fixedOperatingExpense)} />\n        <MetricRow label={t("metricRowR2B2.managementFeeAmount")} value={formatRecommendationCurrency(r.managementFeeAmount)} />\n        <MetricRow label={t("metricRowR2B2.insuranceAmount")} value={formatRecommendationCurrency(r.insuranceAmount)} />\n        <MetricRow label={t("metricRowR2B2.operatingExpensesBeforeReserve")} value={formatRecommendationCurrency(r.operatingExpensesBeforeReserve)} />\n        <MetricRow label={t("metricRowR2B2.replacementReserveAmount")} value={formatRecommendationCurrency(r.replacementReserveAmount)} />\n        <MetricRow label={t("metricRowR2B2.operatingExpenses")} value={formatRecommendationCurrency(r.operatingExpenses)} strong />\n        <MetricRow label={t("metricRowR2B2.firstOperatingYearNoi")} value={formatRecommendationCurrency(r.firstOperatingYearNOI)} />\n        <MetricRow label={t("metricRowR2B2.stabilizedNoi")} value={formatRecommendationCurrency(r.stabilizedNOI)} strong />',
    "land expense decomposition",
)

write(path, s)


# -----------------------------------------------------------------------------
# 3) Arabic/English presentation vocabulary
# -----------------------------------------------------------------------------
def patch_locale(rel, lang):
    text = read(rel)
    if lang == "ar":
        text = replace_once(text, '    loanTenorNoteLand: "إن تجاوزت فترة التشغيل، يُخصم الرصيد المتبقي من عائد الخروج",\n', '    loanTenorNoteLand: "إن تجاوزت فترة التشغيل، يُخصم الرصيد المتبقي من عائد الخروج",\n    proxyBoundaryNote: "النموذج التمويلي إرشادي قائم على معدل ربح وجدولة شهرية؛ لا يمثل عقد مرابحة/إجارة نهائياً ولا يحل محل عرض التمويل وشروط الجهة الممولة.",\n', 'ar financing boundary')
        text = replace_once(text, '    serviceIncomeRate: "نسبة دخل الخدمات من الإيجار", opexRate: "نسبة المصروفات التشغيلية",\n', '    serviceIncomeRate: "نسبة دخل الخدمات من الإيجار", opexRate: "نسبة المصروفات التشغيلية المتغيرة",\n    managementFeeRate: "رسوم إدارة العقار", fixedOpexPerSqm: "مصروف تشغيلي ثابت لكل متر سنوياً",\n    replacementReservePerSqm: "احتياطي إحلال لكل متر سنوياً", opexGrowthRate: "نمو المصروف الثابت واحتياطي الإحلال",\n    leaseUpMonths: "فترة الاستقرار/التأجير الأولي", unitMonth: "شهر",\n', 'ar land assumptions')
        text = replace_once(text, '    finalSectionHeading: "القسم الأخير — التوصية النهائية",\n', '    finalSectionHeading: "القسم الأخير — التوصية النهائية",\n    analyticalSectionHeading: "النتيجة التحليلية المالية",\n    scopeNote: "هذه نتيجة تحليل مالي داعم للقرار وليست قرار شراء أو اعتماداً نهائياً. التحقق النظامي والقانوني والمهني المعروض منفصل عن الدرجة المالية ويجب استكماله قبل أي قرار أو تصرف.",\n    pendingCriteria: "الحكم المالي معلّق لحين استكمال المدخلات المطلوبة",\n', 'ar recommendation scope')
        text = replace_once(text, '      ebNetYield: "العائد الصافي على سعر الشراء ≥ {{value}}",\n      ebPayback: "سنوات الاسترداد ≤ {{years}} سنة",\n', '      ebNetYield: "العائد الصافي على سعر الشراء ≥ {{value}}",\n      ebPayback: "سنوات الاسترداد ≤ {{years}} سنة",\n      noiPositive: "صافي الدخل التشغيلي > صفر",\n      ebNetYieldOnCost: "العائد الصافي على إجمالي تكلفة الشراء ≥ {{value}}",\n      ebPaybackOnCost: "الاسترداد التراكمي على إجمالي تكلفة الشراء ≤ {{years}} سنة",\n      npvNonNegative: "صافي القيمة الحالية ≥ صفر",\n      leveredNpvNonNegative: "صافي القيمة الحالية لحقوق الملكية بعد التمويل ≥ صفر",\n', 'ar criteria additions')
        text = replace_once(text, '    grossRentalIncome: "الدخل التأجيري السنوي (قبل الشاغر)",\n    vacancyDeduction: "(يُخصم) دخل فترة الشاغر",\n    serviceIncomeAfterLease: "دخل الخدمات بعد التأجير",\n    totalAnnualIncome: "إجمالي الدخل السنوي",\n', '    grossRentalIncome: "الدخل التأجيري السنوي (قبل الشاغر)",\n    vacancyDeduction: "(يُخصم) دخل فترة الشاغر",\n    serviceIncomeAfterLease: "دخل الخدمات بعد التأجير",\n    totalAnnualIncome: "إجمالي الدخل السنوي",\n    grossRentalIncomeStabilized: "الدخل التأجيري السنوي المستقر (قبل الشاغر الأولي)",\n    vacancyDeductionFirstYear: "خصم الشاغر/الاستقرار في السنة الأولى",\n    rentalIncomeFirstYear: "الدخل التأجيري الفعلي — السنة الأولى",\n    serviceIncomeFirstYear: "دخل الخدمات — السنة الأولى",\n    totalIncomeFirstYear: "إجمالي الدخل — السنة الأولى",\n    serviceIncomeStabilized: "دخل الخدمات — الحالة المستقرة",\n    totalIncomeStabilized: "إجمالي الدخل السنوي — الحالة المستقرة",\n', 'ar period income labels')
        text = replace_once(text, '    vatCollected: "ضريبة القيمة المضافة المحصلة",\n', '    vatCollected: "ضريبة القيمة المضافة المحصلة",\n    vatCollectedFirstYear: "ضريبة القيمة المضافة المحصلة — السنة الأولى",\n', 'ar vat first year')
        text = replace_once(text, '    totalOpex: "إجمالي المصروفات التشغيلية",\n    noiBuilding: "صافي الدخل التشغيلي (NOI)",\n', '    totalOpex: "إجمالي المصروفات التشغيلية",\n    totalOpexStabilized: "إجمالي المصروفات التشغيلية — الحالة المستقرة",\n    firstYearNoiBuilding: "صافي الدخل التشغيلي — السنة الأولى",\n    noiBuilding: "صافي الدخل التشغيلي (NOI)",\n    noiBuildingStabilized: "صافي الدخل التشغيلي — الحالة المستقرة",\n', 'ar noi labels')
        text = replace_once(text, '    operatingExpenses: "المصروفات التشغيلية",\n    stabilizedNoi: "صافي الدخل التشغيلي (NOI) المستقر",\n', '    operatingExpenses: "إجمالي المصروفات التشغيلية بعد الاحتياطي",\n    variableOperatingExpense: "المصروف التشغيلي المتغير",\n    fixedOperatingExpense: "المصروف التشغيلي الثابت",\n    managementFeeAmount: "رسوم الإدارة",\n    insuranceAmount: "التأمين",\n    operatingExpensesBeforeReserve: "المصروفات التشغيلية قبل احتياطي الإحلال",\n    replacementReserveAmount: "احتياطي الإحلال",\n    firstOperatingYearNoi: "صافي الدخل التشغيلي — أول سنة تشغيل",\n    stabilizedNoi: "صافي الدخل التشغيلي (NOI) المستقر",\n', 'ar land expense labels')
    else:
        text = replace_once(text, '    loanTenorNoteLand: "If it exceeds the operating period, the remaining balance is deducted from exit proceeds",\n', '    loanTenorNoteLand: "If it exceeds the operating period, the remaining balance is deducted from exit proceeds",\n    proxyBoundaryNote: "This financing model is an indicative rate-based monthly proxy. It is not an executed Murabaha/Ijarah contract and does not replace lender term sheets, fees, covenants or legal terms.",\n', 'en financing boundary')
        text = replace_once(text, '    serviceIncomeRate: "Service Income Rate from Lease", opexRate: "Operating Expense Rate",\n', '    serviceIncomeRate: "Service Income Rate from Lease", opexRate: "Variable Operating Expense Rate",\n    managementFeeRate: "Property Management Fee", fixedOpexPerSqm: "Annual Fixed OPEX per Sqm",\n    replacementReservePerSqm: "Annual Replacement Reserve per Sqm", opexGrowthRate: "Fixed OPEX & Reserve Growth Rate",\n    leaseUpMonths: "Initial Lease-Up / Stabilization Period", unitMonth: "months",\n', 'en land assumptions')
        text = replace_once(text, '    finalSectionHeading: "Final Section — Final Recommendation",\n', '    finalSectionHeading: "Final Section — Final Recommendation",\n    analyticalSectionHeading: "Financial Analytical Result",\n    scopeNote: "This is financial decision-support analysis, not a final purchase or approval decision. Regulatory, legal and professional verification is separate from the financial score and must be completed before any decision or transaction.",\n    pendingCriteria: "Financial result is on hold until required inputs are completed",\n', 'en recommendation scope')
        text = replace_once(text, '      ebNetYield: "Net Yield on Purchase Price ≥ {{value}}",\n      ebPayback: "Payback Period ≤ {{years}} years",\n', '      ebNetYield: "Net Yield on Purchase Price ≥ {{value}}",\n      ebPayback: "Payback Period ≤ {{years}} years",\n      noiPositive: "Net operating income > zero",\n      ebNetYieldOnCost: "Net Yield on Total Acquisition Cost ≥ {{value}}",\n      ebPaybackOnCost: "Cumulative Payback on Total Acquisition Cost ≤ {{years}} years",\n      npvNonNegative: "Net Present Value ≥ zero",\n      leveredNpvNonNegative: "Levered Equity Net Present Value ≥ zero",\n', 'en criteria additions')
        text = replace_once(text, '    grossRentalIncome: "Annual Rental Income (Before Vacancy)",\n    vacancyDeduction: "(Less) Vacancy Period Income",\n    serviceIncomeAfterLease: "Service Income After Lease",\n    totalAnnualIncome: "Total Annual Income",\n', '    grossRentalIncome: "Annual Rental Income (Before Vacancy)",\n    vacancyDeduction: "(Less) Vacancy Period Income",\n    serviceIncomeAfterLease: "Service Income After Lease",\n    totalAnnualIncome: "Total Annual Income",\n    grossRentalIncomeStabilized: "Stabilized Annual Rental Income (Before Initial Lease-Up)",\n    vacancyDeductionFirstYear: "First-Year Lease-Up / Vacancy Deduction",\n    rentalIncomeFirstYear: "Actual Rental Income — Year 1",\n    serviceIncomeFirstYear: "Service Income — Year 1",\n    totalIncomeFirstYear: "Total Income — Year 1",\n    serviceIncomeStabilized: "Service Income — Stabilized",\n    totalIncomeStabilized: "Total Annual Income — Stabilized",\n', 'en period income labels')
        text = replace_once(text, '    vatCollected: "VAT Collected",\n', '    vatCollected: "VAT Collected",\n    vatCollectedFirstYear: "VAT Collected — Year 1",\n', 'en vat first year')
        text = replace_once(text, '    totalOpex: "Total Operating Expenses",\n    noiBuilding: "Net Operating Income (NOI)",\n', '    totalOpex: "Total Operating Expenses",\n    totalOpexStabilized: "Total Operating Expenses — Stabilized",\n    firstYearNoiBuilding: "Net Operating Income — Year 1",\n    noiBuilding: "Net Operating Income (NOI)",\n    noiBuildingStabilized: "Net Operating Income — Stabilized",\n', 'en noi labels')
        text = replace_once(text, '    operatingExpenses: "Operating Expenses",\n    stabilizedNoi: "Stabilized Net Operating Income (NOI)",\n', '    operatingExpenses: "Total Operating Expenses after Reserve",\n    variableOperatingExpense: "Variable Operating Expense",\n    fixedOperatingExpense: "Fixed Operating Expense",\n    managementFeeAmount: "Management Fee",\n    insuranceAmount: "Insurance",\n    operatingExpensesBeforeReserve: "Operating Expenses before Replacement Reserve",\n    replacementReserveAmount: "Replacement Reserve",\n    firstOperatingYearNoi: "Net Operating Income — First Operating Year",\n    stabilizedNoi: "Stabilized Net Operating Income (NOI)",\n', 'en land expense labels')
    write(rel, text)

patch_locale("src/i18n/locales/ar-SA.js", "ar")
patch_locale("src/i18n/locales/en.js", "en")


# -----------------------------------------------------------------------------
# 4) Regression suite: mathematical identities + invalid-input fail-closed + UI parity
# -----------------------------------------------------------------------------
test_path = ROOT / "tests/defects/decision_integrity_wave.js"
test_path.write_text(r''''use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { calculateInvestmentCase, STUDY_TYPE } = require('../../src/engines');
const { validateEngineInputs } = require('../../src/validation/numeric-safety');
const { classifyFinancingModel } = require('../../src/engines/financial/monthly-debt');

const ROOT = path.join(__dirname, '..', '..');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'characterization', 'fixtures', name + '.json'), 'utf8')).input_set;
const approx = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
function mustReject(inputs, studyType, field) {
  assert.throws(
    () => calculateInvestmentCase({ studyType, inputs, leverageEnabled: Boolean(inputs.leverageEnabled), assumptionModelVersion: 'LEGACY' }),
    (e) => e && e.name === 'ValidationError' && e.field === field,
    `expected ValidationError for ${field}`,
  );
}

const land = fixture('RE-GOLD-001-U');
const landResult = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: land, leverageEnabled: false, assumptionModelVersion: 'LEGACY' });
approx(landResult.totalProjectCost, landResult.totalLandAcquisitionCost + landResult.totalConstructionCost);
approx(landResult.stabilizedNOI, landResult.totalOperatingRevenue - landResult.operatingExpenses);
approx(landResult.marketValueAfterCompletion, landResult.stabilizedNOI / land.marketCapRate);
approx(landResult.terminalNetExitValue, landResult.terminalExitValue * (1 - land.exitTransferFeeRate));
assert.deepStrictEqual(
  landResult.criteriaDetail.map((x) => x.code),
  ['STABILIZED_NOI_POSITIVE', 'CUMULATIVE_PROJECT_PAYBACK', 'NPV_NON_NEGATIVE', 'IRR_MEETS_HURDLE', 'COMPLETION_VALUE_COVERS_COST'],
);
assert.strictEqual(landResult.c2, Number.isFinite(landResult.npv) && landResult.npv >= 0);

mustReject({ ...land, constructionCostPerSqm: -3000 }, STUDY_TYPE.LAND_DEVELOPMENT, 'constructionCostPerSqm');
mustReject({ ...land, landLength: -30 }, STUDY_TYPE.LAND_DEVELOPMENT, 'landLength');
mustReject({ ...land, officeFloorCount: 7.5 }, STUDY_TYPE.LAND_DEVELOPMENT, 'officeFloorCount');
mustReject({ ...land, servicesRatioPerFloor: 1 }, STUDY_TYPE.LAND_DEVELOPMENT, 'servicesRatioPerFloor');

const building = fixture('RE-GOLD-002-U');
const buildingResult = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: building, leverageEnabled: false, assumptionModelVersion: 'LEGACY' });
approx(buildingResult.totalPurchaseCost, building.buildingPrice + buildingResult.commissionAmount + buildingResult.transferFeeAmount + building.inspectionCost + building.valuationCost);
approx(buildingResult.NOI, buildingResult.totalAnnualIncome - buildingResult.opexAmount);
assert.strictEqual(buildingResult.c1, buildingResult.netYieldOnCost >= building.minYieldThreshold);
assert.strictEqual(buildingResult.c2, buildingResult.cumulativePaybackOnCost !== null && buildingResult.cumulativePaybackOnCost <= building.maxPaybackThreshold);
assert.strictEqual(buildingResult.c6, Number.isFinite(buildingResult.npv) && buildingResult.npv >= 0);
assert.deepStrictEqual(
  buildingResult.criteriaDetail.map((x) => x.code),
  ['STABILIZED_NOI_POSITIVE', 'NET_YIELD_ON_COST', 'CUMULATIVE_PAYBACK', 'IRR_MEETS_HURDLE', 'NPV_NON_NEGATIVE', 'INCOME_VALUE_COVERS_COST'],
);
mustReject({ ...building, floorCount: 3.5 }, STUDY_TYPE.EXISTING_BUILDING, 'floorCount');
mustReject({ ...building, netLeasableOverride: building.floorCount * building.floorAreaEach + 1 }, STUDY_TYPE.EXISTING_BUILDING, 'netLeasableOverride');

assert.strictEqual(classifyFinancingModel('مرابحة').exactContractModel, false);
assert.strictEqual(classifyFinancingModel('إجارة منتهية بالتمليك').exactContractModel, false);

const app = fs.readFileSync(path.join(ROOT, 'src', 'app', 'App.jsx'), 'utf8');
for (const needle of [
  'actual: fmtPct(r.netYieldOnCost)',
  'actual: formatRecommendationYears(r.paybackOnCost)',
  'ok: r.c6, label: t("recommendation.criteria.npvNonNegative")',
  'ok: r.c7, label: t("recommendation.criteria.leveredNpvNonNegative")',
  'ok: r.c2, label: t("recommendation.criteria.npvNonNegative")',
  'ok: r.c6, label: t("recommendation.criteria.leveredNpvNonNegative")',
  'inputLand.managementFeeRate',
  'inputLand.fixedOpexPerSqm',
  'inputLand.replacementReservePerSqm',
  'metricRowR2B2.firstYearNoiBuilding',
  'metricRowR2B2.firstOperatingYearNoi',
  'financingInput.proxyBoundaryNote',
  'recommendation.analyticalSectionHeading',
]) assert.ok(app.includes(needle), `missing UI parity marker: ${needle}`);
assert.ok(!app.includes('onChange(isNaN(parsed) ? 0'), 'blank numeric input must not silently become zero');

validateEngineInputs({ ...land, leverageEnabled: false }, { studyType: STUDY_TYPE.LAND_DEVELOPMENT });
validateEngineInputs({ ...building, leverageEnabled: false }, { studyType: STUDY_TYPE.EXISTING_BUILDING });
console.log('DECISION_INTEGRITY_WAVE=PASS');
''', encoding="utf-8")

# Keep a direct task for operators; release-verify also auto-discovers tests/defects/*.js.
pkg_path = ROOT / "package.json"
pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
pkg.setdefault("scripts", {})["test:decision-integrity"] = "node tests/defects/decision_integrity_wave.js"
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("DECISION_INTEGRITY_REMEDIATION_APPLIED=1")
