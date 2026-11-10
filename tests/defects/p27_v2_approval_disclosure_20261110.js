'use strict';
const assert=require('node:assert/strict');
const {
  ASSUMPTION_MODEL_VERSION,
  V2_APPROVED_ASSUMPTIONS,
  applyAssumptionModel,
  buildAssumptionModelDisclosure,
}=require('../../src/assumptions/assumption-model');
const {buildAssumptionDisclosureEnvelope}=
  require('../../src/assumptions/assumption-disclosure');
const {EXIT_CAP_SOURCE}=require('../../src/engines/valuation/exit-cap-resolver');

let checks=0;
function equal(actual,expected,label){assert.deepStrictEqual(actual,expected,label);checks++}
const v2=buildAssumptionModelDisclosure(ASSUMPTION_MODEL_VERSION.V2);
equal(v2.version,'V2','V2 remains the selected calculation model');
equal(v2.userApprovedAssumptions,false,'V2 selection alone cannot fabricate user sign-off');
equal(v2.approvalEvidenceStatus,'NOT_SUPPLIED','explicit independent approval evidence absent');
equal(v2.canonicalDefaultsAreApprovalEvidence,false,'source-level defaults never imply approval');
const legacy=buildAssumptionModelDisclosure(ASSUMPTION_MODEL_VERSION.LEGACY);
equal(legacy.userApprovedAssumptions,false,'legacy is not user attestation');
equal(legacy.approvalEvidenceStatus,'NOT_SUPPLIED','legacy provenance remains unset');
const inputs=Object.freeze({maintenanceRate:0.0125,marketCapRate:0.07});
const before=applyAssumptionModel(inputs,'V2');
equal(before.maintenanceRate,V2_APPROVED_ASSUMPTIONS.maintenanceRate,
  'V2 numeric default unaffected by disclosure fix');
equal(inputs.maintenanceRate,0.0125,'source input not mutated');
const envelope=buildAssumptionDisclosureEnvelope({
 assumptionModelVersion:ASSUMPTION_MODEL_VERSION.V2,
 exitCapSource:EXIT_CAP_SOURCE.MISSING_REQUIRED,
});
equal(envelope.userApprovedAssumptions,false,'owner-facing envelope never claims automatic approval');
equal(envelope.approvalEvidenceStatus,'NOT_SUPPLIED','owner-facing provenance exposed');
equal(envelope.canonicalDefaultsAreApprovalEvidence,false,'defaults not signed authority');
equal(envelope.transactionAuthorized,false,'disclosure not authorization');
equal(envelope.canonicalDefaultAssumptionKeys,Object.keys(V2_APPROVED_ASSUMPTIONS),
  'configuration defaults still discoverable');
equal(envelope.approvedAssumptionKeys,envelope.canonicalDefaultAssumptionKeys,
  'legacy key retained only for compatibility');
equal(envelope.requiresExplicitExitCap,true,'financial hard gate stays closed');
const legacyEnvelope=buildAssumptionDisclosureEnvelope({
 assumptionModelVersion:ASSUMPTION_MODEL_VERSION.LEGACY,
 exitCapSource:EXIT_CAP_SOURCE.LEGACY_DERIVED,
});
equal(legacyEnvelope.userApprovedAssumptions,false,'legacy envelope not approved');
equal(legacyEnvelope.canonicalDefaultAssumptionKeys,[],'legacy has no V2 default keys');
console.log('P27_V2_APPROVAL_DISCLOSURE=PASS checks='+checks+' approval_inferred=false economics_unchanged=true');
