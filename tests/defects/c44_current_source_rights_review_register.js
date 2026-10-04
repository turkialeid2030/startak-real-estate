'use strict';

const { validate } = require('../../tools/c44-current-source-rights-review-register');

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

const r = validate();
assert(r.scope === 'C44_CURRENT_SOURCE_RIGHTS_REVIEW_REGISTER_SUMMARY', 'C44_SCOPE_INVALID');
assert(r.frozenReviewCandidateHeadSha === 'db05999e5a3c995235ac290c256251ab1592072b', 'C44_FROZEN_CANDIDATE_INVALID');
assert(r.sourceCount === 6, 'C44_SOURCE_COUNT_INVALID');
assert(r.sourceUniversePrepared === true, 'C44_SOURCE_UNIVERSE_NOT_PREPARED');
assert(r.liveConnectorsConfigured === 0, 'C44_LIVE_CONNECTOR_COUNT_INVALID');
assert(r.hardcodedOfficialSourceValues === 0, 'C44_HARDCODED_VALUE_COUNT_INVALID');
assert(r.rightsReviewRequiredCount === 6, 'C44_RIGHTS_REVIEW_COUNT_INVALID');
assert(r.rightsEvidenceSuppliedCount === 0, 'C44_FALSE_RIGHTS_EVIDENCE');
assert(r.authorizationGrantedCount === 0, 'C44_FALSE_AUTHORIZATION');
assert(r.externalReceiptConfirmed === false, 'C44_FALSE_EXTERNAL_RECEIPT');
assert(r.gate548Satisfied === false, 'C44_FALSE_GATE_548_SATISFACTION');
assert(r.sourceRightsAuthorized === false, 'C44_FALSE_SOURCE_RIGHTS_AUTHORIZATION');
assert(r.mergeAuthorized === false, 'C44_MERGE_AUTHORITY_ESCALATION');
assert(r.deploymentAuthorized === false, 'C44_DEPLOYMENT_AUTHORITY_ESCALATION');
assert(r.commercialGoLiveAuthorized === false, 'C44_GO_LIVE_AUTHORITY_ESCALATION');
assert(r.publicAiAuthorized === false, 'C44_PUBLIC_AI_AUTHORITY_ESCALATION');
assert(r.decision === 'SOURCE_UNIVERSE_PREPARED_RIGHTS_REVIEW_PENDING', 'C44_DECISION_INVALID');

console.log('C44_CURRENT_SOURCE_RIGHTS_REVIEW_REGISTER=PASS');
console.log(`C44_SOURCE_COUNT=${r.sourceCount}`);
console.log('C44_SOURCE_UNIVERSE_PREPARED=PASS');
console.log(`C44_RIGHTS_REVIEW_REQUIRED_COUNT=${r.rightsReviewRequiredCount}`);
console.log(`C44_RIGHTS_EVIDENCE_SUPPLIED_COUNT=${r.rightsEvidenceSuppliedCount}`);
console.log(`C44_AUTHORIZATION_GRANTED_COUNT=${r.authorizationGrantedCount}`);
console.log('C44_SOURCE_RIGHTS_AUTHORIZED=FALSE');
console.log('C44_GATE_548_SATISFIED=FALSE');
console.log('C44_AUTHORITY_POSTURE=FAIL_CLOSED');
