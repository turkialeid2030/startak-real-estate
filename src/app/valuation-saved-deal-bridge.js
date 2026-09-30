'use strict';

const { validateValuationCaseExtension } = require('../valuation-intelligence');
const { validateGovernedDealDecisionSnapshot } = require('../decision-intelligence/governed-deal-decision');
const {
  buildGovernedHumanReview,
  validateGovernedHumanReview,
  withGovernedHumanReview: attachGovernedHumanReview,
  evaluateControlledHumanReviewState,
  buildGovernedReviewedDecisionExport,
} = require('../decision-intelligence/governed-human-review');
const { createStorageProvider } = require('../storage/create-storage-provider');
const {
  C5OperationalError,
  computeSavedDealStateHash,
  evaluateGovernedDecisionOperationalState,
  buildGovernedDecisionOperationalExport,
} = require('./governed-decision-operational');

// Session-only provenance association. The exact valuationCase object returned
// by valuationCaseFromSavedDeal is the capability token for the loaded saved
// record. Any valuation-case replacement loses this association by design.
// Economic/governance edits are additionally detected by the saved-deal state
// hash before C4/C6 metadata can be preserved on update.
const loadedGovernedContextByValuationCase = new WeakMap();

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function requiredSavedDeal(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('saved deal record must be an object');
  return record;
}

function rememberGovernedContext(valuationCase, record) {
  if (!valuationCase || !record || !Object.prototype.hasOwnProperty.call(record, 'governedDealDecision')) return;
  validateGovernedDealDecisionSnapshot(record.governedDealDecision);
  if (Object.prototype.hasOwnProperty.call(record, 'governedHumanReview')) {
    validateGovernedHumanReview(record.governedHumanReview, { savedDealRecord: record });
  }
  loadedGovernedContextByValuationCase.set(valuationCase, Object.freeze({
    savedDealRecord: clone(record),
    savedDealStateHashSha256: computeSavedDealStateHash(record),
  }));
}

function valuationCaseFromSavedDeal(record) {
  requiredSavedDeal(record);
  if (record.mode !== 'building') return null;
  if (!Object.prototype.hasOwnProperty.call(record, 'valuationCase')) return null;
  validateValuationCaseExtension(record.valuationCase);
  const valuationCase = clone(record.valuationCase);
  rememberGovernedContext(valuationCase, record);
  return valuationCase;
}

function withValuationCase(record, valuationCase) {
  requiredSavedDeal(record);
  const {
    valuationCase: _discardedValuationCase,
    governedDealDecision: _discardedDecision,
    governedHumanReview: _discardedReview,
    ...withoutGovernedExtensions
  } = record;
  if (record.mode !== 'building' || valuationCase === null || valuationCase === undefined) return withoutGovernedExtensions;
  validateValuationCaseExtension(valuationCase);
  let output = {
    ...withoutGovernedExtensions,
    valuationCase: clone(valuationCase),
  };

  const loaded = loadedGovernedContextByValuationCase.get(valuationCase);
  if (loaded && loaded.savedDealRecord.governedDealDecision) {
    const currentStateHash = computeSavedDealStateHash(output);
    if (currentStateHash === loaded.savedDealStateHashSha256) {
      output = withGovernedDealDecision(output, loaded.savedDealRecord.governedDealDecision);
      if (loaded.savedDealRecord.governedHumanReview) {
        output = attachGovernedHumanReview(output, loaded.savedDealRecord.governedHumanReview);
      }
    } else {
      // Any material saved-deal state change invalidates the session provenance
      // association. The stale governed decision and review are deliberately not
      // carried forward into the updated deal.
      loadedGovernedContextByValuationCase.delete(valuationCase);
      delete output.governedDealDecision;
      delete output.governedHumanReview;
    }
  }
  return output;
}

function governedDealDecisionFromSavedDeal(record) {
  requiredSavedDeal(record);
  if (record.mode !== 'building') return null;
  if (!Object.prototype.hasOwnProperty.call(record, 'governedDealDecision')) return null;
  validateGovernedDealDecisionSnapshot(record.governedDealDecision);
  return clone(record.governedDealDecision);
}

function withGovernedDealDecision(record, governedDealDecision) {
  requiredSavedDeal(record);
  const { governedDealDecision: _discarded, governedHumanReview: _discardedReview, ...withoutGovernedDecision } = record;
  if (record.mode !== 'building' || governedDealDecision === null || governedDealDecision === undefined) return withoutGovernedDecision;
  validateGovernedDealDecisionSnapshot(governedDealDecision);
  return {
    ...withoutGovernedDecision,
    governedDealDecision: clone(governedDealDecision),
  };
}

function withGovernedHumanReview(record, governedHumanReview) {
  requiredSavedDeal(record);
  return attachGovernedHumanReview(record, governedHumanReview);
}

