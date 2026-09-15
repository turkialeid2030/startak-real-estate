'use strict';

const { calculateInvestmentCase } = require('../engines');
const { STUDY_TYPE } = require('../contracts/study-type');
const { adaptGovernedAcquisitionCosts } = require('./acquisition-cost-adapter');

/**
 * Governance-aware orchestration boundary.
 *
 * The canonical financial engine output contract remains unchanged. Governance
 * metadata is returned beside (not injected into) the financial result so
 * characterization/golden-result consumers keep their existing contract.
 *
 * For EXISTING_BUILDING, legacy transferFeeRate is also used by the current
 * engine as a terminal-sale cost. A governed acquisition RETT must therefore
 * never be mapped into that legacy field until disposition-cost semantics are
 * explicitly separated. Fail closed rather than silently changing exit cashflow.
 */
function calculateGovernedInvestmentCase({ studyType, inputs, leverageEnabled, assumptionModelVersion }) {
  const asset = studyType === STUDY_TYPE.LAND_DEVELOPMENT ? 'LAND' : 'BUILDING';
  const adaptation = adaptGovernedAcquisitionCosts(inputs, { asset });

  if (studyType === STUDY_TYPE.EXISTING_BUILDING && adaptation.legacyCompatibility === false) {
    const originalTransferFeeRate = inputs.transferFeeRate;
    const governedTransferFeeRate = adaptation.inputs.transferFeeRate;
    if (governedTransferFeeRate !== originalTransferFeeRate) {
      const error = new Error('Governed acquisition RETT cannot be mapped to building transferFeeRate because that legacy field also changes terminal-sale cashflow.');
      error.code = 'BUILDING_RETT_DISPOSITION_SEMANTICS_NOT_SEPARATED';
      throw error;
    }
  }

  const financialResult = calculateInvestmentCase({
    studyType,
    inputs: adaptation.inputs,
    leverageEnabled,
    assumptionModelVersion,
  });

  return Object.freeze({
    financialResult,
    acquisitionCostGovernance: Object.freeze({
      legacyCompatibility: adaptation.legacyCompatibility,
      warnings: adaptation.warnings,
      governed: adaptation.governed || null,
    }),
  });
}

module.exports = { calculateGovernedInvestmentCase };
