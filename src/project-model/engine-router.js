'use strict';

const { STUDY_TYPE } = require('../contracts/study-type');
const {
  LIFECYCLE_STAGE,
  INVESTMENT_STRATEGY,
  INCOME_MODEL,
} = require('./project-profile');

const ENGINE_ROUTE_STATUS = Object.freeze({
  QUALIFIED: 'QUALIFIED',
  HOLD_NO_QUALIFIED_ENGINE: 'HOLD_NO_QUALIFIED_ENGINE',
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function resolveExecutableEngine(profile) {
  if (!profile || typeof profile !== 'object' || !profile.projectId || !profile.traits) {
    throw new TypeError('qualified project profile is required');
  }

  const landDevelopmentLifecycle = [LIFECYCLE_STAGE.PLANNED, LIFECYCLE_STAGE.UNDER_DEVELOPMENT].includes(profile.lifecycleStage);
  const landDevelopmentStrategy = profile.investmentStrategy === INVESTMENT_STRATEGY.DEVELOPMENT;
  if (profile.traits.landOnly && (landDevelopmentLifecycle || landDevelopmentStrategy)) {
    return freeze({
      schemaVersion: 1,
      projectId: profile.projectId,
      status: ENGINE_ROUTE_STATUS.QUALIFIED,
      studyType: STUDY_TYPE.LAND_DEVELOPMENT,
      adapterId: 'CANONICAL_LAND_DEVELOPMENT_V1',
      reason: 'Qualified land-development calculation path matches the canonical LAND_DEVELOPMENT engine contract.',
      evidencePipelineSupported: true,
      financialEngineQualified: true,
    });
  }

  const existingBuiltLifecycle = [
    LIFECYCLE_STAGE.EXISTING_VACANT,
    LIFECYCLE_STAGE.EXISTING_OPERATING,
    LIFECYCLE_STAGE.STABILIZED,
  ].includes(profile.lifecycleStage);
  const existingIncomeStrategy = [INVESTMENT_STRATEGY.ACQUIRE_HOLD, INVESTMENT_STRATEGY.CORE_INCOME].includes(profile.investmentStrategy);
  if (profile.traits.hasBuiltAsset && existingBuiltLifecycle && existingIncomeStrategy && profile.incomeModel === INCOME_MODEL.LEASE_INCOME) {
    return freeze({
      schemaVersion: 1,
      projectId: profile.projectId,
      status: ENGINE_ROUTE_STATUS.QUALIFIED,
      studyType: STUDY_TYPE.EXISTING_BUILDING,
      adapterId: 'CANONICAL_EXISTING_BUILDING_V1',
      reason: 'Qualified leased existing-asset path matches the canonical EXISTING_BUILDING engine contract.',
      evidencePipelineSupported: true,
      financialEngineQualified: true,
    });
  }

  return freeze({
    schemaVersion: 1,
    projectId: profile.projectId,
    status: ENGINE_ROUTE_STATUS.HOLD_NO_QUALIFIED_ENGINE,
    studyType: null,
    adapterId: null,
    reason: 'The universal evidence and reconciliation pipeline supports this project profile, but no qualified financial adapter currently matches it. No financial result may be fabricated or borrowed from another asset class.',
    evidencePipelineSupported: true,
    financialEngineQualified: false,
  });
}

module.exports = { ENGINE_ROUTE_STATUS, resolveExecutableEngine };
