'use strict';
const { calculateSaudiAcquisitionCosts, PARTY } = require('./saudi-acquisition-costs');

function adaptGovernedAcquisitionCosts(inputs = {}, { asset = 'BUILDING' } = {}) {
  const priceKey = asset === 'LAND' ? 'landMarketValue' : 'buildingPrice';
  const purchasePrice = Number(inputs[priceKey] ?? inputs.buildingPrice ?? 0);

  const hasGovernedRett = Object.prototype.hasOwnProperty.call(inputs, 'rettEconomicBearer');
  const hasGovernedBrokerage = Object.prototype.hasOwnProperty.call(inputs, 'brokeragePayer');
  if (!hasGovernedRett && !hasGovernedBrokerage) {
    return Object.freeze({ inputs: { ...inputs }, legacyCompatibility: true, warnings: Object.freeze([]) });
  }

  const governed = calculateSaudiAcquisitionCosts({
    purchasePrice,
    rettRate: inputs.rettRate,
    rettStatutoryLiableParty: inputs.rettStatutoryLiableParty || PARTY.UNKNOWN,
    rettEconomicBearer: inputs.rettEconomicBearer || PARTY.UNKNOWN,
    rettAmount: inputs.rettAmount,
    rettIncludedInAcquisitionBasis: inputs.rettIncludedInAcquisitionBasis,
    rettSource: inputs.rettSource,
    rettSourceDate: inputs.rettSourceDate,
    rettAssumptionType: inputs.rettAssumptionType,
    rettBuyerShare: inputs.rettBuyerShare,
    brokerageRate: inputs.brokerageRate,
    brokeragePayer: inputs.brokeragePayer || PARTY.UNKNOWN,
    brokerageAmount: inputs.brokerageAmount,
    brokerageAgreementType: inputs.brokerageAgreementType,
    brokerageIncludedInAcquisitionBasis: inputs.brokerageIncludedInAcquisitionBasis,
    brokerageSource: inputs.brokerageSource,
    brokerageAssumptionType: inputs.brokerageAssumptionType,
    brokerageBuyerShare: inputs.brokerageBuyerShare,
  });

  // Do not overwrite legacy rate fields. In the existing-building engine the
  // historical transferFeeRate also drives terminal-sale cost, so mutating it
  // with acquisition RETT burden would conflate acquisition and disposition.
  // Governed acquisition economics travel through explicit amount fields.
  const next = {
    ...inputs,
    governedAcquisitionRettAmount: governed.rett.includedInAcquisitionBasis
      ? governed.rett.buyerEconomicAmount
      : 0,
    governedAcquisitionBrokerageAmount: governed.brokerage.includedInAcquisitionBasis
      ? governed.brokerage.buyerEconomicAmount
      : 0,
  };
  return Object.freeze({ inputs: next, governed, legacyCompatibility: false, warnings: governed.warnings });
}

module.exports = { adaptGovernedAcquisitionCosts };
