'use strict';

const DEAL_PROVENANCE = Object.freeze({
  NEW: 'NEW',
  DEMO: 'DEMO',
  SAVED: 'SAVED',
  DUPLICATED: 'DUPLICATED',
});

const DEMO_LABEL = Object.freeze({ en: 'DEMO DATA · SAMPLE DEAL', ar: 'بيانات تجريبية · صفقة نموذجية' });

function createDealProvenance(kind = DEAL_PROVENANCE.NEW) {
  if (!Object.values(DEAL_PROVENANCE).includes(kind)) throw new TypeError('invalid deal provenance');
  return Object.freeze({
    kind,
    isDemo: kind === DEAL_PROVENANCE.DEMO,
    requiresRealDealConfirmation: kind === DEAL_PROVENANCE.DEMO,
    label: kind === DEAL_PROVENANCE.DEMO ? DEMO_LABEL : null,
  });
}

function assertRealDealSaveAllowed({ provenance, confirmedDemoConversion = false } = {}) {
  if (!provenance) throw new TypeError('provenance is required');
  if (provenance.isDemo && !confirmedDemoConversion) {
    const error = new Error('Demo data cannot be saved as a real deal without explicit confirmation');
    error.code = 'DEMO_REAL_DEAL_CONFIRMATION_REQUIRED';
    throw error;
  }
  return true;
}

module.exports = { DEAL_PROVENANCE, DEMO_LABEL, createDealProvenance, assertRealDealSaveAllowed };
