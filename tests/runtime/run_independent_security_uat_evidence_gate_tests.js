'use strict';

const assert = require('assert');
const {
  OBSERVABILITY_STATUS,
} = require('../../src/qualification/controlled-observability-incident-qualification');
const {
  SECURITY_UAT_STATUS,
  createUatScenarioPlan,
  verifyCompletedSecurityUatBundle,
  evaluateIndependentSecurityUatEvidence,
} = require('../../src/qualification/independent-security-uat-evidence-gate');

const results = [];
const COMMIT = 'a'.repeat(40);
const REPORT_HASH = 'b'.repeat(64);
const UAT_HASH = 'c'.repeat(64);

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

const {syntheticObservability}=require('../fixtures/synthetic-observability-qualification');
function observability(overrides={}){
 return {...syntheticObservability({environment:'staging',serviceRef:'startak-staging-api',exactCommitSha:COMMIT}),...overrides};
}

function pentest(overrides = {}) {
  return {
    status: 'PASS',
    environment: 'staging',
    serviceRef: 'startak-staging-api',
    exactCommitSha: COMMIT,
    reportRef: 'secure://pentest/report-2026-09',
    reportHashSha256: REPORT_HASH,
    testerOrganization: 'Independent Security Lab',
    preparedBy: 'external-tester',
    reviewedBy: 'external-reviewer',
    independentAssessorAttested: true,
    scopeIncludesAuthentication: true,
    scopeIncludesTenantIsolation: true,
    scopeIncludesApiAuthorization: true,
    scopeIncludesServerRuntime: true,
    retestCompletedForRemediatedCriticalHigh: true,
    findingCounts: { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 1 },
    openFindingCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 1 },
    startedAt: '2026-09-05T08:00:00.000Z',
    completedAt: '2026-09-06T08:00:00.000Z',
    reviewedAt: '2026-09-07T08:00:00.000Z',
    password: 'must-not-leak',
    ...overrides,
  };
}

const scenarioPlan=createUatScenarioPlan({
  environment:'staging',serviceRef:'startak-staging-api',exactCommitSha:COMMIT,
  preparedAt:'2026-09-01T00:00:00Z',validUntil:'2026-09-09T00:00:00Z',
  scenarios:Array.from({length:24},(_,i)=>({scenarioId:'SYNTH-'+String(i+1).padStart(2,'0'),userRole:i%2?'ANALYST':'VIEWER',expectedOutcomeHashSha256:'e'.repeat(64)}))
});
const scenarioResults=scenarioPlan.scenarios.map(s=>({...s,actualObservationHashSha256:'f'.repeat(64),passed:true}));

function uat(overrides = {}) {
  return {
    status: 'PASS',
    environment: 'staging',
    serviceRef: 'startak-staging-api',
    exactCommitSha: COMMIT,
    acceptanceRef: 'secure://uat/acceptance-2026-09',
    acceptanceArtifactHashSha256: UAT_HASH,
    businessOwner: 'business-owner',
    reviewedBy: 'uat-independent-reviewer',
    criticalWorkflowCoverageComplete: true,
    tenantBoundaryAcceptanceComplete: true,
    authorizationWorkflowAcceptanceComplete: true,
    scenarioPlanHashSha256:scenarioPlan.planHashSha256,
    scenarioResults,
    requiredScenarios: 24,
    passedScenarios: 24,
    failedScenarios: 0,
    startedAt: '2026-09-06T09:00:00.000Z',
    completedAt: '2026-09-07T09:00:00.000Z',
    reviewedAt: '2026-09-08T09:00:00.000Z',
    bearerToken: 'must-not-leak-token',
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    observabilityQualification: observability(),
    environment: 'staging',
    serviceRef: 'startak-staging-api',
    exactCommitSha: COMMIT,
    assessedAt: '2026-09-09T12:00:00.000Z',
    maximumEvidenceAgeDays: 30,
    pentestEvidence: pentest(),
    uatEvidence: uat(),
    uatScenarioPlan:scenarioPlan,
    ...overrides,
  };
}

function assertAuthorityClosed(result) {
  assert.strictEqual(result.productionQualified, false);
  assert.strictEqual(result.releaseCandidateAuthorityEstablished, false);
  for (const value of Object.values(result.authority)) assert.strictEqual(value, false);
}

