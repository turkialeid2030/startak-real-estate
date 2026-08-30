import React, { useState, useMemo, useEffect } from "react";
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
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@300;400;500;700&display=swap');

.rf-root { font-family: 'Tajawal', 'Segoe UI', sans-serif; }
.rf-display { font-family: 'Cairo', 'Tajawal', sans-serif; }
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
// FINANCIAL HELPERS (verified against source Excel files)
// ============================================================
function computeNPV(rate, cashflows) {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

function computeIRR(cashflows, guess = 0.1) {
  const npvFn = (r) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  const dnpvFn = (r) => cashflows.reduce((acc, cf, t) => acc - (t * cf) / Math.pow(1 + r, t + 1), 0);
  let rate = guess;
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const val = npvFn(rate);
    const d = dnpvFn(rate);
    if (Math.abs(d) < 1e-10) break;
    const newRate = rate - val / d;
    if (!isFinite(newRate)) break;
    if (Math.abs(newRate - rate) < 1e-9) { rate = newRate; converged = true; break; }
    rate = newRate;
  }
  if (!converged || !isFinite(rate) || rate < -0.999) {
    let lo = -0.99, hi = 10;
    let nLo = npvFn(lo), nHi = npvFn(hi);
    if (nLo * nHi > 0) return NaN;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const nMid = npvFn(mid);
      if (Math.abs(nMid) < 1e-6) return mid;
      if (nLo * nMid < 0) { hi = mid; nHi = nMid; } else { lo = mid; nLo = nMid; }
    }
    return (lo + hi) / 2;
  }
  return rate;
}

function amortizationSchedule(principal, rate, years) {
  const n = Math.max(1, Math.round(years));
  if (principal <= 0) return { payment: 0, schedule: [] };
  const payment = rate === 0 ? principal / n : (principal * rate) / (1 - Math.pow(1 + rate, -n));
  let balance = principal;
  const schedule = [];
  for (let y = 1; y <= n; y++) {
    const interest = balance * rate;
    const principalPortion = Math.min(balance, payment - interest);
    balance = Math.max(0, balance - principalPortion);
    schedule.push({ year: y, payment, interest, principal: principalPortion, balance });
  }
  return { payment, schedule };
}

function tierVerdict(criteria) {
  const total = criteria.length;
  const met = criteria.filter(Boolean).length;
  const verdict = met === total ? "يوصى بالشراء" : met >= total - 1 ? "يوصى بالشراء بشروط" : "لا يوصى بالشراء";
  return { met, total, verdict };
}

const VACANCY_MONTHS_MAP = { "مؤجر": 0, "3 أشهر": 3, "6 أشهر": 6, "9 أشهر": 9, "سنة": 12 };

// ============================================================
// SCENARIO A: EXISTING BUILDING PURCHASE (verified vs source file)
// ============================================================
function calcExistingBuilding(inp) {
  const landArea = inp.landLength * inp.landWidth;
  const totalBasementArea = inp.basementCount * inp.basementAreaEach;
  const totalParkingSpots = inp.parkingAreaPerSpot > 0 ? Math.floor(totalBasementArea / inp.parkingAreaPerSpot) : 0;
  const totalFloorArea = inp.floorCount * inp.floorAreaEach;
  const netLeasableArea = inp.netLeasableOverride > 0 ? inp.netLeasableOverride : totalFloorArea * inp.efficiencyRatio;
  const avgNetAreaPerFloor = inp.floorCount > 0 ? netLeasableArea / inp.floorCount : 0;
  const totalBuiltArea = totalBasementArea + totalFloorArea;
  const coverageRatio = landArea > 0 ? totalBuiltArea / landArea : 0;
  const areaCheckOk = netLeasableArea <= totalFloorArea;

  const commissionAmount = inp.buildingPrice * inp.commissionRate;
  const transferFeeAmount = inp.buildingPrice * inp.transferFeeRate;
  const totalPurchaseCost = inp.buildingPrice + commissionAmount + transferFeeAmount + inp.inspectionCost + inp.valuationCost;
  const costPerSqm = netLeasableArea > 0 ? totalPurchaseCost / netLeasableArea : 0;

  const vacancyMonths = VACANCY_MONTHS_MAP[inp.leaseStatus] ?? 0;
  const grossRentalIncome = netLeasableArea * inp.rentPerSqm * inp.occupancyRate;
  const vacancyDeduction = grossRentalIncome * (vacancyMonths / 12);
  const rentalIncomeAfterVacancy = grossRentalIncome - vacancyDeduction;
  const serviceIncome = rentalIncomeAfterVacancy * inp.serviceIncomeRate;
  const totalAnnualIncome = rentalIncomeAfterVacancy + serviceIncome;
  const vatCollected = totalAnnualIncome * inp.vatRate;

  const opexAmount = totalAnnualIncome * (inp.maintenanceRate + inp.insuranceRate);
  const NOI = totalAnnualIncome - opexAmount;

  const netYieldOnCost = totalPurchaseCost > 0 ? NOI / totalPurchaseCost : 0;
  const grossYieldOnCost = totalPurchaseCost > 0 ? totalAnnualIncome / totalPurchaseCost : 0;
  const paybackOnCost = NOI > 0 ? totalPurchaseCost / NOI : 0;
  const netYieldOnPrice = inp.buildingPrice > 0 ? NOI / inp.buildingPrice : 0;
  const paybackOnPrice = NOI > 0 ? inp.buildingPrice / NOI : 0;

  const marketValueByIncomeCap = inp.marketCapRate > 0 ? NOI / inp.marketCapRate : 0;
  const valueGapVsCost = marketValueByIncomeCap - totalPurchaseCost;

  const basementConstructionValue = totalBasementArea * inp.basementConstructionCostPerSqm;
  const floorConstructionValue = totalFloorArea * inp.floorConstructionCostPerSqm;
  const totalReplacementConstructionValue = basementConstructionValue + floorConstructionValue;
  const currentLandValue = landArea * inp.currentLandPricePerSqm;
  const totalAppraisedValue = totalReplacementConstructionValue + currentLandValue;
  const annualDepreciation = inp.buildingUsefulLife > 0 ? totalReplacementConstructionValue / inp.buildingUsefulLife : 0;

  const cashflows = [-totalPurchaseCost];
  let noiYear = NOI;
  for (let y = 1; y <= inp.holdPeriod; y++) {
    if (y > 1) noiYear = noiYear * (1 + inp.rentGrowthRate);
    if (y < inp.holdPeriod) {
      cashflows.push(noiYear);
    } else {
      const saleValue = inp.marketCapRate > 0 ? noiYear / inp.marketCapRate : 0;
      const saleTransferFee = saleValue * inp.transferFeeRate;
      const netSaleProceeds = saleValue - saleTransferFee;
      cashflows.push(noiYear + netSaleProceeds);
    }
  }
  const irr = computeIRR(cashflows);
  const npv = computeNPV(inp.discountRate, cashflows);
  const maxJustifiedPrice = NOI / Math.max(inp.minYieldThreshold, 1 / inp.maxPaybackThreshold);

  // --- Leverage (always computed; UI/recommendation show it only when leverageEnabled) ---
  const loanAmount = inp.ltv * totalPurchaseCost;
  const equityRequired = totalPurchaseCost - loanAmount;
  const { payment: debtService, schedule: loanSchedule } = amortizationSchedule(loanAmount, inp.loanRate, inp.loanTenor);
  const leveredCashflows = [-equityRequired];
  let noiYearL = NOI;
  let dscrMin = Infinity;
  for (let y = 1; y <= inp.holdPeriod; y++) {
    if (y > 1) noiYearL = noiYearL * (1 + inp.rentGrowthRate);
    const ds = y <= loanSchedule.length ? debtService : 0;
    if (ds > 0) dscrMin = Math.min(dscrMin, noiYearL / ds);
    const remBalance = y === inp.holdPeriod && y <= loanSchedule.length ? loanSchedule[y - 1].balance : 0;
    if (y < inp.holdPeriod) {
      leveredCashflows.push(noiYearL - ds);
    } else {
      const saleValueL = inp.marketCapRate > 0 ? noiYearL / inp.marketCapRate : 0;
      const netSaleProceedsL = saleValueL - saleValueL * inp.transferFeeRate;
      leveredCashflows.push(noiYearL - ds + netSaleProceedsL - remBalance);
    }
  }
  if (dscrMin === Infinity) dscrMin = null;
  const leveredIRR = computeIRR(leveredCashflows);
  const equityDiscountRate = inp.discountRate + inp.equityRiskSpread;
  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);

  const c1 = netYieldOnPrice >= inp.minYieldThreshold;
  const c2 = paybackOnPrice <= inp.maxPaybackThreshold;
  const c3 = irr >= inp.discountRate;
  const c4 = marketValueByIncomeCap >= totalPurchaseCost;
  const criteria = [c1, c2, c3, c4];
  const c5 = inp.leverageEnabled ? dscrMin !== null && dscrMin >= inp.minDscrThreshold : null;
  if (inp.leverageEnabled) criteria.push(c5);
  const { met: metCount, total: totalCriteria, verdict } = tierVerdict(criteria);

  return {
    landArea, totalBasementArea, totalParkingSpots, totalFloorArea, netLeasableArea, avgNetAreaPerFloor,
    totalBuiltArea, coverageRatio, areaCheckOk,
    commissionAmount, transferFeeAmount, totalPurchaseCost, costPerSqm,
    grossRentalIncome, vacancyDeduction, rentalIncomeAfterVacancy, serviceIncome, totalAnnualIncome, vatCollected,
    opexAmount, NOI, netYieldOnCost, grossYieldOnCost, paybackOnCost, netYieldOnPrice, paybackOnPrice,
    marketValueByIncomeCap, valueGapVsCost,
    basementConstructionValue, floorConstructionValue, totalReplacementConstructionValue, currentLandValue,
    totalAppraisedValue, annualDepreciation,
    cashflows, irr, npv, maxJustifiedPrice,
    loanAmount, equityRequired, debtService, dscrMin, leveredCashflows, leveredIRR, leveredNPV, equityDiscountRate,
    c1, c2, c3, c4, c5, metCount, totalCriteria, verdict,
  };
}

