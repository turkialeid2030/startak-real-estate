// Operator-supplied conservative price ceiling, not a price lookup or invoice.
// USD micros are integers; billing outside this explicit bound is unqualified.
export function monetaryReservation(env, model, tokens, now = Date.now()) {
  const rate=Number(env.RIAI_AI_MAX_USD_MICROS_PER_TOKEN);
  const fixed=Number(env.RIAI_AI_FIXED_USD_MICROS_PER_REQUEST);
  const limit=Number(env.RIAI_AI_GLOBAL_USD_MICROS_PER_DAY);
  const expires=env.RIAI_AI_PRICE_BOUND_EXPIRES_AT;
  if (env.RIAI_AI_PRICE_BOUND_MODEL !== model || !Number.isSafeInteger(tokens) || tokens<=0
    || !Number.isSafeInteger(rate) || rate<=0 || env.RIAI_AI_FIXED_USD_MICROS_PER_REQUEST == null
    || String(env.RIAI_AI_FIXED_USD_MICROS_PER_REQUEST).trim()===''
    || !Number.isSafeInteger(fixed) || fixed<0 || !Number.isSafeInteger(limit) || limit<=0
    || typeof expires!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(expires)
    || !Number.isFinite(Date.parse(expires)) || new Date(expires).toISOString().replace('.000Z','Z')!==expires
    || !Number.isFinite(now) || Date.parse(expires)<=now)
    return {ok:false,code:'AI_MONETARY_BOUND_NOT_CONFIGURED'};
  const amount=BigInt(tokens)*BigInt(rate)+BigInt(fixed);
  if(amount>BigInt(Number.MAX_SAFE_INTEGER)) return {ok:false,code:'AI_MONETARY_BOUND_NOT_CONFIGURED'};
  return {ok:true,money:{reservedUsdMicros:Number(amount),limitUsdMicros:limit,model}};
}
