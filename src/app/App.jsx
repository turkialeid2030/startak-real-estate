import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Building2, Landmark, TrendingUp, CheckCircle2, XCircle, RotateCcw,
  ChevronDown, Layers, Calendar, ArrowUpRight, Percent, Wallet,
  MapPin, AlertTriangle, Bookmark, Save, Trash2,
} from "lucide-react";

// ============================================================
// DESIGN TOKENS
// ============================================================
const COLORS = {
  ink: "#0D1526",
  panel: "#141F35",
  panelRaised: "#1C2C4A",
  panelInput: "#18233C",
  hairline: "#2B3B5C",
  hairlineSoft: "#20304E",
  brass: "#C9A24C",
  brassSoft: "#E7D3A0",
  brassDim: "#8A7440",
  parchment: "#EDE6D6",
  slate: "#8C97AC",
  slateDim: "#647089",
  positive: "#4F9D6E",
  positiveSoft: "#1E3327",
  caution: "#D08A3E",
  cautionSoft: "#3A2A16",
  negative: "#B4544A",
  negativeSoft: "#3A2220",
};

const GLOBAL_STYLE = `
/* PR-10: Google Fonts runtime dependency removed -- was the application's
   only external network request. Replaced with a robust system-font stack
   that renders Arabic well on the vast majority of platforms (Segoe UI /
   Tahoma cover Arabic on Windows; San Francisco/Helvetica/Arial elsewhere)
   without bundling or redistributing any font binary. */
.rf-root { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
.rf-display { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
.rf-num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

.rf-root input[type=text].rf-input {
  -moz-appearance: textfield;
}
.rf-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.rf-root ::-webkit-scrollbar-track { background: ${COLORS.ink}; }
.rf-root ::-webkit-scrollbar-thumb { background: ${COLORS.hairline}; border-radius: 8px; }

.rf-input:focus { outline: none; box-shadow: 0 0 0 2px ${COLORS.brassDim}; }

@keyframes rf-stamp {
  0% { transform: scale(0.85) rotate(-3deg); opacity: 0; }
  60% { transform: scale(1.04) rotate(1deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
.rf-seal-anim { animation: rf-stamp 0.45s cubic-bezier(.2,.8,.3,1); }

@media (prefers-reduced-motion: reduce) {
  .rf-seal-anim { animation: none; }
}

.rf-accordion-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
}
.rf-accordion-body.open { grid-template-rows: 1fr; }
.rf-accordion-inner { overflow: hidden; }
`;

// ============================================================
// FORMATTERS
// ============================================================
const fmtNum = (n) => {
  if (!isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
};
const fmtSAR = (n) => (isFinite(n) ? `${fmtNum(n)} ريال` : "—");
const fmtSARSigned = (n) => {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.round(Math.abs(n)).toLocaleString("en-US")} ريال`;
};
const fmtPct = (n, d = 2) => (isFinite(n) ? `${(n * 100).toFixed(d)}%` : "—");
const fmtYears = (n) => (isFinite(n) ? `${n.toFixed(1)} سنة` : "—");
const fmtX = (n) => (isFinite(n) ? `${n.toFixed(2)}x` : "—");

// ============================================================
// PRODUCTION UI CUTOVER (Wave B2): the local calculation function bodies below
// (computeNPV, computeIRR, amortizationSchedule, tierVerdict, calcExistingBuilding,
// calcLandDevelopment) have been REMOVED from this file and replaced by a single
// import from the canonical modular engine. This is the ONLY structural change in
// this file versus the original platform-source.jsx -- see REBASE_CHANGE_MANIFEST.csv.
// No formula was altered: the imported functions ARE the verbatim-extracted bodies
// (src/engines/*), proven equivalent to this file's original inline versions via
// tests/characterization/run_triple_path.js (0 mismatches across all 204 RE-GOLD fields).
const { calculateInvestmentCase, STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE, VACANCY_MONTHS_MAP } = require('../engines');
// I18N LIVE INTEGRATION: useLocale() provides t() for translated UI strings.
// STRICT ISOLATION: this import and useLocale() must NEVER be used inside
// calculateInvestmentCase, useMemo blocks computing financial results, or
// any file under src/engines/src/validation. Only presentational JSX below
// may call t() -- verified by run_locale_invariance.js (unaffected by this change).
const { useLocale } = require('../i18n/LocaleContext.js');
const { getVerdictLabel, getBuildingPermitStatusLabel, BUILDING_PERMIT_STATUS_PRESENTATION_KEYS, getLeaseStatusLabel, LEASE_STATUS_PRESENTATION_KEYS, getBuildingTypeLabel, BUILDING_TYPE_PRESENTATION_KEYS, getFinancingStructureLabel, FINANCING_STRUCTURE_PRESENTATION_KEYS, getDealDisplayName, getProjectTitleDisplay } = require('../i18n/domain-presentation.js');
const arDict = require('../i18n/locales/ar-SA.js');
const enDict = require('../i18n/locales/en.js');
const { validateSavedDealRecord } = require('../validation/saved-deal-schema.js');
const { validateEngineInputs } = require('../validation/numeric-safety.js');
const { buildExportPayload, planRestore, commitRestore } = require('../storage/saved-deals-backup.js');
// RUNTIME REMEDIATION (Runtime Enablement v1): all 8 window.storage call sites
// below are replaced by this single centralized abstraction. No storage
// business logic changes -- same get/set/delete semantics, same keys, same
// {shared:false} scope. See RUNTIME_STORAGE_PORTABILITY_REMEDIATION.md.
const { createStorageProvider } = require('../storage/create-storage-provider');

// ============================================================

// ============================================================
// DEFAULT DATASETS — preloaded from the two source studies
// ============================================================
const DEFAULT_BUILDING_INPUTS = {
  projectTitle: "مبنى مكتبي قائم — طريق أبو بكر الصديق، حي الندى، الرياض",
  landLength: 100, landWidth: 53.26, buildingAge: 1,
  basementCount: 2, basementAreaEach: 7800, parkingAreaPerSpot: 60,
  floorCount: 3, floorAreaEach: 3060, efficiencyRatio: 0.85, netLeasableOverride: 7800,
  serviceElevators: 6,
  buildingPrice: 140000000, commissionRate: 0.025, transferFeeRate: 0.05, inspectionCost: 75000, valuationCost: 60000,
  rentPerSqm: 1800, occupancyRate: 1.0, leaseStatus: "مؤجر", leaseYears: 5, vatRate: 0.15, serviceIncomeRate: 0.12,
  maintenanceRate: 0.05, insuranceRate: 0.005,
  marketCapRate: 0.07, discountRate: 0.08, holdPeriod: 5, rentGrowthRate: 0,
  basementConstructionCostPerSqm: 3000, floorConstructionCostPerSqm: 2000, currentLandPricePerSqm: 15000, buildingUsefulLife: 30,
  minYieldThreshold: 0.09, maxPaybackThreshold: 10,
  leverageEnabled: false, ltv: 0.5, loanRate: 0.06, loanTenor: 10, financingStructureLabel: "مرابحة",
  minDscrThreshold: 1.25, equityRiskSpread: 0.02,
  titleDeedVerified: false, complianceCertified: false, rentFreezeChecked: false,
};

const DEFAULT_LAND_INPUTS = {
  projectTitle: "أرض للتطوير — الدائري الشرقي، حي الوادي",
  landLength: 30, landWidth: 60, landPricePerSqm: 20000,
  buildableRatio: 0.6, buildingTypeLabel: "برج مكتبي", officeFloorCount: 7, servicesRatioPerFloor: 0.15, basementFloorCount: 2,
  constructionCostPerSqm: 5500,
  landCommissionRate: 0.025, landTransferFeeRate: 0.05, engineeringCost: 200000, landValuationCost: 60000,
  marketRentPerSqm: 1800, occupancyRate: 1.0, serviceIncomeRate: 0.12, opexRate: 0.05,
  marketCapRate: 0.08,
  constructionPeriod: 2, rentGrowthRate: 0.03, operatingPeriod: 10, exitCapRate: 0.085, hurdleRate: 0.12,
  exitTransferFeeRate: 0.05,
  maxPaybackThreshold: 9,
  leverageEnabled: false, ltv: 0.6, loanRate: 0.065, loanTenor: 8, financingStructureLabel: "مرابحة",
  minDscrThreshold: 1.25, equityRiskSpread: 0.02,
  titleDeedVerified: false, zoningConfirmed: false, buildingPermitStatus: "لم يُستخرج", soilStudyDone: false, utilitiesConfirmed: false,
};

// ============================================================
// SMALL UI ATOMS
// ============================================================
function Field({ label, unit, note, children }) {
  return (
    <label className="block mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs" style={{ color: COLORS.slate }}>{label}</span>
        {unit ? <span className="text-[10px]" style={{ color: COLORS.slateDim }}>{unit}</span> : null}
      </div>
      {children}
      {note ? <div className="text-[10px] mt-1 leading-relaxed" style={{ color: COLORS.slateDim }}>{note}</div> : null}
    </label>
  );
}

function baseInputStyle() {
  return {
    background: COLORS.panelInput,
    border: `1px solid ${COLORS.hairline}`,
    color: COLORS.brassSoft,
    borderRadius: "0.6rem",
  };
}

function rangeWarning(value, warnBelow, warnAbove, warnText, t) {
  if (warnBelow !== undefined && value < warnBelow) return warnText || t("globalApp.genericWarnBelow");
  if (warnAbove !== undefined && value > warnAbove) return warnText || t("globalApp.genericWarnAbove");
  return null;
}

function FieldNote({ note, warning }) {
  if (warning) {
    return (
      <div className="text-[10px] mt-1 leading-relaxed flex items-center gap-1" style={{ color: COLORS.caution }}>
        <AlertTriangle size={10} /> {warning}
      </div>
    );
  }
  if (note) return <div className="text-[10px] mt-1 leading-relaxed" style={{ color: COLORS.slateDim }}>{note}</div>;
  return null;
}

function NumField({ label, unit, note, value, onChange, step = 1, min, warnBelow, warnAbove, warnText }) {
  const { t } = useLocale();
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText, t);
  return (
    <Field label={label} unit={unit}>
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={baseInputStyle()}
        value={value}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.\-]/g, "");
          const parsed = parseFloat(raw);
          onChange(isNaN(parsed) ? 0 : (min !== undefined ? Math.max(min, parsed) : parsed));
        }}
      />
      <FieldNote note={note} warning={warning} />
    </Field>
  );
}

function PercentField({ label, note, value, onChange, warnBelow, warnAbove, warnText }) {
  const { t } = useLocale();
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText, t);
  return (
    <Field label={label} unit="%">
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={baseInputStyle()}
        value={Number((value * 100).toFixed(4))}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.\-]/g, "");
          const parsed = parseFloat(raw);
          onChange(isNaN(parsed) ? 0 : parsed / 100);
        }}
      />
      <FieldNote note={note} warning={warning} />
    </Field>
  );
}

function SelectField({ label, note, value, onChange, options }) {
  return (
    <Field label={label} note={note}>
      <select
        className="rf-input w-full px-3 py-2 text-sm"
        style={baseInputStyle()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => {
          // R5-C: supports both plain strings (legacy, e.g. financingStructureLabel
          // in R5-D, untouched) and {value, label} objects (new, for enums with a
          // localized display distinct from the raw stored value). The <option>
          // value attribute -- what onChange receives -- is ALWAYS the raw value;
          // only the visible text differs.
          const optValue = typeof o === "object" && o !== null ? o.value : o;
          const optLabel = typeof o === "object" && o !== null ? o.label : o;
          return (
            <option key={optValue} value={optValue} style={{ background: COLORS.panel }}>
              {optLabel}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

function Divider() {
  return <div className="h-px my-4" style={{ background: COLORS.hairlineSoft }} />;
}

function Toggle({ label, note, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-2 mb-2">
      <div>
        <div className="text-xs font-medium" style={{ color: COLORS.parchment }}>{label}</div>
        {note ? <div className="text-[10px] mt-0.5" style={{ color: COLORS.slateDim }}>{note}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative shrink-0"
        style={{
          width: 40, height: 22, borderRadius: 999,
          background: checked ? COLORS.brass : COLORS.hairline,
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute", top: 2, [checked ? "right" : "left"]: 2,
            width: 18, height: 18, borderRadius: "50%",
            background: checked ? COLORS.ink : COLORS.slate,
            transition: "all 0.2s",
          }}
        />
      </button>
    </div>
  );
}

function Section({ eyebrow, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl mb-3 overflow-hidden" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-right"
      >
        <div>
          <div className="text-[10px] tracking-widest" style={{ color: COLORS.brass }}>{eyebrow}</div>
          <div className="rf-display text-sm font-semibold" style={{ color: COLORS.parchment }}>{title}</div>
        </div>
        <ChevronDown
          size={18}
          style={{ color: COLORS.slate, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        />
      </button>
      <div className={`rf-accordion-body ${open ? "open" : ""}`}>
        <div className="rf-accordion-inner">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function KPIChip({ label, value, icon: Icon, accent, sub }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 flex-1 min-w-[120px]"
      style={{ background: COLORS.panelRaised, border: `1px solid ${accent ? COLORS.brassDim : COLORS.hairline}` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {Icon ? <Icon size={12} style={{ color: accent ? COLORS.brass : COLORS.slate }} /> : null}
        <span className="text-[10px]" style={{ color: COLORS.slate }}>{label}</span>
      </div>
      <div className="rf-num text-base font-bold" style={{ color: accent ? COLORS.brass : COLORS.parchment }}>{value}</div>
      {sub ? <div className="text-[10px] mt-0.5" style={{ color: COLORS.slateDim }}>{sub}</div> : null}
    </div>
  );
}

function VerdictSeal({ verdict, metCount, totalCriteria = 4, size = "large" }) {
  const { t } = useLocale();
  const isGo = verdict === "يوصى بالشراء";
  const isConditional = verdict === "يوصى بالشراء بشروط";
  const color = isGo ? COLORS.positive : isConditional ? COLORS.caution : COLORS.negative;
  const dim = size === "large" ? 132 : 64;
  const Icon = isGo ? CheckCircle2 : isConditional ? AlertTriangle : XCircle;
  return (
    <div className="rf-seal-anim flex flex-col items-center justify-center" style={{ width: dim, height: dim }} key={verdict + metCount + totalCriteria}>
      <svg width={dim} height={dim} viewBox="0 0 132 132">
        <circle cx="66" cy="66" r="62" fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 4" opacity="0.55" />
        <circle cx="66" cy="66" r="52" fill={color} opacity="0.12" />
        <circle cx="66" cy="66" r="52" fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
      <div style={{ marginTop: size === "large" ? -96 : -46 }} className="flex flex-col items-center">
        <Icon size={size === "large" ? 30 : 16} style={{ color }} />
        {size === "large" ? (
          <>
            <div className="rf-display text-xs font-bold mt-2 text-center px-2" style={{ color: COLORS.parchment, maxWidth: 110 }}>
              {getVerdictLabel(verdict, t)}
            </div>
            <div className="text-[10px] mt-1 rf-num" style={{ color: COLORS.slate }}>{metCount}/{totalCriteria} {t("recommendation.criteriaMet")}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MetricRow({ label, value, note, strong, positiveNegative }) {
  let valColor = strong ? COLORS.brass : COLORS.parchment;
  if (positiveNegative !== undefined) {
    valColor = positiveNegative ? COLORS.positive : COLORS.negative;
  }
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${COLORS.hairlineSoft}` }}>
      <div>
        <div className="text-xs" style={{ color: COLORS.slate }}>{label}</div>
        {note ? <div className="text-[10px] mt-0.5" style={{ color: COLORS.slateDim }}>{note}</div> : null}
      </div>
      <div className={`rf-num text-sm ${strong ? "font-bold" : "font-medium"}`} style={{ color: valColor }}>{value}</div>
    </div>
  );
}

