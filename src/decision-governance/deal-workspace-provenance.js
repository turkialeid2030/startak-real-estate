'use strict';

const {
  DEAL_PROVENANCE,
  createDealProvenance,
  assertRealDealSaveAllowed,
} = require('./deal-provenance');

function provenanceForNewDeal() {
  return createDealProvenance(DEAL_PROVENANCE.NEW);
}

function provenanceForDemoDeal() {
  return createDealProvenance(DEAL_PROVENANCE.DEMO);
}

function provenanceForSavedDeal() {
  return createDealProvenance(DEAL_PROVENANCE.SAVED);
}

function provenanceForDuplicatedDeal() {
  return createDealProvenance(DEAL_PROVENANCE.DUPLICATED);
}

function provenanceForLoadedRecord(record) {
  if (!record || typeof record !== 'object') return provenanceForSavedDeal();
  if (record.provenance && record.provenance.kind === DEAL_PROVENANCE.DEMO) return provenanceForDemoDeal();
  if (record.provenance && record.provenance.kind === DEAL_PROVENANCE.DUPLICATED) return provenanceForDuplicatedDeal();
  return provenanceForSavedDeal();
}

function assertWorkspaceSaveAllowed({ provenance, confirmedDemoConversion = false } = {}) {
  return assertRealDealSaveAllowed({ provenance, confirmedDemoConversion });
}

function withDealProvenance(record, provenance) {
  if (!record || typeof record !== 'object') throw new TypeError('record is required');
  if (!provenance || !Object.values(DEAL_PROVENANCE).includes(provenance.kind)) {
    throw new TypeError('valid provenance is required');
  }
  return {
    ...record,
    provenance: {
      kind: provenance.kind,
      isDemo: provenance.isDemo,
      requiresRealDealConfirmation: provenance.requiresRealDealConfirmation,
    },
  };
}

module.exports = {
  provenanceForNewDeal,
  provenanceForDemoDeal,
  provenanceForSavedDeal,
  provenanceForDuplicatedDeal,
  provenanceForLoadedRecord,
  assertWorkspaceSaveAllowed,
  withDealProvenance,
};
