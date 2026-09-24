'use strict';

const FORMULA_REGISTRY_VERSION = 'REAL_ESTATE_FORMULA_REGISTRY_1.0';

const FORMULAS = Object.freeze({
  GPI: Object.freeze({
    id: 'GPI',
    nameAr: 'إجمالي الدخل المحتمل',
    nameEn: 'Gross Potential Income',
    expression: 'PotentialBaseRent + OtherPotentialIncome',
    unit: 'SAR/period',
    semantic: 'Operating',
  }),
  EGI: Object.freeze({
    id: 'EGI',
    nameAr: 'إجمالي الدخل الفعلي',
    nameEn: 'Effective Gross Income',
    expression: 'GPI - VacancyLoss - CollectionLoss - Concessions + OtherOperatingIncome + ServiceChargeRecoveries',
    unit: 'SAR/period',
    semantic: 'Operating',
  }),
  NOI: Object.freeze({
    id: 'NOI',
    nameAr: 'صافي دخل التشغيل',
    nameEn: 'Net Operating Income',
    expression: 'EGI - RecoverableOperatingExpenses - NonRecoverableOperatingExpenses - OtherOperatingExpenses',
    unit: 'SAR/period',
    semantic: 'Operating',
    exclusions: Object.freeze(['DebtService', 'Depreciation', 'IncomeTax', 'InvestorFinancing']),
  }),
  MARKET_CAP_RATE: Object.freeze({
    id: 'MARKET_CAP_RATE',
    nameAr: 'معدل الرسملة السوقي',
    nameEn: 'Market Capitalization Rate',
    expression: 'StabilizedNOI / MarketValue',
    unit: 'ratio',
    semantic: 'Valuation',
  }),
  DIRECT_CAP_VALUE: Object.freeze({
    id: 'DIRECT_CAP_VALUE',
    nameAr: 'القيمة بطريقة الرسملة المباشرة',
    nameEn: 'Direct Capitalization Value',
    expression: 'StabilizedNOI / MarketCapRate',
    unit: 'SAR',
    semantic: 'Valuation',
  }),
  YIELD_ON_COST: Object.freeze({
    id: 'YIELD_ON_COST',
    nameAr: 'العائد على التكلفة',
    nameEn: 'Yield on Cost',
    expression: 'StabilizedNOI / TotalDevelopmentCost',
    unit: 'ratio',
    semantic: 'Development',
    notEquivalentTo: 'MARKET_CAP_RATE',
  }),
  DSCR: Object.freeze({
    id: 'DSCR',
    nameAr: 'نسبة تغطية خدمة الدين',
    nameEn: 'Debt Service Coverage Ratio',
    expression: 'ApprovedDSCRNumerator / DebtService',
    unit: 'x',
    semantic: 'Financing',
    note: 'The required covenant is lender/deal specific; 1.25x is not a universal Saudi rule.',
  }),
  LTV: Object.freeze({
    id: 'LTV',
    nameAr: 'نسبة القرض إلى القيمة',
    nameEn: 'Loan to Value',
    expression: 'LoanAmount / CollateralValue',
    unit: 'ratio',
    semantic: 'Financing',
  }),
  LTC: Object.freeze({
    id: 'LTC',
    nameAr: 'نسبة القرض إلى التكلفة',
    nameEn: 'Loan to Cost',
    expression: 'LoanAmount / TotalDevelopmentCost',
    unit: 'ratio',
    semantic: 'Financing',
  }),
  DEBT_YIELD: Object.freeze({
    id: 'DEBT_YIELD',
    nameAr: 'عائد الدين',
    nameEn: 'Debt Yield',
    expression: 'StabilizedNOI / LoanBalance',
    unit: 'ratio',
    semantic: 'Financing',
  }),
  XNPV: Object.freeze({
    id: 'XNPV',
    nameAr: 'صافي القيمة الحالية بتواريخ فعلية',
    nameEn: 'Date-aware Net Present Value',
    expression: 'SUM(CashFlow_i / (1 + Rate) ^ (Days_i / 365))',
    unit: 'SAR',
    semantic: 'Returns',
  }),
  XIRR: Object.freeze({
    id: 'XIRR',
    nameAr: 'معدل العائد الداخلي بتواريخ فعلية',
    nameEn: 'Date-aware Internal Rate of Return',
    expression: 'Rate where XNPV = 0',
    unit: 'ratio',
    semantic: 'Returns',
  }),
  BREAK_EVEN_OCCUPANCY: Object.freeze({
    id: 'BREAK_EVEN_OCCUPANCY',
    nameAr: 'إشغال التعادل',
    nameEn: 'Break-even Occupancy',
    expression: '(OperatingExpenses + DebtService - OtherIncome) / GrossPotentialRent',
    unit: 'ratio',
    semantic: 'Risk',
  }),
});

function getFormula(id) {
  return FORMULAS[id] || null;
}

function listFormulas() {
  return Object.values(FORMULAS);
}

module.exports = {
  FORMULA_REGISTRY_VERSION,
  FORMULAS,
  getFormula,
  listFormulas,
};
