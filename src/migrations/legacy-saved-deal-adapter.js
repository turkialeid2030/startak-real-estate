// src/migrations/legacy-saved-deal-adapter.js -- non-destructive adapter:
// legacy Saved Deal record -> ExecutableInvestmentCase. Does NOT mutate the
// original record, does NOT alter financial inputs, does NOT repair invalid
// historical values (DEF-004 stays exactly as-is).
const { STUDY_TYPE } = require('../contracts/study-type');
const { STUDY_LEVEL } = require('../contracts/study-level');
const { createExecutableInvestmentCase } = require('../contracts/executable-investment-case');
const { calculateInvestmentCase } = require('../engines');
const { evaluateSavedDealAssumptionRegistry } = require('../assumptions/saved-deal-assumption-registry');

const LEGACY_MODE_TO_STUDY_TYPE = { building: STUDY_TYPE.EXISTING_BUILDING, land: STUDY_TYPE.LAND_DEVELOPMENT };

function buildAssumptionGovernanceDomainOutputs(record) {
  const evaluated = evaluateSavedDealAssumptionRegistry(record);
  if (evaluated.status === 'NOT_EVALUATED') return { evaluated, domainOutputs: {} };

  const decisionStatus = evaluated.status === 'HOLD'
    ? 'HOLD'
    : evaluated.status === 'REVIEW'
      ? 'REVIEW_REQUIRED'
      : 'NOT_EVALUATED';

  return {
    evaluated,
    domainOutputs: {
      assumptions: {
        status: evaluated.status,
        items: evaluated.assumptions,
        registryHashSha256: evaluated.registryHashSha256,
        blockers: evaluated.blockers,
        warnings: evaluated.warnings,
      },
      governance: {
        status: evaluated.status,
        assumptionRegistryVersion: evaluated.version,
        assumptionRegistryHashSha256: evaluated.registryHashSha256,
        assumptionBlockers: evaluated.blockers,
        assumptionWarnings: evaluated.warnings,
        failClosed: evaluated.status === 'HOLD',
      },
      decision: {
        status: decisionStatus,
        reasonCodes: evaluated.blockers.length ? evaluated.blockers.slice() : evaluated.warnings.slice(),
        semantics: evaluated.status === 'HOLD'
          ? 'The deterministic financial engine result is preserved for audit, but the governed decision cannot advance while critical assumptions are unsupported or stale.'
          : evaluated.status === 'REVIEW'
            ? 'The deterministic financial engine result is preserved, but assumption-governance warnings require review before decision progression.'
            : 'Assumption evidence passed its registry gate. This does not itself authorize an investment, valuation, credit, transaction, or release decision.',
      },
    },
  };
}

/**
 * legacySavedDealToInvestmentCase(record)
 * record = the legacy Saved Deal core plus optional governed metadata.
 * Returns a NEW ExecutableInvestmentCase object -- the input `record` is never
 * written to. Economic inputs are never repaired or rewritten here.
 */
function legacySavedDealToInvestmentCase(record) {
  const studyType = LEGACY_MODE_TO_STUDY_TYPE[record.mode];
  if (!studyType) throw new Error(`Unknown legacy mode: ${record.mode}`);

  // inputs are passed through UNMODIFIED -- no isFinite/min/schema repair of
  // any kind, even if the record contains invalid historical values (DEF-004).
  const engineResult = calculateInvestmentCase({ studyType, inputs: record.inputs, leverageEnabled: record.inputs.leverageEnabled });
  const { evaluated: assumptionGovernance, domainOutputs } = buildAssumptionGovernanceDomainOutputs(record);

  const investmentCase = createExecutableInvestmentCase({
    caseId: record.id, // legacy ID preserved exactly, not regenerated
    studyType,
    inputs: record.inputs, // exact same object reference's VALUES copied in, never mutated
    engineResult,
    verdict: engineResult.verdict,
    domainOutputs,
  });

  // Preserve legacy-specific fields the base contract factory doesn't carry.
  investmentCase.legacyMetadata = {
    originalName: record.name,
    originalSavedAt: record.savedAt,
    migratedFrom: 'legacy-saved-deal-v1',
    assumptionRegistryPresent: assumptionGovernance.status !== 'NOT_EVALUATED',
    assumptionRegistryVersion: assumptionGovernance.version,
    assumptionRegistryHashSha256: assumptionGovernance.registryHashSha256,
  };
  investmentCase.studyLevel = STUDY_LEVEL.SCREENING; // no evidence exists to justify any other level

  return investmentCase;
}

module.exports = {
  legacySavedDealToInvestmentCase,
  LEGACY_MODE_TO_STUDY_TYPE,
  buildAssumptionGovernanceDomainOutputs,
};