function governedDecisionOperationalContextFromValuationCase(valuationCase, { asOf = new Date() } = {}) {
  if (!valuationCase || typeof valuationCase !== 'object') return null;
  const loaded = loadedGovernedContextByValuationCase.get(valuationCase);
  if (!loaded) return null;
  const viewModel = evaluateGovernedDecisionOperationalState({
    savedDealRecord: loaded.savedDealRecord,
    expectedContext: { projectId: valuationCase.projectId },
    asOf,
  });
  return Object.freeze({
    sourceSavedDealId: loaded.savedDealRecord.id || null,
    sourceSavedDealStateHashSha256: loaded.savedDealStateHashSha256,
    viewModel,
  });
}

function governedHumanReviewContextFromValuationCase(valuationCase, { asOf = new Date() } = {}) {
  if (!valuationCase || typeof valuationCase !== 'object') return null;
  const loaded = loadedGovernedContextByValuationCase.get(valuationCase);
  if (!loaded) return null;
  const viewModel = evaluateControlledHumanReviewState({
    savedDealRecord: loaded.savedDealRecord,
    asOf,
  });
  return Object.freeze({
    sourceSavedDealId: loaded.savedDealRecord.id || null,
    sourceSavedDealStateHashSha256: loaded.savedDealStateHashSha256,
    viewModel,
  });
}

function buildGovernedHumanReviewFromValuationCase(valuationCase, reviewInput = {}) {
  if (!valuationCase || typeof valuationCase !== 'object') throw new C5OperationalError('C5_LOADED_CONTEXT_REQUIRED');
  const loaded = loadedGovernedContextByValuationCase.get(valuationCase);
  if (!loaded) throw new C5OperationalError('C5_LOADED_CONTEXT_REQUIRED');
  return buildGovernedHumanReview({
    savedDealRecord: loaded.savedDealRecord,
    ...reviewInput,
  });
}

async function persistGovernedHumanReviewFromValuationCase(valuationCase, reviewInput = {}) {
  if (!valuationCase || typeof valuationCase !== 'object') throw new C5OperationalError('C5_LOADED_CONTEXT_REQUIRED');
  const loaded = loadedGovernedContextByValuationCase.get(valuationCase);
  if (!loaded) throw new C5OperationalError('C5_LOADED_CONTEXT_REQUIRED');
  const id = typeof loaded.savedDealRecord.id === 'string' ? loaded.savedDealRecord.id.trim() : '';
  if (!id) throw new C5OperationalError('C5_SAVED_DEAL_ID_REQUIRED');
  const review = buildGovernedHumanReview({ savedDealRecord: loaded.savedDealRecord, ...reviewInput });
  const updatedRecord = attachGovernedHumanReview(loaded.savedDealRecord, review);
  const storageProvider = createStorageProvider();
  await storageProvider.set(`deal:${id}`, JSON.stringify(updatedRecord));
  rememberGovernedContext(valuationCase, updatedRecord);
  return clone(review);
}

function buildGovernedDecisionOperationalExportFromValuationCase(valuationCase, {
  reportId,
  generatedAt = new Date(),
} = {}) {
  if (!valuationCase || typeof valuationCase !== 'object') throw new C5OperationalError('C5_LOADED_CONTEXT_REQUIRED');
  const loaded = loadedGovernedContextByValuationCase.get(valuationCase);
  if (!loaded) throw new C5OperationalError('C5_LOADED_CONTEXT_REQUIRED');
  return buildGovernedDecisionOperationalExport({
    savedDealRecord: loaded.savedDealRecord,
    expectedContext: { projectId: valuationCase.projectId },
    reportId,
    generatedAt,
  });
}

function buildGovernedReviewedDecisionExportFromValuationCase(valuationCase, {
  reportId,
  generatedAt = new Date(),
} = {}) {
  if (!valuationCase || typeof valuationCase !== 'object') throw new C5OperationalError('C5_LOADED_CONTEXT_REQUIRED');
  const loaded = loadedGovernedContextByValuationCase.get(valuationCase);
  if (!loaded) throw new C5OperationalError('C5_LOADED_CONTEXT_REQUIRED');
  return buildGovernedReviewedDecisionExport({
    savedDealRecord: loaded.savedDealRecord,
    reportId,
    generatedAt,
  });
}

module.exports = {
  valuationCaseFromSavedDeal,
  withValuationCase,
  governedDealDecisionFromSavedDeal,
  withGovernedDealDecision,
  withGovernedHumanReview,
  governedDecisionOperationalContextFromValuationCase,
  governedHumanReviewContextFromValuationCase,
  buildGovernedHumanReviewFromValuationCase,
  persistGovernedHumanReviewFromValuationCase,
  buildGovernedDecisionOperationalExportFromValuationCase,
  buildGovernedReviewedDecisionExportFromValuationCase,
};
