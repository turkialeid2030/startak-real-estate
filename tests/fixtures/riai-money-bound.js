// Synthetic ceiling only; no provider pricing or production authorization.
module.exports = model => ({
  RIAI_AI_PRICE_BOUND_MODEL:model,
  RIAI_AI_MAX_USD_MICROS_PER_TOKEN:'1',
  RIAI_AI_FIXED_USD_MICROS_PER_REQUEST:'0',
  RIAI_AI_GLOBAL_USD_MICROS_PER_DAY:'1000000',
  RIAI_AI_PRICE_BOUND_EXPIRES_AT:'2099-01-01T00:00:00Z',
});
