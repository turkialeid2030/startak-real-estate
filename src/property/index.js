'use strict';

const propertyEvidenceBridge = require('./property-evidence-bridge');
const governedTitleSurveyVerification = require('./governed-title-survey-verification');

module.exports = Object.assign({}, propertyEvidenceBridge, governedTitleSurveyVerification, {
  propertyEvidenceBridge,
  governedTitleSurveyVerification,
});