(async () => {
  await test('PRODUCTIZATION-P19-01', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input());
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.pentest.openFindingCounts.HIGH, 0);
    assert.strictEqual(result.uat.failedScenarios, 0);
    assert.strictEqual(result.evidenceBundleHashSha256.length, 64);
    assertAuthorityClosed(result);
  });

  await test('PRODUCTIZATION-P19-02', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      observabilityQualification: observability({ status: OBSERVABILITY_STATUS.HOLD_OBJECTIVES }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_OBSERVABILITY_QUALIFICATION);
    assert.strictEqual(result.pentest ?? null, null);
  });

  await test('PRODUCTIZATION-P19-03', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ reportHashSha256: 'not-a-hash' }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE);
    assert.ok(result.issues.includes('PENTEST_EVIDENCE_INVALID_OR_INCOMPLETE'));
  });

  await test('PRODUCTIZATION-P19-04', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ exactCommitSha: 'e'.repeat(40) }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_SCOPE_MISMATCH);
    assert.ok(result.issues.includes('PENTEST_SCOPE_MISMATCH'));
  });

  await test('PRODUCTIZATION-P19-05', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      maximumEvidenceAgeDays: 1,
      assessedAt: '2026-09-09T12:00:00.000Z',
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE);
    assert.ok(result.issues.some((item) => item.includes('PENTEST_EVIDENCE_OUTSIDE_FRESHNESS')));
  });

  await test('PRODUCTIZATION-P19-06', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ openFindingCounts: { CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0, INFO: 0 } }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS);
    assert.deepStrictEqual(result.issues, ['OPEN_CRITICAL_OR_HIGH_PENTEST_FINDINGS']);
  });

  await test('PRODUCTIZATION-P19-07', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ retestCompletedForRemediatedCriticalHigh: false }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_PENTEST_FINDINGS);
    assert.deepStrictEqual(result.issues, ['CRITICAL_HIGH_REMEDIATION_RETEST_NOT_COMPLETE']);
  });

  await test('PRODUCTIZATION-P19-08', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      uatEvidence: uat({ status: 'FAIL', requiredScenarios: 24, passedScenarios: 23, failedScenarios: 1 }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE);
    assert.ok(result.issues.includes('UAT_STATUS_NOT_PASS'));
    assert.ok(result.issues.includes('UAT_SCENARIOS_NOT_ALL_PASSING'));
  });

  await test('PRODUCTIZATION-P19-09', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({ independentAssessorAttested: false }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE);
    assert.ok(result.issues.includes('PENTEST_INDEPENDENT_ASSESSOR_NOT_ATTESTED'));
  });

  await test('PRODUCTIZATION-P19-10', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      uatEvidence: uat({ businessOwner: 'same-person', reviewedBy: 'same-person' }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE);
    assert.ok(result.issues.includes('UAT_REVIEWER_NOT_SEPARATE'));
  });

  await test('PRODUCTIZATION-P19-11', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input());
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('secure://pentest/report-2026-09'));
    assert.ok(!serialized.includes('secure://uat/acceptance-2026-09'));
    assert.ok(!serialized.includes('must-not-leak'));
    assert.ok(!serialized.includes('Independent Security Lab'));
    assert.ok(result.pentest.reportRef.startsWith('sha256:'));
    assert.ok(result.uat.acceptanceRef.startsWith('sha256:'));
  });

  await test('PRODUCTIZATION-P19-12', async () => {
    const first = evaluateIndependentSecurityUatEvidence(input());
    const second = evaluateIndependentSecurityUatEvidence(input());
    assert.strictEqual(first.evidenceBundleHashSha256, second.evidenceBundleHashSha256);
    assert.strictEqual(first.plan.planHashSha256, second.plan.planHashSha256);
  });

  await test('PRODUCTIZATION-P19-13', async () => {
    assert.throws(
      () => evaluateIndependentSecurityUatEvidence(input({ environment: 'production' })),
      /environment must be staging/,
    );
  });

  await test('PRODUCTIZATION-P19-14', async () => {
    const result = evaluateIndependentSecurityUatEvidence(input({
      pentestEvidence: pentest({
        findingCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 4, LOW: 2, INFO: 0 },
        openFindingCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 2, LOW: 1, INFO: 0 },
        retestCompletedForRemediatedCriticalHigh: false,
      }),
    }));
    assert.strictEqual(result.status, SECURITY_UAT_STATUS.INDEPENDENT_SECURITY_UAT_EVIDENCE_COMPLETE_NOT_RELEASE_AUTHORIZED);
  });

  // Incomplete, null, unknown, or unsafe finding counts cannot mean zero.
  const missingHigh = {...pentest().openFindingCounts};
  delete missingHigh.HIGH;
  const incompleteCases = [
    pentest({openFindingCounts: missingHigh}),
    pentest({findingCounts: {}}),
    pentest({openFindingCounts: {...pentest().openFindingCounts, CRITICAL: null}}),
    pentest({openFindingCounts: {...pentest().openFindingCounts, UNKNOWN: 1}}),
    pentest({findingCounts: {...pentest().findingCounts, HIGH: Number.MAX_SAFE_INTEGER + 1}}),
  ];
  for (const [index, record] of incompleteCases.entries()) {
    await test('PRODUCTIZATION-P19-MISSING-COUNTS-'+index, async()=>{
      const out=evaluateIndependentSecurityUatEvidence(input({pentestEvidence:record}));
      assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_PENTEST_EVIDENCE);
      assertAuthorityClosed(out);
    });
  }
  await test('PRODUCTIZATION-P19-OBSERVABILITY-HASH', async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input({observabilityQualification:observability({evidenceHashSha256:undefined})}));
    assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_OBSERVABILITY_QUALIFICATION);
    assertAuthorityClosed(out);
  });
  await test('PRODUCTIZATION-P19-OLD-PENTEST-NEW-REVIEW', async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input({pentestEvidence:pentest({startedAt:'2026-07-01T08:00:00Z',completedAt:'2026-07-02T08:00:00Z'})}));
    assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE);
    assert.ok(out.issues.includes('PENTEST_EVIDENCE_OUTSIDE_FRESHNESS'));
    assertAuthorityClosed(out);
  });
  await test('PRODUCTIZATION-P19-OLD-UAT-NEW-REVIEW', async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input({uatEvidence:uat({startedAt:'2026-07-01T08:00:00Z',completedAt:'2026-07-02T08:00:00Z'})}));
    assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE);
    assert.ok(out.issues.includes('UAT_EVIDENCE_OUTSIDE_FRESHNESS'));
    assertAuthorityClosed(out);
  });
  await test('PRODUCTIZATION-P19-FUTURE-REVIEW', async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input({uatEvidence:uat({reviewedAt:'2026-09-10T00:00:00Z'})}));
    assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE);
    assert.ok(out.issues.includes('UAT_EVIDENCE_OUTSIDE_FRESHNESS'));
    assertAuthorityClosed(out);
  });

  await test('PRODUCTIZATION-P19-SCENARIO-BINDING-VALID',async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input());
    assert.strictEqual(out.uat.scenarioBinding.scenarioCount,24);
    assert.strictEqual(out.uat.scenarioBinding.planHashSha256,scenarioPlan.planHashSha256);
    assert.strictEqual(out.uat.scenarioBinding.scenarioResultsHashSha256.length,64);
    assert.ok(!JSON.stringify(out).includes('SYNTH-01'));
    assertAuthorityClosed(out);
  });
  const invalidScenarioCases=[
    [{uatScenarioPlan:undefined},'UAT_SCENARIO_PLAN_OR_RESULTS_INVALID'],
    [{uatEvidence:uat({scenarioPlanHashSha256:'0'.repeat(64)})},'UAT_SCENARIO_PLAN_HASH_MISMATCH'],
    [{uatEvidence:uat({scenarioResults:[...scenarioResults.slice(0,23),scenarioResults[0]]})},'UAT_SCENARIO_COVERAGE_MISMATCH'],
    [{uatEvidence:uat({scenarioResults:[{...scenarioResults[0],userRole:'ADMIN'},...scenarioResults.slice(1)]})},'UAT_SCENARIO_ROLE_OR_OUTCOME_MISMATCH'],
    [{uatEvidence:uat({scenarioResults:[{...scenarioResults[0],expectedOutcomeHashSha256:'0'.repeat(64)},...scenarioResults.slice(1)]})},'UAT_SCENARIO_ROLE_OR_OUTCOME_MISMATCH'],
    [{uatEvidence:uat({scenarioResults:[{...scenarioResults[0],passed:false},...scenarioResults.slice(1)]})},'UAT_SCENARIO_FAILURE_PRESENT'],
    [{uatEvidence:uat({scenarioResults:[{...scenarioResults[0],actualObservationHashSha256:null},...scenarioResults.slice(1)]})},'UAT_SCENARIO_PLAN_OR_RESULTS_INVALID'],
    [{uatEvidence:uat({scenarioResults:scenarioResults.slice(1)})},'UAT_SCENARIO_COVERAGE_MISMATCH'],
  ];
  for(const [index,[patch,issue]] of invalidScenarioCases.entries())await test('PRODUCTIZATION-P19-SCENARIO-BINDING-'+index,async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input(patch));
    assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE);
    assert.ok(out.issues.includes(issue));
    assertAuthorityClosed(out);
  });
  for(const [index,patch] of [{exactCommitSha:'0'.repeat(40)},{preparedAt:'2026-09-07T00:00:00Z'}].entries()){
    const other=createUatScenarioPlan({...scenarioPlan,...patch});
    await test('PRODUCTIZATION-P19-SCENARIO-PLAN-SCOPE-WINDOW-'+index,async()=>{
      const out=evaluateIndependentSecurityUatEvidence(input({uatScenarioPlan:other,uatEvidence:uat({scenarioPlanHashSha256:other.planHashSha256})}));
      assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_UAT_EVIDENCE);
      assert.ok(out.issues.includes(index===0?'UAT_SCENARIO_PLAN_SCOPE_MISMATCH':'UAT_SCENARIO_PLAN_WINDOW_MISMATCH'));
      assertAuthorityClosed(out);
    });
  }

  for(const [i,patch] of [{metrics:null},{evidenceHashSha256:'0'.repeat(64)},{authorizationRef:'sha256:'+'0'.repeat(64)},{productionQualified:true},{authority:{}},{plan:{...observability().plan,assessedAt:'2026-09-10T00:00:00Z'}}].entries())
    await test('P19-OBSERVABILITY-INTEGRITY-'+i,async()=>{
      const out=evaluateIndependentSecurityUatEvidence(input({observabilityQualification:observability(patch)}));
      assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_OBSERVABILITY_QUALIFICATION);
      assertAuthorityClosed(out);
    });
  await test('P19-FRESHNESS-OVERFLOW',async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input({maximumEvidenceAgeDays:Number.MAX_VALUE}));
    assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE);
  });
  await test('P19-STALE-OBSERVABILITY',async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input({maximumEvidenceAgeDays:4}));
    assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_STALE_EVIDENCE);
    assert.ok(out.issues.includes('OBSERVABILITY_EVIDENCE_OUTSIDE_FRESHNESS'));assertAuthorityClosed(out);
  });
  await test('P19-INVALID-UPSTREAM-REFERENCE',async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input({observabilityQualification:observability({evidenceHashSha256:['d'.repeat(64)]})}));
    assert.strictEqual(out.status,SECURITY_UAT_STATUS.HOLD_OBSERVABILITY_QUALIFICATION);
    assert.strictEqual(out.observabilityQualificationRef,null);
  });
  await test('P19-BOUND-MONITORING-COMPLETION',async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input());
    assert.strictEqual(out.plan.observabilityCompletedAt,observability().incident.resolvedAt);
    assert.strictEqual(verifyCompletedSecurityUatBundle(out,input().assessedAt),true);
    assert.strictEqual(verifyCompletedSecurityUatBundle(out,'2026-10-05T00:00:00Z'),false);
  });
  await test('P19-FUTURE-ASSESSMENT',async()=>{
    assert.throws(()=>evaluateIndependentSecurityUatEvidence(input({assessedAt:'2999-01-01T00:00:00Z'})),/must not be in the future/);
  });
  await test('P19-VERIFIER-REHASHED-SEMANTIC-CONFLICTS',async()=>{
    const crypto=require('node:crypto');
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    const digest=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
    const original=evaluateIndependentSecurityUatEvidence(input());
    for(const change of [
      {pentest:{...original.pentest,reviewedByRef:original.pentest.preparedByRef}},
      {uat:{...original.uat,reviewedByRef:original.uat.businessOwnerRef}},
      {pentest:{...original.pentest,reportHashSha256:[original.pentest.reportHashSha256]}},
      {uat:{...original.uat,scenarioBinding:{...original.uat.scenarioBinding,planHashSha256:[original.uat.scenarioBinding.planHashSha256]}}},
      {plan:{...original.plan,observabilityCompletedAt:'2026-07-01T00:00:00Z'}}
    ]){
      const out={...original,...change};const {planHashSha256:ignored,...planCore}=out.plan;
      out.plan={...planCore,planHashSha256:digest(planCore)};out.planHashSha256=out.plan.planHashSha256;
      out.pentestEvidenceRef='sha256:'+digest(out.pentest);out.uatEvidenceRef='sha256:'+digest(out.uat);
      const core=Object.fromEntries(['schemaVersion','status','planHashSha256','observabilityQualificationRef','pentestEvidenceRef','uatEvidenceRef','issues'].map(k=>[k,out[k]]));
      out.evidenceBundleHashSha256=digest(core);out.evidenceBundleRef='sha256:'+out.evidenceBundleHashSha256;
      assert.strictEqual(verifyCompletedSecurityUatBundle(out,input().assessedAt),false);
    }
  });
  await test('P19-V622-REVERIFIABLE-WITNESS',async()=>{
    const out=evaluateIndependentSecurityUatEvidence(input());
    const b=out.uat.scenarioBinding;
    assert.strictEqual(b.planWitness.scenarios.length,24);assert.strictEqual(b.resultWitness.length,24);
    assert.strictEqual(verifyCompletedSecurityUatBundle(out,input().assessedAt),true);
    assert.ok(!JSON.stringify(b).includes('SYNTH-01'));assert.ok(!JSON.stringify(b).includes('ANALYST'));
    assert.ok(Object.isFrozen(b.planWitness.scenarios)&&Object.isFrozen(b.resultWitness[0]));
    const crypto=require('node:crypto');
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    const digest=v=>crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
    const patches=[
      {planWitness:undefined},
      {resultWitness:undefined},
      {resultWitness:b.resultWitness.slice(1)},
      {resultWitness:[b.resultWitness[0],b.resultWitness[0],...b.resultWitness.slice(2)]},
      {resultWitness:[{...b.resultWitness[0],roleRef:'sha256:'+'0'.repeat(64)},...b.resultWitness.slice(1)]},
      {resultWitness:[{...b.resultWitness[0],expectedOutcomeHashSha256:'0'.repeat(64)},...b.resultWitness.slice(1)]},
      {resultWitness:[{...b.resultWitness[0],passed:false},...b.resultWitness.slice(1)]},
      {resultWitness:[{...b.resultWitness[0],actualObservationHashSha256:null},...b.resultWitness.slice(1)]},
      {planWitness:{...b.planWitness,exactCommitSha:'0'.repeat(40)}},
      {planWitness:{...b.planWitness,preparedAt:'2026-09-07T00:00:00Z'}},
      {planWitness:{...b.planWitness,validUntil:'2026-09-06T10:00:00Z'}}
    ];
    for(const patch of patches){
      const binding={...b,...patch};
      if(binding.planWitness)binding.planHashSha256=digest(binding.planWitness);
      if(binding.resultWitness)binding.scenarioResultsHashSha256=digest(binding.resultWitness);
      const uat={...out.uat,scenarioBinding:binding};
      const modified={...out,uat,uatEvidenceRef:'sha256:'+digest(uat)};
      const core=Object.fromEntries(['schemaVersion','status','planHashSha256','observabilityQualificationRef','pentestEvidenceRef','uatEvidenceRef','issues'].map(k=>[k,modified[k]]));
      modified.evidenceBundleHashSha256=digest(core);modified.evidenceBundleRef='sha256:'+modified.evidenceBundleHashSha256;
      assert.strictEqual(verifyCompletedSecurityUatBundle(modified,input().assessedAt),false);
    }
  });
  console.log('P19_V622_WITNESS_REVALIDATION=CHECKED negative_cases=11 synthetic_evidence=true');
  const failed = results.filter((entry) => entry[1] !== 'PASS');
  console.log(`PRODUCTIZATION_P19_INDEPENDENT_SECURITY_UAT_RESULT=${failed.length === 0 ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry[1] === 'PASS').length}/${results.length}`);
  if (failed.length > 0) process.exit(1);
})().catch((error) => {
  console.error('PRODUCTIZATION_P19_INDEPENDENT_SECURITY_UAT_FATAL', error && error.stack ? error.stack : error);
  process.exit(1);
});
