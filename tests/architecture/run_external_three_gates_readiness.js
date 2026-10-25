'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {VERSION,STATUS,REQUIRED,validExternalRef,evaluateExternalQualification:assess}
 =require('../../src/governance/external-three-gates-readiness');
const {evaluateServerExternalQualification:serverAssess}=require('../../src/validation/server-external-three-gates-readiness');
let checks=0;
function eq(a,b,why){assert.deepEqual(a,b,why);checks++;}
function yes(v,why){assert.ok(v,why);checks++;}
const initial=assess();
eq(initial.version,VERSION,'versioned three-gate contract');
eq(initial.status,STATUS.HOLD,'aggregate fail closed');
eq(Object.keys(initial.gates).sort(),['ai','compliance','market'],'exact gate scopes');
for(const k of ['market','ai','compliance']){
 eq(initial.gates[k].status,STATUS.HOLD,k+' always HOLD on missing independent proof');
 yes(initial.gates[k].reasonCodes.length>0,k+' missing evidence reasons');
 eq(initial.gates[k].productionAuthorized,false,k+' cannot promote production');
 eq(initial.gates[k].transactionAuthorized,false,k+' cannot authorize purchase');
 eq(initial.gates[k].externalEvidenceIndependentlyAuthenticated,false,k+' cannot authenticate source claims');
 eq(initial.gates[k].professionalOrRegulatoryApproved,false,k+' cannot invent official signature');
 for(const field of REQUIRED[k])yes(initial.gates[k].reasonCodes.includes('EVIDENCE_REQUIRED_'+field.toUpperCase()),k+' missing '+field);
}
for(const x of ['plain','https://example.com/ok','source 001']){
 if(x.length>=12)yes(validExternalRef(x),'candidate ref syntax only');
}
for(const bad of ['','bad','token=abcd123456789','https://x.tld/ok\r\nInjected: true',' <x> '])
 eq(validExternalRef(bad),false,'reject suspicious external source ref '+bad.slice(0,12));
const evidenceRefs=field=>Object.fromEntries(REQUIRED[field].map((k,i)=>[k,'UNVERIFIED-FAKE-EXTERNAL-EVIDENCE-'+i]));
const pretend=assess({
 market:{evidenceRefs:evidenceRefs('market'),protocol:{protocolId:'FAKE'},observations:[]},
 ai:{evidenceRefs:evidenceRefs('ai'),providerRoundTripStatus:'SUCCESS',
  aiModelUsed:true,advisoryOnly:true,deterministicScoreRemainsAuthoritative:true,
  productionRequestAuthorized:true,scopedPrivacyAndIsolationTestPassed:true},
 compliance:{evidenceRefs:evidenceRefs('compliance'),signedIndependentAuditPacket:true,
  legalReviewSigned:true},
});
eq(pretend.status,STATUS.HOLD,'all actor-provided assertions do not promote');
eq(pretend.gates.ai.status,STATUS.EXTERNAL_REVIEW_REQUIRED,'valid-looking AI packet only goes to independent review');
eq(pretend.gates.compliance.status,STATUS.EXTERNAL_REVIEW_REQUIRED,'signed-looking compliance only goes to human review');
eq(pretend.gates.market.status,STATUS.HOLD,'no genuine out-of-sample cohort');
eq(pretend.completedExternalIndependentApprovals,0,'no approval claimed from user-supplied refs');
eq(pretend.productionAiAuthorized,false,'no production AI authority even if pretend success');
eq(pretend.professionalReportsAuthorized,false,'no licensed report from source IDs');
eq(pretend.userIdentityAndTenantVaultAuthorized,false,'no real vault from checkbox');
eq(pretend.commercialGoLiveAuthorized,false,'no commercial operation from affirmations');
eq(pretend.transactionAuthorized,false,'no purchase authority');
const malformed=serverAssess({market:{evidenceRefs:evidenceRefs('market'),protocol:{},observations:[{}]}});
eq(malformed.gates.market.cohortStatus,'HOLD_PROTOCOL','reuse existing pre-registered time-forward holdout');
eq(malformed.gates.market.sampleMetricsWithinProtocol,false,'math not independently passed');
eq(malformed.gates.market.metrics,null,'no fabricated cohort metrics');
const browserOnly=assess({market:{evidenceRefs:evidenceRefs('market'),protocol:{},observations:[{}]}});
 eq(browserOnly.gates.market.cohortStatus,null,'browser must not calculate server-side protocol');
 yes(browserOnly.gates.market.reasonCodes.includes('SERVER_SIDE_HOLDOUT_VALIDATOR_REQUIRED'),'no browser Node crypto or forged cohort');
const weird=assess({market:{protocol:null,observations:new Array(4).fill({})},
 ai:{evidenceRefs:{liveProviderRoundTrip:'token=should-never-leak'}},
 compliance:{evidenceRefs:{licensedRealEstateValuerApproval:'\n<script>'}}});
eq(weird.commercialGoLiveAuthorized,false,'adversarial malformed evidence still HOLD');
yes(weird.gates.ai.reasonCodes.includes('EVIDENCE_REQUIRED_LIVEPROVIDERROUNDTRIP'),
 'AI fake secret rejected');
yes(weird.gates.compliance.reasonCodes.includes('EVIDENCE_REQUIRED_LICENSEDREALESTATEVALUERAPPROVAL'),
 'fake valuer html rejected');
const panel=fs.readFileSync('src/components/ExternalThreeGatesReadinessPanel.jsx','utf8');
const integration=fs.readFileSync('src/components/PersonalAssetUniversePanel.jsx','utf8');
for(const id of ['external-three-gates-readiness','external-gate-','external-three-gates-authority'])
 yes(panel.includes(id),'actual Arabic UI evidence boundary '+id);
yes(integration.includes('<ExternalThreeGatesReadinessPanel locale={locale}/>'),
 'C56/AI/C73 gate is mounted in live research UI');
yes(panel.includes('https://rei.rega.gov.sa/'),'official market research route');
yes(panel.includes('https://taqeem.gov.sa/'),'professional license research route');
console.log('THREE_EXTERNAL_QUALIFICATION_GATES=PASS checks='+checks+
 ' cohortIndependent=FALSE aiProductionProven=FALSE independentSecurityApproved=FALSE goLive=FALSE');
