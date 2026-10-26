'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {VERSION,protocolHash,message,verifyIndependentPreRegistration:verify}=
 require('../../src/validation/independent-pre-registration-witness');
const {evaluateServerExternalQualification:server}=
 require('../../src/validation/server-external-three-gates-readiness');
const {REQUIRED}=require('../../src/governance/external-three-gates-readiness');
let checks=0;
const eq=(a,b,n)=>{assert.deepEqual(a,b,n);checks++;};
const yes=(v,n)=>{assert.ok(v,n);checks++;};
const protocol={
 protocolId:'SYNTHETIC-PREREG-001',modelVersion:'synthetic-v1',
 currency:'SAR',basis:'MARKET_VALUE',
 registeredAt:'2025-12-01',trainingCutoffDate:'2025-11-01',
 holdoutStartDate:'2026-01-01',holdoutEndDate:'2026-12-31',
 calibrationAssetIds:['CALIBRATION-0001'],maxP90AbsolutePercentageError:0.25,
 numericPolicy:{minObservations:2,maxDateGapDays:120,
   maxMedianAbsolutePercentageError:0.25,maxAbsoluteMedianSignedPercentageError:0.25},
 slices:[
  {field:'region',value:'Riyadh',minObservations:1,maxMedianAbsolutePercentageError:0.15,maxP90AbsolutePercentageError:0.25,maxAbsoluteMedianSignedPercentageError:0.15},
  {field:'region',value:'Jeddah',minObservations:1,maxMedianAbsolutePercentageError:0.2,maxP90AbsolutePercentageError:0.25,maxAbsoluteMedianSignedPercentageError:0.2},
  {field:'assetType',value:'OFFICE',minObservations:2,maxMedianAbsolutePercentageError:0.25,maxP90AbsolutePercentageError:0.25,maxAbsoluteMedianSignedPercentageError:0.25}
 ],
};
function obs(i){return {
 caseId:'SYNTHETIC-CASE-'+i,projectId:'SYNTHETIC-PROPERTY-'+i,
 region:i===1?'Riyadh':'Jeddah',assetType:'OFFICE',
 modelVersion:'synthetic-v1',startakValue:i===1?1100000:900000,
 comparatorValue:1000000,comparatorType:'ACTUAL_TRANSACTION',
 currency:'SAR',basis:'MARKET_VALUE',startakAsOf:'2026-01-02',
 predictionRecordedAt:'2026-01-03',comparatorAsOf:'2026-02-01',
 startakEvidenceRef:'SYNTHETIC-PRED-'+i,
 comparatorEvidenceRef:'SYNTHETIC-COMP-'+i,
 reviewerRef:'SYNTHETIC-NOT-A-REVIEWER-'+i,
};}
const observations=[obs(1),obs(2)];
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
const other=crypto.generateKeyPairSync('ed25519');
const trust={reviewerId:'SYNTHETIC-INDEPENDENT-REVIEWER',
 pinnedPublicKeyPem:publicKey.export({type:'spki',format:'pem'})};
const signedAt='2025-12-01T00:00:00Z';
const unsigned={version:VERSION,protocolSha256:protocolHash(protocol),
 reviewerId:trust.reviewerId,signedAt};
const witness={...unsigned,
 signatureBase64:crypto.sign(null,message(unsigned),privateKey).toString('base64')};
const valid=verify({protocol,witness,operatorTrust:trust});
eq(valid.status,'CRYPTOGRAPHIC_SEAL_VALID_REVIEW_REQUIRED','valid pinned Ed25519');
eq(valid.signatureCryptographicallyVerified,true,'only crypto verified');
eq(valid.independentReviewerIdentityAuthenticated,false,'external identity not certified');
eq(valid.independentMarketEvidenceVerified,false,'no market certification');
eq(valid.sourceRightsVerified,false,'source rights not inferred');
eq(valid.professionalApprovalEstablished,false,'no professional authority');
eq(valid.transactionAuthorized,false,'no transaction authority');
yes(/^[a-f0-9]{64}$/.test(valid.protocolSha256),'digest length');
eq(protocolHash({slices:protocol.slices,...Object.fromEntries(Object.entries(protocol).reverse())}),
 protocolHash(protocol),'canonical object key ordering');
