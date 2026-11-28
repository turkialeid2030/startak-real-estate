// This provider channel carries qualitative observations only. Financial values
// remain in the deterministic report, never in generated narrative.
const QUANTITY = /\p{N}|\b(?:hundreds?|thousands?|millions?|billions?|trillions?|percent)\b|\bper\s+cent\b|(?:مليون|ملايين|مليار|مليارات|تريليون|مئة|مائة|ألف|آلاف|بالمئة|بالمائة|ريالان|ريالين)|[%٪]/iu;
const SPELLED_CARDINAL = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b|(?<!\p{L})(?:صفر|واحد|واحدة|اثنان|اثنين|اثنتان|اثنتين|ثلاثة|ثلاث|أربعة|أربع|خمسة|خمس|ستة|ست|سبعة|سبع|ثمانية|ثماني|تسعة|تسع|عشرة|عشر|عشرون|عشرين|ثلاثون|ثلاثين|أربعون|أربعين|خمسون|خمسين|ستون|ستين|سبعون|سبعين|ثمانون|ثمانين|تسعون|تسعين)(?!\p{L})/iu;
const QUANTITATIVE_CONTEXT = /\b(?:SAR|USD|AED|EUR|GBP|riyals?|dollars?|dirhams?|euros?|pounds?|price|value|valuation|rent|rental|yield|return|rate|costs?|expenses?|income|revenue|profit|loss|NOI|NPV|IRR|DSCR|LTV|CAPEX|OPEX|occupancy|vacancy|units?|rooms?|tenants?|leases?|years?|months?|days?|basis\s+points?|square\s+met(?:er|re)s?)\b|(?:ريال|دولار|درهم|يورو|دينار|القيمة|قيمة|السعر|سعر|التقييم|الإيجار|الايجار|إيجار|ايجار|العائد|عائد|النسبة|المعدل|التكلفة|تكلفة|تكاليف|الدخل|الإيراد|الايراد|الإيرادات|الربح|الأرباح|الخسارة|الإشغال|الاشغال|الشغور|وحدات|وحدة|غرف|غرفة|مستأجر|عقود|عقد|سنوات|سنة|أشهر|شهر|أيام|يوم|متر)/iu;
// Preserve qualitative prose about material issues while screening spelled
// quantities in financial/property contexts. This is lexical, not semantic.
function hasQuantity(value) {
  const raw=value.normalize('NFKC'), normalized=quantityText(value);
  return [raw,normalized].some(text=>QUANTITY.test(text)||(SPELLED_CARDINAL.test(text)&&QUANTITATIVE_CONTEXT.test(text)));
}
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
    if (typeof value === 'number' || (typeof value === 'string' && hasQuantity(value))) return 'AI_UNSOURCED_NUMERIC_CLAIM';
    if (value && typeof value === 'object') {
      if (Object.hasOwn(value, 'financialClaims')) return 'AI_FINANCIAL_CLAIM_CHANNEL_UNSUPPORTED';
      stack.push(...Object.values(value));
    }
  }
  return null;
}
