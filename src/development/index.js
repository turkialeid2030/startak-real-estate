'use strict';

const developmentProperty = require('./development-property');
const developmentSensitivity = require('./development-sensitivity');

module.exports = Object.assign({}, developmentProperty, developmentSensitivity, {
  developmentProperty,
  developmentSensitivity,
});
