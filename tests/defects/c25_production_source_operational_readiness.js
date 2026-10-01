'use strict';

const assert=require('assert');
const {
  ACQUISITION_METHOD,EXTRACTION_METHOD,
  createGovernedNonApiAcquisitionRecord,
}=require('../../src/source-intelligence/governed-non-api-acquisition');
const {
  STATUS,RIGHTS_DISPOSITION,AVAILABILITY,
  createSourceOperationalRecord,evaluateSourceOperationalReadiness,
}=require('../../src/source-intelligence/governed-source-operational-readiness');

const AS_OF='2026-10-01T13:40:00Z';
const H=(c)=>c.repeat(64); const H1=H('1'),H2=H('2'),H3=H('3'),H4=H('4');
function acquisition(overrides={}){
  return createGovernedNonApiAcquisitionRecord({
    acquisitionId:'ACQ-C25-BALADY',profileId:'BALADY_OPEN_DATA_DOWNLOADS',sourceProvider:'BALADY_URBAN_MAPS',sourceUrl:'https://balady.gov.sa/open-data/example.csv',
    acquisitionMethod:ACQUISITION_METHOD.OFFICIAL_OPEN_DATA_FILE_DOWNLOAD,automatedRetrieval:true,retrievedAt:'2026-10-01T10:00:00Z',sourceEffectiveAt:'2026-10-01T09:00:00Z',
    artifactMimeType:'text/csv',artifactFormat:'CSV',artifactHashSha256:H1,extractionMethod:EXTRACTION_METHOD.STRUCTURED_FILE_PARSE,extractorVersion:'C25-CSV-PARSER-V1',
    extractedPayload:{columns:['id','value'],rows:[['A','verified-test-value']]},termsEvidenceRef:'BALADY-OPEN-DATA-TERMS-EVIDENCE',licenseReference:'OPEN-DATA-LICENSE-REFERENCE',attributionText:'Source: Balady open data',
    rightsVerified:false,hiddenEndpointDiscoveryUsed:false,credentialBypassUsed:false,captchaBypassUsed:false,accessControlEvasionUsed:false,rateLimitEvasionUsed:false,
    ...overrides,
  });
}
function operational(record,overrides={}){
  return createSourceOperationalRecord({
    operationalRecordId:'OP-C25-BALADY',profileId:record.profileId,sourceProvider:record.sourceProvider,acquisitionRecordHashSha256:record.acquisitionRecordHashSha256,artifactHashSha256:record.artifactHashSha256,
    rightsDisposition:RIGHTS_DISPOSITION.OPEN_DATA_LICENSE_VERIFIED,rightsEvidenceHashSha256:H2,parserVersion:'C25-CSV-PARSER-V1',parserValidated:true,
    schemaFingerprintSha256:H3,expectedSchemaFingerprintSha256:H3,dataContractVersion:'BALADY-CONTRACT-V1',requiredFieldsValidated:true,silentCoercionUsed:false,
    acquiredAt:'2026-10-01T10:00:00Z',sourcePublishedAt:'2026-10-01T09:00:00Z',freshnessValidUntil:'2026-10-02T10:00:00Z',availability:AVAILABILITY.AVAILABLE,
    conflictDetected:false,reviewedByRef:'SOURCE-GOV-REVIEWER',reviewEvidenceRef:'SOURCE-READINESS-REVIEW',reviewedAt:'2026-10-01T11:00:00Z',validUntil:'2026-10-02T12:00:00Z',
    ...overrides,
  });
}
const a=acquisition(); const op=operational(a);
const ready=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:op,asOf:AS_OF,trustedRightsVerifierIds:['TRUSTED-RIGHTS']});
assert.strictEqual(ready.status,STATUS.READY_FOR_PREPRODUCTION_SOURCE_USE);
assert.strictEqual(ready.preproductionSourceReady,true);
assert.strictEqual(ready.productionUseAuthorized,false);
assert.strictEqual(ready.staleDataTreatedAsCurrent,false);
assert.strictEqual(ready.conflictAutoReconciled,false);

const drift=operational(a,{operationalRecordId:'OP-DRIFT',schemaFingerprintSha256:H4});
const driftResult=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:drift,asOf:AS_OF});
assert.strictEqual(driftResult.status,STATUS.HOLD_SCHEMA); assert(driftResult.blockers.includes('C25_SCHEMA_DRIFT_DETECTED'));

const parser=operational(a,{operationalRecordId:'OP-PARSER',parserValidated:false});
const parserResult=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:parser,asOf:AS_OF});
assert.strictEqual(parserResult.status,STATUS.HOLD_PARSER); assert(parserResult.blockers.includes('C25_PARSER_NOT_VALIDATED'));

const coercion=operational(a,{operationalRecordId:'OP-COERCE',silentCoercionUsed:true});
const coercionResult=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:coercion,asOf:AS_OF});
assert.strictEqual(coercionResult.status,STATUS.HOLD_SCHEMA); assert(coercionResult.blockers.includes('C25_SCHEMA_SILENT_COERCION_FORBIDDEN'));

const stale=operational(a,{operationalRecordId:'OP-STALE',freshnessValidUntil:'2026-10-01T12:00:00Z'});
const staleResult=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:stale,asOf:AS_OF});
assert.strictEqual(staleResult.status,STATUS.HOLD_TEMPORAL); assert(staleResult.blockers.includes('C25_TEMPORAL_SOURCE_STALE'));
assert.strictEqual(staleResult.staleDataTreatedAsCurrent,false);