// ============================================================
// SCENARIO B: LAND PURCHASE + DEVELOPMENT (verified vs source file; timing bug fixed)
// ============================================================
function calcLandDevelopment(inp) {
  const landArea = inp.landLength * inp.landWidth;
  const landMarketValue = landArea * inp.landPricePerSqm;

  const floorPlateArea = landArea * inp.buildableRatio;
  const serviceAreaPerFloor = floorPlateArea * inp.servicesRatioPerFloor;
  const netLeasableAreaPerFloor = floorPlateArea - serviceAreaPerFloor;
  const totalNetLeasableArea = netLeasableAreaPerFloor * inp.officeFloorCount;
  const totalOfficeFloorArea = floorPlateArea * inp.officeFloorCount;
  const totalBasementArea = landArea * inp.basementFloorCount;
  const totalBuiltArea = totalOfficeFloorArea + totalBasementArea;

  const totalConstructionCost = totalBuiltArea * inp.constructionCostPerSqm;

  const landCommission = landMarketValue * inp.landCommissionRate;
  const landTransferFee = landMarketValue * inp.landTransferFeeRate;
  const totalLandAcquisitionCost = landMarketValue + landCommission + landTransferFee + inp.engineeringCost + inp.landValuationCost;
  const totalProjectCost = totalLandAcquisitionCost + totalConstructionCost;
  const costPerSqm = totalNetLeasableArea > 0 ? totalProjectCost / totalNetLeasableArea : 0;

  const grossRentalIncome = totalNetLeasableArea * inp.marketRentPerSqm;
  const actualRentalIncome = grossRentalIncome * inp.occupancyRate;
  const serviceIncome = actualRentalIncome * inp.serviceIncomeRate;
  const totalOperatingRevenue = actualRentalIncome + serviceIncome;
  const operatingExpenses = totalOperatingRevenue * inp.opexRate;
  const stabilizedNOI = totalOperatingRevenue - operatingExpenses;

  const capRateOnCost = totalProjectCost > 0 ? stabilizedNOI / totalProjectCost : 0;

  // --- Goal-seek: max land price/sqm that still clears the payback/cap-rate-on-cost criteria (mirrors building's maxJustifiedPrice) ---
  const targetProjectCost = stabilizedNOI * inp.maxPaybackThreshold;
  const targetLandAcquisitionCost = targetProjectCost - totalConstructionCost;
  const feeLoad = 1 + inp.landCommissionRate + inp.landTransferFeeRate;
  const targetLandMarketValue = (targetLandAcquisitionCost - inp.engineeringCost - inp.landValuationCost) / feeLoad;
  const maxJustifiedLandPricePerSqm = landArea > 0 ? targetLandMarketValue / landArea : 0;
  const marketValueAfterCompletion = inp.marketCapRate > 0 ? stabilizedNOI / inp.marketCapRate : 0;
  const valueSurplusOverCost = marketValueAfterCompletion - totalProjectCost;
  const simplePaybackYears = stabilizedNOI > 0 ? totalProjectCost / stabilizedNOI : 0;

  const cashflows = [-totalLandAcquisitionCost];
  const constructionYears = Math.max(1, Math.round(inp.constructionPeriod));
  const perYearConstructionDraw = totalConstructionCost / constructionYears;
  for (let y = 0; y < constructionYears; y++) cashflows.push(-perYearConstructionDraw);

  const operatingYears = Math.max(1, Math.round(inp.operatingPeriod));
  let noiYear = stabilizedNOI;
  for (let y = 1; y <= operatingYears; y++) {
    if (y > 1) noiYear = noiYear * (1 + inp.rentGrowthRate);
    if (y < operatingYears) {
      cashflows.push(noiYear);
    } else {
      const forwardNOI = noiYear * (1 + inp.rentGrowthRate);
      const exitValue = inp.exitCapRate > 0 ? forwardNOI / inp.exitCapRate : 0;
      const exitTransferFee = exitValue * inp.exitTransferFeeRate;
      const netExitValue = exitValue - exitTransferFee;
      cashflows.push(noiYear + netExitValue);
    }
  }
  const irr = computeIRR(cashflows);
  const npv = computeNPV(inp.hurdleRate, cashflows);

  // --- Leverage (always computed; UI/recommendation show it only when leverageEnabled) ---
  const loanToCost = inp.ltv;
  const landDebtDraw = totalLandAcquisitionCost * loanToCost;
  const landEquityDraw = totalLandAcquisitionCost - landDebtDraw;
  const perYearConstructionDebtDraw = perYearConstructionDraw * loanToCost;
  const perYearConstructionEquityDraw = perYearConstructionDraw - perYearConstructionDebtDraw;

  let constructionLoanBalance = landDebtDraw;
  for (let y = 0; y < constructionYears; y++) {
    constructionLoanBalance = constructionLoanBalance * (1 + inp.loanRate) + perYearConstructionDebtDraw;
  }
  const { payment: debtService, schedule: loanSchedule } = amortizationSchedule(constructionLoanBalance, inp.loanRate, inp.loanTenor);

  const leveredCashflows = [-landEquityDraw];
  for (let y = 0; y < constructionYears; y++) leveredCashflows.push(-perYearConstructionEquityDraw);

  let noiYearL = stabilizedNOI;
  let dscrMin = Infinity;
  for (let y = 1; y <= operatingYears; y++) {
    if (y > 1) noiYearL = noiYearL * (1 + inp.rentGrowthRate);
    const ds = y <= loanSchedule.length ? debtService : 0;
    if (ds > 0) dscrMin = Math.min(dscrMin, noiYearL / ds);
    const remBalance = y === operatingYears && y <= loanSchedule.length ? loanSchedule[y - 1].balance : 0;
    if (y < operatingYears) {
      leveredCashflows.push(noiYearL - ds);
    } else {
      const forwardNOIL = noiYearL * (1 + inp.rentGrowthRate);
      const exitValueL = inp.exitCapRate > 0 ? forwardNOIL / inp.exitCapRate : 0;
      const netExitValueL = exitValueL - exitValueL * inp.exitTransferFeeRate;
      leveredCashflows.push(noiYearL - ds + netExitValueL - remBalance);
    }
  }
  if (dscrMin === Infinity) dscrMin = null;
  const leveredIRR = computeIRR(leveredCashflows);
  const equityDiscountRate = inp.hurdleRate + inp.equityRiskSpread;
  const leveredNPV = computeNPV(equityDiscountRate, leveredCashflows);

  const c1 = simplePaybackYears <= inp.maxPaybackThreshold;
  const c2 = capRateOnCost >= (1 / inp.maxPaybackThreshold);
  const c3 = irr >= inp.hurdleRate;
  const c4 = marketValueAfterCompletion >= totalProjectCost;
  const criteria = [c1, c2, c3, c4];
  const c5 = inp.leverageEnabled ? dscrMin !== null && dscrMin >= inp.minDscrThreshold : null;
  if (inp.leverageEnabled) criteria.push(c5);
  const { met: metCount, total: totalCriteria, verdict } = tierVerdict(criteria);

  return {
    landArea, landMarketValue, floorPlateArea, serviceAreaPerFloor, netLeasableAreaPerFloor,
    totalNetLeasableArea, totalOfficeFloorArea, totalBasementArea, totalBuiltArea,
    totalConstructionCost, landCommission, landTransferFee, totalLandAcquisitionCost, totalProjectCost, costPerSqm,
    grossRentalIncome, actualRentalIncome, serviceIncome, totalOperatingRevenue, operatingExpenses, stabilizedNOI,
    capRateOnCost, marketValueAfterCompletion, valueSurplusOverCost, simplePaybackYears, maxJustifiedLandPricePerSqm,
    cashflows, irr, npv,
    constructionYears, operatingYears,
    loanAmount: landDebtDraw, equityRequired: landEquityDraw, constructionLoanBalance, debtService, dscrMin,
    leveredCashflows, leveredIRR, leveredNPV, equityDiscountRate,
    c1, c2, c3, c4, c5, metCount, totalCriteria, verdict,
  };
}

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