function MetricGroup({ eyebrow, title, children }) {
  return (
    <div className="rounded-2xl mb-4 p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      <div className="text-[10px] tracking-widest mb-0.5" style={{ color: COLORS.brass }}>{eyebrow}</div>
      <div className="rf-display text-sm font-semibold mb-2" style={{ color: COLORS.parchment }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function CriteriaRow({ ok, label, actual, target }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg mb-2"
      style={{ background: ok ? COLORS.positiveSoft : COLORS.negativeSoft, border: `1px solid ${ok ? COLORS.positive : COLORS.negative}33` }}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 size={16} style={{ color: COLORS.positive }} /> : <XCircle size={16} style={{ color: COLORS.negative }} />}
        <span className="text-xs" style={{ color: COLORS.parchment }}>{label}</span>
      </div>
      <div className="text-[11px] rf-num" style={{ color: COLORS.slate }}>
        {actual} <span style={{ color: COLORS.slateDim }}>/ {t("recommendation.target")} {target}</span>
      </div>
    </div>
  );
}

// ============================================================
// CASH FLOW CHART + TABLE
// ============================================================
function CashFlowTooltip({ active, payload, label }) {
  const { t } = useLocale();
  if (!active || !payload || !payload.length) return null;
  const v = payload[0].value;
  const formatSigned = (n) => {
    if (!isFinite(n)) return "—";
    const sign = n < 0 ? "-" : "";
    return `${sign}${Math.round(Math.abs(n)).toLocaleString("en-US")} ${t("units.sar")}`;
  };
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.parchment }}>
      <div style={{ color: COLORS.slate }}>{t("cashFlow.tooltipYear", { value: label })}</div>
      <div className="rf-num font-bold" style={{ color: v < 0 ? COLORS.negative : COLORS.brass }}>{formatSigned(v)}</div>
    </div>
  );
}

