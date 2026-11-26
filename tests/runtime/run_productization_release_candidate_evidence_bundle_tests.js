'use strict';

const assert = require('assert');
const {
  PRODUCTION_QUALIFICATION_STATUS,
  NEXT_STEP,
} = require('../../src/runtime/production-qualification-service');
const {
  SECURITY_UAT_STATUS,
  createUatScenarioPlan,
  evaluateIndependentSecurityUatEvidence,
} = require('../../src/qualification/independent-security-uat-evidence-gate');
const {
  RELEASE_CANDIDATE_STATUS,
  REQUIRED_OPEN_EXTERNAL_BLOCKERS,
  buildProductizationReleaseCandidateEvidenceBundle,
  verifyReleaseCandidateManifest,
} = require('../../src/qualification/productization-release-candidate-evidence-bundle');

const results = [];
const COMMIT = 'a'.repeat(40);

async function test(id, fn) {
  try {
    await fn();
    results.push([id, 'PASS']);
    console.log(id + ' PASS');
  } catch (error) {
    results.push([id, 'FAIL: ' + error.message]);
    console.log(id + ' FAIL: ' + error.message);
  }
}

function productionQualification(overrides = {}) {
  return {
    status: PRODUCTION_QUALIFICATION_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW,
    releaseGovernanceReviewEligible: true,
    humanReleaseAuthorityApprovalRequired: true,
    nextStep: NEXT_STEP.EXISTING_RELEASE_GOVERNANCE_REVIEW,
    reasonCodes:[],
    evidenceRefs:{productionReadinessRef:'SYNTH-P9-READINESS',independentReleaseQualificationRef:'SYNTH-P9-INDEPENDENT',institutionalGoLiveRef:'SYNTH-P9-INSTITUTIONAL'},
    evidenceBoundary:{productionEvidenceValidatedByThisService:false,productionReadinessProvenanceVerifiedByThisService:false,independentReleaseIntegrityVerified:true,institutionalEvidenceProvenanceVerifiedByThisService:false,productionAuthenticationValidated:false,productionPersistenceValidated:false,externalEvidenceRequired:true},
    gates: {
      productionReadiness: { status: 'READY_FOR_PRODUCTION_REVIEW', ready: true },
      independentReleaseQualification: { status: 'READY_FOR_RELEASE_AUTHORITY_REVIEW', ready: true, integrityValid: true,exactCommitSha:COMMIT,qualificationHashSha256:'1'.repeat(64) },
      institutionalGoLiveReview: { status: 'READY_FOR_HUMAN_GO_LIVE_DECISION', ready: true },
    },
    authority: {
      releaseAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      goLiveAuthorized: false,
      transactionAuthorized: false,
      productionAuthenticationValidated: false,
      productionPersistenceValidated: false,
      productionSecurityValidated: false,
      productionPerformanceValidated: false,
      legalApprovalEstablished: false,
      certifiedValuationEstablished: false,
    },
    secretConnectionString: 'must-not-leak',
    ...overrides,
  };
}

