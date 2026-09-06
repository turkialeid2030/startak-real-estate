"use strict";

const { computeIRR, computeNPV } = require('../engines/financial');

const ZAKAT_INPUT_SOURCE = Object.freeze({
  ACCOUNTANT: 'ACCOUNTANT',
  ZAKAT_ADVISER: 'ZAKAT_ADVISER',
  INTERNAL_ESTIMATE: 'INTERNAL_ESTIMATE',
});

const ZAKAT_LAYER_STATUS = Object.freeze({
  NOT_PROVIDED: 'NOT_PROVIDED',
  USER_ENTERED: 'USER_ENTERED',
});

class ZakatLayerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ZakatLayerError';
    this.code = code;
  }
}

function validateUserEnteredZakatCase(candidate) {
  if (candidate === null || candidate === undefined) return null;
  if (typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new ZakatLayerError('ZAKAT_CASE_INVALID', 'Zakat case must be an object when provided.');
  }
  if (!Number.isFinite(candidate.annualAmount) || candidate.annualAmount < 0) {
    throw new ZakatLayerError('ZAKAT_ANNUAL_AMOUNT_INVALID', 'Annual Zakat amount must be a finite non-negative SAR amount.');
  }
  if (!Object.values(ZAKAT_INPUT_SOURCE).includes(candidate.source)) {
    throw new ZakatLayerError('ZAKAT_SOURCE_REQUIRED', 'A recognized source is required when an annual Zakat amount is supplied.');
  }
  return Object.freeze({ annualAmount: candidate.annualAmount, source: candidate.source });
}

function validateCashflows(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length === 0) {
    throw new ZakatLayerError('ZAKAT_CASHFLOWS_REQUIRED', 'Cash flows are required for the optional Zakat layer.');
  }
  cashflows.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new ZakatLayerError('ZAKAT_CASHFLOW_NON_FINITE', `Cash flow at index ${index} is not finite.`);
    }
  });
}

function buildUserEnteredZakatLayer({
  mode,
  cashflowsBeforeZakat,
  zakatCase,
  constructionYears = 0,
  operatingYears = null,
  discountRate = null,
  returnsReady = true,
}) {
  validateCashflows(cashflowsBeforeZakat);
  const before = [...cashflowsBeforeZakat];
  const validatedCase = validateUserEnteredZakatCase(zakatCase);

  if (!validatedCase) {
    return Object.freeze({
      status: ZAKAT_LAYER_STATUS.NOT_PROVIDED,
      platformCalculated: false,
      annualZakatAmount: null,
      annualZakatSource: null,
      cashflowsBeforeZakat: before,
      cashflowsAfterZakat: null,
      afterZakatIRR: null,
      afterZakatNPV: null,
      disclosureCode: 'ZAKAT_EFFECT_NOT_CALCULATED',
    });
  }

  const startIndex = mode === 'land' ? Math.max(0, Math.round(constructionYears)) + 1 : 1;
  const availableOperatingPeriods = Math.max(0, before.length - startIndex);
  const requestedOperatingPeriods = Number.isFinite(operatingYears)
    ? Math.max(0, Math.round(operatingYears))
    : availableOperatingPeriods;
  const periods = Math.min(availableOperatingPeriods, requestedOperatingPeriods);
  const after = [...before];
  for (let offset = 0; offset < periods; offset += 1) {
    const index = startIndex + offset;
    after[index] = before[index] - validatedCase.annualAmount;
  }

  const canCalculateReturns = returnsReady && Number.isFinite(discountRate);
  return Object.freeze({
    status: ZAKAT_LAYER_STATUS.USER_ENTERED,
    platformCalculated: false,
    annualZakatAmount: validatedCase.annualAmount,
    annualZakatSource: validatedCase.source,
    operatingStartIndex: startIndex,
    operatingPeriodsAffected: periods,
    cashflowsBeforeZakat: before,
    cashflowsAfterZakat: after,
    afterZakatIRR: canCalculateReturns ? computeIRR(after) : null,
    afterZakatNPV: canCalculateReturns ? computeNPV(discountRate, after) : null,
    disclosureCode: 'USER_ENTERED_ZAKAT_NOT_PLATFORM_CALCULATED',
  });
}

module.exports = {
  ZAKAT_INPUT_SOURCE,
  ZAKAT_LAYER_STATUS,
  ZakatLayerError,
  validateUserEnteredZakatCase,
  buildUserEnteredZakatLayer,
};