function CashFlowChart({ cashflows }) {
  const { t } = useLocale();
  const data = cashflows.map((v, i) => ({ year: i, value: v }));
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.hairlineSoft} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: COLORS.slate, fontSize: 11 }}
            tickFormatter={(y) => t("cashFlow.chartYearTick", { value: y })}
            axisLine={{ stroke: COLORS.hairline }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: COLORS.slate, fontSize: 10 }}
            tickFormatter={(v) => t("cashFlow.chartMillionTick", { value: (v / 1e6).toFixed(0) })}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <ReferenceLine y={0} stroke={COLORS.hairline} />
          <Tooltip content={<CashFlowTooltip />} cursor={{ fill: COLORS.hairlineSoft, opacity: 0.3 }} />
          <Bar dataKey="value" radius={[3, 3, 3, 3]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value < 0 ? COLORS.negative : COLORS.brass} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CashFlowTable({ cashflows }) {
  const { t } = useLocale();
  const formatSigned = (n) => {
    if (!isFinite(n)) return "—";
    const sign = n < 0 ? "-" : "";
    return `${sign}${Math.round(Math.abs(n)).toLocaleString("en-US")} ${t("units.sar")}`;
  };
  let cum = 0;
  const rows = cashflows.map((v, i) => {
    cum += v;
    return { year: i, value: v, cum };
  });
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${COLORS.hairline}` }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: COLORS.panelRaised }}>
            <th className="px-3 py-2 text-right font-normal" style={{ color: COLORS.slate }}>{t("cashFlow.tableColYear")}</th>
            <th className="px-3 py-2 text-right font-normal" style={{ color: COLORS.slate }}>{t("cashFlow.tableColCashFlow")}</th>
            <th className="px-3 py-2 text-right font-normal" style={{ color: COLORS.slate }}>{t("cashFlow.tableColCumulative")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year} style={{ borderTop: `1px solid ${COLORS.hairlineSoft}` }}>
              <td className="px-3 py-2 rf-num" style={{ color: COLORS.slate }}>{r.year}</td>
              <td className="px-3 py-2 rf-num" style={{ color: r.value < 0 ? COLORS.negative : COLORS.parchment }}>{formatSigned(r.value)}</td>
              <td className="px-3 py-2 rf-num" style={{ color: r.cum < 0 ? COLORS.negative : COLORS.positive }}>{formatSigned(r.cum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// SENSITIVITY (TORNADO) ANALYSIS
// ============================================================
function buildSensitivityData(mode, inputs, t) {
  const vars = mode === "building"
    ? [
        { key: "rentPerSqm", label: t("sensitivity.varRentPerSqm") },
        { key: "buildingPrice", label: t("sensitivity.varBuildingPrice") },
        { key: "marketCapRate", label: t("sensitivity.varMarketCapRate") },
        { key: "occupancyRate", label: t("sensitivity.varOccupancyRate") },
      ]
    : [
        { key: "marketRentPerSqm", label: t("sensitivity.varRentPerSqm") },
        { key: "constructionCostPerSqm", label: t("sensitivity.varConstructionCostPerSqm") },
        { key: "landPricePerSqm", label: t("sensitivity.varLandPricePerSqm") },
        { key: "exitCapRate", label: t("sensitivity.varExitCapRate") },
      ];
  const calc = (i) => calculateInvestmentCase({ studyType: mode === "building" ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT, inputs: i, leverageEnabled: i.leverageEnabled });
  const irrField = inputs.leverageEnabled ? "leveredIRR" : "irr";
  // DEFECT REMEDIATION D1 (DEF-002): scenario-generation logic, NOT generic
  // input clamping. occupancyRate is a physical-domain field (0..1); a
  // perturbation that would exceed that domain is bounded HERE, before the
  // canonical engine is invoked, with truthful metadata recording the
  // boundary-limiting -- the canonical engine boundary itself still rejects
  // any occupancyRate outside [0,1] if supplied directly (unchanged).
  function boundedOccupancyValue(key, requestedValue) {
    if (key !== "occupancyRate") return { effectiveValue: requestedValue, boundaryLimited: false, boundaryReason: null };
    const effectiveValue = Math.min(1, Math.max(0, requestedValue));
    const boundaryLimited = effectiveValue !== requestedValue;
    return { effectiveValue, boundaryLimited, boundaryReason: boundaryLimited ? "OCCUPANCY_MAX_100_PERCENT" : null };
  }
  const rows = vars.map(({ key, label }) => {
    const requestedLow = inputs[key] * 0.9;
    const requestedHigh = inputs[key] * 1.1;
    const boundedLow = boundedOccupancyValue(key, requestedLow);
    const boundedHigh = boundedOccupancyValue(key, requestedHigh);
    const lowInputs = { ...inputs, [key]: boundedLow.effectiveValue };
    const highInputs = { ...inputs, [key]: boundedHigh.effectiveValue };
    const irrLow = calc(lowInputs)[irrField];
    const irrHigh = calc(highInputs)[irrField];
    const lo = Math.min(irrLow, irrHigh);
    const hi = Math.max(irrLow, irrHigh);
    return {
      label, lo, hi, base: lo, range: hi - lo,
      requestedValueLow: requestedLow, effectiveValueLow: boundedLow.effectiveValue, boundaryLimitedLow: boundedLow.boundaryLimited, boundaryReasonLow: boundedLow.boundaryReason,
      requestedValueHigh: requestedHigh, effectiveValueHigh: boundedHigh.effectiveValue, boundaryLimitedHigh: boundedHigh.boundaryLimited, boundaryReasonHigh: boundedHigh.boundaryReason,
    };
  });
  rows.sort((a, b) => b.range - a.range);
  return rows;
}

function SensitivityTooltip({ active, payload }) {
  const { t } = useLocale();
  if (!active || !payload || !payload.length) return null;
  const d = payload[0] && payload[0].payload;
  if (!d) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.parchment }}>
      <div style={{ color: COLORS.slate }}>{d.label}</div>
      <div className="rf-num">{t("sensitivity.tooltipRange", { lo: fmtPct(d.lo), hi: fmtPct(d.hi) })}</div>
    </div>
  );
}

function SensitivityChart({ data }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} layout="vertical" margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={COLORS.hairlineSoft} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: COLORS.slate, fontSize: 10 }}
            axisLine={{ stroke: COLORS.hairline }}
            tickLine={false}
          />
          <YAxis type="category" dataKey="label" width={112} tick={{ fill: COLORS.parchment, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<SensitivityTooltip />} cursor={{ fill: COLORS.hairlineSoft, opacity: 0.3 }} />
          <Bar dataKey="base" stackId="s" fill="transparent" />
          <Bar dataKey="range" stackId="s" radius={[3, 3, 3, 3]} fill={COLORS.brass} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// RECOMMENDATION CARD
// ============================================================
function RegulatoryStatusCard({ items }) {
  const { t } = useLocale();
  const checkedCount = items.filter((it) => it.checked).length;
  return (
    <div className="rounded-2xl mb-4 p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] tracking-widest" style={{ color: COLORS.brass }}>{t("dashboardR3.regulatoryCardEyebrow")}</div>
          <div className="rf-display text-sm font-semibold" style={{ color: COLORS.parchment }}>{t("dashboardR3.regulatoryCardTitle")}</div>
        </div>
        <span className="text-[11px] rf-num" style={{ color: checkedCount === items.length ? COLORS.positive : COLORS.caution }}>
          {checkedCount}/{items.length}
        </span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2 py-1.5">
          {it.checked ? <CheckCircle2 size={14} style={{ color: COLORS.positive, marginTop: 1 }} /> : <AlertTriangle size={14} style={{ color: COLORS.caution, marginTop: 1 }} />}
          <div>
            <div className="text-xs" style={{ color: COLORS.parchment }}>{it.label}</div>
            {it.note ? <div className="text-[10px] mt-0.5 leading-relaxed" style={{ color: COLORS.slateDim }}>{it.note}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationCard({ results, criteria }) {
  const { t } = useLocale();
  return (
    <div
      className="rounded-2xl p-5 mb-4 flex flex-col md:flex-row items-center gap-5"
      style={{ background: COLORS.panel, border: `1px solid ${COLORS.brassDim}` }}
    >
      <VerdictSeal verdict={results.verdict} metCount={results.metCount} totalCriteria={results.totalCriteria} size="large" />
      <div className="flex-1 w-full">
        <div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>{t("recommendation.finalSectionHeading")}</div>
        {criteria.map((c, i) => (
          <CriteriaRow key={i} ok={c.ok} label={c.label} actual={c.actual} target={c.target} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD TAB
// ============================================================
function DashboardTab({ mode, inputs, results }) {
  const { t } = useLocale();
  // R1B: presentation-only unit localization, used EXCLUSIVELY inside the
  // criteria={[...]} arrays below. Global fmtSAR()/fmtYears() are
  // deliberately left untouched -- every other call site in this file
  // (MetricRow etc.) continues using them exactly as before.
  const formatRecommendationCurrency = (n) => (isFinite(n) ? `${fmtNum(n)} ${t("units.sar")}` : "—");
  const formatRecommendationYears = (n) => (isFinite(n) ? `${n.toFixed(1)} ${t("units.years")}` : "—");
  // R2B-1: presentation-only area/currency-per-area helpers, used EXCLUSIVELY
  // for the 23 authorized MetricRow call sites (MR-B01..B12, MR-L01..L11).
  const formatMetricArea = (n) => `${fmtNum(n)} ${t("units.squareMeters")}`;
  const formatMetricCurrencyPerArea = (n) => `${fmtNum(n)} ${t("units.sarPerSquareMeter")}`;
  // R2B-2: same pattern, for the signed-currency formatter.
  const formatMetricCurrencySigned = (n) => {
    if (!isFinite(n)) return "—";
    const sign = n < 0 ? "-" : "";
    return `${sign}${Math.round(Math.abs(n)).toLocaleString("en-US")} ${t("units.sar")}`;
  };
  const r = results;
  if (mode === "building") {
    return (
      <div>
        <MetricGroup eyebrow={t("globalApp.section1")} title={t("dashboardR3.sectionAreas")}>
          <MetricRow label={t("metricRow.landArea")} value={formatMetricArea(r.landArea)} />
          <MetricRow label={t("metricRow.totalBasementArea")} value={formatMetricArea(r.totalBasementArea)} note={t("metricRow.parkingSpotsNote", { value: fmtNum(r.totalParkingSpots) })} />
          <MetricRow label={t("metricRow.totalFloorArea")} value={formatMetricArea(r.totalFloorArea)} />
          <MetricRow label={t("metricRow.netLeasableAreaApproved")} value={formatMetricArea(r.netLeasableArea)} strong note={t("metricRow.avgAreaPerFloorNote", { value: fmtNum(r.avgNetAreaPerFloor) })} />
          <MetricRow label={t("metricRow.coverageRatio")} value={fmtX(r.coverageRatio)} />
          <MetricRow label={t("metricRow.areaCheck")} value={r.areaCheckOk ? t("metricRow.areaCheckOk") : t("metricRow.areaCheckFail")} positiveNegative={r.areaCheckOk} />
        </MetricGroup>

        <MetricGroup eyebrow={t("globalApp.section2")} title={t("dashboardR3.sectionPurchaseCost")}>
          <MetricRow label={t("metricRow.buildingPurchasePrice")} value={formatRecommendationCurrency(inputs.buildingPrice)} />
          <MetricRow label={t("metricRow.commissionAmount")} value={formatRecommendationCurrency(r.commissionAmount)} />
          <MetricRow label={t("metricRow.transferFeeAmount")} value={formatRecommendationCurrency(r.transferFeeAmount)} />
          <MetricRow label={t("metricRow.inspectionAndValuationCost")} value={formatRecommendationCurrency(inputs.inspectionCost + inputs.valuationCost)} />
          <MetricRow label={t("metricRow.totalPurchaseCost")} value={formatRecommendationCurrency(r.totalPurchaseCost)} strong />
          <MetricRow label={t("metricRow.costPerLeasableSqm")} value={formatMetricCurrencyPerArea(r.costPerSqm)} />
        </MetricGroup>

        <MetricGroup eyebrow={t("globalApp.section3")} title={t("dashboardR3.sectionOperatingIncome")}>
          <MetricRow label={t("metricRowR2B2.grossRentalIncome")} value={formatRecommendationCurrency(r.grossRentalIncome)} />
          <MetricRow label={t("metricRowR2B2.vacancyDeduction")} value={formatRecommendationCurrency(r.vacancyDeduction)} />
          <MetricRow label={t("metricRowR2B2.serviceIncomeAfterLease")} value={formatRecommendationCurrency(r.serviceIncome)} />
          <MetricRow label={t("metricRowR2B2.totalAnnualIncome")} value={formatRecommendationCurrency(r.totalAnnualIncome)} strong />
          <MetricRow label={t("metricRowR2B2.vatCollected")} value={formatRecommendationCurrency(r.vatCollected)} note={t("metricRowR2B2.vatCollectedNote")} />
        </MetricGroup>

        <MetricGroup eyebrow={t("globalApp.section4")} title={t("dashboardR3.sectionOpexAndNoi")}>
          <MetricRow label={t("metricRowR2B2.totalOpex")} value={formatRecommendationCurrency(r.opexAmount)} />
          <MetricRow label={t("metricRowR2B2.noiBuilding")} value={formatRecommendationCurrency(r.NOI)} strong />
        </MetricGroup>

        <MetricGroup eyebrow={t("globalApp.section5")} title={t("dashboardR3.sectionYieldValuation")}>
          <MetricRow label={t("metricRowR2B2.netYieldOnCost")} value={fmtPct(r.netYieldOnCost)} />
          <MetricRow label={t("metricRowR2B2.grossYieldOnCost")} value={fmtPct(r.grossYieldOnCost)} />
          <MetricRow label={t("metricRowR2B2.netYieldOnPrice")} value={fmtPct(r.netYieldOnPrice)} strong />
          <MetricRow label={t("metricRowR2B2.paybackOnPrice")} value={formatRecommendationYears(r.paybackOnPrice)} strong />
          <MetricRow label={t("metricRowR2B2.marketValueByIncomeCap")} value={formatRecommendationCurrency(r.marketValueByIncomeCap)} />
          <MetricRow label={t("metricRowR2B2.valueGapVsCost")} value={formatMetricCurrencySigned(r.valueGapVsCost)} positiveNegative={r.valueGapVsCost >= 0} />
          <MetricRow label={t("metricRowR2B2.maxJustifiedPrice")} value={formatRecommendationCurrency(r.maxJustifiedPrice)} />
        </MetricGroup>

        <MetricGroup eyebrow={t("globalApp.section6")} title={t("dashboardR3.sectionAppraisal")}>
          <MetricRow label={t("metricRowR2B2.replacementConstructionValue")} value={formatRecommendationCurrency(r.totalReplacementConstructionValue)} />
          <MetricRow label={t("metricRowR2B2.currentLandValue")} value={formatRecommendationCurrency(r.currentLandValue)} />
          <MetricRow label={t("metricRowR2B2.totalAppraisedValue")} value={formatRecommendationCurrency(r.totalAppraisedValue)} strong />
          <MetricRow label={t("metricRowR2B2.appraisedVsPurchaseCost")} value={formatMetricCurrencySigned(r.totalAppraisedValue - r.totalPurchaseCost)} positiveNegative={r.totalAppraisedValue >= r.totalPurchaseCost} />
          <MetricRow label={t("metricRowR2B2.annualDepreciation")} value={formatRecommendationCurrency(r.annualDepreciation)} note={t("metricRowR2B2.annualDepreciationNote")} />
        </MetricGroup>

        {inputs.leverageEnabled ? (
          <MetricGroup eyebrow={t("globalApp.section7")} title={t("dashboardR3.sectionFinancing", { structure: inputs.financingStructureLabel })}>
            <MetricRow label={t("metricRowR2B3.loanAmountBuilding")} value={formatRecommendationCurrency(r.loanAmount)} />
            <MetricRow label={t("metricRowR2B3.equityRequired")} value={formatRecommendationCurrency(r.equityRequired)} strong />
            <MetricRow label={t("metricRowR2B3.debtService")} value={formatRecommendationCurrency(r.debtService)} />
            <MetricRow label={t("metricRowR2B3.dscrMinLabel")} value={r.dscrMin !== null ? fmtX(r.dscrMin) : "—"} positiveNegative={r.dscrMin !== null ? r.dscrMin >= inputs.minDscrThreshold : undefined} />
            <MetricRow label={t("metricRowR2B3.leveredIrr")} value={fmtPct(r.leveredIRR)} strong />
            <MetricRow label={t("metricRowR2B3.leveredNpv")} value={formatRecommendationCurrency(r.leveredNPV)} note={t("metricRowR2B3.leveredNpvNoteBuilding", { rate: fmtPct(r.equityDiscountRate) })} />
          </MetricGroup>
        ) : null}

        <RegulatoryStatusCard
          items={[
            { checked: inputs.titleDeedVerified, label: t("dashboardR3.regTitleDeedVerified") },
            { checked: inputs.complianceCertified, label: t("dashboardR3.regComplianceCertified") },
            {
              checked: inputs.rentFreezeChecked,
              label: t("dashboardR3.regRentFreezeConfirmed"),
              note: t("dashboardR3.regRentFreezeNote"),
            },
          ]}
        />

        <RecommendationCard
          results={r}
          criteria={[
            { ok: r.c1, label: t("recommendation.criteria.ebNetYield", { value: fmtPct(inputs.minYieldThreshold, 1) }), actual: fmtPct(r.netYieldOnPrice), target: fmtPct(inputs.minYieldThreshold, 1) },
            { ok: r.c2, label: t("recommendation.criteria.ebPayback", { years: inputs.maxPaybackThreshold }), actual: formatRecommendationYears(r.paybackOnPrice), target: `${inputs.maxPaybackThreshold} ${t("units.years")}` },
            { ok: r.c3, label: t("recommendation.criteria.ebIrrVsDiscount"), actual: fmtPct(r.irr), target: fmtPct(inputs.discountRate) },
            { ok: r.c4, label: t("recommendation.criteria.ebMarketValueVsCost"), actual: formatRecommendationCurrency(r.marketValueByIncomeCap), target: formatRecommendationCurrency(r.totalPurchaseCost) },
            ...(inputs.leverageEnabled
              ? [{ ok: r.c5, label: t("recommendation.criteria.dscr", { value: fmtX(inputs.minDscrThreshold) }), actual: r.dscrMin !== null ? fmtX(r.dscrMin) : "—", target: fmtX(inputs.minDscrThreshold) }]
              : []),
          ]}
        />
      </div>
    );
  }

  return (
    <div>
      <MetricGroup eyebrow={t("globalApp.section1")} title={t("dashboardR3.sectionLandDevelopment")}>
        <MetricRow label={t("metricRow.landArea")} value={formatMetricArea(r.landArea)} />
        <MetricRow label={t("metricRow.landMarketValue")} value={formatRecommendationCurrency(r.landMarketValue)} />
        <MetricRow label={t("metricRow.floorPlateArea")} value={formatMetricArea(r.floorPlateArea)} />
        <MetricRow label={t("metricRow.totalFloorArea")} value={formatMetricArea(r.totalOfficeFloorArea)} />
        <MetricRow label={t("metricRow.totalBasementArea")} value={formatMetricArea(r.totalBasementArea)} />
        <MetricRow label={t("metricRow.totalNetLeasableArea")} value={formatMetricArea(r.totalNetLeasableArea)} strong />
      </MetricGroup>

      <MetricGroup eyebrow={t("globalApp.sectionCombined2And3")} title={t("dashboardR3.sectionProjectCost")}>
        <MetricRow label={t("metricRow.totalConstructionCost")} value={formatRecommendationCurrency(r.totalConstructionCost)} />
        <MetricRow label={t("metricRow.landCommissionAndTransferFee")} value={formatRecommendationCurrency(r.landCommission + r.landTransferFee)} />
        <MetricRow label={t("metricRow.totalLandAcquisitionCost")} value={formatRecommendationCurrency(r.totalLandAcquisitionCost)} />
        <MetricRow label={t("metricRow.totalProjectCost")} value={formatRecommendationCurrency(r.totalProjectCost)} strong />
        <MetricRow label={t("metricRow.costPerLeasableSqm")} value={formatMetricCurrencyPerArea(r.costPerSqm)} />
      </MetricGroup>

      <MetricGroup eyebrow={t("globalApp.section4")} title={t("dashboardR3.sectionRevenueNoi")}>
        <MetricRow label={t("metricRowR2B2.grossRentalIncomeFullOccupancy")} value={formatRecommendationCurrency(r.grossRentalIncome)} />
        <MetricRow label={t("metricRowR2B2.actualRentalIncome")} value={formatRecommendationCurrency(r.actualRentalIncome)} />
        <MetricRow label={t("metricRowR2B2.serviceIncome")} value={formatRecommendationCurrency(r.serviceIncome)} />
        <MetricRow label={t("metricRowR2B2.totalOperatingRevenue")} value={formatRecommendationCurrency(r.totalOperatingRevenue)} />
        <MetricRow label={t("metricRowR2B2.operatingExpenses")} value={formatRecommendationCurrency(r.operatingExpenses)} />
        <MetricRow label={t("metricRowR2B2.stabilizedNoi")} value={formatRecommendationCurrency(r.stabilizedNOI)} strong />
      </MetricGroup>

      <MetricGroup eyebrow={t("globalApp.section5")} title={t("dashboardR3.sectionYieldValuationLand")}>
        <MetricRow label={t("metricRowR2B2.capRateOnCost")} value={fmtPct(r.capRateOnCost)} strong />
        <MetricRow label={t("metricRowR2B2.marketValueAfterCompletion")} value={formatRecommendationCurrency(r.marketValueAfterCompletion)} />
        <MetricRow label={t("metricRowR2B2.valueSurplusOverCost")} value={formatMetricCurrencySigned(r.valueSurplusOverCost)} positiveNegative={r.valueSurplusOverCost >= 0} />
        <MetricRow label={t("metricRowR2B2.simplePaybackYears")} value={formatRecommendationYears(r.simplePaybackYears)} strong />
        <MetricRow
          label={t("metricRowR2B2.maxJustifiedLandPricePerSqm")}
          value={formatMetricCurrencyPerArea(r.maxJustifiedLandPricePerSqm)}
          note={t("metricRowR2B2.maxJustifiedLandPriceNote", { value: formatMetricCurrencyPerArea(inputs.landPricePerSqm) })}
          positiveNegative={r.maxJustifiedLandPricePerSqm >= inputs.landPricePerSqm}
        />
      </MetricGroup>

      {inputs.leverageEnabled ? (
        <MetricGroup eyebrow={t("globalApp.section6")} title={t("dashboardR3.sectionFinancing", { structure: inputs.financingStructureLabel })}>
          <MetricRow label={t("metricRowR2B3.loanAmountLand")} value={formatRecommendationCurrency(r.loanAmount)} />
          <MetricRow label={t("metricRowR2B3.equityRequired")} value={formatRecommendationCurrency(r.equityRequired)} strong />
          <MetricRow label={t("metricRowR2B3.constructionLoanBalance")} value={formatRecommendationCurrency(r.constructionLoanBalance)} />
          <MetricRow label={t("metricRowR2B3.debtService")} value={formatRecommendationCurrency(r.debtService)} />
          <MetricRow label={t("metricRowR2B3.dscrMinLabel")} value={r.dscrMin !== null ? fmtX(r.dscrMin) : "—"} positiveNegative={r.dscrMin !== null ? r.dscrMin >= inputs.minDscrThreshold : undefined} />
          <MetricRow label={t("metricRowR2B3.leveredIrr")} value={fmtPct(r.leveredIRR)} strong />
          <MetricRow label={t("metricRowR2B3.leveredNpv")} value={formatRecommendationCurrency(r.leveredNPV)} note={t("metricRowR2B3.leveredNpvNoteLand", { rate: fmtPct(r.equityDiscountRate) })} />
        </MetricGroup>
      ) : null}

      <RegulatoryStatusCard
        items={[
          { checked: inputs.titleDeedVerified, label: t("dashboardR3.regLandTitleDeedVerified") },
          { checked: inputs.zoningConfirmed, label: t("dashboardR3.regZoningConfirmed") },
          { checked: inputs.buildingPermitStatus === "صادر", label: t("dashboardR3.regBuildingPermitStatusLabel", { status: getBuildingPermitStatusLabel(inputs.buildingPermitStatus, t) }) },
          { checked: inputs.soilStudyDone, label: t("dashboardR3.regSoilStudyDone") },
          { checked: inputs.utilitiesConfirmed, label: t("dashboardR3.regUtilitiesConfirmed") },
        ]}
      />

      <RecommendationCard
        results={r}
        criteria={[
          { ok: r.c1, label: t("recommendation.criteria.ldPayback", { years: inputs.maxPaybackThreshold }), actual: formatRecommendationYears(r.simplePaybackYears), target: `${inputs.maxPaybackThreshold} ${t("units.years")}` },
          { ok: r.c2, label: t("recommendation.criteria.ldReturnOnCost"), actual: fmtPct(r.capRateOnCost), target: fmtPct(1 / inputs.maxPaybackThreshold) },
          { ok: r.c3, label: t("recommendation.criteria.ldIrrVsHurdle"), actual: fmtPct(r.irr), target: fmtPct(inputs.hurdleRate) },
          { ok: r.c4, label: t("recommendation.criteria.ldMarketValueVsCost"), actual: formatRecommendationCurrency(r.marketValueAfterCompletion), target: formatRecommendationCurrency(r.totalProjectCost) },
          ...(inputs.leverageEnabled
            ? [{ ok: r.c5, label: t("recommendation.criteria.dscr", { value: fmtX(inputs.minDscrThreshold) }), actual: r.dscrMin !== null ? fmtX(r.dscrMin) : "—", target: fmtX(inputs.minDscrThreshold) }]
            : []),
        ]}
      />
    </div>
  );
}

// ============================================================
// CASH FLOW TAB
// ============================================================
function CashFlowTab({ mode, inputs, results }) {
  const { t } = useLocale();
  // R7: fmtSAR() is the global formatter, hardcoded to "ريال" -- it has no
  // access to t()/locale since it's defined outside any component. This was
  // the ONLY remaining call site of fmtSAR() in the entire file (grep-
  // confirmed); rather than modify the global function (touching every other
  // theoretical caller and risking wider regression), a local formatter is
  // used here, matching the exact pattern already established for
  // formatSigned/formatMetricCurrencySigned elsewhere in R2B-2/R4-A.
  const formatCurrencyLocalized = (n) => (isFinite(n) ? `${fmtNum(n)} ${t("units.sar")}` : "—");
  const [view, setView] = useState("unlevered");
  const showLevered = inputs.leverageEnabled;
  const activeCashflows = showLevered && view === "levered" ? results.leveredCashflows : results.cashflows;
  const activeIRR = showLevered && view === "levered" ? results.leveredIRR : results.irr;
  const activeNPV = showLevered && view === "levered" ? results.leveredNPV : results.npv;

  return (
    <div>
      <MetricGroup eyebrow={mode === "building" ? t("globalApp.section7") : t("globalApp.section6")} title={t("cashFlow.sectionTitle")}>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: COLORS.slate }}>
          {mode === "building" ? t("cashFlow.descBuilding") : t("cashFlow.descLand")}
        </p>
        {showLevered ? (
          <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}` }}>
            {[
              { key: "unlevered", label: t("cashFlow.viewUnlevered") },
              { key: "levered", label: t("cashFlow.viewLevered") },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setView(o.key)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium"
                style={{ background: view === o.key ? COLORS.brass : "transparent", color: view === o.key ? COLORS.ink : COLORS.slate }}
              >
                {o.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 mb-4">
          <KPIChip label={t("cashFlow.kpiIrr")} value={fmtPct(activeIRR)} accent icon={TrendingUp} />
          <KPIChip label={t("cashFlow.kpiNpv")} value={formatCurrencyLocalized(activeNPV)} icon={Wallet} />
          {showLevered && view === "levered" ? (
            <KPIChip label={t("cashFlow.kpiDscrMin")} value={results.dscrMin !== null ? fmtX(results.dscrMin) : "—"} icon={Percent} />
          ) : null}
        </div>
        <CashFlowChart cashflows={activeCashflows} />
      </MetricGroup>
      <MetricGroup eyebrow={t("cashFlow.tableEyebrow")} title={t("cashFlow.tableTitle")}>
        <CashFlowTable cashflows={activeCashflows} />
      </MetricGroup>
    </div>
  );
}

// ============================================================
// SENSITIVITY TAB
// ============================================================
function SensitivityTab({ mode, inputs }) {
  const { t } = useLocale();
  const data = useMemo(() => buildSensitivityData(mode, inputs, t), [mode, inputs, t]);
  const irrKindLabel = inputs.leverageEnabled ? t("kpi.irrLevered") : t("kpi.irrUnlevered");
  return (
    <div>
      <MetricGroup eyebrow={t("sensitivity.sectionEyebrowAnalysis")} title={t("sensitivity.sectionTitleAnalysis", { irrKind: irrKindLabel })}>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: COLORS.slate }}>
          {t("sensitivity.descLine1", { irrKind: irrKindLabel })}
          {inputs.leverageEnabled ? " " + t("sensitivity.descLine2Levered") : ""}
        </p>
        <SensitivityChart data={data} />
      </MetricGroup>
      <MetricGroup eyebrow={t("sensitivity.sectionEyebrowDetail")} title={t("sensitivity.sectionTitleDetail", { irrKind: irrKindLabel })}>
        {data.map((d, i) => (
          <MetricRow key={i} label={d.label} value={`${fmtPct(d.lo)} — ${fmtPct(d.hi)}`} note={t("sensitivity.rangeNote", { range: fmtPct(d.range) })} />
        ))}
      </MetricGroup>
    </div>
  );
}

