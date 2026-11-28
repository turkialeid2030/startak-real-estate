// This provider channel carries qualitative observations only. Financial values
// remain in the deterministic report, never in generated narrative.
const QUANTITY = /\p{N}|\b(?:hundreds?|thousands?|millions?|billions?|trillions?|percent|zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b|\bper\s+cent\b|\bone\s+(?:SAR|USD|riyal|dollar|unit|room|tenant|lease|year|month|day|basis\s+point)\b|(?:مليون|ملايين|مليار|مليارات|تريليون|مئة|مائة|ألف|آلاف|بالمئة|بالمائة)|(?<!\p{L})(?:صفر|اثنان|اثنين|اثنتان|اثنتين|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة|عشرون|عشرين|ثلاثون|ثلاثين|أربعون|أربعين|خمسون|خمسين|ستون|ستين|سبعون|سبعين|ثمانون|ثمانين|تسعون|تسعين|ريالان|ريالين)(?!\p{L})|[%٪]/iu;
// Detection only: normalize presentation variants and ignore invisible format
// characters, Arabic elongation and combining marks. Do not rewrite output.
function quantityText(value) {
  return value.normalize('NFKC').replace(/[\p{Cf}\p{M}\u0640]/gu,'');
}
export function qualitativeOutputError(payload) {
  const stack = [payload];
  let nodes = 0;
  while (stack.length) {
    if (++nodes > 2000) return 'AI_OUTPUT_STRUCTURE_TOO_LARGE';
    const value = stack.pop();
    if (typeof value === 'number' || (typeof value === 'string' && (QUANTITY.test(value.normalize('NFKC')) || QUANTITY.test(quantityText(value))))) return 'AI_UNSOURCED_NUMERIC_CLAIM';
    if (value && typeof value === 'object') {
      if (Object.hasOwn(value, 'financialClaims')) return 'AI_FINANCIAL_CLAIM_CHANNEL_UNSUPPORTED';
      stack.push(...Object.values(value));
    }
  }
  return null;
}
