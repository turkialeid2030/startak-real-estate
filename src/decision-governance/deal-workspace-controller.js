'use strict';

const { createNewDealInputs, evaluateNewDealReadiness } = require('./new-deal-workspace');
const {
  provenanceForNewDeal,
  provenanceForDemoDeal,
  provenanceForLoadedRecord,
  assertWorkspaceSaveAllowed,
  withDealProvenance,
} = require('./deal-workspace-provenance');

const WORKSPACE_KIND = Object.freeze({ NEW: 'NEW', DEMO: 'DEMO', SAVED: 'SAVED', DUPLICATED: 'DUPLICATED' });

function createNewWorkspace(mode) {
  const inputs = createNewDealInputs(mode);
  const readiness = evaluateNewDealReadiness(mode, inputs);
  return Object.freeze({
    kind: WORKSPACE_KIND.NEW,
    mode,
    inputs,
    provenance: provenanceForNewDeal(),
    readiness,
    calculationAllowed: false,
  });
}

function createDemoWorkspace(mode, demoInputs) {
  if (!demoInputs || typeof demoInputs !== 'object' || Array.isArray(demoInputs)) throw new TypeError('demoInputs must be an object');
  return Object.freeze({
    kind: WORKSPACE_KIND.DEMO,
    mode,
    inputs: Object.freeze({ ...demoInputs }),
    provenance: provenanceForDemoDeal(),
    readiness: Object.freeze({ status: 'DEMO', calculationAllowed: true, missingFields: Object.freeze([]) }),
    calculationAllowed: true,
  });
}

function evaluateWorkspace(mode, inputs, provenance) {
  if (!provenance || provenance.kind === WORKSPACE_KIND.NEW) {
    const readiness = evaluateNewDealReadiness(mode, inputs);
    return Object.freeze({ readiness, calculationAllowed: readiness.calculationAllowed });
  }
  return Object.freeze({ readiness: null, calculationAllowed: true });
}

function prepareWorkspaceRecordForSave(record, provenance, { confirmedDemoConversion = false } = {}) {
  assertWorkspaceSaveAllowed({ provenance, confirmedDemoConversion });
  // Once a Demo is explicitly converted and saved as a real deal, do not persist
  // DEMO provenance. The saved record is a real saved deal and must not silently
  // retain a sample-data identity.
  const persistedProvenance = provenance && provenance.kind === WORKSPACE_KIND.DEMO
    ? provenanceForLoadedRecord({})
    : provenance;
  return withDealProvenance(record, persistedProvenance || provenanceForLoadedRecord({}));
}

module.exports = {
  WORKSPACE_KIND,
  createNewWorkspace,
  createDemoWorkspace,
  evaluateWorkspace,
  prepareWorkspaceRecordForSave,
};