// ============================================================
// INPUT PANEL — EXISTING BUILDING
// ============================================================
function BuildingInputPanel({ inputs, setInputs }) {
  const { t } = useLocale();
  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));
  return (
    <div>
      <Section eyebrow={t("globalApp.section1")} title={t("inputBuilding.sec1")} defaultOpen>
        <NumField label={t("inputBuilding.landLength")} unit={t("inputBuilding.unitMeterLinear")} value={inputs.landLength} onChange={(v) => patch("landLength", v)} />
        <NumField label={t("inputBuilding.landWidth")} unit={t("inputBuilding.unitMeterLinear")} value={inputs.landWidth} onChange={(v) => patch("landWidth", v)} />
        <NumField label={t("inputBuilding.buildingAge")} unit={t("inputBuilding.unitYear")} value={inputs.buildingAge} onChange={(v) => patch("buildingAge", v)} min={0} />
        <Divider />
        <NumField label={t("inputBuilding.basementCount")} unit={t("inputBuilding.unitBasement")} value={inputs.basementCount} onChange={(v) => patch("basementCount", v)} min={0} />
        <NumField label={t("inputBuilding.basementAreaEach")} unit={t("inputBuilding.unitSqm")} value={inputs.basementAreaEach} onChange={(v) => patch("basementAreaEach", v)} />
        <NumField label={t("inputBuilding.parkingAreaPerSpot")} unit={t("inputBuilding.unitSqmSpot")} value={inputs.parkingAreaPerSpot} onChange={(v) => patch("parkingAreaPerSpot", v)} />
        <Divider />
        <NumField label={t("inputBuilding.floorCount")} unit={t("inputBuilding.unitFloor")} value={inputs.floorCount} onChange={(v) => patch("floorCount", v)} min={1} />
        <NumField label={t("inputBuilding.floorAreaEach")} unit={t("inputBuilding.unitSqm")} value={inputs.floorAreaEach} onChange={(v) => patch("floorAreaEach", v)} />
        <PercentField label={t("inputBuilding.efficiencyRatio")} value={inputs.efficiencyRatio} onChange={(v) => patch("efficiencyRatio", v)} warnAbove={0.95} warnText={t("inputBuilding.efficiencyRatioWarn")} />
        <NumField
          label={t("inputBuilding.netLeasableOverride")}
          unit={t("inputBuilding.unitSqm")}
          value={inputs.netLeasableOverride}
          onChange={(v) => patch("netLeasableOverride", v)}
          min={0}
          note={t("inputBuilding.netLeasableOverrideNote")}
        />
        <NumField label={t("inputBuilding.serviceElevators")} unit={t("inputBuilding.unitElevator")} value={inputs.serviceElevators} onChange={(v) => patch("serviceElevators", v)} min={0} />
      </Section>

      <Section eyebrow={t("globalApp.section2")} title={t("inputBuilding.sec2")}>
        <NumField label={t("inputBuilding.buildingPrice")} unit={t("inputBuilding.unitSar")} value={inputs.buildingPrice} onChange={(v) => patch("buildingPrice", v)} />
        <PercentField label={t("inputBuilding.commissionRate")} value={inputs.commissionRate} onChange={(v) => patch("commissionRate", v)} />
        <PercentField label={t("inputBuilding.transferFeeRate")} value={inputs.transferFeeRate} onChange={(v) => patch("transferFeeRate", v)} />
        <NumField label={t("inputBuilding.inspectionCost")} unit={t("inputBuilding.unitSar")} value={inputs.inspectionCost} onChange={(v) => patch("inspectionCost", v)} />
        <NumField label={t("inputBuilding.valuationCost")} unit={t("inputBuilding.unitSar")} value={inputs.valuationCost} onChange={(v) => patch("valuationCost", v)} />
      </Section>

      <Section eyebrow={t("globalApp.section3")} title={t("inputBuilding.sec3")}>
        <NumField label={t("inputBuilding.rentPerSqm")} unit={t("inputBuilding.unitSarSqmYear")} value={inputs.rentPerSqm} onChange={(v) => patch("rentPerSqm", v)} />
        <PercentField label={t("inputBuilding.occupancyRate")} value={inputs.occupancyRate} onChange={(v) => patch("occupancyRate", v)} warnAbove={1} warnText={t("inputBuilding.occupancyRateWarn")} />
        <SelectField
          label={t("dashboardR3.selectLeaseStatus")}
          value={inputs.leaseStatus}
          onChange={(v) => patch("leaseStatus", v)}
          options={Object.keys(LEASE_STATUS_PRESENTATION_KEYS).map((raw) => ({ value: raw, label: getLeaseStatusLabel(raw, t) }))}
          note={t("dashboardR3.leaseStatusNote")}
        />
        <NumField label={t("inputBuilding.leaseYears")} unit={t("inputBuilding.unitYear")} value={inputs.leaseYears} onChange={(v) => patch("leaseYears", v)} min={1} />
        <PercentField label={t("inputBuilding.vatRate")} value={inputs.vatRate} onChange={(v) => patch("vatRate", v)} />
        <PercentField label={t("inputBuilding.serviceIncomeRate")} value={inputs.serviceIncomeRate} onChange={(v) => patch("serviceIncomeRate", v)} />
      </Section>

      <Section eyebrow={t("globalApp.section4")} title={t("inputBuilding.sec4")}>
        <PercentField label={t("inputBuilding.maintenanceRate")} note={t("inputBuilding.maintenanceRateNote")} value={inputs.maintenanceRate} onChange={(v) => patch("maintenanceRate", v)} />
        <PercentField label={t("inputBuilding.insuranceRate")} note={t("inputBuilding.insuranceRateNote")} value={inputs.insuranceRate} onChange={(v) => patch("insuranceRate", v)} />
      </Section>

      <Section eyebrow={t("globalApp.section5")} title={t("inputBuilding.sec5")}>
        <PercentField label={t("inputBuilding.marketCapRate")} value={inputs.marketCapRate} onChange={(v) => patch("marketCapRate", v)} warnBelow={0.04} warnAbove={0.12} />
        <PercentField label={t("inputBuilding.discountRate")} value={inputs.discountRate} onChange={(v) => patch("discountRate", v)} warnBelow={0.04} warnAbove={0.15} />
        <NumField label={t("inputBuilding.holdPeriod")} unit={t("inputBuilding.unitYear")} value={inputs.holdPeriod} onChange={(v) => patch("holdPeriod", v)} min={1} warnAbove={20} />
        <PercentField label={t("inputBuilding.rentGrowthRate")} note={t("inputBuilding.rentGrowthRateNote")} value={inputs.rentGrowthRate} onChange={(v) => patch("rentGrowthRate", v)} warnAbove={0.15} />
        <Divider />
        <NumField label={t("inputBuilding.basementConstructionCostPerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.basementConstructionCostPerSqm} onChange={(v) => patch("basementConstructionCostPerSqm", v)} />
        <NumField label={t("inputBuilding.floorConstructionCostPerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.floorConstructionCostPerSqm} onChange={(v) => patch("floorConstructionCostPerSqm", v)} />
        <NumField label={t("inputBuilding.currentLandPricePerSqm")} unit={t("inputBuilding.unitSarSqm")} value={inputs.currentLandPricePerSqm} onChange={(v) => patch("currentLandPricePerSqm", v)} />
        <NumField label={t("inputBuilding.buildingUsefulLife")} unit={t("inputBuilding.unitYear")} value={inputs.buildingUsefulLife} onChange={(v) => patch("buildingUsefulLife", v)} min={1} />
      </Section>

      <Section eyebrow={t("globalApp.section6")} title={t("inputBuilding.sec6")}>
        <PercentField label={t("inputBuilding.minYieldThreshold")} value={inputs.minYieldThreshold} onChange={(v) => patch("minYieldThreshold", v)} />
        <NumField label={t("inputBuilding.maxPaybackThreshold")} unit={t("inputBuilding.unitYear")} value={inputs.maxPaybackThreshold} onChange={(v) => patch("maxPaybackThreshold", v)} min={1} />
      </Section>

      <Section eyebrow={t("globalApp.section7")} title={t("financingInput.section")}>
        <Toggle
          label={t("financing.toggle")}
          note={t("financingInput.toggleNote")}
          checked={inputs.leverageEnabled}
          onChange={(v) => patch("leverageEnabled", v)}
        />
        <SelectField label={t("financingInput.structureLabel")} value={inputs.financingStructureLabel} onChange={(v) => patch("financingStructureLabel", v)} options={Object.keys(FINANCING_STRUCTURE_PRESENTATION_KEYS).map((raw) => ({ value: raw, label: getFinancingStructureLabel(raw, t) }))} />
        <PercentField label={t("financingInput.ltvLabelBuilding")} value={inputs.ltv} onChange={(v) => patch("ltv", v)} warnAbove={0.9} warnText={t("financingInput.ltvWarnBuilding")} />
        <PercentField label={t("financingInput.loanRateLabel")} value={inputs.loanRate} onChange={(v) => patch("loanRate", v)} warnBelow={0.02} warnAbove={0.15} />
        <NumField label={t("financingInput.loanTenorLabelBuilding")} unit={t("inputBuilding.unitYear")} value={inputs.loanTenor} onChange={(v) => patch("loanTenor", v)} min={1} warnAbove={25} note={t("financingInput.loanTenorNoteBuilding")} />
        <PercentField label={t("inputBuilding.minDscrThreshold")} value={inputs.minDscrThreshold} onChange={(v) => patch("minDscrThreshold", v)} warnBelow={1} warnText={t("inputBuilding.minDscrThresholdWarn")} note={t("inputBuilding.minDscrThresholdNote")} />
        <PercentField label={t("inputBuilding.equityRiskSpread")} value={inputs.equityRiskSpread} onChange={(v) => patch("equityRiskSpread", v)} note={t("inputBuilding.equityRiskSpreadNote")} />
      </Section>

      <Section eyebrow={t("globalApp.section8")} title={t("inputBuilding.sec8")}>
        <Toggle label={t("inputBuilding.titleDeedVerified")} checked={inputs.titleDeedVerified} onChange={(v) => patch("titleDeedVerified", v)} />
        <Toggle label={t("inputBuilding.complianceCertified")} checked={inputs.complianceCertified} onChange={(v) => patch("complianceCertified", v)} />
        <Toggle
          label={t("inputBuilding.rentFreezeChecked")}
          note={t("inputBuilding.rentFreezeCheckedNote")}
          checked={inputs.rentFreezeChecked}
          onChange={(v) => patch("rentFreezeChecked", v)}
        />
      </Section>
    </div>
  );
}

// ============================================================
// INPUT PANEL — LAND + DEVELOPMENT
// ============================================================
function LandInputPanel({ inputs, setInputs }) {
  const { t } = useLocale();
  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));
  return (
    <div>
      <Section eyebrow={t("globalApp.section1")} title={t("inputLand.sec1")} defaultOpen>
        <NumField label={t("inputLand.landLength")} unit={t("inputLand.unitMeter")} value={inputs.landLength} onChange={(v) => patch("landLength", v)} />
        <NumField label={t("inputLand.landWidth")} unit={t("inputLand.unitMeter")} value={inputs.landWidth} onChange={(v) => patch("landWidth", v)} />
        <NumField label={t("inputLand.landPricePerSqm")} unit={t("inputLand.unitSarSqm")} value={inputs.landPricePerSqm} onChange={(v) => patch("landPricePerSqm", v)} />
      </Section>

      <Section eyebrow={t("globalApp.section2")} title={t("inputLand.sec2")}>
        <PercentField label={t("inputLand.buildableRatio")} value={inputs.buildableRatio} onChange={(v) => patch("buildableRatio", v)} warnAbove={0.9} />
        <SelectField label={t("dashboardR3.selectBuildingType")} value={inputs.buildingTypeLabel} onChange={(v) => patch("buildingTypeLabel", v)} options={Object.keys(BUILDING_TYPE_PRESENTATION_KEYS).map((raw) => ({ value: raw, label: getBuildingTypeLabel(raw, t) }))} />
        <NumField label={t("inputLand.officeFloorCount")} unit={t("inputBuilding.unitFloor")} value={inputs.officeFloorCount} onChange={(v) => patch("officeFloorCount", v)} min={1} />
        <PercentField label={t("inputLand.servicesRatioPerFloor")} value={inputs.servicesRatioPerFloor} onChange={(v) => patch("servicesRatioPerFloor", v)} warnAbove={0.4} warnText={t("inputLand.servicesRatioPerFloorWarn")} />
        <NumField label={t("inputLand.basementFloorCount")} unit={t("inputBuilding.unitFloor")} value={inputs.basementFloorCount} onChange={(v) => patch("basementFloorCount", v)} min={0} />
      </Section>

      <Section eyebrow={t("globalApp.section3")} title={t("inputLand.sec3")}>
        <NumField
          label={t("inputLand.constructionCostPerSqm")}
          unit={t("inputLand.unitSarSqm")}
          value={inputs.constructionCostPerSqm}
          onChange={(v) => patch("constructionCostPerSqm", v)}
          note={t("inputLand.constructionCostPerSqmNote")}
        />
      </Section>

      <Section eyebrow={t("globalApp.section4")} title={t("inputLand.sec4")}>
        <PercentField label={t("inputLand.landCommissionRate")} value={inputs.landCommissionRate} onChange={(v) => patch("landCommissionRate", v)} />
        <PercentField label={t("inputLand.landTransferFeeRate")} value={inputs.landTransferFeeRate} onChange={(v) => patch("landTransferFeeRate", v)} />
        <NumField label={t("inputLand.engineeringCost")} unit={t("inputLand.unitSar")} value={inputs.engineeringCost} onChange={(v) => patch("engineeringCost", v)} />
        <NumField label={t("inputLand.landValuationCost")} unit={t("inputLand.unitSar")} value={inputs.landValuationCost} onChange={(v) => patch("landValuationCost", v)} />
      </Section>

      <Section eyebrow={t("globalApp.section5")} title={t("inputLand.sec5")}>
        <NumField label={t("inputLand.marketRentPerSqm")} unit={t("inputBuilding.unitSarSqmYear")} value={inputs.marketRentPerSqm} onChange={(v) => patch("marketRentPerSqm", v)} />
        <PercentField label={t("inputLand.occupancyRate")} value={inputs.occupancyRate} onChange={(v) => patch("occupancyRate", v)} warnAbove={1} warnText={t("inputLand.occupancyRateWarn")} />
        <PercentField label={t("inputLand.serviceIncomeRate")} value={inputs.serviceIncomeRate} onChange={(v) => patch("serviceIncomeRate", v)} />
        <PercentField label={t("inputLand.opexRate")} value={inputs.opexRate} onChange={(v) => patch("opexRate", v)} />
      </Section>

      <Section eyebrow={t("globalApp.section6")} title={t("inputLand.sec6")}>
        <NumField
          label={t("inputLand.constructionPeriod")}
          unit={t("inputLand.unitYear")}
          value={inputs.constructionPeriod}
          onChange={(v) => patch("constructionPeriod", v)}
          min={1}
          warnAbove={5}
          note={t("inputLand.constructionPeriodNote")}
        />
        <PercentField label={t("inputLand.rentGrowthRate")} value={inputs.rentGrowthRate} onChange={(v) => patch("rentGrowthRate", v)} warnAbove={0.15} />
        <NumField label={t("inputLand.operatingPeriod")} unit={t("inputLand.unitYear")} value={inputs.operatingPeriod} onChange={(v) => patch("operatingPeriod", v)} min={1} warnAbove={25} />
        <PercentField label={t("inputLand.marketCapRate")} value={inputs.marketCapRate} onChange={(v) => patch("marketCapRate", v)} warnBelow={0.04} warnAbove={0.12} />
        <PercentField label={t("inputLand.exitCapRate")} value={inputs.exitCapRate} onChange={(v) => patch("exitCapRate", v)} warnBelow={0.04} warnAbove={0.12} />
        <PercentField label={t("inputLand.exitTransferFeeRate")} value={inputs.exitTransferFeeRate} onChange={(v) => patch("exitTransferFeeRate", v)} note={t("inputLand.exitTransferFeeRateNote")} />
        <PercentField label={t("inputLand.hurdleRate")} value={inputs.hurdleRate} onChange={(v) => patch("hurdleRate", v)} warnBelow={0.04} warnAbove={0.2} />
        <NumField label={t("inputLand.maxPaybackThreshold")} unit={t("inputLand.unitYear")} value={inputs.maxPaybackThreshold} onChange={(v) => patch("maxPaybackThreshold", v)} min={1} />
      </Section>

      <Section eyebrow={t("globalApp.section7")} title={t("financingInput.section")}>
        <Toggle
          label={t("financing.toggle")}
          note={t("financingInput.toggleNote")}
          checked={inputs.leverageEnabled}
          onChange={(v) => patch("leverageEnabled", v)}
        />
        <SelectField label={t("financingInput.structureLabel")} value={inputs.financingStructureLabel} onChange={(v) => patch("financingStructureLabel", v)} options={Object.keys(FINANCING_STRUCTURE_PRESENTATION_KEYS).map((raw) => ({ value: raw, label: getFinancingStructureLabel(raw, t) }))} />
        <PercentField label={t("financingInput.ltvLabelLand")} value={inputs.ltv} onChange={(v) => patch("ltv", v)} warnAbove={0.9} warnText={t("financingInput.ltvWarnLand")} />
        <PercentField label={t("financingInput.loanRateLabel")} value={inputs.loanRate} onChange={(v) => patch("loanRate", v)} warnBelow={0.02} warnAbove={0.15} note={t("financingInput.loanRateNoteLand")} />
        <NumField label={t("financingInput.loanTenorLabelLand")} unit={t("inputLand.unitYear")} value={inputs.loanTenor} onChange={(v) => patch("loanTenor", v)} min={1} warnAbove={25} note={t("financingInput.loanTenorNoteLand")} />
        <PercentField label={t("inputLand.minDscrThreshold")} value={inputs.minDscrThreshold} onChange={(v) => patch("minDscrThreshold", v)} warnBelow={1} warnText={t("inputLand.minDscrThresholdWarn")} note={t("inputLand.minDscrThresholdNote")} />
        <PercentField label={t("inputLand.equityRiskSpread")} value={inputs.equityRiskSpread} onChange={(v) => patch("equityRiskSpread", v)} note={t("inputLand.equityRiskSpreadNote")} />
      </Section>

      <Section eyebrow={t("globalApp.section8")} title={t("inputLand.sec8")}>
        <Toggle label={t("inputLand.titleDeedVerified")} checked={inputs.titleDeedVerified} onChange={(v) => patch("titleDeedVerified", v)} />
        <Toggle label={t("inputLand.zoningConfirmed")} checked={inputs.zoningConfirmed} onChange={(v) => patch("zoningConfirmed", v)} />
        <SelectField label={t("dashboardR3.selectBuildingPermitStatus")} value={inputs.buildingPermitStatus} onChange={(v) => patch("buildingPermitStatus", v)} options={Object.keys(BUILDING_PERMIT_STATUS_PRESENTATION_KEYS).map((raw) => ({ value: raw, label: getBuildingPermitStatusLabel(raw, t) }))} />
        <Toggle label={t("inputLand.soilStudyDone")} checked={inputs.soilStudyDone} onChange={(v) => patch("soilStudyDone", v)} />
        <Toggle label={t("inputLand.utilitiesConfirmed")} checked={inputs.utilitiesConfirmed} onChange={(v) => patch("utilitiesConfirmed", v)} />
      </Section>
    </div>
  );
}

// ============================================================
// MODE SWITCH + TABS
// ============================================================
function ModeSwitch({ mode, setMode }) {
  const { t } = useLocale();
  const options = [
    { key: "building", label: t("mode.building"), icon: Building2 },
    { key: "land", label: t("mode.land"), icon: Landmark },
  ];
  return (
    <div className="inline-flex p-1 rounded-xl" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}` }}>
      {options.map((o) => {
        const active = mode === o.key;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => setMode(o.key)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: active ? COLORS.brass : "transparent",
              color: active ? COLORS.ink : COLORS.slate,
            }}
          >
            <Icon size={14} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Tabs({ value, onChange }) {
  const { t } = useLocale();
  const tabs = [
    { key: "dashboard", label: t("tabs.dashboard") },
    { key: "cashflow", label: t("tabs.cashflow") },
    { key: "sensitivity", label: t("tabs.sensitivity") },
  ];
  return (
    <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className="flex-1 rf-display text-xs md:text-sm font-semibold py-2 rounded-lg transition-colors"
            style={{
              background: active ? COLORS.panelRaised : "transparent",
              color: active ? COLORS.brass : COLORS.slate,
              borderBottom: active ? `2px solid ${COLORS.brass}` : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// KPI RIBBON (mode-aware)
// ============================================================
function KPIRibbon({ mode, results, leverageEnabled }) {
  const { t } = useLocale();
  const formatKpiCurrency = (n) => (isFinite(n) ? `${fmtNum(n)} ${t("units.sar")}` : "—");
  const formatKpiYears = (n) => (isFinite(n) ? `${n.toFixed(1)} ${t("units.years")}` : "—");
  const r = results;
  const noiLabel = mode === "building" ? t("kpi.noiExisting") : t("kpi.noiStabilized");
  const noiValue = mode === "building" ? r.NOI : r.stabilizedNOI;
  const yieldLabel = mode === "building" ? t("kpi.yieldOnPrice") : t("kpi.yieldOnCost");
  const yieldValue = mode === "building" ? r.netYieldOnPrice : r.capRateOnCost;
  const paybackValue = mode === "building" ? r.paybackOnPrice : r.simplePaybackYears;
  const irrLabel = leverageEnabled ? t("kpi.irrLevered") : t("kpi.irrUnlevered");
  const irrValue = leverageEnabled ? r.leveredIRR : r.irr;
  const npvLabel = leverageEnabled ? t("kpi.npvLevered") : t("kpi.npvUnlevered");
  const npvValue = leverageEnabled ? r.leveredNPV : r.npv;

  return (
    <div
      className="sticky top-2 z-20 rounded-2xl p-3 mb-6"
      style={{ background: `${COLORS.panel}F2`, backdropFilter: "blur(8px)", border: `1px solid ${COLORS.hairline}` }}
    >
      <div className="flex flex-wrap items-stretch gap-2">
        <KPIChip label={noiLabel} value={formatKpiCurrency(noiValue)} icon={Wallet} />
        <KPIChip label={yieldLabel} value={fmtPct(yieldValue)} icon={Percent} />
        <KPIChip label={irrLabel} value={fmtPct(irrValue)} icon={TrendingUp} accent sub={leverageEnabled ? t("kpi.unleveredSub", { value: fmtPct(r.irr) }) : undefined} />
        <KPIChip label={npvLabel} value={formatKpiCurrency(npvValue)} icon={ArrowUpRight} />
        <KPIChip label={t("kpi.payback")} value={formatKpiYears(paybackValue)} icon={Calendar} />
        <div className="flex items-center justify-center px-2">
          <VerdictSeal verdict={r.verdict} metCount={r.metCount} totalCriteria={r.totalCriteria} size="small" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SAVED DEALS PANEL (multi-deal persistence)
// ============================================================
function DealsPanel({
  open, onClose, savedDeals, dealsLoading, activeDealId, mode,
  onLoadBuiltIn, onLoadDeal, onDeleteDeal, onSaveNew, onUpdateActive,
  saveNameInput, setSaveNameInput, savingInProgress, dealsError,
  onExportBackup, onImportBackup, backupMessage,
}) {
  const { t, locale } = useLocale();
  if (!open) return null;
  const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "#00000099" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("savedDeals.panelTitle")}
        onKeyDown={handleKeyDown}
        className="w-full md:w-[480px] max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5"
        style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="rf-display text-base font-bold" style={{ color: COLORS.parchment }}>{t("savedDeals.panelTitle")}</span>
          <button type="button" onClick={onClose} aria-label={t("globalApp.closePanel")} autoFocus style={{ color: COLORS.slate }}>
            <XCircle size={20} />
          </button>
        </div>

        <div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>{t("savedDeals.referenceStudies")}</div>
        <div className="flex gap-2 mb-5">
          <button
            type="button"
            onClick={() => onLoadBuiltIn("building")}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
            style={{
              background: !activeDealId && mode === "building" ? COLORS.panelRaised : "transparent",
              border: `1px solid ${COLORS.hairline}`, color: COLORS.parchment,
            }}
          >
            <Building2 size={14} style={{ color: COLORS.brass }} /> {t("savedDeals.builtinBuilding")}
          </button>
          <button
            type="button"
            onClick={() => onLoadBuiltIn("land")}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
            style={{
              background: !activeDealId && mode === "land" ? COLORS.panelRaised : "transparent",
              border: `1px solid ${COLORS.hairline}`, color: COLORS.parchment,
            }}
          >
            <Landmark size={14} style={{ color: COLORS.brass }} /> {t("savedDeals.builtinLand")}
          </button>
        </div>

        <div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>{t("savedDeals.mySavedDeals")}</div>
        {dealsLoading ? (
          <div className="text-xs mb-4" style={{ color: COLORS.slate }}>{t("savedDeals.loading")}</div>
        ) : savedDeals.length === 0 ? (
          <div className="text-xs mb-4" style={{ color: COLORS.slateDim }}>{t("savedDeals.emptyState")}</div>
        ) : (
          <div className="mb-4 flex flex-col gap-1.5">
            {savedDeals.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: activeDealId === d.id ? COLORS.panelRaised : "transparent", border: `1px solid ${COLORS.hairline}` }}
              >
                <button type="button" onClick={() => onLoadDeal(d.id)} className="flex-1 flex items-center gap-2 text-xs" style={{ color: COLORS.parchment }}>
                  {d.mode === "building" ? <Building2 size={13} style={{ color: COLORS.slate }} /> : <Landmark size={13} style={{ color: COLORS.slate }} />}
                  {getDealDisplayName(d, t)}
                </button>
                <button type="button" onClick={() => onDeleteDeal(d.id)} aria-label={t("globalApp.deleteDeal")} style={{ color: COLORS.negative }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {dealsError ? <div className="text-[11px] mb-3" style={{ color: COLORS.negative }}>{locale === "en" ? dealsError.message_en : dealsError.message_ar}</div> : null}

        {backupMessage ? <div className="text-[11px] mb-3" style={{ color: backupMessage.ok ? COLORS.brass : COLORS.negative }}>{locale === "en" ? backupMessage.en : backupMessage.ar}</div> : null}

        <Divider />
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={onExportBackup} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: COLORS.panelRaised, color: COLORS.parchment, border: `1px solid ${COLORS.hairline}` }}>
            {t("savedDeals.exportBackup")}
          </button>
          <label className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-center cursor-pointer" style={{ background: COLORS.panelRaised, color: COLORS.parchment, border: `1px solid ${COLORS.hairline}` }}>
            {t("savedDeals.importRestore")}
            <input type="file" accept="application/json" className="hidden" onChange={(e) => { if (e.target.files[0]) onImportBackup(e.target.files[0]); e.target.value = ""; }} />
          </label>
        </div>
        <div className="text-[10px] leading-relaxed mb-3" style={{ color: COLORS.slateDim }}>{t("savedDeals.durabilityDisclosure")}</div>
        <div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>{t("savedDeals.saveSectionTitle")}</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={saveNameInput}
            onChange={(e) => setSaveNameInput(e.target.value)}
            placeholder={t("savedDeals.namePlaceholder")}
            className="rf-input flex-1 px-3 py-2 text-xs rounded-lg"
            style={{ background: COLORS.panelInput, border: `1px solid ${COLORS.hairline}`, color: COLORS.parchment }}
          />
          <button
            type="button"
            onClick={onSaveNew}
            disabled={savingInProgress || !saveNameInput.trim()}
            className="px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5"
            style={{ background: COLORS.brass, color: COLORS.ink, opacity: savingInProgress || !saveNameInput.trim() ? 0.5 : 1 }}
          >
            <Save size={13} /> {t("savedDeals.saveButton")}
          </button>
        </div>
        {activeDealId ? (
          <button
            type="button"
            onClick={onUpdateActive}
            disabled={savingInProgress}
            className="w-full mt-2 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.brassDim}`, color: COLORS.brass }}
          >
            {t("savedDeals.updateButton")}
          </button>
        ) : null}
        <div className="text-[10px] mt-3 leading-relaxed" style={{ color: COLORS.slateDim }}>
          {t("savedDeals.saveNote")}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP SHELL
