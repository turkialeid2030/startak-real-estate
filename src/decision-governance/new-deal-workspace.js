'use strict';

const { DEAL_PROVENANCE, createDealProvenance } = require('./deal-provenance');

const NEW_DEAL_STATUS = Object.freeze({ INCOMPLETE: 'INCOMPLETE', READY_FOR_FINANCIAL_ANALYSIS: 'READY_FOR_FINANCIAL_ANALYSIS' });

const REQUIRED_FIELDS = Object.freeze({
  building: Object.freeze(['buildingPrice', 'rentPerSqm', 'occupancyRate', 'marketCapRate', 'discountRate', 'holdPeriod']),
  land: Object.freeze(['landLength', 'landWidth', 'landPricePerSqm', 'constructionCostPerSqm', 'marketRentPerSqm', 'marketCapRate', 'exitCapRate']),
});

function createNewDealInputs(mode) {
  if (!REQUIRED_FIELDS[mode]) throw new TypeError(`Unsupported New Deal mode: ${mode}`);
  return Object.freeze({
    projectTitle: '',
    leverageEnabled: false,
    titleDeedVerified: false,
    ...(mode === 'building'
      ? { complianceCertified: false, rentFreezeChecked: false }
      : { zoningConfirmed: false, buildingPermitStatus: '', soilStudyDone: false, utilitiesConfirmed: false }),
  });
}

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function evaluateNewDealReadiness(mode, inputs = {}) {
  if (!REQUIRED_FIELDS[mode]) throw new TypeError(`Unsupported New Deal mode: ${mode}`);
  const missingFields = REQUIRED_FIELDS[mode].filter((field) => !isPresent(inputs[field]));
  return Object.freeze({
    status: missingFields.length ? NEW_DEAL_STATUS.INCOMPLETE : NEW_DEAL_STATUS.READY_FOR_FINANCIAL_ANALYSIS,
    calculationAllowed: missingFields.length === 0,
    missingFields: Object.freeze(missingFields),
    provenance: createDealProvenance(DEAL_PROVENANCE.NEW),
  });
}

module.exports = { NEW_DEAL_STATUS, REQUIRED_FIELDS, createNewDealInputs, evaluateNewDealReadiness };
