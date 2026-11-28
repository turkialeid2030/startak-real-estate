'use strict';

const assert = require('assert');
const {
  AI_ASSIST_ENDPOINT,
  AI_ASSIST_CLIENT_STATUS,
  requestResidentialIncomeAiAssist,
} = require('../../src/residential-income-acquisition/ai-assist-client');

const viewModel = {
  apiStatus: 'CASE_LOADED',
  asOfDate: '2026-09-03',
  readinessStatus: 'NEEDS_DUE_DILIGENCE',
  summary: { unitCount: 2, leaseCount: 1, tenantCount: 1, evidenceLineageCount: 4 },
  blockers: [], evidenceGaps: [], dueDiligence: [],
  acquisitionAnalyticalScore: { status: 'CALCULATED', score: 75, scoreCoverage: 1, evidenceConfidence: 0.8, redFlags: [], components: [] },
  lifecycleLocationUpside: null,
  reverseUnderwriting: null,
  exitStrategyComparison: null,
  scenarioIntegration: null,
  rawOperatingCase: { tenant: 'PRIVATE TENANT', address: 'PRIVATE ADDRESS' },
};

let capturedUrl = null;
let capturedOptions = null;
const fetchImpl = async (url, options) => {
  if(options.method==='GET')return {ok:true,status:200,async json(){return {schemaVersion:1,publicAiEnabled:false};}};
  capturedUrl = url;
  capturedOptions = options;
  return {
    ok: true,
    status: 200,
    async json() {
      const payload = {
        ok: true,
        aiModelUsed: true,
        model: 'configured-model',
        generatedAt: '2026-09-03T00:00:00.000Z',
        advisoryOnly: true,
        deterministicScoreRemainsAuthoritative: true,
        result: {
          executiveObservations: ['The evidence package is usable but still requires explicit diligence confirmation.'],
          riskFlags: [],
          evidenceGaps: [],
          dueDiligenceQuestions: ['Which independent source confirms the principal underwriting assumptions?'],
          scenarioChecks: ['Confirm the selected benchmark scenario remains internally consistent.'],
          earlyWarningIndicators: [{ indicator: 'Evidence confidence', whyItMatters: 'A decline would weaken the reliability of the analytical narrative.' }],
          decisionBoundary: 'Advisory narrative only; no transaction is authorized.',
        },
      };
      const request=JSON.parse(options.body);
      const hash=value=>require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
      payload.requestBinding={version:1,clientRequestId:request.clientRequestId,snapshotHashSha256:hash(request.decisionSnapshot),resultHashSha256:hash(payload.result)};
      return payload;
    },
  };
};

