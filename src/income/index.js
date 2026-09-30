'use strict';

const professionalIncomeForecast = require('./professional-income-forecast');
const governedIncomeAssetIntelligence = require('./governed-income-asset-intelligence');

module.exports = Object.assign({}, professionalIncomeForecast, governedIncomeAssetIntelligence, {
  professionalIncomeForecast,
  governedIncomeAssetIntelligence,
});
