'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  createComparableEvidenceRecord, MARKET_EVIDENCE_LEVEL, MARKET_TRANSACTION_TYPE,
  MARKET_VERIFICATION_STATUS,
} = require('../../src/market/comparable-evidence');
const {
  evaluateComparableProvenanceChain, calculateSourceBoundMarketIndication, STATUS,
} = require('../../src/market/comparable-provenance-chain');
const {
  createComparable, TRANSACTION_STATUS, WEIGHTING_POLICY,
} = require('../../src/valuation-intelligence/market-comparables');
const {BASIS_OF_VALUE,EVIDENCE_GRADE,INDICATION_STATUS} = require('../../src/valuation-intelligence/contracts');

const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const date='2026-09-01',asOf='2026-10-08';
function data(id, transactionIdentityRef, price=1000000, status=TRANSACTION_STATUS.EXECUTED_SALE) {
  const ref='SA-TRANSACTION-SOURCE-'+id;
  const record=createComparableEvidenceRecord({
    comparableId:id,caseId:'C58-CASE',sourcePropertyRef:'PROPERTY-'+id,
    assetType:'OFFICE',transactionType:MARKET_TRANSACTION_TYPE.SALE,
    evidenceLevel:MARKET_EVIDENCE_LEVEL.VERIFIED_TRANSACTION,
    sourceName:'Structural simulated provider',sourceRef:ref,
    sourceDate:'2026-08-18',transactionDate:'2026-08-15',
    location:{city:'Riyadh',district:'Olaya'},
    areaSqm:100,amountSar:price,
    verification:{status:MARKET_VERIFICATION_STATUS.VERIFIED,verifiedAt:'2026-08-20',
      verifiedByRef:'TEST-REVIEWER',evidenceRef:'TEST-VERIFICATION-'+id},
    capturedAt:'2026-08-21',
  });
  const comparable=createComparable({
    comparableId:id,unitValue:record.unitValueSarPerSqm,
    transactionStatus:status,evidenceGrade:EVIDENCE_GRADE.B_VERIFIED_TRANSACTION,
    sourceRef:ref,transactionDate:record.transactionDate,
  });
  const receipt={
    comparableId:id,sourceRef:ref,recordHashSha256:record.comparableHashSha256,
    sourcePropertyRef:record.sourcePropertyRef,transactionIdentityRef,
    sourceDocumentRef:'TEST-DOC-'+id,
    sourceArtifactSha256:'a'.repeat(64),capturedByRef:'TEST-CAPTURE',capturedAt:record.capturedAt,
  };
  receipt.receiptHashSha256=hash(receipt);
  const rights={
    sourceRef:ref,providerRef:'TEST-PROVIDER',rightsDocumentRef:'TEST-RIGHTS-'+id,
    rightsArtifactSha256:'b'.repeat(64),reviewedByRef:'TEST-LEGAL',
    reviewEvidenceRef:'TEST-LEGAL-REF',reviewedAt:'2026-08-31',
    validFrom:'2025-01-01',validUntil:'2026-12-31',
    allowedUses:['INTERNAL_VALUATION'],prohibitedUses:[],suspended:false,
  };
  return {record,comparable,receipt,rights};
}
const a=data('A','SA-TXN-111'),b=data('B','SA-TXN-222',1100000);
const base={
  caseId:'C58-CASE',basis:BASIS_OF_VALUE.MARKET_VALUE,valuationDate:date,
  subjectAssetType:'OFFICE',subjectCity:'Riyadh',asOf,
  comparables:[a.comparable,b.comparable],
  evidenceRecords:[a.record,b.record],
  sourceReceipts:[a.receipt,b.receipt],
  sourceRights:[a.rights,b.rights],
};
function checkHold(overrides,reason) {
  const out=evaluateComparableProvenanceChain({...base,...overrides});
  assert.equal(out.status,STATUS.HOLD);
  if(reason) assert(out.blockers.some(t=>t.includes(reason)),JSON.stringify(out.blockers));
  return out;
}
const valid=evaluateComparableProvenanceChain(base);
assert.equal(valid.status,STATUS.READY_FOR_INDEPENDENT_SOURCE_AUTHENTICATION);
assert.equal(valid.details.length,2);
assert.equal(valid.independentSourceAuthenticityEstablished,false);
assert.equal(valid.sourceRightsIndependentlyAuthenticated,false);
const diagnostic=calculateSourceBoundMarketIndication({
  comparables:base.comparables,basis:base.basis,valuationDate:base.valuationDate,
  subjectArea:100,weightingPolicy:WEIGHTING_POLICY.EQUAL,
  provenance:base,
});
assert.equal(diagnostic.value,1050000);
assert.equal(diagnostic.status,INDICATION_STATUS.HOLD_EVIDENCE_CONFLICT);
assert.equal(diagnostic.components.sourceProvenanceGate.status,STATUS.READY_FOR_INDEPENDENT_SOURCE_AUTHENTICATION);
assert.equal(diagnostic.components.independentSourceAuthenticityEstablished,false);
assert.equal(diagnostic.evidence.at(-1).status,'CONFLICT');
checkHold({evidenceRecords:[{...a.record,amountSar:9999999},b.record]},'WAVE9A_RECORD_HASH_INVALID');
checkHold({sourceReceipts:[{...a.receipt,sourceArtifactSha256:'f'.repeat(64)},b.receipt]},'CAPTURE_RECEIPT_HASH_INVALID');
checkHold({sourceReceipts:[{...a.receipt,sourcePropertyRef:'WRONG',receiptHashSha256:hash({...a.receipt,sourcePropertyRef:'WRONG'})},b.receipt]},'CAPTURE_RECEIPT_HASH_INVALID');
checkHold({sourceRights:[{...a.rights,allowedUses:['BROWSE_ONLY']},b.rights]},'SOURCE_RIGHTS_DOCUMENT_NOT_QUALIFIED');
checkHold({sourceRights:[{...a.rights,suspended:true},b.rights]},'SOURCE_RIGHTS_DOCUMENT_NOT_QUALIFIED');
checkHold({sourceRights:[{...a.rights,validUntil:'2026-08-01'},b.rights]},'SOURCE_RIGHTS_DOCUMENT_NOT_QUALIFIED');
checkHold({comparables:[a.comparable,{...b.comparable,transactionStatus:TRANSACTION_STATUS.ASKING_SALE}]},'NOT_EXECUTED');
checkHold({comparables:[a.comparable,{...b.comparable,unitValue:1000}]},'PRICE_MISMATCH');
checkHold({comparables:[a.comparable,{...a.comparable,comparableId:'B'}]},'PRICE_MISMATCH');
checkHold({evidenceRecords:[a.record,{...b.record,assetType:'INDUSTRIAL_LOGISTICS'}]},'ASSET_IDENTITY_CITY_CASE_MISMATCH');
checkHold({evidenceRecords:[a.record,{...b.record,caseId:'OTHER'}]},'ASSET_IDENTITY_CITY_CASE_MISMATCH');
checkHold({valuationDate:'2026-08-01'},'MARKET_CHRONOLOGY_INVALID');
checkHold({asOf:'2026-07-01'},'VALUATION_AND_ASOF_DATES_REQUIRED');
checkHold({sourceReceipts:[a.receipt,{...b.receipt,transactionIdentityRef:'SA-TXN-111',
  receiptHashSha256:hash({...b.receipt,transactionIdentityRef:'SA-TXN-111'})}]},'DUPLICATE_UNDERLYING_TRANSACTION');
