const assert=require('node:assert/strict');
(async()=>{
 const {qualitativeOutputError}=await import('../../functions/api/riai/_qualitative-output.mjs');
 for(const value of ['القيمة السوقية 100 مليون ريال','القيمة السوقية ١٠٠ مليون ريال','القيمة السوقية ۱۰۰ میلیون','Market value is one million SAR','العائد ١٠٪','Value １００','القيمة مئة ريال']) assert.equal(qualitativeOutputError({nested:[{text:value}]}),'AI_UNSOURCED_NUMERIC_CLAIM',value);
 assert.equal(qualitativeOutputError({financialClaims:[]}),'AI_FINANCIAL_CLAIM_CHANNEL_UNSUPPORTED');
 assert.equal(qualitativeOutputError({observations:['يلزم التحقق من إيجار السوق ومصدر معدل الرسملة.']}),null);
 assert.equal(qualitativeOutputError({observations:['Review lease expiry and collection evidence.']}),null);
 const {verifyTurnstile}=await import('../../functions/api/riai/_public-ai-security.mjs');
 const request=new Request('https://example.com');
 const oversized=await verifyTurnstile({request,env:{RIAI_TURNSTILE_SECRET_KEY:'synthetic'},token:'synthetic',fetchImpl:async()=>new Response('x'.repeat(16385))});
 assert.equal(oversized.code,'AI_TURNSTILE_RESPONSE_INVALID');
 const {validateResidentialIncomeAiAssistResponse:validate}=require('../../src/residential-income-acquisition/ai-assist-contract');
 const good={executiveObservations:['Review evidence.'],riskFlags:[],evidenceGaps:[],dueDiligenceQuestions:[],scenarioChecks:[],earlyWarningIndicators:[],decisionBoundary:'Advisory only.'};
 assert.equal(validate(good).status,'VALID');
 assert.equal(validate({...good,schemaVersion:1,investmentRecommendation:null,investmentDecision:null,legalConclusion:null,transactionAuthorized:false}).status,'VALID');
 const cases=[
  {executiveObservations:['القيمة ١٠٠ ريال']},
  {executiveObservations:['Market value is one million SAR']},
  {executiveObservations:['نوصي بالشراء']},
  {riskFlags:[{code:'Buy',severity:'HIGH',rationale:'Review evidence'}]},
  {riskFlags:[{code:'X'.repeat(121),severity:'HIGH',rationale:'Review evidence'}]},
  {riskFlags:[{code:'RISK',severity:'HIGH',rationale:'Review evidence',extra:'unknown'}]},
  {earlyWarningIndicators:[{indicator:'X'.repeat(221),whyItMatters:'Review evidence'}]},
  {decisionBoundary:'X'.repeat(501)},
  {transactionAuthorized:true},
  {investmentRecommendation:'APPROVE'},
  {unexpected:'unknown'}
 ];
 for(const patch of cases){const result=validate({...good,...patch});assert.equal(result.status,'INVALID');assert.equal(result.value,null);}
 console.log('RIAI_V615_CLIENT_OUTPUT_BOUNDARY=PASS negative_cases=11 positive_cases=2');
 console.log('RIAI_QUALITATIVE_OUTPUT=PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
