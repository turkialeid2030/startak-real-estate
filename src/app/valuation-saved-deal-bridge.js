'use strict';

const { validateValuationCaseExtension } = require('../valuation-intelligence');
const { validateGovernedDealDecisionSnapshot } = require('../decision-intelligence/governed-deal-decision');

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function requiredSavedDeal(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('saved deal record must be an object');
  return record;
}

function valuationCaseFromSavedDeal(record) {
  requiredSavedDeal(record);
  if (record.mode !== 'building') return null;
  if (!Object.prototype.hasOwnProperty.call(record, 'valuationCase')) return null;
  validateValuationCaseExtension(record.valuationCase);
  return clone(record.valuationCase);
}

function withValuationCase(record, valuationCase) {
  requiredSavedDeal(record);
  const { valuationCase: _discarded, ...withoutValuationCase } = record;
  if (record.mode !== 'building' || valuationCase === null || valuationCase === undefined) return withoutValuationCase;
  validateValuationCaseExtension(valuationCase);
  return {
    ...withoutValuationCase,
    valuationCase: clone(valuationCase),
  };
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
  const { governedDealDecision: _discarded, ...withoutGovernedDecision } = record;
  if (record.mode !== 'building' || governedDealDecision === null || governedDealDecision === undefined) return withoutGovernedDecision;
  validateGovernedDealDecisionSnapshot(governedDealDecision);
  return {
    ...withoutGovernedDecision,
    governedDealDecision: clone(governedDealDecision),
  };
}

module.exports = {
  valuationCaseFromSavedDeal,
  withValuationCase,
  governedDealDecisionFromSavedDeal,
  withGovernedDealDecision,
};
