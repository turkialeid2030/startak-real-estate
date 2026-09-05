'use strict';

const { validateValuationCaseExtension } = require('../valuation-intelligence');

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function valuationCaseFromSavedDeal(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('saved deal record must be an object');
  if (record.mode !== 'building') return null;
  if (!Object.prototype.hasOwnProperty.call(record, 'valuationCase')) return null;
  validateValuationCaseExtension(record.valuationCase);
  return clone(record.valuationCase);
}

function withValuationCase(record, valuationCase) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('saved deal record must be an object');
  const { valuationCase: _discarded, ...withoutValuationCase } = record;
  if (record.mode !== 'building' || valuationCase === null || valuationCase === undefined) return withoutValuationCase;
  validateValuationCaseExtension(valuationCase);
  return {
    ...withoutValuationCase,
    valuationCase: clone(valuationCase),
  };
}

module.exports = {
  valuationCaseFromSavedDeal,
  withValuationCase,
};
