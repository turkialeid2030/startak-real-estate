// This provider channel carries qualitative observations only. Financial values
// remain in the deterministic report, never in generated narrative.
const QUANTITY = /\p{N}|\b(?:hundred|thousand|million|billion|trillion|percent)\b|(?:مليون|ملايين|مليار|مليارات|تريليون|مئة|مائة|ألف|آلاف|بالمئة|بالمائة)|[%٪]/iu;
export function qualitativeOutputError(payload) {
  const stack = [payload];
  let nodes = 0;
  while (stack.length) {
    if (++nodes > 2000) return 'AI_OUTPUT_STRUCTURE_TOO_LARGE';
    const value = stack.pop();
    if (typeof value === 'number' || (typeof value === 'string' && QUANTITY.test(value.normalize('NFKC')))) return 'AI_UNSOURCED_NUMERIC_CLAIM';
    if (value && typeof value === 'object') {
      if (Object.hasOwn(value, 'financialClaims')) return 'AI_FINANCIAL_CLAIM_CHANNEL_UNSUPPORTED';
      stack.push(...Object.values(value));
    }
  }
  return null;
}
