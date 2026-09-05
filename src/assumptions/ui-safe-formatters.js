'use strict';

const DEFAULT_UNAVAILABLE = '—';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatNumber(value, { fallback = DEFAULT_UNAVAILABLE, maximumFractionDigits = 0 } = {}) {
  if (!isFiniteNumber(value)) return fallback;
  return value.toLocaleString('en-US', { maximumFractionDigits });
}

function formatInteger(value, { fallback = DEFAULT_UNAVAILABLE } = {}) {
  if (!isFiniteNumber(value)) return fallback;
  return Math.round(value).toLocaleString('en-US');
}

function formatSar(value, { fallback = DEFAULT_UNAVAILABLE, currencyLabel = 'ريال' } = {}) {
  if (!isFiniteNumber(value)) return fallback;
  return `${formatInteger(value, { fallback })} ${currencyLabel}`;
}

function formatSignedSar(value, { fallback = DEFAULT_UNAVAILABLE, currencyLabel = 'ريال' } = {}) {
  if (!isFiniteNumber(value)) return fallback;
  const sign = value < 0 ? '-' : '';
  return `${sign}${Math.round(Math.abs(value)).toLocaleString('en-US')} ${currencyLabel}`;
}

function formatPercent(value, { decimals = 2, fallback = DEFAULT_UNAVAILABLE } = {}) {
  if (!isFiniteNumber(value)) return fallback;
  return `${(value * 100).toFixed(decimals)}%`;
}

function formatYears(value, { decimals = 1, fallback = DEFAULT_UNAVAILABLE, unitLabel = 'سنة' } = {}) {
  if (!isFiniteNumber(value)) return fallback;
  return `${value.toFixed(decimals)} ${unitLabel}`;
}

function formatMultiple(value, { decimals = 2, fallback = DEFAULT_UNAVAILABLE } = {}) {
  if (!isFiniteNumber(value)) return fallback;
  return `${value.toFixed(decimals)}x`;
}

function buildExitDependentMetricPresentation(financialResults, { fallback = DEFAULT_UNAVAILABLE } = {}) {
  if (!financialResults || typeof financialResults !== 'object' || Array.isArray(financialResults)) {
    throw new TypeError('financialResults must be an object');
  }

  return Object.freeze({
    terminalSaleValue: formatSar(financialResults.terminalSaleValue, { fallback }),
    terminalNetSaleProceeds: formatSar(financialResults.terminalNetSaleProceeds, { fallback }),
    irr: formatPercent(financialResults.irr, { fallback }),
    npv: formatSar(financialResults.npv, { fallback }),
    leveredIRR: formatPercent(financialResults.leveredIRR, { fallback }),
    leveredNPV: formatSar(financialResults.leveredNPV, { fallback }),
    exitDependentAnalyticsReady: financialResults.exitDependentAnalyticsReady === true,
    financialModelStatus: financialResults.financialModelStatus || null,
    transactionAuthorized: false,
  });
}

module.exports = {
  DEFAULT_UNAVAILABLE,
  isFiniteNumber,
  formatNumber,
  formatInteger,
  formatSar,
  formatSignedSar,
  formatPercent,
  formatYears,
  formatMultiple,
  buildExitDependentMetricPresentation,
};
