// src/engines/index.js -- MODULAR ENGINE ENTRYPOINT.
// Single production entry point selecting the correct study engine and applying
// canonical post-calculation financing remediation where implemented.
const { calcExistingBuilding, VACANCY_MONTHS_MAP } = require('./valuation/existing-building');
const { calcLandDevelopment } = require('./valuation/land-development');
const { applyFinancingRemediation } = require('./financing/remediation-wave-b');
const { STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE } = require('../contracts/study-type');
const { validateEngineInputs } = require('../validation/numeric-safety');

/**
 * calculateInvestmentCase({ studyType, inputs, leverageEnabled })
 * Validates inputs, executes the study engine, then applies any versioned
 * canonical financing remediation. Financial/valuation formulas remain owned by
 * their dedicated engine modules; this entrypoint only orchestrates the path.
 */
function calculateInvestmentCase({ studyType, inputs, leverageEnabled }) {
  if (studyType !== STUDY_TYPE.EXISTING_BUILDING && studyType !== STUDY_TYPE.LAND_DEVELOPMENT) {
    throw new Error(`calculateInvestmentCase: unknown studyType "${studyType}" -- must be one of ${Object.values(STUDY_TYPE).join(', ')}`);
  }
  const engineInputs = { ...inputs, leverageEnabled };
  validateEngineInputs(engineInputs);
  const rawResult = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? calcExistingBuilding(engineInputs)
    : calcLandDevelopment(engineInputs);
  return applyFinancingRemediation({ studyType, inputs: engineInputs, engineResult: rawResult });
}

module.exports = { calculateInvestmentCase, STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE, VACANCY_MONTHS_MAP };