(async () => {
  const result = await requestResidentialIncomeAiAssist(viewModel, { fetchImpl, timeoutMs: 5000 });
  assert.strictEqual(result.status, AI_ASSIST_CLIENT_STATUS.SUCCESS);
  assert.strictEqual(result.aiModelUsed, true);
  assert.strictEqual(result.deterministicScoreRemainsAuthoritative, true);
  assert.strictEqual(result.result.investmentRecommendation, null);
  assert.strictEqual(result.result.legalConclusion, null);
  assert.strictEqual(capturedUrl, AI_ASSIST_ENDPOINT);
  assert.strictEqual(capturedUrl, '/api/riai/ai-assist');
  assert.strictEqual(capturedOptions.method, 'POST');
  assert.strictEqual(capturedOptions.credentials, 'same-origin');
  assert.strictEqual(capturedOptions.cache, 'no-store');
  const sent = capturedOptions.body;
  assert(sent.includes('RESIDENTIAL_INCOME_ACQUISITION_AI_ASSIST'));
  assert(!sent.includes('PRIVATE TENANT'));
  assert(!sent.includes('PRIVATE ADDRESS'));
  assert(!sent.includes('"rawOperatingCase":'));
  assert(!sent.includes('"tenant":'));
  assert(!sent.includes('"address":'));

  const notReady = await requestResidentialIncomeAiAssist({ apiStatus: 'NOT_LOADED' }, { fetchImpl });
  assert.strictEqual(notReady.status, AI_ASSIST_CLIENT_STATUS.NOT_READY);
  assert.strictEqual(notReady.aiModelUsed, false);

  const unavailable = await requestResidentialIncomeAiAssist(viewModel, {
    fetchImpl: async () => ({ ok: false, status: 503, async json() { return { ok: false, code: 'AI_PROVIDER_NOT_CONFIGURED' }; } }),
  });
  assert.strictEqual(unavailable.status, AI_ASSIST_CLIENT_STATUS.UNAVAILABLE);
  assert.strictEqual(unavailable.reasonCode, 'AI_PROVIDER_NOT_CONFIGURED');
  assert.strictEqual(unavailable.aiModelUsed, false);

  assert.match(result.requestBinding.snapshotHashSha256,/^[a-f0-9]{64}$/);
  const oldId=result.requestBinding.clientRequestId;
  const second=await requestResidentialIncomeAiAssist(viewModel,{fetchImpl});
  assert.notStrictEqual(second.requestBinding.clientRequestId,oldId);
  for(const patch of [p=>delete p.requestBinding,p=>p.requestBinding.clientRequestId=oldId,p=>p.requestBinding.snapshotHashSha256='a'.repeat(64),p=>p.requestBinding.resultHashSha256='b'.repeat(64),p=>p.requestBinding.version=2,p=>p.result.executiveObservations=['Changed result.']]){
    const bad=await requestResidentialIncomeAiAssist(viewModel,{turnstileToken:'synthetic',fetchImpl:async(url,options)=>{
      const res=await fetchImpl(url,options);const payload=await res.json();patch(payload);return {ok:true,status:200,async json(){return payload;}};
    }});
    assert.strictEqual(bad.status,AI_ASSIST_CLIENT_STATUS.INVALID_RESPONSE);assert.strictEqual(bad.reasonCode,'AI_ASSIST_REQUEST_BINDING_INVALID');assert.strictEqual(bad.result,null);
  }
  // Explicit gateway status is distinct from an ambiguous transport failure.
  for(const attempted of [true,false,undefined,'false']){
    let posts=0;
    const failure=await requestResidentialIncomeAiAssist(viewModel,{turnstileToken:'synthetic',fetchImpl:async(url,options)=>{
      if(options.method==='GET')return {ok:true,status:200,async json(){return {schemaVersion:1,publicAiEnabled:false};}};
      posts++;return {ok:false,status:502,async json(){return {ok:false,code:'AI_PROVIDER_UNREACHABLE',providerRequestAttempted:attempted};}};
    }});
    assert.strictEqual(failure.status,AI_ASSIST_CLIENT_STATUS.UNAVAILABLE);
    assert.strictEqual(failure.providerRequestAttempted,typeof attempted==='boolean'?attempted:null);
    assert.strictEqual(failure.potentialProviderCharge,attempted!==false);
    assert.strictEqual(failure.automaticRetryAllowed,false);assert.strictEqual(posts,1);
  }
  for(const failureMode of ['network','json','timeout']){
    let posts=0;
    const failure=await requestResidentialIncomeAiAssist(viewModel,{turnstileToken:'synthetic',timeoutMs:1000,fetchImpl:async(url,options)=>{
      if(options.method==='GET')return {ok:true,status:200,async json(){return {schemaVersion:1,publicAiEnabled:false};}};
      posts++;
      if(failureMode==='network')throw Error('synthetic network failure');
      if(failureMode==='timeout')return new Promise(()=>{});
      return {ok:true,status:200,async json(){throw Error('synthetic invalid JSON');}};
    }});
    assert.strictEqual(failure.providerRequestAttempted,null);assert.strictEqual(failure.potentialProviderCharge,true);
    assert.strictEqual(failure.automaticRetryAllowed,false);assert.strictEqual(posts,1);
  }
  const cancelled=new AbortController();cancelled.abort();
  const beforeDispatch=await requestResidentialIncomeAiAssist(viewModel,{signal:cancelled.signal,fetchImpl:async()=>{throw Error('must not dispatch');}});
  assert.strictEqual(beforeDispatch.providerRequestAttempted,false);assert.strictEqual(beforeDispatch.potentialProviderCharge,false);
  console.log('RIAI_CLIENT_RETRY_RISK=PASS scenarios=8 synthetic_only=true');
  console.log('RIAI_V617_CLIENT_REQUEST_BINDING=PASS negative_cases=6 unique_request_check=1');
  console.log('RIAI_AI_ASSIST_CLIENT_V1=PASS');
  console.log('SAME_ORIGIN_AI_ENDPOINT_ONLY=PASS');
  console.log('RAW_CASE_AND_PII_NOT_TRANSMITTED=PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
