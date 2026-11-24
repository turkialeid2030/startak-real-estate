// Explicit, single-request synthetic provider qualification. Never run automatically in CI.
// This does not authorize a production release or prove production key equivalence.
import {pathToFileURL} from 'node:url';
import {MODEL_PROFILES,MODEL_CATALOG_REVIEW_DATE,resolveModernModel,matchesReportedModel} from '../functions/api/riai/_model-policy.mjs';
import {monetaryReservation} from '../functions/api/riai/_money-budget.mjs';
const URL='https://api.openai.com/v1/responses';
const OUTPUT_LIMIT=256,MAX_RESPONSE_BYTES=65536;
const fail=(code,attempted=false)=>({ok:false,code,providerRequestAttempted:attempted,productionAuthorized:false,automaticRetryAllowed:false});
export async function qualifyLiveModel({env=process.env,fetchImpl=globalThis.fetch,now=Date.now()}={}){
 const model=env.RIAI_AI_MODEL,key=env.RIAI_AI_PROVIDER_KEY;
 if(env.RIAI_LIVE_CANARY_CONFIRM!=='ONE_SYNTHETIC_BILLABLE_REQUEST')return fail('CANARY_EXPLICIT_CONSENT_REQUIRED');
 if(!Object.hasOwn(MODEL_PROFILES,model)||typeof key!=='string'||!key.trim())return fail('CANARY_MODEL_OR_KEY_MISSING');
 const policy=resolveModernModel({env,model,protocol:'OPENAI_RESPONSES',url:new globalThis.URL(URL)});
 if(policy.error)return fail(policy.error);
 const body={model,store:false,reasoning:{effort:policy.effort},max_output_tokens:OUTPUT_LIMIT,input:[
 {role:'developer',content:[{type:'input_text',text:'Synthetic connectivity test only. Return the requested fixed JSON. No tools, no external data.'}]},
 {role:'user',content:[{type:'input_text',text:'Return {"status":"ok","synthetic":true}.'}]}
 ],text:{format:{type:'json_schema',name:'synthetic_canary',strict:true,schema:{type:'object',properties:{status:{type:'string',enum:['ok']},synthetic:{type:'boolean',enum:[true]}},required:['status','synthetic'],additionalProperties:false}}}};
 const payload=JSON.stringify(body),inputBound=Number(env.RIAI_AI_INPUT_TOKEN_UPPER_BOUND),cap=Number(env.RIAI_LIVE_CANARY_MAX_USD_MICROS);
 if(!Number.isSafeInteger(inputBound)||inputBound<Buffer.byteLength(payload)||inputBound>32768||!Number.isSafeInteger(cap)||cap<=0||cap>2000000)return fail('CANARY_BOUND_INVALID');
 const budget=monetaryReservation(env,model,inputBound+OUTPUT_LIMIT,now);
 if(!budget.ok)return fail(budget.code);
 if(budget.money.reservedUsdMicros>cap||budget.money.reservedUsdMicros>budget.money.limitUsdMicros)return fail('CANARY_BUDGET_EXCEEDED');
 const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const res=await fetchImpl(URL,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:payload,redirect:'error',signal:controller.signal});
  if(!res.ok)return {...fail('CANARY_PROVIDER_HTTP_ERROR',true),httpStatus:res.status};
  if(!res.body?.getReader)return fail('CANARY_RESPONSE_STREAM_REQUIRED',true);
  const reader=res.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_RESPONSE_BYTES){await reader.cancel();return fail('CANARY_RESPONSE_LIMIT',true);}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(data.status!=='completed'||!matchesReportedModel(model,data.model))return fail('CANARY_MODEL_OR_STATUS_MISMATCH',true);
  const usage=data.usage||{},i=usage.input_tokens,o=usage.output_tokens,t=usage.total_tokens;
  if(![i,o,t].every(x=>Number.isSafeInteger(x)&&x>=0)||t!==i+o||i>inputBound||o>OUTPUT_LIMIT||t===0)return fail('CANARY_USAGE_UNVERIFIED',true);
  const items=(Array.isArray(data.output)?data.output:[]).filter(x=>x.type==='message');
  const contents=items.flatMap(x=>Array.isArray(x.content)?x.content:[]);
  if(contents.some(x=>x.type==='refusal')||contents.filter(x=>x.type==='output_text').length!==1)return fail('CANARY_OUTPUT_UNVERIFIED',true);
  const result=JSON.parse(contents.find(x=>x.type==='output_text').text);
  if(result?.status!=='ok'||result.synthetic!==true||Object.keys(result).sort().join(',')!=='status,synthetic')return fail('CANARY_SCHEMA_MISMATCH',true);
  return {ok:true,code:'SYNTHETIC_PROVIDER_CANARY_PASS',requestedModel:model,reportedModel:data.model,modelCatalogReviewDate:MODEL_CATALOG_REVIEW_DATE,policyVersion:'GPT6_20261124',inputTokens:i,outputTokens:o,totalTokens:t,elapsedMs:Date.now()-started,reservedUsdMicros:budget.money.reservedUsdMicros,syntheticOnly:true,providerRequestAttempted:true,productionAuthorized:false,automaticRetryAllowed:false};
 }catch{return fail('CANARY_REQUEST_OR_RESPONSE_FAILED',true);}finally{clearTimeout(timer);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await qualifyLiveModel();console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}