function securityUat(overrides = {}) {
  const scope={environment:'staging',serviceRef:'startak-staging-api',exactCommitSha:COMMIT};
  const timing={startedAt:'2026-09-05T08:00:00Z',completedAt:'2026-09-06T08:00:00Z',reviewedAt:'2026-09-07T08:00:00Z'};
  const plan=createUatScenarioPlan({...scope,preparedAt:'2026-09-01T00:00:00Z',validUntil:'2026-09-08T00:00:00Z',scenarios:[{scenarioId:'SYNTH-01',userRole:'ANALYST',expectedOutcomeHashSha256:'e'.repeat(64)}]});
  const counts={CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0,INFO:0};
  const result=evaluateIndependentSecurityUatEvidence({
    ...scope,assessedAt:'2026-09-09T12:00:00Z',maximumEvidenceAgeDays:30,
    observabilityQualification:require('../fixtures/synthetic-observability-qualification').syntheticObservability(scope),
    pentestEvidence:{...scope,...timing,status:'PASS',reportRef:'SYNTH-REPORT',reportHashSha256:'b'.repeat(64),testerOrganization:'SYNTH-LAB',preparedBy:'TESTER',reviewedBy:'REVIEWER',independentAssessorAttested:true,scopeIncludesAuthentication:true,scopeIncludesTenantIsolation:true,scopeIncludesApiAuthorization:true,scopeIncludesServerRuntime:true,retestCompletedForRemediatedCriticalHigh:false,findingCounts:counts,openFindingCounts:counts},
    uatScenarioPlan:plan,
    uatEvidence:{...scope,...timing,status:'PASS',acceptanceRef:'SYNTH-UAT',acceptanceArtifactHashSha256:'c'.repeat(64),businessOwner:'OWNER',reviewedBy:'REVIEWER',criticalWorkflowCoverageComplete:true,tenantBoundaryAcceptanceComplete:true,authorizationWorkflowAcceptanceComplete:true,requiredScenarios:1,passedScenarios:1,failedScenarios:0,scenarioPlanHashSha256:plan.planHashSha256,scenarioResults:[{...plan.scenarios[0],actualObservationHashSha256:'f'.repeat(64),passed:true}]}
  });
  assert.strictEqual(result.status,SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED);
  return {...result,bearerToken:'must-not-leak-token',...overrides};
}

