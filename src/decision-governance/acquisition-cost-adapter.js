'use strict';
const { calculateSaudiAcquisitionCosts, PARTY } = require('./saudi-acquisition-costs');

const ACQUISITION_COST_BASIS = Object.freeze({ RATE: 'RATE', FIXED_AMOUNT: 'FIXED_AMOUNT', NONE: 'NONE' });

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

function hasExplicitValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function acquisitionBasisType({ explicitAmount, rate, buyerAmount, included }) {
  if (!included || buyerAmount === 0) return ACQUISITION_COST_BASIS.NONE;
  if (hasExplicitValue(explicitAmount)) return ACQUISITION_COST_BASIS.FIXED_AMOUNT;
  if (rate !== null) return ACQUISITION_COST_BASIS.RATE;
  return ACQUISITION_COST_BASIS.NONE;
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
  const governedAcquisitionRettBasis = acquisitionBasisType({
    explicitAmount: inputs.rettAmount,
    rate: governed.rett.rate,
    buyerAmount: governedAcquisitionRettAmount,
    included: governed.rett.includedInAcquisitionBasis,
  });
  const governedAcquisitionBrokerageBasis = acquisitionBasisType({
    explicitAmount: inputs.brokerageAmount,
    rate: governed.brokerage.rate,
    buyerAmount: governedAcquisitionBrokerageAmount,
    included: governed.brokerage.includedInAcquisitionBasis,
  });
  const governedAcquisitionRettEffectiveRate = governedAcquisitionRettBasis === ACQUISITION_COST_BASIS.RATE && purchasePrice > 0
    ? governedAcquisitionRettAmount / purchasePrice
    : 0;
  const governedAcquisitionBrokerageEffectiveRate = governedAcquisitionBrokerageBasis === ACQUISITION_COST_BASIS.RATE && purchasePrice > 0
    ? governedAcquisitionBrokerageAmount / purchasePrice
    : 0;

  const next = {
    ...inputs,
    governedAcquisitionRettAmount,
    governedAcquisitionBrokerageAmount,
    governedAcquisitionRettBasis,
    governedAcquisitionBrokerageBasis,
    governedAcquisitionRettEffectiveRate,
    governedAcquisitionBrokerageEffectiveRate,
  };

  // Land has distinct acquisition and exit transfer fields. Rate-derived buyer
  // burdens can therefore map to acquisition-only rates. Fixed contractual
  // amounts are intentionally NOT converted into rates: doing so would make a
  // fixed amount scale with candidate price and corrupt threshold KPIs. They
  // remain explicit amounts until the canonical engine consumes fixed costs.
  if (asset === 'LAND') {
    next.landTransferFeeRate = governedAcquisitionRettEffectiveRate;
    next.landCommissionRate = governedAcquisitionBrokerageEffectiveRate;
  }

  return Object.freeze({ inputs: next, governed, legacyCompatibility: false, warnings: governed.warnings });
}

module.exports = { ACQUISITION_COST_BASIS, adaptGovernedAcquisitionCosts };
