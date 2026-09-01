'use strict';

const {
  getExternalDecisionSupportVerdictLabel,
  setVerdictPresentationMode,
  getVerdictPresentationMode,
  VERDICT_PRESENTATION_MODE,
} = require('../i18n/domain-presentation.js');

function getCustomerFacingVerdictLabel(rawVerdict, t, options = {}) {
  if (typeof t !== 'function') throw new TypeError('t must be a translation function');
  return getExternalDecisionSupportVerdictLabel(rawVerdict, t, options);
}

function activateCustomerFacingVerdictPresentation() {
  setVerdictPresentationMode(VERDICT_PRESENTATION_MODE.EXTERNAL_DECISION_SUPPORT);
  return getVerdictPresentationMode();
}

module.exports = {
  getCustomerFacingVerdictLabel,
  activateCustomerFacingVerdictPresentation,
};