// ============================================================
export default function App() {
  const { t, dir, locale, setLocale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
  const [mode, setMode] = useState("building");
  // RUNTIME REMEDIATION: single centralized storage provider instance for
  // this App instance. If neither host nor browser storage is available,
  // storageProvider stays null and every Saved Deals operation surfaces an
  // explicit, user-visible error via the existing dealsError state -- no
  // silent success (NO_SILENT_STORAGE_SUCCESS).
  const [storageProvider] = useState(() => {
    try { return createStorageProvider(); } catch (e) { return null; }
  });

  const [activeTab, setActiveTab] = useState("dashboard");
  const [buildingInputs, setBuildingInputs] = useState(DEFAULT_BUILDING_INPUTS);
  const [landInputs, setLandInputs] = useState(DEFAULT_LAND_INPUTS);

  // DEFECT REMEDIATION D1: validateEngineInputs() at the calculateInvestmentCase
  // boundary can now throw ValidationError for invalid input (DEF-002/DEF-003).
  // useMemo must not let that exception escape uncaught -- React has no default
  // error boundary for render-time throws in a memo callback, and letting it
  // escape freezes/crashes the app (confirmed empirically). We catch it here,
  // keep showing the LAST KNOWN VALID result (not a blank/broken screen), and
  // surface a clear validationError state the UI displays alongside it.
  const lastValidBuildingResult = useRef(null);
  const lastValidLandResult = useRef(null);
  const [buildingValidationError, setBuildingValidationError] = useState(null);
  const [landValidationError, setLandValidationError] = useState(null);

  const buildingResults = useMemo(() => {
    try {
      const r = calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: buildingInputs, leverageEnabled: buildingInputs.leverageEnabled });
      lastValidBuildingResult.current = r;
      if (buildingValidationError) setBuildingValidationError(null);
      return r;
    } catch (e) {
      if (e.name === 'ValidationError') {
        if (!buildingValidationError || buildingValidationError.field !== e.field || buildingValidationError.value !== e.value) setBuildingValidationError({ field: e.field, value: e.value, rule: e.rule, message_ar: e.message_ar, message_en: e.message_en });
        return lastValidBuildingResult.current || calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs: DEFAULT_BUILDING_INPUTS, leverageEnabled: false });
      }
      throw e; // non-validation errors are real bugs -- do not swallow those
    }
  }, [buildingInputs]);
  const landResults = useMemo(() => {
    try {
      const r = calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: landInputs, leverageEnabled: landInputs.leverageEnabled });
      lastValidLandResult.current = r;
      if (landValidationError) setLandValidationError(null);
      return r;
    } catch (e) {
      if (e.name === 'ValidationError') {
        if (!landValidationError || landValidationError.field !== e.field || landValidationError.value !== e.value) setLandValidationError({ field: e.field, value: e.value, rule: e.rule, message_ar: e.message_ar, message_en: e.message_en });
        return lastValidLandResult.current || calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs: DEFAULT_LAND_INPUTS, leverageEnabled: false });
      }
      throw e;
    }
  }, [landInputs]);

  const inputs = mode === "building" ? buildingInputs : landInputs;
  const results = mode === "building" ? buildingResults : landResults;
  const activeValidationError = mode === "building" ? buildingValidationError : landValidationError;

  // --- Saved deals (multi-deal persistence) ---
  const [savedDeals, setSavedDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [activeDealId, setActiveDealId] = useState(null);
  const [dealsPanelOpen, setDealsPanelOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [dealsError, setDealsError] = useState(null);
  const activeDealName = activeDealId ? (savedDeals.find((d) => d.id === activeDealId) || {}).name : null;

  useEffect(() => {
    (async () => {
      try {
        const value = await storageProvider.get("deals-index");
        const list = value ? JSON.parse(value) : [];
        setSavedDeals(Array.isArray(list) ? list : []);
      } catch (e) {
        setSavedDeals([]);
      } finally {
        setDealsLoading(false);
      }
    })();
  }, []);

  const loadBuiltIn = (builtInMode) => {
    setMode(builtInMode);
    setActiveDealId(null);
    setActiveTab("dashboard");
    setDealsPanelOpen(false);
  };

  const loadDeal = async (id) => {
    setDealsError(null);
    try {
      const value = await storageProvider.get("deal:" + id);
      if (!value) { setDealsError({ code: "DEAL_NOT_FOUND", message_ar: "تعذّر العثور على الصفقة", message_en: "The deal could not be found" }); return; }
      const record = JSON.parse(value);
      validateSavedDealRecord(record); // SDI-001: structural validation boundary -- throws SavedDealValidationError on malformed shape; caught below, mapped to the existing DEAL_LOAD_FAILED public contract
      setMode(record.mode);
      if (record.mode === "building") setBuildingInputs({ ...DEFAULT_BUILDING_INPUTS, ...record.inputs });
      else setLandInputs({ ...DEFAULT_LAND_INPUTS, ...record.inputs });
      setActiveDealId(id);
      setActiveTab("dashboard");
      setDealsPanelOpen(false);
    } catch (e) {
      setDealsError({ code: "DEAL_LOAD_FAILED", message_ar: "تعذّر تحميل الصفقة", message_en: "The deal could not be loaded" });
    }
  };

  const saveCurrentAsNewDeal = async () => {
    const name = saveNameInput.trim();
    if (!name) return;
    // SDI-002: block persistence of an invalid current input state. Calls the
    // SAME canonical validator calculateInvestmentCase() uses internally,
    // independent of React state (buildingValidationError/etc. could in
    // principle be stale) -- not a second validation engine, the identical
    // function. On ValidationError, no write occurs and we return silently:
    // the existing active-validation disclosure (already visible whenever
    // this condition holds, per R6) already explains why to the user -- no
    // new error code is introduced, per this task's explicit instruction not
    // to conflate this with DEAL_SAVE_FAILED (a storage-infrastructure code).
    try { validateEngineInputs({ ...inputs, leverageEnabled: inputs.leverageEnabled }); }
    catch (e) { if (e.name === 'ValidationError') return; throw e; }
    setSavingInProgress(true);
    setDealsError(null);
    try {
      const id = "deal_" + Date.now();
      const record = { id, name, mode, inputs, savedAt: new Date().toISOString() };
      await storageProvider.set("deal:" + id, JSON.stringify(record));
      const newIndex = [...savedDeals, { id, name, mode, savedAt: record.savedAt }];
      await storageProvider.set("deals-index", JSON.stringify(newIndex));
      setSavedDeals(newIndex);
      setActiveDealId(id);
      setSaveNameInput("");
    } catch (e) {
      setDealsError({ code: "DEAL_SAVE_FAILED", message_ar: "تعذّر الحفظ، حاول مرة أخرى", message_en: "Save failed, please try again" });
    } finally {
      setSavingInProgress(false);
    }
  };

  const updateActiveDeal = async () => {
    if (!activeDealId) return;
    // SDI-002: same persistence-safety boundary as saveCurrentAsNewDeal above.
    try { validateEngineInputs({ ...inputs, leverageEnabled: inputs.leverageEnabled }); }
    catch (e) { if (e.name === 'ValidationError') return; throw e; }
    setSavingInProgress(true);
    setDealsError(null);
    try {
      const existing = savedDeals.find((d) => d.id === activeDealId);
      const record = { id: activeDealId, name: existing ? existing.name : "صفقة", mode, inputs, savedAt: new Date().toISOString() };
      await storageProvider.set("deal:" + activeDealId, JSON.stringify(record));
      const newIndex = savedDeals.map((d) => (d.id === activeDealId ? { ...d, savedAt: record.savedAt } : d));
      await storageProvider.set("deals-index", JSON.stringify(newIndex));
      setSavedDeals(newIndex);
    } catch (e) {
      setDealsError({ code: "DEAL_UPDATE_FAILED", message_ar: "تعذّر تحديث الصفقة", message_en: "The deal could not be updated" });
    } finally {
      setSavingInProgress(false);
    }
  };

  const deleteDeal = async (id) => {
    setDealsError(null);
    try {
      await storageProvider.delete("deal:" + id);
      const newIndex = savedDeals.filter((d) => d.id !== id);
      await storageProvider.set("deals-index", JSON.stringify(newIndex));
      setSavedDeals(newIndex);
      if (activeDealId === id) setActiveDealId(null);
    } catch (e) {
      setDealsError({ code: "DEAL_DELETE_FAILED", message_ar: "تعذّر الحذف", message_en: "Delete failed" });
    }
  };

  const [backupMessage, setBackupMessage] = useState(null);

  const exportBackup = async () => {
    setBackupMessage(null);
    try {
      const payload = await buildExportPayload(savedDeals, storageProvider);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `startak-saved-deals-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMessage({ ok: true, ar: arDict.savedDeals.exportSuccess, en: enDict.savedDeals.exportSuccess });
    } catch (e) {
      setBackupMessage({ ok: false, ar: arDict.savedDeals.exportFailedCorrupt, en: enDict.savedDeals.exportFailedCorrupt });
    }
  };

  const importBackup = async (file) => {
    setBackupMessage(null);
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { throw new Error("INVALID_JSON"); }
      const existingRecordsById = new Map();
      for (const entry of savedDeals) {
        const raw = await storageProvider.get("deal:" + entry.id);
        if (raw) existingRecordsById.set(entry.id, raw);
      }
      const plan = planRestore(parsed, savedDeals, existingRecordsById); // throws on ANY structural problem -- zero writes happen before this line succeeds
      const newIndex = await commitRestore(plan, storageProvider);
      setSavedDeals(newIndex);
      setBackupMessage({ ok: true, ar: arDict.savedDeals.importSuccess, en: enDict.savedDeals.importSuccess });
    } catch (e) {
      setBackupMessage({ ok: false, ar: arDict.savedDeals.importFailedInvalid, en: enDict.savedDeals.importFailedInvalid });
    }
  };

  const resetCurrent = () => {
    if (activeDealId) {
      loadDeal(activeDealId);
    } else if (mode === "building") {
      setBuildingInputs(DEFAULT_BUILDING_INPUTS);
    } else {
      setLandInputs(DEFAULT_LAND_INPUTS);
    }
  };

  return (
    <div dir={dir} className="rf-root min-h-screen" style={{ background: COLORS.ink }}>
      <style>{GLOBAL_STYLE}</style>
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] tracking-[0.2em]" style={{ color: COLORS.brass }}>
              {t("app.title")} · {t("app.subtitle")}
            </div>
            <h1 className="rf-display text-2xl md:text-[28px] font-extrabold mt-1" style={{ color: COLORS.parchment }}>
              {t("app.engineName")}
            </h1>
            <p className="text-xs md:text-sm mt-1 flex items-center gap-1.5" style={{ color: COLORS.slate }}>
              <MapPin size={13} />
              {activeDealName ? `${activeDealName} — ${getProjectTitleDisplay(inputs.projectTitle, t)}` : getProjectTitleDisplay(inputs.projectTitle, t)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === "ar-SA" ? "en" : "ar-SA")}
              title={locale === "ar-SA" ? "Switch to English" : "التبديل إلى العربية"}
              className="relative p-2.5 rounded-xl text-xs font-semibold"
              style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.slate }}
            >
              {locale === "ar-SA" ? "EN" : "ع"}
            </button>
            <ModeSwitch mode={mode} setMode={(m) => { setMode(m); setActiveDealId(null); setActiveTab("dashboard"); }} />
            <button
              type="button"
              onClick={() => setDealsPanelOpen(true)}
              title={t("actions.savedDeals")}
              className="relative p-2.5 rounded-xl"
              style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.slate }}
            >
              <Bookmark size={16} />
              {savedDeals.length > 0 ? (
                <span
                  className="rf-num absolute -top-1 -left-1 flex items-center justify-center text-[9px] font-bold"
                  style={{ width: 15, height: 15, borderRadius: "50%", background: COLORS.brass, color: COLORS.ink }}
                >
                  {savedDeals.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={resetCurrent}
              title={activeDealId ? t("savedDeals.resetButtonTitleActive") : t("actions.reset")}
              className="p-2.5 rounded-xl"
              style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.slate }}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </header>

        <DealsPanel
          open={dealsPanelOpen}
          onClose={() => setDealsPanelOpen(false)}
          savedDeals={savedDeals}
          dealsLoading={dealsLoading}
          activeDealId={activeDealId}
          mode={mode}
          onLoadBuiltIn={loadBuiltIn}
          onLoadDeal={loadDeal}
          onDeleteDeal={deleteDeal}
          onSaveNew={saveCurrentAsNewDeal}
          onUpdateActive={updateActiveDeal}
          saveNameInput={saveNameInput}
          setSaveNameInput={setSaveNameInput}
          savingInProgress={savingInProgress}
          dealsError={dealsError}
          onExportBackup={exportBackup}
          onImportBackup={importBackup}
          backupMessage={backupMessage}
        />

        <KPIRibbon mode={mode} results={results} leverageEnabled={inputs.leverageEnabled} />

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} style={{ color: COLORS.brass }} />
              <span className="rf-display text-sm font-semibold" style={{ color: COLORS.parchment }}>{t("globalApp.inputsHeading")}</span>
              <span className="text-[10px]" style={{ color: COLORS.slateDim }}>— {t("globalApp.inputsNote")}</span>
            </div>
            {mode === "building" ? (
              <BuildingInputPanel inputs={buildingInputs} setInputs={setBuildingInputs} />
            ) : (
              <LandInputPanel inputs={landInputs} setInputs={setLandInputs} />
            )}
          </aside>

          <main className="lg:col-span-7">
            {activeValidationError ? (
              <div className="rounded-2xl mb-3 px-4 py-3" style={{ background: "rgba(220,80,80,0.12)", border: "1px solid rgba(220,80,80,0.4)" }}>
                <div className="text-sm font-semibold" style={{ color: "#e08080" }}>{t("validationDisclosure.title")}</div>
                <div className="text-xs mt-1" style={{ color: COLORS.slate }}>{(locale === "en" ? activeValidationError.message_en : activeValidationError.message_ar)} — {t("validationDisclosure.messageSuffix")}</div>
              </div>
            ) : null}
            <Tabs value={activeTab} onChange={setActiveTab} />
            {activeTab === "dashboard" && <DashboardTab mode={mode} inputs={inputs} results={results} />}
            {activeTab === "cashflow" && <CashFlowTab mode={mode} inputs={inputs} results={results} />}
            {activeTab === "sensitivity" && <SensitivityTab mode={mode} inputs={inputs} />}
          </main>
        </div>

        {/* FOOTER */}
        <footer className="mt-10 pt-6" style={{ borderTop: `1px solid ${COLORS.hairlineSoft}` }}>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] mb-3" style={{ color: COLORS.slateDim }}>
            <span>{t("globalApp.footerCurrency")}</span>
            <span>{t("globalApp.footerIrrNpv")}</span>
            <span>{t("globalApp.footerEditable")}</span>
          </div>
          <div className="text-[10px] leading-relaxed" style={{ color: COLORS.slateDim }}>
            {t("globalApp.methodologyNote")}
          </div>
        </footer>
      </div>
    </div>
  );
}
