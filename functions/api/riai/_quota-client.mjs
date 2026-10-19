import { readBoundedText } from './_bounded-body.mjs';
const ACTOR = 'riai-global-quota-v1';
const codes = { MINUTE_LIMIT:'AI_RATE_LIMIT_EXCEEDED_PER_MINUTE', SUBJECT_DAY_LIMIT:'AI_RATE_LIMIT_EXCEEDED_PER_DAY', GLOBAL_DAY_LIMIT:'AI_SPEND_BUDGET_EXHAUSTED', TOKEN_DAY_LIMIT:'AI_TOKEN_BUDGET_EXCEEDED', MONETARY_DAY_LIMIT:'AI_MONETARY_BUDGET_EXCEEDED' };
async function call(binding, route, body) {
  if (!binding || typeof binding.idFromName !== 'function' || typeof binding.get !== 'function') throw new Error('binding unavailable');
  let timer;
  try {
    const work = async () => {
      const response = await binding.get(binding.idFromName(ACTOR)).fetch(`https://quota${route}`, { method:'POST', body:JSON.stringify(body), headers:{'content-type':'application/json'} });
      if (!response.ok) throw new Error('quota rejected request');
      return JSON.parse(await readBoundedText(response, {maxBytes:4096,timeoutMs:3000}));
    };
    return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('quota timeout')),3000);})]);
  } finally { clearTimeout(timer); }
}
export async function reserveGatewayQuota(binding, input) {
  try {
    const result = await call(binding, '/reserve', input);
    if (result.allowed === true && result.replayed === false && result.id === input.id && result.reservedTokens === input.tokens
      && (!input.money || result.reservedUsdMicros === input.money.reservedUsdMicros)) return {...result,status:200};
    const code = codes[result.code];
    return {allowed:false,status:code?429:503,code:code||'AI_ATOMIC_QUOTA_REJECTED'};
  } catch (_) { return {allowed:false,status:503,code:'AI_ATOMIC_QUOTA_UNAVAILABLE'}; }
}
export async function settleGatewayQuota(binding, input) {
  try {
    const result = await call(binding, '/settle', input);
    return result.settled === true && result.overage === false ? {ok:true} : {ok:false,code:'AI_QUOTA_SETTLEMENT_REJECTED'};
  } catch (_) { return {ok:false,code:'AI_ATOMIC_QUOTA_UNAVAILABLE'}; }
}
export function verifiedUsage(payload, protocol) {
  const usage=payload?.usage;
  const input=protocol==='OPENAI_RESPONSES'?usage?.input_tokens:usage?.prompt_tokens;
  const output=protocol==='OPENAI_RESPONSES'?usage?.output_tokens:usage?.completion_tokens;
  const total=usage?.total_tokens;
  if (![input,output,total].every(n=>Number.isSafeInteger(n)&&n>=0) || !Number.isSafeInteger(input+output) || input+output!==total) return null;
  return total;
}
