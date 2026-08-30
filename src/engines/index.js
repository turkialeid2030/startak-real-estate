// src/engines/index.js -- MODULAR ENGINE ENTRYPOINT.
// Single production entry point selecting the correct study engine.
// Zero formula logic here -- pure dispatch to the verbatim-extracted engines.
const { calcExistingBuilding, VACANCY_MONTHS_MAP } = require('./valuation/existing-building');
const { calcLandDevelopment } = require('./valuation/land-development');
const { STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE } = require('../contracts/study-type');
// DEFECT REMEDIATION D1 (DEF-002/DEF-003): single centralized numeric-safety
// boundary. Validates BEFORE dispatch to either study engine -- no scattered
// per-formula validation. Valid inputs (including all RE-GOLD fixtures) are
// completely unaffected; only genuinely invalid inputs now throw instead of
// silently producing misleading finite results.
const { validateEngineInputs } = require('../validation/numeric-safety');

/**
 * calculateInvestmentCase({ studyType, inputs, leverageEnabled })
 * Dispatches to the correct verbatim-extracted engine. Returns the engine's
 * exact current result object, unmodified -- callers use the selector facades
 * (src/engines/valuation/index.js, src/engines/financing/index.js) to extract
 * structured sub-views without any recalculation.
 */
function calculateInvestmentCase({ studyType, inputs, leverageEnabled }) {
  if (studyType !== STUDY_TYPE.EXISTING_BUILDING && studyType !== STUDY_TYPE.LAND_DEVELOPMENT) {
    throw new Error(`calculateInvestmentCase: unknown studyType "${studyType}" -- must be one of ${Object.values(STUDY_TYPE).join(', ')}`);
  }
  const engineInputs = { ...inputs, leverageEnabled };
  validateEngineInputs(engineInputs); // throws ValidationError on invalid input; does not clamp, does not alter valid inputs
  if (studyType === STUDY_TYPE.EXISTING_BUILDING) return calcExistingBuilding(engineInputs);
  return calcLandDevelopment(engineInputs);
}

module.exports = { calculateInvestmentCase, STUDY_TYPE, STUDY_TYPE_TO_LEGACY_MODE, VACANCY_MONTHS_MAP };
