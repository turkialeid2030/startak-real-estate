// src/contracts/criterion-result.js -- represents current criteria WITHOUT
// redefining their business logic. No new criterion logic introduced.
const CRITERION_RESULT_FIELDS = Object.freeze({
  c1: { id: 'c1', existing_building_meaning: 'netYieldOnPrice >= minYieldThreshold', land_development_meaning: 'simplePaybackYears <= maxPaybackThreshold' },
  c2: { id: 'c2', existing_building_meaning: 'paybackOnPrice <= maxPaybackThreshold', land_development_meaning: 'capRateOnCost >= 1/maxPaybackThreshold' },
  c3: { id: 'c3', existing_building_meaning: 'irr >= discountRate', land_development_meaning: 'irr >= hurdleRate' },
  c4: { id: 'c4', existing_building_meaning: 'marketValueByIncomeCap >= totalPurchaseCost', land_development_meaning: 'marketValueAfterCompletion >= totalProjectCost' },
  c5: { id: 'c5', existing_building_meaning: 'dscrMin >= minDscrThreshold (only when leveraged)', land_development_meaning: 'dscrMin >= minDscrThreshold (only when leveraged)' },
});
module.exports = { CRITERION_RESULT_FIELDS };
