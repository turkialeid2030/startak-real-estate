// src/modules/studies/existing-building/index.js -- ExistingBuildingStudyDefinition.
// NO formulas here -- calculate() routes exclusively through calculateInvestmentCase().
const { STUDY_TYPE } = require('../../../contracts/study-type');
const { STUDY_LEVEL } = require('../../../contracts/study-level');
const { calculateInvestmentCase } = require('../../../engines');
const { selectValuationResult } = require('../../../engines/valuation');
const { selectFinancingResult } = require('../../../engines/financing');
const { selectRecommendationResult } = require('../../../engines/recommendation/selectors');
const {
  createResidentialIncomeOperatingCase,
  assessOperatingUnderwritingReadiness,
  createResidentialIncomeAcquisitionViewModel,
  calculateOperatingMetrics,
} = require('../../../residential-income-acquisition');

const ExistingBuildingStudyDefinition = {
  id: 'existing-building',
  studyType: STUDY_TYPE.EXISTING_BUILDING,
  defaultStudyLevel: STUDY_LEVEL.SCREENING,
  calculate: (inputs) => calculateInvestmentCase({ studyType: STUDY_TYPE.EXISTING_BUILDING, inputs, leverageEnabled: inputs.leverageEnabled }),
  selectFinancialResult: (r) => ({ cashflows: r.cashflows, irr: r.irr, npv: r.npv }),
  selectValuationResult: (r) => selectValuationResult(r, 'EXISTING_BUILDING'),
  selectFinancingResult,
  selectRecommendationResult,
  createOperatingUnderwritingCase: createResidentialIncomeOperatingCase,
  assessOperatingUnderwritingReadiness,
  projectOperatingUnderwritingReadiness: createResidentialIncomeAcquisitionViewModel,
  calculateResidentialIncomeOperatingMetrics: calculateOperatingMetrics,
  supportedSections: ['dashboard', 'cashflow', 'sensitivity', 'saved-deals'],
  knownLimitations: ['DEF-001 (exit-value growth timing)', 'DEF-002 (occupancy >100% unclamped)', 'DEF-003 (Infinity via 309+ digit input)', 'DEF-004 (unvalidated persisted zero denominator)', 'COV-001 (no positive-growth exit fixture)'],
};
module.exports = { ExistingBuildingStudyDefinition };