const outage=operational(a,{operationalRecordId:'OP-OUTAGE',availability:AVAILABILITY.OUTAGE});
const outageResult=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:outage,asOf:AS_OF});
assert.strictEqual(outageResult.status,STATUS.HOLD_OUTAGE); assert(outageResult.blockers.includes('C25_OUTAGE_SOURCE_OUTAGE'));

const conflict=operational(a,{operationalRecordId:'OP-CONFLICT',conflictDetected:true,conflictEvidenceRef:'CONFLICT-EVIDENCE'});
const conflictResult=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:conflict,asOf:AS_OF});
assert.strictEqual(conflictResult.status,STATUS.HOLD_CONFLICT); assert(conflictResult.blockers.includes('C25_CONFLICT_UNRESOLVED_SOURCE_VALUES'));
assert.strictEqual(conflictResult.conflictAutoReconciled,false);

const wrongBinding=operational(a,{operationalRecordId:'OP-BIND',artifactHashSha256:H4});
const bindingResult=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:wrongBinding,asOf:AS_OF});
assert.strictEqual(bindingResult.status,STATUS.HOLD_INTEGRITY); assert(bindingResult.blockers.includes('C25_INTEGRITY_ARTIFACT_BINDING'));

const tampered={...op,parserVersion:'TAMPERED'};
const tamperResult=evaluateSourceOperationalReadiness({acquisitionRecord:a,operationalRecord:tampered,asOf:AS_OF});
assert.strictEqual(tamperResult.status,STATUS.HOLD_INTEGRITY); assert(tamperResult.blockers.includes('C25_INTEGRITY_OPERATIONAL_RECORD'));

const tathmin=createGovernedNonApiAcquisitionRecord({
  acquisitionId:'ACQ-TATHMIN',profileId:'TATHMIN_AVM_RESTRICTED',sourceProvider:'TATHMIN_INDICATIVE_AVM',sourceUrl:'https://tathmin.online/report',acquisitionMethod:ACQUISITION_METHOD.MANUAL_GOVERNED_UPLOAD,automatedRetrieval:false,
  retrievedAt:'2026-10-01T10:00:00Z',sourceEffectiveAt:'2026-10-01T09:00:00Z',artifactMimeType:'application/pdf',artifactFormat:'PDF',artifactHashSha256:H1,extractionMethod:EXTRACTION_METHOD.MANUAL_VERIFIED_TRANSCRIPTION,extractorVersion:'MANUAL-V1',
  extractedPayload:{indicativeOnly:true},termsEvidenceRef:'TATHMIN-TERMS',attributionText:'Tathmin indicative output',rightsVerified:true,rightsVerifiedByRef:'TRUSTED-RIGHTS',rightsVerifiedAt:'2026-10-01T09:30:00Z',rightsEvidenceRef:'RIGHTS-REVIEW',
  hiddenEndpointDiscoveryUsed:false,credentialBypassUsed:false,captchaBypassUsed:false,accessControlEvasionUsed:false,rateLimitEvasionUsed:false,
});
const tathminOp=operational(tathmin,{operationalRecordId:'OP-TATHMIN',profileId:tathmin.profileId,sourceProvider:tathmin.sourceProvider,acquisitionRecordHashSha256:tathmin.acquisitionRecordHashSha256,artifactHashSha256:tathmin.artifactHashSha256,rightsDisposition:RIGHTS_DISPOSITION.VERIFIED_RIGHTS});
const terms=evaluateSourceOperationalReadiness({acquisitionRecord:tathmin,operationalRecord:tathminOp,asOf:AS_OF,trustedRightsVerifierIds:['TRUSTED-RIGHTS']});
assert.strictEqual(terms.status,STATUS.HOLD_RIGHTS); assert(terms.blockers.includes('C25_RIGHTS_TERMS_UNVERIFIED_NOT_PRODUCTION_READY'));

assert.throws(()=>createSourceOperationalRecord({
  operationalRecordId:'BAD',profileId:a.profileId,sourceProvider:a.sourceProvider,acquisitionRecordHashSha256:a.acquisitionRecordHashSha256,artifactHashSha256:a.artifactHashSha256,rightsDisposition:RIGHTS_DISPOSITION.OPEN_DATA_LICENSE_VERIFIED,rightsEvidenceHashSha256:H2,
  parserVersion:'V1',parserValidated:true,schemaFingerprintSha256:H3,expectedSchemaFingerprintSha256:H3,dataContractVersion:'V1',requiredFieldsValidated:true,silentCoercionUsed:false,acquiredAt:'2026-10-01T10:00:00Z',freshnessValidUntil:'2026-10-02T10:00:00Z',availability:AVAILABILITY.AVAILABLE,conflictDetected:false,reviewedByRef:'R',reviewEvidenceRef:'E',reviewedAt:'2026-10-01T11:00:00Z',validUntil:'2026-10-02T12:00:00Z',hiddenEndpointDiscoveryUsed:true,
}),/C25_FORBIDDEN_ACQUISITION_BEHAVIOR/);

console.log('C25_PRODUCTION_SOURCE_OPERATIONAL_READINESS=PASS');
