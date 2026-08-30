// src/validation/numeric-safety.js -- single canonical numeric-validation
// layer. Uses Number.isFinite() (NOT isNaN()) because isNaN(Infinity)===false
// -- this was the exact root cause of DEF-003.

class ValidationError extends Error {
  constructor(field, value, rule, messageAr, messageEn) {
    super(messageEn);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.rule = rule;
    this.message_ar = messageAr;
    this.message_en = messageEn;
  }
}

function requireFinite(field, value) {
  if (!Number.isFinite(value)) {
    throw new ValidationError(field, value, 'FINITE_NUMBER_REQUIRED',
      `القيمة المُدخلة لحقل "${field}" غير صالحة (غير محدودة أو ليست رقماً)`,
      `Field "${field}" must be a finite number (got ${value})`);
  }
  return value;
}

function requireRange(field, value, min, max) {
  requireFinite(field, value);
  if (value < min || value > max) {
    throw new ValidationError(field, value, 'OUT_OF_RANGE',
      `قيمة حقل "${field}" (${value}) خارج النطاق المسموح [${min}, ${max}]`,
      `Field "${field}" value ${value} is outside allowed range [${min}, ${max}]`);
  }
  return value;
}

// Percentage-domain fields, expressed as 0..1 fractions in this codebase
// (confirmed: occupancyRate=1.0 means 100%, per DEFAULT_BUILDING_INPUTS).
const PERCENTAGE_FIELDS_0_TO_1 = ['occupancyRate', 'ltv', 'loanRate', 'minYieldThreshold', 'discountRate', 'hurdleRate', 'minDscrThreshold', 'rentGrowthRate', 'vatRate'];

// DEFECT REMEDIATION D2 (DEF-004): fields that are divisors in the engine
// (1/maxPaybackThreshold appears in both calcExistingBuilding line ~210 and
// calcLandDevelopment line ~363) must be strictly positive. Zero produces a
// silent 0 SAR "maximum justified price" with no error; negative produces a
// plausible-looking but meaningless positive number (worse -- no visible
// anomaly at all). Confirmed identical field name in both studies.
// STRICTLY_POSITIVE_DIVISOR_FIELDS: fields used directly as a divisor in an
// economically load-bearing formula, where zero or negative would either
// throw (uncaught) or -- worse, as discovered for buildingPrice under
// OBS-001 -- be silently guarded to a fallback of 0, producing a
// mathematically finite but economically nonsensical/misleading result
// (e.g. netYieldOnPrice=0 when buildingPrice=0, which fails the minimum-
// yield criterion despite NOI being strongly positive, while an
// unrealistic near-zero price like 0.01 passes with a fictitious 110% IRR).
// buildingPrice added per OBS-001 disposition: CLASS A (invalid domain
// missing validation) -- the "> 0 ? ... : 0" guard already present in
// existing-building.js proves the original implementer was aware zero was
// unsafe here, but the safeguard was placed at the formula level instead of
// the validation boundary, unlike maxPaybackThreshold which correctly uses
// this same central list.
const STRICTLY_POSITIVE_DIVISOR_FIELDS = ['maxPaybackThreshold', 'buildingPrice'];

/**
 * validateEngineInputs(inputs) -- called once at the calculateInvestmentCase
 * boundary (src/engines/index.js), before dispatch to either study engine.
 * Throws ValidationError on the first invalid field found. Does NOT clamp,
 * does NOT silently coerce -- per the explicit "no silent clamping" principle.
 */
function validateEngineInputs(inputs) {
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value !== 'number') continue; // non-numeric fields (labels, booleans, text) are out of scope here
    requireFinite(key, value);
  }
  if ('occupancyRate' in inputs) {
    requireRange('occupancyRate', inputs.occupancyRate, 0, 1); // 0%..100%, matching the 0..1 fraction convention
  }
  for (const field of STRICTLY_POSITIVE_DIVISOR_FIELDS) {
    if (field in inputs && inputs[field] <= 0) {
      throw new ValidationError(field, inputs[field], 'STRICTLY_POSITIVE_REQUIRED',
        `قيمة حقل "${field}" (${inputs[field]}) يجب أن تكون أكبر من صفر`,
        `Field "${field}" value ${inputs[field]} must be strictly positive (it is used as a divisor)`);
    }
  }
  // OBS-002: totalProjectCost (Land Development) is a DERIVED aggregate, not
  // a single input field, so it cannot be added to STRICTLY_POSITIVE_DIVISOR_FIELDS
  // directly. Validated here, at the earliest canonical point once every
  // component is available, using the identical formula land-development.js
  // computes -- this is a validation-boundary check, not a second financial
  // engine. Guarded by 'buildableRatio' in inputs: that key is exclusive to
  // Land Development (Building's equivalent fields are named differently --
  // floorCount/basementCount, not officeFloorCount/basementFloorCount/
  // buildableRatio), so this block is fully inert for Building calls -- it
  // cannot fire and cannot throw for them.
  // (CORRECTED mid-session: an earlier version guarded on 'landLength',
  // which -- unlike the fields above -- IS also present in
  // DEFAULT_BUILDING_INPUTS; that broke 3 permanent tests, caught
  // immediately by a full-regression check, and fixed to this field.)
  if ('buildableRatio' in inputs) {
    const landMarketValue = inputs.landLength * inputs.landWidth * inputs.landPricePerSqm;
    const totalLandAcquisitionCost = landMarketValue + landMarketValue * inputs.landCommissionRate + landMarketValue * inputs.landTransferFeeRate + inputs.engineeringCost + inputs.landValuationCost;
    const floorPlateArea = inputs.landLength * inputs.landWidth * inputs.buildableRatio;
    const totalBuiltArea = floorPlateArea * inputs.officeFloorCount + inputs.landLength * inputs.landWidth * inputs.basementFloorCount;
    const totalConstructionCost = totalBuiltArea * inputs.constructionCostPerSqm;
    const totalProjectCost = totalLandAcquisitionCost + totalConstructionCost;
    if (totalProjectCost <= 0) {
      throw new ValidationError('totalProjectCost', totalProjectCost, 'STRICTLY_POSITIVE_REQUIRED',
        `إجمالي تكلفة المشروع (${totalProjectCost}) يجب أن يكون أكبر من صفر`,
        `Total project cost (${totalProjectCost}) must be strictly positive (it is used as a divisor)`);
    }
  }
  return true;
}

module.exports = { ValidationError, requireFinite, requireRange, validateEngineInputs, PERCENTAGE_FIELDS_0_TO_1, STRICTLY_POSITIVE_DIVISOR_FIELDS };
