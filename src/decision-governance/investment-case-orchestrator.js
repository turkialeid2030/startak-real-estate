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
 * Governed acquisition RETT/brokerage are carried as explicit acquisition
 * amounts; legacy transferFeeRate remains independent for disposition behavior.
 */
function calculateGovernedInvestmentCase({ studyType, inputs, leverageEnabled, assumptionModelVersion }) {
  const asset = studyType === STUDY_TYPE.LAND_DEVELOPMENT ? 'LAND' : 'BUILDING';
  const adaptation = adaptGovernedAcquisitionCosts(inputs, { asset });

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
