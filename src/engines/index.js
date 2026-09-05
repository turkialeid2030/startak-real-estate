// src/engines/index.js -- MODULAR ENGINE ENTRYPOINT.
// Single production entry point selecting the correct study engine and applying
// canonical post-calculation financing remediation where implemented.
const { calcExistingBuilding, VACANCY_MONTHS_MAP } = require('./valuation/existing-building');
const { calcLandDevelopment } = require('./valuation/land-development');
const { applyFinancingRemediation } = require('./financing/remediation-wave-b');
const { STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE } = require('../contracts/study-type');
const { validateEngineInputs } = require('../validation/numeric-safety');

/**
 * calculateInvestmentCase({ studyType, inputs, leverageEnabled, assumptionModelVersion })
 * Validates inputs, executes the study engine, then applies any versioned
 * canonical financing remediation. assumptionModelVersion is deal-envelope
 * metadata and is never injected into the economic inputs object.
 */
function calculateInvestmentCase({ studyType, inputs, leverageEnabled, assumptionModelVersion }) {
  if (studyType !== STUDY_TYPE.EXISTING_BUILDING && studyType !== STUDY_TYPE.LAND_DEVELOPMENT) {
    throw new Error(`calculateInvestmentCase: unknown studyType "${studyType}" -- must be one of ${Object.values(STUDY_TYPE).join(', ')}`);
  }
  const engineInputs = { ...inputs, leverageEnabled };
  validateEngineInputs(engineInputs, { studyType });
  const rawResult = studyType === STUDY_TYPE.EXISTING_BUILDING
    ? calcExistingBuilding(engineInputs, { assumptionModelVersion })
    : calcLandDevelopment(engineInputs);
  return applyFinancingRemediation({
    studyType,
    inputs: engineInputs,
    engineResult: rawResult,
    assumptionModelVersion,
  });
}

module.exports = { calculateInvestmentCase, STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE, VACANCY_MONTHS_MAP };
