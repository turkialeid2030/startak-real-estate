// src/modules/studies/land-development/index.js -- LandDevelopmentStudyDefinition.
// NO formulas here -- calculate() routes exclusively through calculateInvestmentCase().
const { STUDY_TYPE } = require('../../../contracts/study-type');
const { STUDY_LEVEL } = require('../../../contracts/study-level');
const { calculateInvestmentCase } = require('../../../engines');
const { selectValuationResult } = require('../../../engines/valuation');
const { selectFinancingResult } = require('../../../engines/financing');
const { selectRecommendationResult } = require('../../../engines/recommendation/selectors');

const LandDevelopmentStudyDefinition = {
  id: 'land-development',
  studyType: STUDY_TYPE.LAND_DEVELOPMENT,
  defaultStudyLevel: STUDY_LEVEL.SCREENING,
  calculate: (inputs) => calculateInvestmentCase({ studyType: STUDY_TYPE.LAND_DEVELOPMENT, inputs, leverageEnabled: inputs.leverageEnabled }),
  selectFinancialResult: (r) => ({ cashflows: r.cashflows, irr: r.irr, npv: r.npv }),
  selectValuationResult: (r) => selectValuationResult(r, 'LAND_DEVELOPMENT'),
  selectFinancingResult,
  selectRecommendationResult,
  supportedSections: ['dashboard', 'cashflow', 'sensitivity', 'saved-deals'],
  knownLimitations: ['DEF-001 (exit-value growth timing)', 'COV-002 (no NO-GO tier fixture)'],
};
module.exports = { LandDevelopmentStudyDefinition };
