// src/contracts/financial-result.js -- maps ALL actual current income/yield output
// fields, verified against real engine output (0 unmapped, checked programmatically).
const FINANCIAL_RESULT_FIELDS = Object.freeze({
  cashflows: { present: 'BOTH', type: 'number[]' },
  irr: { present: 'BOTH', type: 'number (may be NaN)' },
  npv: { present: 'BOTH', type: 'number' },
  NOI: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  stabilizedNOI: { present: 'LAND_DEVELOPMENT_ONLY', type: 'number' },
  totalAnnualIncome: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  totalOperatingRevenue: { present: 'LAND_DEVELOPMENT_ONLY', type: 'number' },
  grossRentalIncome: { present: 'BOTH', type: 'number' },
  opexAmount: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  operatingExpenses: { present: 'LAND_DEVELOPMENT_ONLY', type: 'number' },
  vacancyDeduction: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  rentalIncomeAfterVacancy: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  serviceIncome: { present: 'BOTH', type: 'number' },
  vatCollected: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  netYieldOnCost: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  grossYieldOnCost: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  paybackOnCost: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  netYieldOnPrice: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  paybackOnPrice: { present: 'EXISTING_BUILDING_ONLY', type: 'number' },
  actualRentalIncome: { present: 'LAND_DEVELOPMENT_ONLY', type: 'number' },
});
module.exports = { FINANCIAL_RESULT_FIELDS };
