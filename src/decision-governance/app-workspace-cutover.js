'use strict';

const { createNewDealInputs, evaluateNewDealReadiness } = require('./new-deal-workspace');
const {
  DEMO_BUILDING_INPUTS,
  DEMO_LAND_INPUTS,
  LEGACY_BUILDING_HYDRATION_DEFAULTS,
  LEGACY_LAND_HYDRATION_DEFAULTS,
} = require('./deal-datasets');
const { createDealProvenance, DEAL_PROVENANCE } = require('./deal-provenance');

const APP_WORKSPACE_KIND = Object.freeze({
  NEW: 'NEW',
  DEMO: 'DEMO',
  SAVED: 'SAVED',
});

function assertMode(mode) {
  if (mode !== 'building' && mode !== 'land') throw new TypeError(`Unsupported App workspace mode: ${mode}`);
}

function clone(value) { return { ...value }; }

function createAppNewWorkspace(mode) {
  assertMode(mode);
  const inputs = clone(createNewDealInputs(mode));
  return Object.freeze({
    kind: APP_WORKSPACE_KIND.NEW,
    mode,
    inputs,
    readiness: evaluateNewDealReadiness(mode, inputs),
    provenance: createDealProvenance(DEAL_PROVENANCE.NEW),
  });
}

function createAppDemoWorkspace(mode) {
  assertMode(mode);
  const inputs = clone(mode === 'building' ? DEMO_BUILDING_INPUTS : DEMO_LAND_INPUTS);
  return Object.freeze({
    kind: APP_WORKSPACE_KIND.DEMO,
    mode,
    inputs,
    readiness: Object.freeze({ status: 'DEMO_READY', calculationAllowed: true, missingFields: Object.freeze([]) }),
    provenance: createDealProvenance(DEAL_PROVENANCE.DEMO),
  });
}

function legacyHydrationDefaults(mode) {
  assertMode(mode);
  return mode === 'building' ? LEGACY_BUILDING_HYDRATION_DEFAULTS : LEGACY_LAND_HYDRATION_DEFAULTS;
}

function evaluateAppCalculationReadiness({ kind, mode, inputs }) {
  assertMode(mode);
  if (kind === APP_WORKSPACE_KIND.NEW) return evaluateNewDealReadiness(mode, inputs || {});
  if (kind === APP_WORKSPACE_KIND.DEMO || kind === APP_WORKSPACE_KIND.SAVED) {
    return Object.freeze({ status: 'CALCULATION_ALLOWED', calculationAllowed: true, missingFields: Object.freeze([]) });
  }
  return Object.freeze({ status: 'INCOMPLETE', calculationAllowed: false, missingFields: Object.freeze([]) });
}

module.exports = {
  APP_WORKSPACE_KIND,
  createAppNewWorkspace,
  createAppDemoWorkspace,
  legacyHydrationDefaults,
  evaluateAppCalculationReadiness,
};
