'use strict';
const assert = require('assert');
const { adaptGovernedAcquisitionCosts } = require('../../src/decision-governance/acquisition-cost-adapter');

let r = adaptGovernedAcquisitionCosts({ buildingPrice: 1000000, commissionRate: 0.025, transferFeeRate: 0.05 });
assert.strictEqual(r.legacyCompatibility, true);
assert.strictEqual(r.inputs.commissionRate, 0.025);
assert.strictEqual(r.inputs.transferFeeRate, 0.05);
assert.strictEqual(Object.prototype.hasOwnProperty.call(r.inputs, 'governedAcquisitionRettAmount'), false);

r = adaptGovernedAcquisitionCosts({ buildingPrice: 1000000, commissionRate: 0.025, transferFeeRate: 0.05, rettRate: 0.05, rettEconomicBearer: 'SELLER', brokerageRate: 0.025, brokeragePayer: 'SELLER' });
assert.strictEqual(r.legacyCompatibility, false);
assert.strictEqual(r.inputs.governedAcquisitionRettAmount, 0);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageAmount, 0);
assert.strictEqual(r.inputs.governedAcquisitionRettBasisType, 'RATE');
assert.strictEqual(r.inputs.governedAcquisitionBrokerageBasisType, 'RATE');
assert.strictEqual(r.inputs.governedAcquisitionRettEffectiveRate, 0);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageEffectiveRate, 0);
assert.strictEqual(r.inputs.transferFeeRate, 0.05, 'Building governed acquisition RETT must not mutate legacy disposition-coupled rate');
assert.strictEqual(r.inputs.commissionRate, 0.025);

r = adaptGovernedAcquisitionCosts({ buildingPrice: 1000000, commissionRate: 0.01, transferFeeRate: 0.02, rettRate: 0.05, rettEconomicBearer: 'BUYER', brokerageRate: 0.025, brokeragePayer: 'BUYER' });
assert.strictEqual(r.inputs.governedAcquisitionRettAmount, 50000);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageAmount, 25000);
assert.strictEqual(r.inputs.governedAcquisitionRettBasisType, 'RATE');
assert.strictEqual(r.inputs.governedAcquisitionBrokerageBasisType, 'RATE');
assert.strictEqual(r.inputs.governedAcquisitionRettEffectiveRate, 0.05);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageEffectiveRate, 0.025);
assert.strictEqual(r.inputs.transferFeeRate, 0.02);
assert.strictEqual(r.inputs.commissionRate, 0.01);

// Explicit contractual amounts remain fixed amounts. They must never be
// converted into a percentage for max-price or other price-sensitive KPIs.
r = adaptGovernedAcquisitionCosts({ buildingPrice: 1000000, rettAmount: 42000, rettEconomicBearer: 'BUYER', brokerageAmount: 17000, brokeragePayer: 'BUYER' });
assert.strictEqual(r.inputs.governedAcquisitionRettAmount, 42000);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageAmount, 17000);
assert.strictEqual(r.inputs.governedAcquisitionRettBasisType, 'FIXED_AMOUNT');
assert.strictEqual(r.inputs.governedAcquisitionBrokerageBasisType, 'FIXED_AMOUNT');
assert.strictEqual(r.inputs.governedAcquisitionRettEffectiveRate, 0);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageEffectiveRate, 0);

r = adaptGovernedAcquisitionCosts({ buildingPrice: 1000000, commissionRate: 0.01, transferFeeRate: 0.02, rettRate: 0.05, rettEconomicBearer: 'UNKNOWN', brokerageRate: 0.025, brokeragePayer: 'UNKNOWN' });
assert.strictEqual(r.inputs.governedAcquisitionRettAmount, 0);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageAmount, 0);
assert.strictEqual(r.inputs.transferFeeRate, 0.02);
assert.strictEqual(r.inputs.commissionRate, 0.01);
assert.strictEqual(r.warnings.length, 2);

const landBase = {
  landLength: 100,
  landWidth: 100,
  landPricePerSqm: 1000,
  landCommissionRate: 0.025,
  landTransferFeeRate: 0.05,
  exitTransferFeeRate: 0.03,
};

r = adaptGovernedAcquisitionCosts({ ...landBase, rettRate: 0.05, rettEconomicBearer: 'SELLER', brokerageRate: 0.025, brokeragePayer: 'SELLER' }, { asset: 'LAND' });
assert.strictEqual(r.inputs.governedAcquisitionRettAmount, 0);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageAmount, 0);
assert.strictEqual(r.inputs.landTransferFeeRate, 0);
assert.strictEqual(r.inputs.landCommissionRate, 0);
assert.strictEqual(r.inputs.exitTransferFeeRate, 0.03, 'Disposition transfer rate must remain independent');

r = adaptGovernedAcquisitionCosts({ ...landBase, rettRate: 0.05, rettEconomicBearer: 'BUYER', brokerageRate: 0.025, brokeragePayer: 'BUYER' }, { asset: 'LAND' });
assert.strictEqual(r.inputs.governedAcquisitionRettAmount, 500000);
assert.strictEqual(r.inputs.governedAcquisitionBrokerageAmount, 250000);
assert.strictEqual(r.inputs.landTransferFeeRate, 0.05);
assert.strictEqual(r.inputs.landCommissionRate, 0.025);
assert.strictEqual(r.inputs.exitTransferFeeRate, 0.03);

// Fixed land acquisition amounts are not representable as acquisition rates;
// leave legacy rate fields at zero and carry the amounts explicitly.
r = adaptGovernedAcquisitionCosts({ ...landBase, rettAmount: 420000, rettEconomicBearer: 'BUYER', brokerageAmount: 170000, brokeragePayer: 'BUYER' }, { asset: 'LAND' });
assert.strictEqual(r.inputs.governedAcquisitionRettBasisType, 'FIXED_AMOUNT');
assert.strictEqual(r.inputs.governedAcquisitionBrokerageBasisType, 'FIXED_AMOUNT');
assert.strictEqual(r.inputs.landTransferFeeRate, 0);
assert.strictEqual(r.inputs.landCommissionRate, 0);
assert.strictEqual(r.inputs.exitTransferFeeRate, 0.03);

r = adaptGovernedAcquisitionCosts({ ...landBase, rettRate: 0.05, rettEconomicBearer: 'UNKNOWN', brokerageRate: 0.025, brokeragePayer: 'UNKNOWN' }, { asset: 'LAND' });
assert.strictEqual(r.inputs.landTransferFeeRate, 0);
assert.strictEqual(r.inputs.landCommissionRate, 0);
assert.strictEqual(r.inputs.exitTransferFeeRate, 0.03);
assert.strictEqual(r.warnings.length, 2);

console.log('ACQUISITION_COST_ADAPTER_TESTS=PASS');
