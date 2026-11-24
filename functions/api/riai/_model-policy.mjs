// Published standard token prices, USD micros per token; reviewed 2026-11-24.
 // These are minimum floors, not a billing guarantee or activation authorization.
export const MODEL_CATALOG_REVIEW_DATE='2026-11-24';
export const MODEL_CATALOG_SOURCE='https://developers.openai.com/api/docs/models';
export const MODEL_PROFILES=Object.freeze({
 'gpt-6.2-sol':Object.freeze({role:'PRIMARY_QUALITATIVE_REVIEW',minimumMicrosPerToken:10,effort:'low'}),
 'gpt-6.2-astra':Object.freeze({role:'COMPLEX_QUALITATIVE_REVIEW',minimumMicrosPerToken:40,effort:'low'}),
 'gpt-6.1-terra':Object.freeze({role:'EFFICIENT_QUALITATIVE_REVIEW',minimumMicrosPerToken:5,effort:'low'}),
 'gpt-6-luna':Object.freeze({role:'BOUNDED_CLASSIFICATION_REVIEW',minimumMicrosPerToken:1,effort:'low'}),
});
export function resolveModernModel({env,model,protocol,url}){
 if(!Object.hasOwn(MODEL_PROFILES,model)){
  // Keep legacy adapters compatible; unknown GPT-6 IDs cannot silently bypass policy.
  if(/^gpt-6(?:[.-]|$)/i.test(model))return {error:'AI_MODEL_NOT_QUALIFIED'};
  return {profile:null};
 }
 const profile=MODEL_PROFILES[model];
 if(protocol!=='OPENAI_RESPONSES'||url.href!=='https://api.openai.com/v1/responses')return {error:'AI_MODEL_REQUIRES_NATIVE_RESPONSES'};
 if(env.RIAI_AI_MODEL_POLICY_VERSION!=='GPT6_20261124')return {error:'AI_MODEL_POLICY_NOT_CONFIGURED'};
 if(Number(env.RIAI_AI_MAX_USD_MICROS_PER_TOKEN)<profile.minimumMicrosPerToken)return {error:'AI_MODEL_PRICE_BOUND_BELOW_CATALOG'};
 const effort=env.RIAI_AI_REASONING_EFFORT||profile.effort;
 if(!['low','medium'].includes(effort))return {error:'AI_MODEL_REASONING_EFFORT_INVALID'};
 return {profile,effort};
}
export function matchesReportedModel(requested,reported){
 if(typeof reported!=='string')return false;
 if(reported===requested)return true;
 if(!reported.startsWith(requested+'-'))return false;
 const date=reported.slice(requested.length+1);
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}