checkHold({sourceReceipts:[a.receipt]},'CAPTURE_RECEIPT_HASH_INVALID');
checkHold({sourceRights:[]},'SOURCE_RIGHTS_DOCUMENT_NOT_QUALIFIED');
checkHold({evidenceRecords:[]},'WAVE9A_RECORD_HASH_INVALID');
checkHold({evidenceRecords:[a.record,a.record]},'EVIDENCE_RECORD_DUPLICATED_OR_INVALID');
checkHold({comparables:[a.comparable]},'MINIMUM_TWO_COMPARABLES_REQUIRED');
checkHold({comparables:[a.comparable,a.comparable]},'COMPARABLE_ID_DUPLICATED_OR_INVALID');
const boundInvalid=calculateSourceBoundMarketIndication({
  comparables:base.comparables,basis:base.basis,valuationDate:base.valuationDate,
  subjectArea:100,weightingPolicy:WEIGHTING_POLICY.EQUAL,
  provenance:{...base,sourceRights:[]},
});
assert.equal(boundInvalid.status,INDICATION_STATUS.HOLD_EVIDENCE_CONFLICT);
console.log('C58_COMPARABLE_PROVENANCE_CHAIN=PASS');
console.log('C58_INDEPENDENT_TRANSACTION_AUTHENTICITY_ESTABLISHED=FALSE');
console.log('C58_RIGHTS_EXTERNAL_AUTHORIZATION_ESTABLISHED=FALSE');
