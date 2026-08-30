// src/migrations/legacy-saved-deal-adapter.js -- non-destructive adapter:
// legacy Saved Deal record -> ExecutableInvestmentCase. Does NOT mutate the
// original record, does NOT alter financial inputs, does NOT repair invalid
// historical values (DEF-004 stays exactly as-is).
const { STUDY_TYPE } = require('../contracts/study-type');
const { STUDY_LEVEL } = require('../contracts/study-level');
const { createExecutableInvestmentCase } = require('../contracts/executable-investment-case');
const { calculateInvestmentCase } = require('../engines');

const LEGACY_MODE_TO_STUDY_TYPE = { building: STUDY_TYPE.EXISTING_BUILDING, land: STUDY_TYPE.LAND_DEVELOPMENT };

/**
 * legacySavedDealToInvestmentCase(record)
 * record = the EXACT current Saved Deal shape: {id, name, mode, inputs, savedAt}
 * (confirmed in REBASE_SAVED_DEAL_SCHEMA.md).
 * Returns a NEW ExecutableInvestmentCase object -- the input `record` is never
 * written to.
 */
function legacySavedDealToInvestmentCase(record) {
  const studyType = LEGACY_MODE_TO_STUDY_TYPE[record.mode];
  if (!studyType) throw new Error(`Unknown legacy mode: ${record.mode}`);

  // inputs are passed through UNMODIFIED -- no isFinite/min/schema repair of
  // any kind, even if the record contains invalid historical values (DEF-004).
  const engineResult = calculateInvestmentCase({ studyType, inputs: record.inputs, leverageEnabled: record.inputs.leverageEnabled });

  const investmentCase = createExecutableInvestmentCase({
    caseId: record.id, // legacy ID preserved exactly, not regenerated
    studyType,
    inputs: record.inputs, // exact same object reference's VALUES copied in, never mutated
    engineResult,
    verdict: engineResult.verdict,
  });

  // Preserve legacy-specific fields the base contract factory doesn't carry:
  investmentCase.legacyMetadata = {
    originalName: record.name,
    originalSavedAt: record.savedAt,
    migratedFrom: 'legacy-saved-deal-v1',
  };
  investmentCase.studyLevel = STUDY_LEVEL.SCREENING; // no evidence exists to justify any other level

  return investmentCase;
}

module.exports = { legacySavedDealToInvestmentCase, LEGACY_MODE_TO_STUDY_TYPE };
