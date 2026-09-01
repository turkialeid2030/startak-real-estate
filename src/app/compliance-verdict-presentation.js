'use strict';

const {
  getExternalDecisionSupportVerdictLabel,
} = require('../i18n/domain-presentation.js');

function getCustomerFacingVerdictLabel(rawVerdict, t, options = {}) {
  if (typeof t !== 'function') throw new TypeError('t must be a translation function');
  return getExternalDecisionSupportVerdictLabel(rawVerdict, t, options);
}

module.exports = {
  getCustomerFacingVerdictLabel,
};