function fail(packet,anchor,code){
 const res=verify({protocol,witness:packet,operatorTrust:anchor});
 eq(res.status,'HOLD_INDEPENDENT_PROTOCOL_SEAL',code+' HOLD');
 yes(res.reasonCodes.includes(code),code+' reason');
 eq(res.signatureCryptographicallyVerified,false,'signature not passed');
}
fail(undefined,trust,'SIGNED_PREREGISTRATION_WITNESS_MISSING');
fail(witness,undefined,'INDEPENDENT_PINNED_REVIEWER_KEY_MISSING');
fail({...witness,protocolSha256:'0'.repeat(64)},trust,'WITNESS_PROTOCOL_OR_REVIEWER_MISMATCH');
fail({...witness,reviewerId:'SELF-SIGNED-PRETENDER'},trust,'WITNESS_PROTOCOL_OR_REVIEWER_MISMATCH');
fail({...witness,signedAt:'2026-02-01T00:00:00Z'},trust,'PRE_REGISTRATION_DATE_ORDER_INVALID');
fail({...witness,signedAt:'2025-12-01T00:00:01Z'},trust,'WITNESS_SIGNATURE_INVALID');
fail({...witness,signatureBase64:crypto.sign(null,message(unsigned),other.privateKey).toString('base64')},
 trust,'WITNESS_SIGNATURE_INVALID');
fail(witness,{...trust,pinnedPublicKeyPem:other.publicKey.export({type:'spki',format:'pem'})},
 'WITNESS_SIGNATURE_INVALID');
fail({...witness,signatureBase64:'not-a-signature'},trust,'DETACHED_SIGNATURE_MALFORMED');
fail({...witness,version:'INVALID'},trust,'WITNESS_PROTOCOL_OR_REVIEWER_MISMATCH');
const forged={...protocol,maxP90AbsolutePercentageError:0.95};
eq(verify({protocol:forged,witness,operatorTrust:trust}).status,
 'HOLD_INDEPENDENT_PROTOCOL_SEAL','changing target threshold invalidates seal');
const badNumber={...protocol,maxP90AbsolutePercentageError:NaN};
eq(verify({protocol:badNumber,witness,operatorTrust:trust}).status,
 'HOLD_INDEPENDENT_PROTOCOL_SEAL','NaN cannot be signed canonically');
const packet={market:{protocol,observations}};
const none=server(packet);
eq(none.gates.market.cohortStatus,'HOLD_INDEPENDENT_PROTOCOL_SEAL',
 'server will not run seemingly valid synthetic cohort without independent key');
eq(none.gates.market.metrics,null,'unsealed cohort metrics not published');
eq(none.independentMarketAccuracyCertified,false,'no market accuracy without signed evidence');
const forgedBySubmitter=server({market:{...packet.market,preRegistrationWitness:witness,
 pinnedIndependentReviewer:trust}});
eq(forgedBySubmitter.gates.market.cohortStatus,'HOLD_INDEPENDENT_PROTOCOL_SEAL',
 'submitted key and witness cannot authenticate itself');
const signed=server({market:{...packet.market,preRegistrationWitness:witness}},
 {pinnedIndependentReviewer:trust});
eq(signed.gates.market.cohortStatus,'CALCULATED_WITHIN_REGISTERED_THRESHOLDS',
 'real cohort math is executed behind independent signature boundary');
eq(signed.gates.market.sampleMetricsWithinProtocol,true,'arithmetics pass synthetic');
eq(signed.gates.market.metrics.observationCount,2,'2 mock observations');
eq(signed.status,'HOLD','synthetic still HOLD');
eq(signed.commercialGoLiveAuthorized,false,'no go-live');
eq(signed.professionalReportsAuthorized,false,'no certified report');
eq(signed.productionAiAuthorized,false,'no provider auth');
eq(signed.transactionAuthorized,false,'no financial authorization');
for(const f of REQUIRED.market)yes(
 signed.gates.market.reasonCodes.includes('EVIDENCE_REQUIRED_'+f.toUpperCase()),
 'unverified sales and rights '+f);
const badSeal=server({market:{...packet.market,preRegistrationWitness:{...witness,
 signatureBase64:crypto.sign(null,message(unsigned),other.privateKey).toString('base64')}}},
 {pinnedIndependentReviewer:trust});
eq(badSeal.gates.market.cohortStatus,'HOLD_INDEPENDENT_PROTOCOL_SEAL',
 'valid-looking incorrectly signed protocol excluded');
console.log('C56_INDEPENDENT_PREREGISTRATION_GATE=PASS checks='+checks+
 ' genuineSaudiSales=FALSE independentlyLicensed=FALSE commercialGoLive=FALSE');