function rangeWarning(value, warnBelow, warnAbove, warnText) {
  if (warnBelow !== undefined && value < warnBelow) return warnText || "قيمة أقل من المعتاد — تحقّق منها";
  if (warnAbove !== undefined && value > warnAbove) return warnText || "قيمة أعلى من المعتاد — تحقّق منها";
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
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText);
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
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText);
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
        {options.map((o) => (
          <option key={o} value={o} style={{ background: COLORS.panel }}>{o}</option>
        ))}
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
              {verdict}
            </div>
            <div className="text-[10px] mt-1 rf-num" style={{ color: COLORS.slate }}>{metCount}/{totalCriteria} معايير محققة</div>
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
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg mb-2"
      style={{ background: ok ? COLORS.positiveSoft : COLORS.negativeSoft, border: `1px solid ${ok ? COLORS.positive : COLORS.negative}33` }}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 size={16} style={{ color: COLORS.positive }} /> : <XCircle size={16} style={{ color: COLORS.negative }} />}
        <span className="text-xs" style={{ color: COLORS.parchment }}>{label}</span>
      </div>
      <div className="text-[11px] rf-num" style={{ color: COLORS.slate }}>
        {actual} <span style={{ color: COLORS.slateDim }}>/ هدف {target}</span>
      </div>
    </div>
  );
}

// ============================================================
// CASH FLOW CHART + TABLE
// ============================================================
function CashFlowTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.parchment }}>
      <div style={{ color: COLORS.slate }}>سنة {label}</div>
      <div className="rf-num font-bold" style={{ color: v < 0 ? COLORS.negative : COLORS.brass }}>{fmtSARSigned(v)}</div>
    </div>
  );
}

function CashFlowChart({ cashflows }) {
  const data = cashflows.map((v, i) => ({ year: i, value: v }));
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.hairlineSoft} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: COLORS.slate, fontSize: 11 }}
            tickFormatter={(y) => `س${y}`}
            axisLine={{ stroke: COLORS.hairline }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: COLORS.slate, fontSize: 10 }}
            tickFormatter={(v) => `${(v / 1e6).toFixed(0)}م`}
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
            <th className="px-3 py-2 text-right font-normal" style={{ color: COLORS.slate }}>السنة</th>
            <th className="px-3 py-2 text-right font-normal" style={{ color: COLORS.slate }}>التدفق النقدي</th>
            <th className="px-3 py-2 text-right font-normal" style={{ color: COLORS.slate }}>التدفق التراكمي</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year} style={{ borderTop: `1px solid ${COLORS.hairlineSoft}` }}>
              <td className="px-3 py-2 rf-num" style={{ color: COLORS.slate }}>{r.year}</td>
              <td className="px-3 py-2 rf-num" style={{ color: r.value < 0 ? COLORS.negative : COLORS.parchment }}>{fmtSARSigned(r.value)}</td>
              <td className="px-3 py-2 rf-num" style={{ color: r.cum < 0 ? COLORS.negative : COLORS.positive }}>{fmtSARSigned(r.cum)}</td>
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
function buildSensitivityData(mode, inputs) {
  const vars = mode === "building"
    ? [
        { key: "rentPerSqm", label: "سعر المتر التأجيري" },
        { key: "buildingPrice", label: "سعر شراء المبنى" },
        { key: "marketCapRate", label: "معدل الرسملة السوقي" },
        { key: "occupancyRate", label: "نسبة الإشغال" },
      ]
    : [
        { key: "marketRentPerSqm", label: "سعر المتر التأجيري" },
        { key: "constructionCostPerSqm", label: "تكلفة الإنشاء للمتر" },
        { key: "landPricePerSqm", label: "سعر متر الأرض" },
        { key: "exitCapRate", label: "معدل رسملة الخروج" },
      ];
  const calc = mode === "building" ? calcExistingBuilding : calcLandDevelopment;
  const irrField = inputs.leverageEnabled ? "leveredIRR" : "irr";
  const rows = vars.map(({ key, label }) => {
    const lowInputs = { ...inputs, [key]: inputs[key] * 0.9 };
    const highInputs = { ...inputs, [key]: inputs[key] * 1.1 };
    const irrLow = calc(lowInputs)[irrField];
    const irrHigh = calc(highInputs)[irrField];
    const lo = Math.min(irrLow, irrHigh);
    const hi = Math.max(irrLow, irrHigh);
    return { label, lo, hi, base: lo, range: hi - lo };
  });
  rows.sort((a, b) => b.range - a.range);
  return rows;
}

function SensitivityTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0] && payload[0].payload;
  if (!d) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.parchment }}>
      <div style={{ color: COLORS.slate }}>{d.label}</div>
      <div className="rf-num">من {fmtPct(d.lo)} إلى {fmtPct(d.hi)}</div>
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
  const checkedCount = items.filter((it) => it.checked).length;
  return (
    <div className="rounded-2xl mb-4 p-4" style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] tracking-widest" style={{ color: COLORS.brass }}>تحقق نوعي — غير مالي</div>
          <div className="rf-display text-sm font-semibold" style={{ color: COLORS.parchment }}>المخاطر التنظيمية والقانونية</div>
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
  return (
    <div
      className="rounded-2xl p-5 mb-4 flex flex-col md:flex-row items-center gap-5"
      style={{ background: COLORS.panel, border: `1px solid ${COLORS.brassDim}` }}
    >
      <VerdictSeal verdict={results.verdict} metCount={results.metCount} totalCriteria={results.totalCriteria} size="large" />
      <div className="flex-1 w-full">
        <div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>القسم الأخير — التوصية النهائية</div>
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
  const r = results;
  if (mode === "building") {
    return (
      <div>
        <MetricGroup eyebrow="القسم الأول" title="المساحات">
          <MetricRow label="مساحة الأرض" value={`${fmtNum(r.landArea)} م²`} />
          <MetricRow label="إجمالي مساحة الأقبية" value={`${fmtNum(r.totalBasementArea)} م²`} note={`${fmtNum(r.totalParkingSpots)} موقف سيارة`} />
          <MetricRow label="إجمالي المساحة الإنشائية للأدوار" value={`${fmtNum(r.totalFloorArea)} م²`} />
          <MetricRow label="المساحة التأجيرية الصافية المعتمدة" value={`${fmtNum(r.netLeasableArea)} م²`} strong note={`${fmtNum(r.avgNetAreaPerFloor)} م²/دور بالمتوسط`} />
          <MetricRow label="معامل البناء إلى مساحة الأرض" value={fmtX(r.coverageRatio)} />
          <MetricRow label="الفحص المنطقي للمساحات" value={r.areaCheckOk ? "سليم ✓" : "تعارض ✗"} positiveNegative={r.areaCheckOk} />
        </MetricGroup>

        <MetricGroup eyebrow="القسم الثاني" title="تكلفة الشراء">
          <MetricRow label="قيمة شراء المبنى" value={fmtSAR(inputs.buildingPrice)} />
          <MetricRow label="قيمة السعي (العمولة)" value={fmtSAR(r.commissionAmount)} />
          <MetricRow label="رسوم التصرفات العقارية" value={fmtSAR(r.transferFeeAmount)} />
          <MetricRow label="الفحص الفني + التقييم" value={fmtSAR(inputs.inspectionCost + inputs.valuationCost)} />
          <MetricRow label="إجمالي تكلفة الشراء" value={fmtSAR(r.totalPurchaseCost)} strong />
          <MetricRow label="تكلفة المتر على المساحة التأجيرية" value={`${fmtNum(r.costPerSqm)} ريال/م²`} />
        </MetricGroup>

        <MetricGroup eyebrow="القسم الثالث" title="الدخل التشغيلي">
          <MetricRow label="الدخل التأجيري السنوي (قبل الشاغر)" value={fmtSAR(r.grossRentalIncome)} />
          <MetricRow label="(يُخصم) دخل فترة الشاغر" value={fmtSAR(r.vacancyDeduction)} />
          <MetricRow label="دخل الخدمات بعد التأجير" value={fmtSAR(r.serviceIncome)} />
          <MetricRow label="إجمالي الدخل السنوي" value={fmtSAR(r.totalAnnualIncome)} strong />
          <MetricRow label="ضريبة القيمة المضافة المحصلة" value={fmtSAR(r.vatCollected)} note="تورَّد للهيئة — لا تدخل ضمن الدخل" />
        </MetricGroup>

        <MetricGroup eyebrow="القسم الرابع" title="المصروفات التشغيلية وصافي الدخل">
          <MetricRow label="إجمالي المصروفات التشغيلية" value={fmtSAR(r.opexAmount)} />
          <MetricRow label="صافي الدخل التشغيلي (NOI)" value={fmtSAR(r.NOI)} strong />
        </MetricGroup>

        <MetricGroup eyebrow="القسم الخامس" title="العائد والتقييم بالرسملة">
          <MetricRow label="العائد الصافي على إجمالي التكلفة" value={fmtPct(r.netYieldOnCost)} />
          <MetricRow label="العائد الإجمالي على إجمالي التكلفة" value={fmtPct(r.grossYieldOnCost)} />
          <MetricRow label="العائد الصافي على سعر الشراء" value={fmtPct(r.netYieldOnPrice)} strong />
          <MetricRow label="سنوات الاسترداد على سعر الشراء" value={fmtYears(r.paybackOnPrice)} strong />
          <MetricRow label="القيمة السوقية (رسملة الدخل)" value={fmtSAR(r.marketValueByIncomeCap)} />
          <MetricRow label="الفرق عن إجمالي التكلفة" value={fmtSARSigned(r.valueGapVsCost)} positiveNegative={r.valueGapVsCost >= 0} />
          <MetricRow label="أعلى سعر شراء يحقق المعايير" value={fmtSAR(r.maxJustifiedPrice)} />
        </MetricGroup>

        <MetricGroup eyebrow="القسم السادس" title="التقييم العيني (أرض + مبانٍ)">
          <MetricRow label="قيمة إنشاء المباني (استبدالية)" value={fmtSAR(r.totalReplacementConstructionValue)} />
          <MetricRow label="قيمة الأرض الحالية" value={fmtSAR(r.currentLandValue)} />
          <MetricRow label="القيمة الإجمالية الحالية" value={fmtSAR(r.totalAppraisedValue)} strong />
          <MetricRow label="مقابل إجمالي تكلفة الشراء" value={fmtSARSigned(r.totalAppraisedValue - r.totalPurchaseCost)} positiveNegative={r.totalAppraisedValue >= r.totalPurchaseCost} />
          <MetricRow label="الإهلاك السنوي للمباني" value={fmtSAR(r.annualDepreciation)} note="بند محاسبي — لا يُخصم من التدفق النقدي" />
        </MetricGroup>

        {inputs.leverageEnabled ? (
          <MetricGroup eyebrow="القسم السابع" title={`التمويل العقاري (${inputs.financingStructureLabel})`}>
            <MetricRow label="قيمة التمويل" value={fmtSAR(r.loanAmount)} />
            <MetricRow label="حقوق الملكية المطلوبة" value={fmtSAR(r.equityRequired)} strong />
            <MetricRow label="القسط السنوي" value={fmtSAR(r.debtService)} />
            <MetricRow label="نسبة تغطية خدمة الدين (الأدنى)" value={r.dscrMin !== null ? fmtX(r.dscrMin) : "—"} positiveNegative={r.dscrMin !== null ? r.dscrMin >= inputs.minDscrThreshold : undefined} />
            <MetricRow label="معدل العائد الداخلي على حقوق الملكية (مرفوع)" value={fmtPct(r.leveredIRR)} strong />
            <MetricRow label="صافي القيمة الحالية المرفوعة" value={fmtSAR(r.leveredNPV)} note={`بمعدل خصم ${fmtPct(r.equityDiscountRate)} (معدل الخصم + علاوة المخاطرة)`} />
          </MetricGroup>
        ) : null}

        <RegulatoryStatusCard
          items={[
            { checked: inputs.titleDeedVerified, label: "صك الملكية تم التحقق منه" },
            { checked: inputs.complianceCertified, label: "شهادة السلامة والامتثال الفني سارية" },
            {
              checked: inputs.rentFreezeChecked,
              label: "تأكيد وضع العقود القائمة تجاه قرار تجميد الإيجارات",
              note: "قرار سبتمبر ٢٠٢٥ يُجمّد عقود الإيجار القائمة في نطاق الرياض العمراني لمدة ٥ سنوات؛ لا يشمل العقود الجديدة أو أول تأجير",
            },
          ]}
        />

        <RecommendationCard
          results={r}
          criteria={[
            { ok: r.c1, label: `العائد الصافي على سعر الشراء ≥ ${fmtPct(inputs.minYieldThreshold, 1)}`, actual: fmtPct(r.netYieldOnPrice), target: fmtPct(inputs.minYieldThreshold, 1) },
            { ok: r.c2, label: `سنوات الاسترداد ≤ ${inputs.maxPaybackThreshold} سنة`, actual: fmtYears(r.paybackOnPrice), target: `${inputs.maxPaybackThreshold} سنة` },
            { ok: r.c3, label: "معدل العائد الداخلي ≥ معدل الخصم", actual: fmtPct(r.irr), target: fmtPct(inputs.discountRate) },
            { ok: r.c4, label: "القيمة السوقية ≥ إجمالي التكلفة", actual: fmtSAR(r.marketValueByIncomeCap), target: fmtSAR(r.totalPurchaseCost) },
            ...(inputs.leverageEnabled
              ? [{ ok: r.c5, label: `نسبة تغطية خدمة الدين ≥ ${fmtX(inputs.minDscrThreshold)}`, actual: r.dscrMin !== null ? fmtX(r.dscrMin) : "—", target: fmtX(inputs.minDscrThreshold) }]
              : []),
          ]}
        />
      </div>
    );
  }

  return (
    <div>
      <MetricGroup eyebrow="القسم الأول" title="الأرض والتطوير">
        <MetricRow label="مساحة الأرض" value={`${fmtNum(r.landArea)} م²`} />
        <MetricRow label="القيمة السوقية للأرض" value={fmtSAR(r.landMarketValue)} />
        <MetricRow label="مساحة البناء للدور الواحد" value={`${fmtNum(r.floorPlateArea)} م²`} />
        <MetricRow label="إجمالي المساحة الإنشائية للأدوار" value={`${fmtNum(r.totalOfficeFloorArea)} م²`} />
        <MetricRow label="إجمالي مساحة الأقبية" value={`${fmtNum(r.totalBasementArea)} م²`} />
        <MetricRow label="إجمالي المساحة التأجيرية الصافية" value={`${fmtNum(r.totalNetLeasableArea)} م²`} strong />
      </MetricGroup>

      <MetricGroup eyebrow="القسم الثاني والثالث" title="تكلفة المشروع">
        <MetricRow label="إجمالي تكلفة إنشاء البرج" value={fmtSAR(r.totalConstructionCost)} />
        <MetricRow label="السعي + رسوم التصرفات (الأرض)" value={fmtSAR(r.landCommission + r.landTransferFee)} />
        <MetricRow label="إجمالي تكلفة شراء الأرض" value={fmtSAR(r.totalLandAcquisitionCost)} />
        <MetricRow label="إجمالي تكلفة المشروع (أرض + إنشاء)" value={fmtSAR(r.totalProjectCost)} strong />
        <MetricRow label="تكلفة المتر على المساحة التأجيرية" value={`${fmtNum(r.costPerSqm)} ريال/م²`} />
      </MetricGroup>

      <MetricGroup eyebrow="القسم الرابع" title="الإيرادات وصافي الدخل التشغيلي">
        <MetricRow label="الدخل التأجيري (إشغال كامل)" value={fmtSAR(r.grossRentalIncome)} />
        <MetricRow label="الدخل التأجيري الفعلي" value={fmtSAR(r.actualRentalIncome)} />
        <MetricRow label="دخل الخدمات" value={fmtSAR(r.serviceIncome)} />
        <MetricRow label="إجمالي الإيرادات التشغيلية" value={fmtSAR(r.totalOperatingRevenue)} />
        <MetricRow label="المصروفات التشغيلية" value={fmtSAR(r.operatingExpenses)} />
        <MetricRow label="صافي الدخل التشغيلي (NOI) المستقر" value={fmtSAR(r.stabilizedNOI)} strong />
      </MetricGroup>

      <MetricGroup eyebrow="القسم الخامس" title="العائد والتقييم">
        <MetricRow label="معدل الرسملة على التكلفة" value={fmtPct(r.capRateOnCost)} strong />
        <MetricRow label="القيمة السوقية بعد الإنشاء" value={fmtSAR(r.marketValueAfterCompletion)} />
        <MetricRow label="الفائض عن التكلفة" value={fmtSARSigned(r.valueSurplusOverCost)} positiveNegative={r.valueSurplusOverCost >= 0} />
        <MetricRow label="فترة استرداد رأس المال" value={fmtYears(r.simplePaybackYears)} strong />
        <MetricRow
          label="أعلى سعر مبرر لمتر الأرض"
          value={`${fmtNum(r.maxJustifiedLandPricePerSqm)} ريال/م²`}
          note={`مقابل السعر الحالي ${fmtNum(inputs.landPricePerSqm)} ريال/م²`}
          positiveNegative={r.maxJustifiedLandPricePerSqm >= inputs.landPricePerSqm}
        />
      </MetricGroup>

      {inputs.leverageEnabled ? (
        <MetricGroup eyebrow="القسم السادس" title={`التمويل العقاري (${inputs.financingStructureLabel})`}>
          <MetricRow label="قيمة التمويل (الأرض + الإنشاء)" value={fmtSAR(r.loanAmount)} />
          <MetricRow label="حقوق الملكية المطلوبة" value={fmtSAR(r.equityRequired)} strong />
          <MetricRow label="رصيد التمويل عند بدء التشغيل (بعد رسملة فوائد الإنشاء)" value={fmtSAR(r.constructionLoanBalance)} />
          <MetricRow label="القسط السنوي" value={fmtSAR(r.debtService)} />
          <MetricRow label="نسبة تغطية خدمة الدين (الأدنى)" value={r.dscrMin !== null ? fmtX(r.dscrMin) : "—"} positiveNegative={r.dscrMin !== null ? r.dscrMin >= inputs.minDscrThreshold : undefined} />
          <MetricRow label="معدل العائد الداخلي على حقوق الملكية (مرفوع)" value={fmtPct(r.leveredIRR)} strong />
          <MetricRow label="صافي القيمة الحالية المرفوعة" value={fmtSAR(r.leveredNPV)} note={`بمعدل خصم ${fmtPct(r.equityDiscountRate)} (معدل العائد المطلوب + علاوة المخاطرة)`} />
        </MetricGroup>
      ) : null}

      <RegulatoryStatusCard
        items={[
          { checked: inputs.titleDeedVerified, label: "صك ملكية الأرض تم التحقق منه" },
          { checked: inputs.zoningConfirmed, label: "المخطط التنظيمي وكثافة البناء مؤكدة من الأمانة" },
          { checked: inputs.buildingPermitStatus === "صادر", label: `حالة رخصة البناء: ${inputs.buildingPermitStatus}` },
          { checked: inputs.soilStudyDone, label: "دراسة التربة الجيوتقنية منجزة" },
          { checked: inputs.utilitiesConfirmed, label: "توفر الخدمات (كهرباء/مياه/صرف) مؤكد من الجهات المختصة" },
        ]}
      />

      <RecommendationCard
        results={r}
        criteria={[
          { ok: r.c1, label: `فترة الاسترداد ≤ ${inputs.maxPaybackThreshold} سنة`, actual: fmtYears(r.simplePaybackYears), target: `${inputs.maxPaybackThreshold} سنة` },
          { ok: r.c2, label: "العائد على التكلفة ≥ (١ ÷ الحد الأقصى للاسترداد)", actual: fmtPct(r.capRateOnCost), target: fmtPct(1 / inputs.maxPaybackThreshold) },
          { ok: r.c3, label: "معدل العائد الداخلي ≥ معدل العائد المطلوب", actual: fmtPct(r.irr), target: fmtPct(inputs.hurdleRate) },
          { ok: r.c4, label: "القيمة السوقية ≥ إجمالي تكلفة المشروع", actual: fmtSAR(r.marketValueAfterCompletion), target: fmtSAR(r.totalProjectCost) },
          ...(inputs.leverageEnabled
            ? [{ ok: r.c5, label: `نسبة تغطية خدمة الدين ≥ ${fmtX(inputs.minDscrThreshold)}`, actual: r.dscrMin !== null ? fmtX(r.dscrMin) : "—", target: fmtX(inputs.minDscrThreshold) }]
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
  const [view, setView] = useState("unlevered");
  const showLevered = inputs.leverageEnabled;
  const activeCashflows = showLevered && view === "levered" ? results.leveredCashflows : results.cashflows;
  const activeIRR = showLevered && view === "levered" ? results.leveredIRR : results.irr;
  const activeNPV = showLevered && view === "levered" ? results.leveredNPV : results.npv;

  return (
    <div>
      <MetricGroup eyebrow={mode === "building" ? "القسم السابع" : "القسم السادس"} title="تحليل التدفقات النقدية">
        <p className="text-xs mb-3 leading-relaxed" style={{ color: COLORS.slate }}>
          {mode === "building"
            ? "السنة 0 = تدفق خارج بقيمة إجمالي تكلفة الشراء. السنوات التالية = صافي الدخل التشغيلي، وتُضاف صافي قيمة البيع في آخر سنة."
            : "السنة 0 = شراء الأرض. سنوات الإنشاء = تدفق خارج (تكلفة الإنشاء موزعة عليها). سنوات التشغيل = صافي الدخل، وتُضاف صافي قيمة الخروج في آخر سنة."}
        </p>
        {showLevered ? (
          <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}` }}>
            {[
              { key: "unlevered", label: "التمويل الذاتي الكامل" },
              { key: "levered", label: "بعد الرافعة المالية" },
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
          <KPIChip label="معدل العائد الداخلي (IRR)" value={fmtPct(activeIRR)} accent icon={TrendingUp} />
          <KPIChip label="صافي القيمة الحالية (NPV)" value={fmtSAR(activeNPV)} icon={Wallet} />
          {showLevered && view === "levered" ? (
            <KPIChip label="نسبة تغطية خدمة الدين (الأدنى)" value={results.dscrMin !== null ? fmtX(results.dscrMin) : "—"} icon={Percent} />
          ) : null}
        </div>
        <CashFlowChart cashflows={activeCashflows} />
      </MetricGroup>
      <MetricGroup eyebrow="جدول" title="التدفقات سنة بسنة">
        <CashFlowTable cashflows={activeCashflows} />
      </MetricGroup>
    </div>
  );
}

// ============================================================
// SENSITIVITY TAB
// ============================================================
function SensitivityTab({ mode, inputs }) {
  const data = useMemo(() => buildSensitivityData(mode, inputs), [mode, inputs]);
  const irrKindLabel = inputs.leverageEnabled ? "العائد الداخلي على حقوق الملكية (مرفوع)" : "معدل العائد الداخلي";
  return (
    <div>
      <MetricGroup eyebrow="تحليل" title={`حساسية ${irrKindLabel} (± ١٠٪ لكل متغير)`}>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: COLORS.slate }}>
          يوضح الرسم أثر تغيّر كل متغير بمقدار ± ١٠٪ على {irrKindLabel}، مع تثبيت بقية المتغيرات على قيمها الحالية. المتغيرات مرتبة من الأعلى تأثيراً إلى الأقل.
          {inputs.leverageEnabled ? " التحليل هنا على أساس العائد بعد الرافعة المالية — أوقف تفعيل الرافعة لرؤية حساسية عائد المشروع الخام." : ""}
        </p>
        <SensitivityChart data={data} />
      </MetricGroup>
      <MetricGroup eyebrow="تفصيل" title={`نطاق ${irrKindLabel} لكل متغير`}>
        {data.map((d, i) => (
          <MetricRow key={i} label={d.label} value={`${fmtPct(d.lo)} — ${fmtPct(d.hi)}`} note={`اتساع النطاق: ${fmtPct(d.range)}`} />
        ))}
      </MetricGroup>
    </div>
  );
}

// ============================================================
// INPUT PANEL — EXISTING BUILDING
// ============================================================
function BuildingInputPanel({ inputs, setInputs }) {
  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));
  return (
    <div>
      <Section eyebrow="القسم الأول" title="الأرض والمبنى" defaultOpen>
        <NumField label="طول الأرض" unit="متر طولي" value={inputs.landLength} onChange={(v) => patch("landLength", v)} />
        <NumField label="عرض الأرض" unit="متر طولي" value={inputs.landWidth} onChange={(v) => patch("landWidth", v)} />
        <NumField label="عمر المبنى الحالي" unit="سنة" value={inputs.buildingAge} onChange={(v) => patch("buildingAge", v)} min={0} />
        <Divider />
        <NumField label="عدد الأقبية" unit="قبو" value={inputs.basementCount} onChange={(v) => patch("basementCount", v)} min={0} />
        <NumField label="مساحة القبو الواحد" unit="م²" value={inputs.basementAreaEach} onChange={(v) => patch("basementAreaEach", v)} />
        <NumField label="مساحة موقف السيارة الواحد" unit="م²/موقف" value={inputs.parkingAreaPerSpot} onChange={(v) => patch("parkingAreaPerSpot", v)} />
        <Divider />
        <NumField label="عدد الأدوار المكتبية" unit="دور" value={inputs.floorCount} onChange={(v) => patch("floorCount", v)} min={1} />
        <NumField label="المساحة الإجمالية للدور الواحد" unit="م²" value={inputs.floorAreaEach} onChange={(v) => patch("floorAreaEach", v)} />
        <PercentField label="نسبة الكفاءة التأجيرية" value={inputs.efficiencyRatio} onChange={(v) => patch("efficiencyRatio", v)} warnAbove={0.95} warnText="نادراً ما تتجاوز الكفاءة التأجيرية ٩٥٪" />
        <NumField
          label="المساحة التأجيرية حسب العقود (اختياري)"
          unit="م²"
          value={inputs.netLeasableOverride}
          onChange={(v) => patch("netLeasableOverride", v)}
          min={0}
          note="اتركها صفراً لاحتسابها تلقائياً من نسبة الكفاءة"
        />
        <NumField label="عدد مصاعد الخدمة" unit="مصعد" value={inputs.serviceElevators} onChange={(v) => patch("serviceElevators", v)} min={0} />
      </Section>

      <Section eyebrow="القسم الثاني" title="تكلفة الشراء">
        <NumField label="قيمة شراء المبنى" unit="ريال" value={inputs.buildingPrice} onChange={(v) => patch("buildingPrice", v)} />
        <PercentField label="نسبة السعي (العمولة)" value={inputs.commissionRate} onChange={(v) => patch("commissionRate", v)} />
        <PercentField label="نسبة رسوم التصرفات العقارية" value={inputs.transferFeeRate} onChange={(v) => patch("transferFeeRate", v)} />
        <NumField label="الفحص الفني للمبنى" unit="ريال" value={inputs.inspectionCost} onChange={(v) => patch("inspectionCost", v)} />
        <NumField label="تقييم العقار" unit="ريال" value={inputs.valuationCost} onChange={(v) => patch("valuationCost", v)} />
      </Section>

      <Section eyebrow="القسم الثالث" title="الدخل التأجيري">
        <NumField label="سعر المتر التأجيري" unit="ريال/م²/سنة" value={inputs.rentPerSqm} onChange={(v) => patch("rentPerSqm", v)} />
        <PercentField label="نسبة الإشغال المتوقعة" value={inputs.occupancyRate} onChange={(v) => patch("occupancyRate", v)} warnAbove={1} warnText="لا يمكن أن تتجاوز نسبة الإشغال ١٠٠٪" />
        <SelectField
          label="حالة التأجير"
          value={inputs.leaseStatus}
          onChange={(v) => patch("leaseStatus", v)}
          options={["مؤجر", "3 أشهر", "6 أشهر", "9 أشهر", "سنة"]}
          note="مؤجر = دخل فوري بلا شاغر"
        />
        <NumField label="عدد سنوات عقد التأجير" unit="سنة" value={inputs.leaseYears} onChange={(v) => patch("leaseYears", v)} min={1} />
        <PercentField label="ضريبة القيمة المضافة على التأجير" value={inputs.vatRate} onChange={(v) => patch("vatRate", v)} />
        <PercentField label="نسبة دخل الخدمات بعد التأجير" value={inputs.serviceIncomeRate} onChange={(v) => patch("serviceIncomeRate", v)} />
      </Section>

      <Section eyebrow="القسم الرابع" title="المصروفات التشغيلية">
        <PercentField label="إدارة وصيانة وتشغيل وأمن ونظافة" note="نسبة من إجمالي الدخل السنوي" value={inputs.maintenanceRate} onChange={(v) => patch("maintenanceRate", v)} />
        <PercentField label="التأمين على المبنى" note="نسبة من إجمالي الدخل السنوي" value={inputs.insuranceRate} onChange={(v) => patch("insuranceRate", v)} />
      </Section>

      <Section eyebrow="القسم الخامس" title="افتراضات التقييم والاستثمار">
        <PercentField label="معدل الرسملة السوقي" value={inputs.marketCapRate} onChange={(v) => patch("marketCapRate", v)} warnBelow={0.04} warnAbove={0.12} />
        <PercentField label="معدل الخصم (لحساب NPV)" value={inputs.discountRate} onChange={(v) => patch("discountRate", v)} warnBelow={0.04} warnAbove={0.15} />
        <NumField label="مدة الاستثمار (سنة البيع)" unit="سنة" value={inputs.holdPeriod} onChange={(v) => patch("holdPeriod", v)} min={1} warnAbove={20} />
        <PercentField label="معدل نمو الإيجار السنوي" note="صفر = يطابق افتراض الدراسة الأصلية (دخل ثابت)" value={inputs.rentGrowthRate} onChange={(v) => patch("rentGrowthRate", v)} warnAbove={0.15} />
        <Divider />
        <NumField label="سعر المتر الإنشائي للأقبية" unit="ريال/م²" value={inputs.basementConstructionCostPerSqm} onChange={(v) => patch("basementConstructionCostPerSqm", v)} />
        <NumField label="سعر المتر الإنشائي للأدوار" unit="ريال/م²" value={inputs.floorConstructionCostPerSqm} onChange={(v) => patch("floorConstructionCostPerSqm", v)} />
        <NumField label="سعر متر الأرض الحالي" unit="ريال/م²" value={inputs.currentLandPricePerSqm} onChange={(v) => patch("currentLandPricePerSqm", v)} />
        <NumField label="العمر الافتراضي للمباني" unit="سنة" value={inputs.buildingUsefulLife} onChange={(v) => patch("buildingUsefulLife", v)} min={1} />
      </Section>

      <Section eyebrow="القسم السادس" title="معايير التوصية">
        <PercentField label="الحد الأدنى للعائد الصافي" value={inputs.minYieldThreshold} onChange={(v) => patch("minYieldThreshold", v)} />
        <NumField label="الحد الأقصى لسنوات الاسترداد" unit="سنة" value={inputs.maxPaybackThreshold} onChange={(v) => patch("maxPaybackThreshold", v)} min={1} />
      </Section>

      <Section eyebrow="القسم السابع" title="التمويل العقاري (اختياري)">
        <Toggle
          label="تفعيل الرافعة المالية"
          note="عند الإيقاف تُعرض جميع المؤشرات على أساس التمويل الذاتي الكامل (١٠٠٪ حقوق ملكية)، كما في الدراسة الأصلية"
          checked={inputs.leverageEnabled}
          onChange={(v) => patch("leverageEnabled", v)}
        />
        <SelectField label="نمط الهيكل التمويلي" value={inputs.financingStructureLabel} onChange={(v) => patch("financingStructureLabel", v)} options={["مرابحة", "إجارة منتهية بالتمليك"]} />
        <PercentField label="نسبة التمويل إلى قيمة الشراء (LTV)" value={inputs.ltv} onChange={(v) => patch("ltv", v)} warnAbove={0.9} warnText="التمويل العقاري التجاري في السوق السعودي نادراً ما يتجاوز ٩٠٪" />
        <PercentField label="معدل الربح السنوي" value={inputs.loanRate} onChange={(v) => patch("loanRate", v)} warnBelow={0.02} warnAbove={0.15} />
        <NumField label="مدة التمويل" unit="سنة" value={inputs.loanTenor} onChange={(v) => patch("loanTenor", v)} min={1} warnAbove={25} note="إن تجاوزت مدة الاستثمار، يُخصم الرصيد المتبقي من عائد البيع" />
        <PercentField label="الحد الأدنى لنسبة تغطية خدمة الدين (DSCR)" value={inputs.minDscrThreshold} onChange={(v) => patch("minDscrThreshold", v)} warnBelow={1} warnText="أقل من ١٠٠٪ يعني أن الدخل التشغيلي لا يغطي القسط — لن يقبله أي ممول" note="١٢٥٪ = مستوى معتاد في تمويل العقارات المدرّة للدخل" />
        <PercentField label="علاوة مخاطرة حقوق الملكية بعد الرفع" value={inputs.equityRiskSpread} onChange={(v) => patch("equityRiskSpread", v)} note="تُضاف إلى معدل الخصم عند احتساب صافي القيمة الحالية المرفوعة، لأن حقوق الملكية بعد الرفع أعلى مخاطرة" />
      </Section>

      <Section eyebrow="القسم الثامن" title="المخاطر التنظيمية والقانونية (نوعي)">
        <Toggle label="صك الملكية تم التحقق منه" checked={inputs.titleDeedVerified} onChange={(v) => patch("titleDeedVerified", v)} />
        <Toggle label="شهادة السلامة والامتثال الفني سارية" checked={inputs.complianceCertified} onChange={(v) => patch("complianceCertified", v)} />
        <Toggle
          label="تأكيد وضع العقود القائمة تجاه قرار تجميد الإيجارات"
          note="قرار سبتمبر ٢٠٢٥ يُجمّد عقود الإيجار القائمة في نطاق الرياض العمراني لمدة ٥ سنوات؛ العقود الجديدة وأول تأجير غير متأثرين. بما أن هذا المبنى مؤجر حالياً، يُنصح بتأكيد هذا البند قبل افتراض أي نمو إيجاري على العقود القائمة."
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
  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));
  return (
    <div>
      <Section eyebrow="القسم الأول" title="الأرض" defaultOpen>
        <NumField label="الطول" unit="متر" value={inputs.landLength} onChange={(v) => patch("landLength", v)} />
        <NumField label="العرض" unit="متر" value={inputs.landWidth} onChange={(v) => patch("landWidth", v)} />
        <NumField label="سعر المتر المربع (سعر السوق)" unit="ريال/م²" value={inputs.landPricePerSqm} onChange={(v) => patch("landPricePerSqm", v)} />
      </Section>

      <Section eyebrow="القسم الثاني" title="مخطط التطوير">
        <PercentField label="نسبة البناء المسموحة" value={inputs.buildableRatio} onChange={(v) => patch("buildableRatio", v)} warnAbove={0.9} />
        <SelectField label="نوع البناء" value={inputs.buildingTypeLabel} onChange={(v) => patch("buildingTypeLabel", v)} options={["برج مكتبي", "برج سكني", "مبنى تجاري", "استخدام مختلط"]} />
        <NumField label="عدد الأدوار المكتبية" unit="دور" value={inputs.officeFloorCount} onChange={(v) => patch("officeFloorCount", v)} min={1} />
        <PercentField label="نسبة الخدمات من كل دور" value={inputs.servicesRatioPerFloor} onChange={(v) => patch("servicesRatioPerFloor", v)} warnAbove={0.4} warnText="نسبة خدمات أعلى من ٤٠٪ غير معتادة" />
        <NumField label="عدد أدوار الأقبية (مواقف)" unit="دور" value={inputs.basementFloorCount} onChange={(v) => patch("basementFloorCount", v)} min={0} />
      </Section>

      <Section eyebrow="القسم الثالث" title="تكلفة الإنشاء">
        <NumField
          label="سعر المتر الإنشائي الإجمالي"
          unit="ريال/م²"
          value={inputs.constructionCostPerSqm}
          onChange={(v) => patch("constructionCostPerSqm", v)}
          note="تقديري — يُحدَّث حسب عروض المقاولين الفعلية"
        />
      </Section>

      <Section eyebrow="القسم الرابع" title="تكاليف الشراء الإضافية">
        <PercentField label="السعي (العمولة)" value={inputs.landCommissionRate} onChange={(v) => patch("landCommissionRate", v)} />
        <PercentField label="رسوم التصرفات العقارية" value={inputs.landTransferFeeRate} onChange={(v) => patch("landTransferFeeRate", v)} />
        <NumField label="رسوم المكتب الهندسي والتراخيص" unit="ريال" value={inputs.engineeringCost} onChange={(v) => patch("engineeringCost", v)} />
        <NumField label="تقييم الأرض" unit="ريال" value={inputs.landValuationCost} onChange={(v) => patch("landValuationCost", v)} />
      </Section>

      <Section eyebrow="القسم الخامس" title="الإيرادات والتشغيل">
        <NumField label="سعر المتر التأجيري السوقي" unit="ريال/م²/سنة" value={inputs.marketRentPerSqm} onChange={(v) => patch("marketRentPerSqm", v)} />
        <PercentField label="نسبة الإشغال المتوقعة" value={inputs.occupancyRate} onChange={(v) => patch("occupancyRate", v)} warnAbove={1} warnText="لا يمكن أن تتجاوز نسبة الإشغال ١٠٠٪" />
        <PercentField label="نسبة دخل الخدمات من الإيجار" value={inputs.serviceIncomeRate} onChange={(v) => patch("serviceIncomeRate", v)} />
        <PercentField label="نسبة المصروفات التشغيلية" value={inputs.opexRate} onChange={(v) => patch("opexRate", v)} />
      </Section>

      <Section eyebrow="القسم السادس" title="التوقيت والعائد">
        <NumField
          label="فترة الإنشاء"
          unit="سنة"
          value={inputs.constructionPeriod}
          onChange={(v) => patch("constructionPeriod", v)}
          min={1}
          warnAbove={5}
          note="تُوزَّع تكلفة الإنشاء بالتساوي على هذه المدة، وتبدأ سنوات التشغيل بعدها مباشرة"
        />
        <PercentField label="معدل نمو الإيجار السنوي" value={inputs.rentGrowthRate} onChange={(v) => patch("rentGrowthRate", v)} warnAbove={0.15} />
        <NumField label="فترة التشغيل حتى البيع" unit="سنة" value={inputs.operatingPeriod} onChange={(v) => patch("operatingPeriod", v)} min={1} warnAbove={25} />
        <PercentField label="معدل الرسملة السوقي" value={inputs.marketCapRate} onChange={(v) => patch("marketCapRate", v)} warnBelow={0.04} warnAbove={0.12} />
        <PercentField label="معدل رسملة الخروج (Exit Cap Rate)" value={inputs.exitCapRate} onChange={(v) => patch("exitCapRate", v)} warnBelow={0.04} warnAbove={0.12} />
        <PercentField label="رسوم التصرفات عند البيع (الخروج)" value={inputs.exitTransferFeeRate} onChange={(v) => patch("exitTransferFeeRate", v)} note="إضافة موحّدة مع دراسة المبنى القائم — عدّلها لصفر لمطابقة الدراسة الأصلية تماماً" />
        <PercentField label="معدل العائد المطلوب (Hurdle Rate)" value={inputs.hurdleRate} onChange={(v) => patch("hurdleRate", v)} warnBelow={0.04} warnAbove={0.2} />
        <NumField label="الحد الأقصى لسنوات الاسترداد" unit="سنة" value={inputs.maxPaybackThreshold} onChange={(v) => patch("maxPaybackThreshold", v)} min={1} />
      </Section>

      <Section eyebrow="القسم السابع" title="التمويل العقاري (اختياري)">
        <Toggle
          label="تفعيل الرافعة المالية"
          note="عند الإيقاف تُعرض جميع المؤشرات على أساس التمويل الذاتي الكامل (١٠٠٪ حقوق ملكية)، كما في الدراسة الأصلية"
          checked={inputs.leverageEnabled}
          onChange={(v) => patch("leverageEnabled", v)}
        />
        <SelectField label="نمط الهيكل التمويلي" value={inputs.financingStructureLabel} onChange={(v) => patch("financingStructureLabel", v)} options={["مرابحة", "إجارة منتهية بالتمليك"]} />
        <PercentField label="نسبة التمويل إلى التكلفة (LTC)" value={inputs.ltv} onChange={(v) => patch("ltv", v)} warnAbove={0.9} warnText="التمويل التطويري نادراً ما يتجاوز ٩٠٪ من التكلفة" />
        <PercentField label="معدل الربح السنوي" value={inputs.loanRate} onChange={(v) => patch("loanRate", v)} warnBelow={0.02} warnAbove={0.15} note="يُحتسب مرسملاً (يُضاف لرصيد التمويل دون سداد نقدي) طوال فترة الإنشاء" />
        <NumField label="مدة التمويل (من بداية التشغيل)" unit="سنة" value={inputs.loanTenor} onChange={(v) => patch("loanTenor", v)} min={1} warnAbove={25} note="إن تجاوزت فترة التشغيل، يُخصم الرصيد المتبقي من عائد الخروج" />
        <PercentField label="الحد الأدنى لنسبة تغطية خدمة الدين (DSCR)" value={inputs.minDscrThreshold} onChange={(v) => patch("minDscrThreshold", v)} warnBelow={1} warnText="أقل من ١٠٠٪ يعني أن الدخل التشغيلي لا يغطي القسط" note="١٢٥٪ = مستوى معتاد في تمويل العقارات المدرّة للدخل" />
        <PercentField label="علاوة مخاطرة حقوق الملكية بعد الرفع" value={inputs.equityRiskSpread} onChange={(v) => patch("equityRiskSpread", v)} note="تُضاف إلى معدل العائد المطلوب عند احتساب صافي القيمة الحالية المرفوعة" />
      </Section>

      <Section eyebrow="القسم الثامن" title="المخاطر التنظيمية والقانونية (نوعي)">
        <Toggle label="صك ملكية الأرض تم التحقق منه" checked={inputs.titleDeedVerified} onChange={(v) => patch("titleDeedVerified", v)} />
        <Toggle label="المخطط التنظيمي وكثافة البناء مؤكدة من الأمانة" checked={inputs.zoningConfirmed} onChange={(v) => patch("zoningConfirmed", v)} />
        <SelectField label="حالة رخصة البناء" value={inputs.buildingPermitStatus} onChange={(v) => patch("buildingPermitStatus", v)} options={["لم يُستخرج", "قيد الإجراء", "صادر"]} />
        <Toggle label="دراسة التربة الجيوتقنية منجزة" checked={inputs.soilStudyDone} onChange={(v) => patch("soilStudyDone", v)} />
        <Toggle label="توفر الخدمات (كهرباء/مياه/صرف) مؤكد من الجهات المختصة" checked={inputs.utilitiesConfirmed} onChange={(v) => patch("utilitiesConfirmed", v)} />
      </Section>
    </div>
  );
}

// ============================================================
// MODE SWITCH + TABS
// ============================================================
function ModeSwitch({ mode, setMode }) {
  const options = [
    { key: "building", label: "مبنى قائم", icon: Building2 },
    { key: "land", label: "أرض + تطوير", icon: Landmark },
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
  const tabs = [
    { key: "dashboard", label: "لوحة المؤشرات" },
    { key: "cashflow", label: "التدفقات النقدية" },
    { key: "sensitivity", label: "تحليل الحساسية" },
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
  const r = results;
  const noiLabel = mode === "building" ? "صافي الدخل التشغيلي" : "صافي الدخل التشغيلي المستقر";
  const noiValue = mode === "building" ? r.NOI : r.stabilizedNOI;
  const yieldLabel = mode === "building" ? "العائد الصافي على السعر" : "العائد على التكلفة";
  const yieldValue = mode === "building" ? r.netYieldOnPrice : r.capRateOnCost;
  const paybackValue = mode === "building" ? r.paybackOnPrice : r.simplePaybackYears;
  const irrLabel = leverageEnabled ? "العائد الداخلي على حقوق الملكية" : "معدل العائد الداخلي";
  const irrValue = leverageEnabled ? r.leveredIRR : r.irr;
  const npvLabel = leverageEnabled ? "صافي القيمة الحالية (مرفوعة)" : "صافي القيمة الحالية";
  const npvValue = leverageEnabled ? r.leveredNPV : r.npv;

  return (
    <div
      className="sticky top-2 z-20 rounded-2xl p-3 mb-6"
      style={{ background: `${COLORS.panel}F2`, backdropFilter: "blur(8px)", border: `1px solid ${COLORS.hairline}` }}
    >
      <div className="flex flex-wrap items-stretch gap-2">
        <KPIChip label={noiLabel} value={fmtSAR(noiValue)} icon={Wallet} />
        <KPIChip label={yieldLabel} value={fmtPct(yieldValue)} icon={Percent} />
        <KPIChip label={irrLabel} value={fmtPct(irrValue)} icon={TrendingUp} accent sub={leverageEnabled ? `غير مرفوع: ${fmtPct(r.irr)}` : undefined} />
        <KPIChip label={npvLabel} value={fmtSAR(npvValue)} icon={ArrowUpRight} />
        <KPIChip label="فترة الاسترداد" value={fmtYears(paybackValue)} icon={Calendar} />
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
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "#00000099" }}
      onClick={onClose}
    >
      <div
        className="w-full md:w-[480px] max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-5"
        style={{ background: COLORS.panel, border: `1px solid ${COLORS.hairline}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="rf-display text-base font-bold" style={{ color: COLORS.parchment }}>الصفقات</span>
          <button type="button" onClick={onClose} style={{ color: COLORS.slate }}>
            <XCircle size={20} />
          </button>
        </div>

        <div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>الدراسات المرجعية</div>
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
            <Building2 size={14} style={{ color: COLORS.brass }} /> مبنى أبو بكر الصديق
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
            <Landmark size={14} style={{ color: COLORS.brass }} /> أرض الوادي
          </button>
        </div>

        <div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>صفقاتي المحفوظة</div>
        {dealsLoading ? (
          <div className="text-xs mb-4" style={{ color: COLORS.slate }}>جاري التحميل...</div>
        ) : savedDeals.length === 0 ? (
          <div className="text-xs mb-4" style={{ color: COLORS.slateDim }}>لا توجد صفقات محفوظة بعد</div>
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
                  {d.name}
                </button>
                <button type="button" onClick={() => onDeleteDeal(d.id)} style={{ color: COLORS.negative }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {dealsError ? <div className="text-[11px] mb-3" style={{ color: COLORS.negative }}>{dealsError}</div> : null}

        <Divider />
        <div className="text-[10px] tracking-widest mb-2" style={{ color: COLORS.brass }}>حفظ الوضع الحالي كصفقة جديدة</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={saveNameInput}
            onChange={(e) => setSaveNameInput(e.target.value)}
            placeholder="اسم الصفقة..."
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
            <Save size={13} /> حفظ
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
            تحديث الصفقة الحالية بالتعديلات
          </button>
        ) : null}
        <div className="text-[10px] mt-3 leading-relaxed" style={{ color: COLORS.slateDim }}>
          يُحفظ هذا خاصاً بك داخل هذا التطبيق، ويبقى متاحاً عند فتحه لاحقاً.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP SHELL
// ============================================================
export default function App() {
  const [mode, setMode] = useState("building");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [buildingInputs, setBuildingInputs] = useState(DEFAULT_BUILDING_INPUTS);
  const [landInputs, setLandInputs] = useState(DEFAULT_LAND_INPUTS);

  const buildingResults = useMemo(() => calcExistingBuilding(buildingInputs), [buildingInputs]);
  const landResults = useMemo(() => calcLandDevelopment(landInputs), [landInputs]);

  const inputs = mode === "building" ? buildingInputs : landInputs;
  const results = mode === "building" ? buildingResults : landResults;

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
        const result = await window.storage.get("deals-index", false);
        const list = result ? JSON.parse(result.value) : [];
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
      const result = await window.storage.get("deal:" + id, false);
      if (!result) { setDealsError("تعذّر العثور على الصفقة"); return; }
      const record = JSON.parse(result.value);
      setMode(record.mode);
      if (record.mode === "building") setBuildingInputs({ ...DEFAULT_BUILDING_INPUTS, ...record.inputs });
      else setLandInputs({ ...DEFAULT_LAND_INPUTS, ...record.inputs });
      setActiveDealId(id);
      setActiveTab("dashboard");
      setDealsPanelOpen(false);
    } catch (e) {
      setDealsError("تعذّر تحميل الصفقة");
    }
  };

  const saveCurrentAsNewDeal = async () => {
    const name = saveNameInput.trim();
    if (!name) return;
    setSavingInProgress(true);
    setDealsError(null);
    try {
      const id = "deal_" + Date.now();
      const record = { id, name, mode, inputs, savedAt: new Date().toISOString() };
      await window.storage.set("deal:" + id, JSON.stringify(record), false);
      const newIndex = [...savedDeals, { id, name, mode, savedAt: record.savedAt }];
      await window.storage.set("deals-index", JSON.stringify(newIndex), false);
      setSavedDeals(newIndex);
      setActiveDealId(id);
      setSaveNameInput("");
    } catch (e) {
      setDealsError("تعذّر الحفظ، حاول مرة أخرى");
    } finally {
      setSavingInProgress(false);
    }
  };

  const updateActiveDeal = async () => {
    if (!activeDealId) return;
    setSavingInProgress(true);
    setDealsError(null);
    try {
      const existing = savedDeals.find((d) => d.id === activeDealId);
      const record = { id: activeDealId, name: existing ? existing.name : "صفقة", mode, inputs, savedAt: new Date().toISOString() };
      await window.storage.set("deal:" + activeDealId, JSON.stringify(record), false);
      const newIndex = savedDeals.map((d) => (d.id === activeDealId ? { ...d, savedAt: record.savedAt } : d));
      await window.storage.set("deals-index", JSON.stringify(newIndex), false);
      setSavedDeals(newIndex);
    } catch (e) {
      setDealsError("تعذّر تحديث الصفقة");
    } finally {
      setSavingInProgress(false);
    }
  };

  const deleteDeal = async (id) => {
    setDealsError(null);
    try {
      await window.storage.delete("deal:" + id, false);
      const newIndex = savedDeals.filter((d) => d.id !== id);
      await window.storage.set("deals-index", JSON.stringify(newIndex), false);
      setSavedDeals(newIndex);
      if (activeDealId === id) setActiveDealId(null);
    } catch (e) {
      setDealsError("تعذّر الحذف");
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
    <div dir="rtl" className="rf-root min-h-screen" style={{ background: COLORS.ink }}>
      <style>{GLOBAL_STYLE}</style>
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-[11px] tracking-[0.2em]" style={{ color: COLORS.brass }}>
              دراسات الجدوى العقارية · تفاعلي ومترابط بالكامل
            </div>
            <h1 className="rf-display text-2xl md:text-[28px] font-extrabold mt-1" style={{ color: COLORS.parchment }}>
              محرك التقييم الاستثماري العقاري
            </h1>
            <p className="text-xs md:text-sm mt-1 flex items-center gap-1.5" style={{ color: COLORS.slate }}>
              <MapPin size={13} />
              {activeDealName ? `${activeDealName} — ${inputs.projectTitle}` : inputs.projectTitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModeSwitch mode={mode} setMode={(m) => { setMode(m); setActiveDealId(null); setActiveTab("dashboard"); }} />
            <button
              type="button"
              onClick={() => setDealsPanelOpen(true)}
              title="الصفقات المحفوظة"
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
              title={activeDealId ? "التراجع عن التعديلات غير المحفوظة" : "استعادة القيم الأصلية لهذه الدراسة"}
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
        />

        <KPIRibbon mode={mode} results={results} leverageEnabled={inputs.leverageEnabled} />

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} style={{ color: COLORS.brass }} />
              <span className="rf-display text-sm font-semibold" style={{ color: COLORS.parchment }}>المدخلات</span>
              <span className="text-[10px]" style={{ color: COLORS.slateDim }}>— كل قيمة قابلة للتعديل وتُحدَّث النتائج فوراً</span>
            </div>
            {mode === "building" ? (
              <BuildingInputPanel inputs={buildingInputs} setInputs={setBuildingInputs} />
            ) : (
              <LandInputPanel inputs={landInputs} setInputs={setLandInputs} />
            )}
          </aside>

          <main className="lg:col-span-7">
            <Tabs value={activeTab} onChange={setActiveTab} />
            {activeTab === "dashboard" && <DashboardTab mode={mode} inputs={inputs} results={results} />}
            {activeTab === "cashflow" && <CashFlowTab mode={mode} inputs={inputs} results={results} />}
            {activeTab === "sensitivity" && <SensitivityTab mode={mode} inputs={inputs} />}
          </main>
        </div>

        {/* FOOTER */}
        <footer className="mt-10 pt-6" style={{ borderTop: `1px solid ${COLORS.hairlineSoft}` }}>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] mb-3" style={{ color: COLORS.slateDim }}>
            <span>جميع المبالغ بالريال السعودي</span>
            <span>معدل العائد الداخلي (IRR) وصافي القيمة الحالية (NPV) محسوبان على كامل التدفقات النقدية للمشروع</span>
            <span>الحقول الرقمية كلها مدخلات محررة — لا قيم ثابتة داخل معادلات التشغيل</span>
          </div>
          <div className="text-[10px] leading-relaxed" style={{ color: COLORS.slateDim }}>
            ملاحظة منهجية: تم توحيد منطق التوصية بين النموذجين على أربعة معايير مرجّحة بالتساوي، وتصحيح ربط فترتي الإنشاء والتشغيل في نموذج الأرض بحيث تتحكمان فعلياً في الجدول الزمني للتدفقات النقدية.
          </div>
        </footer>
      </div>
    </div>
  );
}
