'use strict';

const C6_GOVERNED_HUMAN_REVIEW_SCHEMA_VERSION = 'C6_GOVERNED_HUMAN_REVIEW_V1';
const C6_GOVERNED_REVIEW_EXPORT_SCHEMA_VERSION = 'C6_GOVERNED_REVIEW_EXPORT_V1';

const C6_REVIEW_RECOMMENDATION = Object.freeze({
  CONTINUE_DUE_DILIGENCE: 'CONTINUE_DUE_DILIGENCE',
  REQUEST_MODIFICATION: 'REQUEST_MODIFICATION',
  HOLD_FOR_EVIDENCE: 'HOLD_FOR_EVIDENCE',
  DO_NOT_ADVANCE: 'DO_NOT_ADVANCE',
});

const C6_REVIEW_STATUS = Object.freeze({
  REVIEW_RECORDED: 'REVIEW_RECORDED',
});

const C6_AUTHORITY_BOUNDARY = Object.freeze({
  commercialGoLive: 'HOLD',
  transactionAuthority: false,
  publicAi: false,
  canonicalBaselineActivationAuthorized: false,
  approvalAuthorized: false,
  finalValuationConclusionEstablished: false,
  certifiedValuationEstablished: false,
});

module.exports = {
  C6_GOVERNED_HUMAN_REVIEW_SCHEMA_VERSION,
  C6_GOVERNED_REVIEW_EXPORT_SCHEMA_VERSION,
  C6_REVIEW_RECOMMENDATION,
  C6_REVIEW_STATUS,
  C6_AUTHORITY_BOUNDARY,
};
