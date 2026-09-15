'use strict';
const { calculateSaudiAcquisitionCosts, PARTY } = require('./saudi-acquisition-costs');

function adaptGovernedAcquisitionCosts(inputs = {}, { asset = 'BUILDING' } = {}) {
  const priceKey = asset === 'LAND' ? 'landMarketValue' : 'buildingPrice';
  const legacyBrokerageKey = asset === 'LAND' ? 'landCommissionRate' : 'commissionRate';
  const legacyRettKey = asset === 'LAND' ? 'landTransferFeeRate' : 'transferFeeRate';
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

  const next = { ...inputs };
  next[legacyRettKey] = purchasePrice > 0 ? governed.rett.buyerEconomicAmount / purchasePrice : 0;
  next[legacyBrokerageKey] = purchasePrice > 0 ? governed.brokerage.buyerEconomicAmount / purchasePrice : 0;
  return Object.freeze({ inputs: next, governed, legacyCompatibility: false, warnings: governed.warnings });
}

module.exports = { adaptGovernedAcquisitionCosts };
