'use strict';
const { calculateSaudiAcquisitionCosts, PARTY } = require('./saudi-acquisition-costs');

function resolvePurchasePrice(inputs, asset) {
  if (asset === 'LAND') {
    if (Number.isFinite(Number(inputs.landMarketValue))) return Number(inputs.landMarketValue);
    const length = Number(inputs.landLength);
    const width = Number(inputs.landWidth);
    const pricePerSqm = Number(inputs.landPricePerSqm);
    if ([length, width, pricePerSqm].every(Number.isFinite)) return length * width * pricePerSqm;
    return 0;
  }
  return Number(inputs.buildingPrice ?? 0);
}

function adaptGovernedAcquisitionCosts(inputs = {}, { asset = 'BUILDING' } = {}) {
  const purchasePrice = resolvePurchasePrice(inputs, asset);

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

  const governedAcquisitionRettAmount = governed.rett.includedInAcquisitionBasis
    ? governed.rett.buyerEconomicAmount
    : 0;
  const governedAcquisitionBrokerageAmount = governed.brokerage.includedInAcquisitionBasis
    ? governed.brokerage.buyerEconomicAmount
    : 0;

  // Effective acquisition rates are explicit and independent from historical
  // transfer/commission fields. They allow price-threshold calculations to
  // remain proportional without reusing disposition semantics.
  const next = {
    ...inputs,
    governedAcquisitionRettAmount,
    governedAcquisitionBrokerageAmount,
    governedAcquisitionRettEffectiveRate: purchasePrice > 0 ? governedAcquisitionRettAmount / purchasePrice : 0,
    governedAcquisitionBrokerageEffectiveRate: purchasePrice > 0 ? governedAcquisitionBrokerageAmount / purchasePrice : 0,
  };
  return Object.freeze({ inputs: next, governed, legacyCompatibility: false, warnings: governed.warnings });
}

module.exports = { adaptGovernedAcquisitionCosts };