function input(overrides = {}) {
  return {
    candidateId: 'startak-rc-evidence-2026-09',
    environment: 'staging',
    serviceRef: 'startak-staging-api',
    exactCommitSha: COMMIT,
    productionQualification: productionQualification(),
    securityUatEvidence: securityUat(),
    openExternalBlockers: [...REQUIRED_OPEN_EXTERNAL_BLOCKERS],
    assembledBy: 'release-engineer',
    reviewedBy: 'independent-release-reviewer',
    assembledAt: '2026-09-09T16:00:00.000Z',
    reviewedAt: '2026-09-09T16:30:00.000Z',
    ...overrides,
  };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  assert.strictEqual(result.externalBlockersRemainOpen, true);
  assert.strictEqual(result.humanReleaseAuthorityApprovalRequired, true);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P20-01', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW);
    assert.strictEqual(result.releaseGovernanceReviewEligible, true);
    assert.strictEqual(result.engineeringEvidenceBundleAssembled, true);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.manifestHashSha256.length, 64);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P20-02', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({
      productionQualification: productionQualification({
        status: PRODUCTION_QUALIFICATION_STATUS.HOLD_PRODUCTION_READINESS,
        releaseGovernanceReviewEligible: false,
      }),
    }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_PRODUCTION_QUALIFICATION);
    assert.strictEqual(result.releaseGovernanceReviewEligible, false);
  });

  await test('PRODUCTIZATION-P20-03', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({
      securityUatEvidence: securityUat({ status: SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS }),
    }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_SECURITY_UAT_EVIDENCE);
  });

  await test('PRODUCTIZATION-P20-04', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({
      securityUatEvidence: securityUat({
        plan: { environment: 'staging', serviceRef: 'other-service', exactCommitSha: COMMIT },
      }),
    }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_SCOPE_MISMATCH);
  });

  await test('PRODUCTIZATION-P20-05', async () => {
    const blockers = REQUIRED_OPEN_EXTERNAL_BLOCKERS.filter((item) => item !== 'HUMAN_RELEASE_AUTHORITY_APPROVAL');
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({ openExternalBlockers: blockers }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_EXTERNAL_BLOCKER_REGISTER);
    assert.ok(result.issues.includes('MISSING_OPEN_EXTERNAL_BLOCKER:HUMAN_RELEASE_AUTHORITY_APPROVAL'));
  });

  await test('PRODUCTIZATION-P20-06', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input({
      assembledBy: 'same-person',
      reviewedBy: 'same-person',
    }));
    assert.strictEqual(result.status, RELEASE_CANDIDATE_STATUS.HOLD_REVIEW_GOVERNANCE);
  });

  await test('PRODUCTIZATION-P20-07', async () => {
    assert.throws(
      () => buildProductizationReleaseCandidateEvidenceBundle(input({ releaseAuthorized: true })),
      /CALLER_RELEASE_CANDIDATE_AUTHORITY_OVERRIDE_NOT_ALLOWED/,
    );
  });

  await test('PRODUCTIZATION-P20-08', async () => {
    const first = buildProductizationReleaseCandidateEvidenceBundle(input());
    const second = buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(first.manifestHashSha256, second.manifestHashSha256);
    assert.strictEqual(first.manifestRef, second.manifestRef);
  });

  await test('PRODUCTIZATION-P20-09', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input());
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('must-not-leak'));
    assert.ok(!serialized.includes('secretConnectionString'));
    assert.ok(!serialized.includes('bearerToken'));
  });

  await test('PRODUCTIZATION-P20-10', async () => {
    assert.throws(
      () => buildProductizationReleaseCandidateEvidenceBundle(input({ environment: 'production' })),
      /environment must be staging/,
    );
  });

  await test('PRODUCTIZATION-P20-11', async () => {
    assert.throws(
      () => buildProductizationReleaseCandidateEvidenceBundle(input({
        openExternalBlockers: [...REQUIRED_OPEN_EXTERNAL_BLOCKERS, REQUIRED_OPEN_EXTERNAL_BLOCKERS[0]],
      })),
      /must not contain duplicates/,
    );
  });

  await test('PRODUCTIZATION-P20-12', async () => {
    const result = buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(result.securityUatEvidence.openCriticalFindings, 0);
    assert.strictEqual(result.securityUatEvidence.openHighFindings, 0);
    assert.strictEqual(result.securityUatEvidence.uatFailedScenarios, 0);
    assert.strictEqual(result.productionQualification.releaseGovernanceReviewEligible, true);
    assertAuthorityClosed(result);
  });

  const valid=securityUat();
  const badCases=[
    {evidenceBundleHashSha256:'0'.repeat(64)},
    {uat:{...valid.uat,scenarioBinding:undefined}},
    {uat:{...valid.uat,failedScenarios:1}},
    {pentest:{...valid.pentest,openFindingCounts:{...valid.pentest.openFindingCounts,HIGH:1}}},
    {authority:{}},
    {plan:{...valid.plan,maximumEvidenceAgeDays:9999}},
    {issues:['UNRESOLVED']},
  ];
  for(const [i,patch] of badCases.entries())await test('PRODUCTIZATION-P20-INVALID-P19-'+i,async()=>{
    const result=buildProductizationReleaseCandidateEvidenceBundle(input({securityUatEvidence:{...valid,...patch}}));
    assert.strictEqual(result.status,RELEASE_CANDIDATE_STATUS.HOLD_SECURITY_UAT_EVIDENCE);
    assertAuthorityClosed(result);
  });
  await test('PRODUCTIZATION-P20-STALE-P19',async()=>{
    const result=buildProductizationReleaseCandidateEvidenceBundle(input({assembledAt:'2026-10-20T00:00:00Z',reviewedAt:'2026-10-20T01:00:00Z'}));
    assert.strictEqual(result.status,RELEASE_CANDIDATE_STATUS.HOLD_SECURITY_UAT_EVIDENCE);
    assertAuthorityClosed(result);
  });
  await test('PRODUCTIZATION-P20-BOUND-SCENARIO-SUMMARY',async()=>{
    const result=buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(result.securityUatEvidence.uatScenarioCount,1);
    assert.strictEqual(result.securityUatEvidence.uatScenarioPlanHashSha256,valid.uat.scenarioBinding.planHashSha256);
    assertAuthorityClosed(result);
  });

  const p9=productionQualification();
  const invalidP9=[
    {authority:{}},
    {authority:{...p9.authority,releaseAuthorized:true}},
    {reasonCodes:['UNRESOLVED']},
    {gates:{...p9.gates,productionReadiness:{...p9.gates.productionReadiness,ready:false}}},
    {gates:{...p9.gates,independentReleaseQualification:{...p9.gates.independentReleaseQualification,exactCommitSha:'d'.repeat(40)}}},
    {gates:{...p9.gates,independentReleaseQualification:{...p9.gates.independentReleaseQualification,qualificationHashSha256:null}}},
    {gates:{...p9.gates,independentReleaseQualification:{...p9.gates.independentReleaseQualification,integrityValid:false}}},
    {gates:{...p9.gates,institutionalGoLiveReview:{...p9.gates.institutionalGoLiveReview,ready:false}}},
    {evidenceRefs:{}},
    {evidenceBoundary:{...p9.evidenceBoundary,externalEvidenceRequired:false}},
    {nextStep:'COMPLETE_EXTERNAL_QUALIFICATION_EVIDENCE'}
  ];
  for(const [i,patch] of invalidP9.entries())await test('PRODUCTIZATION-P20-INVALID-P9-'+i,async()=>{
    const result=buildProductizationReleaseCandidateEvidenceBundle(input({productionQualification:productionQualification(patch)}));
    assert.strictEqual(result.status,RELEASE_CANDIDATE_STATUS.HOLD_PRODUCTION_QUALIFICATION);
    assertAuthorityClosed(result);
  });
  await test('PRODUCTIZATION-P20-P9-IDENTITY-SUMMARY',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(out.productionQualification.gates.independentReleaseQualification.exactCommitSha,COMMIT);
    assert.strictEqual(out.productionQualification.gates.independentReleaseQualification.qualificationHashSha256,'1'.repeat(64));
    assert.strictEqual(out.productionQualification.evidenceReferenceDigests.productionReadinessRef.length,64);
    assert.ok(!JSON.stringify(out).includes('SYNTH-P9-READINESS'));
  });
  await test('PRODUCTIZATION-P20-REJECTED-REF-MINIMIZATION',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input({securityUatEvidence:securityUat({evidenceBundleRef:'SYNTH-PRIVATE-REF-NOT-FOR-OUTPUT'})}));
    assert.strictEqual(out.status,RELEASE_CANDIDATE_STATUS.HOLD_SECURITY_UAT_EVIDENCE);
    assert.strictEqual(out.securityUatEvidence.evidenceBundleRef,null);
    assert.ok(!JSON.stringify(out).includes('SYNTH-PRIVATE-REF-NOT-FOR-OUTPUT'));
  });

  await test('P20-MONITORING-EXPIRES-FIRST',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input({assembledAt:'2026-10-05T00:00:00Z',reviewedAt:'2026-10-05T01:00:00Z'}));
    assert.strictEqual(out.status,RELEASE_CANDIDATE_STATUS.HOLD_SECURITY_UAT_EVIDENCE);assertAuthorityClosed(out);
  });
  await test('P20-ASSEMBLED-BEFORE-P19',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input({assembledAt:'2026-09-09T11:00:00Z'}));
    assert.strictEqual(out.status,RELEASE_CANDIDATE_STATUS.HOLD_SECURITY_UAT_EVIDENCE);assertAuthorityClosed(out);
  });
  await test('P20-FUTURE-REVIEW',async()=>{
    assert.throws(()=>buildProductizationReleaseCandidateEvidenceBundle(input({reviewedAt:'2999-01-01T00:00:00Z'})),/must not be in the future/);
  });
  await test('P20-P9-DIGEST-TYPE',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input({productionQualification:productionQualification({gates:{...p9.gates,independentReleaseQualification:{...p9.gates.independentReleaseQualification,qualificationHashSha256:['1'.repeat(64)]}}})}));
    assert.strictEqual(out.status,RELEASE_CANDIDATE_STATUS.HOLD_PRODUCTION_QUALIFICATION);
    assert.strictEqual(out.productionQualification.gates.independentReleaseQualification.qualificationHashSha256,null);
  });
  await test('P20-STATUS-MINIMIZATION',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input({productionQualification:productionQualification({status:'SYNTH-PRIVATE-STATUS',gates:{...p9.gates,productionReadiness:{status:'SYNTH-PRIVATE-STATUS',ready:false}}}),securityUatEvidence:securityUat({status:'SYNTH-PRIVATE-STATUS'})}));
    assert.ok(!JSON.stringify(out).includes('SYNTH-PRIVATE-STATUS'));assertAuthorityClosed(out);
  });
  await test('P20-MONITORING-TIME-SUMMARY',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input());
    assert.strictEqual(out.securityUatEvidence.observabilityCompletedAt,'2026-09-04T11:01:20.000Z');
    assert.strictEqual(out.status,RELEASE_CANDIDATE_STATUS.READY_FOR_EXISTING_RELEASE_GOVERNANCE_REVIEW);
  });
  await test('P20-SECRET-BLOCKER-REQUIRED',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input({openExternalBlockers:REQUIRED_OPEN_EXTERNAL_BLOCKERS.filter(x=>x!=='GIT_HISTORY_SECRET_SCAN_REMEDIATION_AND_ROTATION')}));
    assert.strictEqual(out.status,RELEASE_CANDIDATE_STATUS.HOLD_EXTERNAL_BLOCKER_REGISTER);
    assert.ok(out.issues.includes('MISSING_OPEN_EXTERNAL_BLOCKER:GIT_HISTORY_SECRET_SCAN_REMEDIATION_AND_ROTATION'));
  });
  await test('P20-EXPLICIT-AUTHORITY-OVERRIDE',async()=>{
    for(const patch of [{releaseAuthorized:null},{authority:{releaseAuthorized:false}},{mergeAuthorized:undefined}])
      assert.throws(()=>buildProductizationReleaseCandidateEvidenceBundle(input(patch)),/CALLER_RELEASE_CANDIDATE_AUTHORITY_OVERRIDE_NOT_ALLOWED/);
  });
  await test('P20-INVALID-BLOCKER-IDENTIFIER',async()=>{
    assert.throws(()=>buildProductizationReleaseCandidateEvidenceBundle(input({openExternalBlockers:[...REQUIRED_OPEN_EXTERNAL_BLOCKERS,'invalid blocker']})),/bounded blocker identifiers/);
  });
  await test('P20-REJECTED-SUMMARY-IS-NOT-VERIFIED',async()=>{
    const out=buildProductizationReleaseCandidateEvidenceBundle(input({securityUatEvidence:securityUat({evidenceBundleHashSha256:'0'.repeat(64)})}));
    assert.strictEqual(out.securityUatEvidence.structurallyVerified,false);
    for(const key of ['evidenceBundleRef','pentestEvidenceRef','uatEvidenceRef','openCriticalFindings','openHighFindings','uatFailedScenarios','uatScenarioCount','uatScenarioPlanHashSha256','observabilityCompletedAt'])assert.strictEqual(out.securityUatEvidence[key],null);
  });
  await test('P20-MANIFEST-REBUILD-AND-FRESHNESS',async()=>{
    const source=input();const out=buildProductizationReleaseCandidateEvidenceBundle(source);
    assert.strictEqual(verifyReleaseCandidateManifest(out,source,source.reviewedAt),true);
    assert.strictEqual(verifyReleaseCandidateManifest(out,source,'2026-10-05T00:00:00Z'),false);
    assert.strictEqual(verifyReleaseCandidateManifest(out,source,'2026-09-09T16:01:00Z'),false);
    assert.strictEqual(verifyReleaseCandidateManifest(out,source,'2999-01-01T00:00:00Z'),false);
    assert.strictEqual(verifyReleaseCandidateManifest(out,input({candidateId:'OTHER'}),source.reviewedAt),false);
  });
  await test('P20-MANIFEST-TAMPER-REHASH',async()=>{
    const source=input();const out=buildProductizationReleaseCandidateEvidenceBundle(source);
    for(const patch of [{authority:{...out.authority,releaseAuthorized:true}},{openExternalBlockers:[]},{manifestHashSha256:'0'.repeat(64)},{engineeringEvidenceBundleAssembled:false},JSON.parse('{"__proto__":{"unexpected":true}}')])
      assert.strictEqual(verifyReleaseCandidateManifest({...out,...patch},source,source.reviewedAt),false);
    const rejected=input({openExternalBlockers:[]});
    assert.strictEqual(verifyReleaseCandidateManifest(buildProductizationReleaseCandidateEvidenceBundle(rejected),rejected,rejected.reviewedAt),false);
  });
  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P20_RELEASE_CANDIDATE_EVIDENCE_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P20_RELEASE_CANDIDATE_EVIDENCE_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
