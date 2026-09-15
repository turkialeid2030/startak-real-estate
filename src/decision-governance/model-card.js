'use strict';

const { recommendationMethodologyMetadata } = require('./methodology-metadata');

const MODEL_CARD = Object.freeze({
  modelName: 'Startak Real Estate Decision Governance',
  modelVersion: recommendationMethodologyMetadata.modelVersion,
  releaseDate: recommendationMethodologyMetadata.effectiveDate,
  scope: recommendationMethodologyMetadata.decisionScope,
  supportedAssetTypes: Object.freeze(['EXISTING_BUILDING', 'LAND_DEVELOPMENT']),
  unsupportedUses: Object.freeze([
    'FORMAL_ACCREDITED_VALUATION',
    'LEGAL_OPINION',
    'REGULATORY_APPROVAL',
    'AUTOMATIC_INVESTMENT_APPROVAL',
    'AUTOMATIC_TRANSACTION_EXECUTION',
  ]),
  hardGates: recommendationMethodologyMetadata.hardGates,
  assumptions: Object.freeze([
    'USER_AND_SOURCE_INPUTS_MUST_BE_VERIFIED',
    'FINANCIAL_PASS_IS_NOT_INVESTMENT_APPROVAL',
    'UNKNOWN_ACQUISITION_COST_BEARER_IS_NOT_CHARGED_TO_BUYER',
  ]),
  knownLimitations: Object.freeze([
    'BUILDING_ACQUISITION_AND_DISPOSITION_TRANSFER_FEE_SEMANTICS_REQUIRE_FURTHER_SEPARATION_BEFORE_KPI_METHOD_CHANGE',
    'EXTERNAL_LEGAL_REGULATORY_AND_TECHNICAL_DUE_DILIGENCE_REQUIRE_HUMAN_OR_AUTHORIZED_EXTERNAL_EVIDENCE',
    'LOCAL_HISTORY_IS_NOT_AN_ENTERPRISE_AUDIT_TRAIL',
  ]),
  dataDependencies: Object.freeze([
    'PROPERTY_INPUTS', 'MARKET_EVIDENCE', 'SOURCE_DATES', 'FINANCING_INPUTS', 'DUE_DILIGENCE_STATUS',
  ]),
  regulatoryLimitations: Object.freeze([
    'DECISION_SUPPORT_ONLY', 'NO_AUTOMATIC_REGULATORY_CLEARANCE', 'NO_TRANSACTION_AUTHORITY_BY_FINANCIAL_RESULT',
  ]),
  valuationLimitations: Object.freeze([
    'NOT_AN_ACCREDITED_VALUATION', 'VALUATION_READINESS_IS_SEPARATE_FROM_FINANCIAL_ANALYSIS',
  ]),
  validationStatus: 'WAVE_VALIDATION_IN_PROGRESS',
  regressionTestCount: null,
  lastVerifiedCommit: null,
});

function buildModelCardVerification({ regressionTestCount, lastVerifiedCommit, validationStatus = 'VERIFIED' } = {}) {
  if (!Number.isInteger(regressionTestCount) || regressionTestCount < 0) throw new TypeError('regressionTestCount must be a non-negative integer');
  if (typeof lastVerifiedCommit !== 'string' || !/^[0-9a-f]{40}$/i.test(lastVerifiedCommit)) throw new TypeError('lastVerifiedCommit must be a 40-character commit SHA');
  return Object.freeze({
    ...MODEL_CARD,
    validationStatus,
    regressionTestCount,
    lastVerifiedCommit,
  });
}

function getAboutMethodology(locale = 'ar') {
  const ar = locale !== 'en';
  return Object.freeze({
    modelName: MODEL_CARD.modelName,
    modelVersion: MODEL_CARD.modelVersion,
    scope: MODEL_CARD.scope,
    notice: ar ? recommendationMethodologyMetadata.scopeNotice.ar : recommendationMethodologyMetadata.scopeNotice.en,
    hardGates: MODEL_CARD.hardGates,
    unsupportedUses: MODEL_CARD.unsupportedUses,
  });
}

module.exports = { MODEL_CARD, buildModelCardVerification, getAboutMethodology };
