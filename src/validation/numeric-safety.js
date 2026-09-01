// src/validation/numeric-safety.js -- single canonical numeric-validation
// layer. Uses Number.isFinite() (NOT isNaN()) because isNaN(Infinity)===false.

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

const PERCENTAGE_FIELDS_0_TO_1 = [
  'occupancyRate', 'ltv', 'loanRate', 'minYieldThreshold', 'discountRate', 'hurdleRate',
  'rentGrowthRate', 'vatRate', 'marketCapRate', 'exitCapRate', 'variableOpexRate',
  'managementFeeRate', 'insuranceRateOnReplacementCost', 'opexGrowthRate',
  'replacementCostGrowthRate',
];

// Economically load-bearing divisors must never silently fall back to zero.
// exitCapRate is conditional because the Building UI did not historically
// expose it; the remediated Building engine falls back to marketCapRate only
// when the field is absent. If a caller supplies it, zero/negative is invalid.
const STRICTLY_POSITIVE_DIVISOR_FIELDS = [
  'maxPaybackThreshold',
  'buildingPrice',
  'marketCapRate',
  'exitCapRate',
];

function validateEngineInputs(inputs) {
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value !== 'number') continue;
    requireFinite(key, value);
  }

  if ('occupancyRate' in inputs) requireRange('occupancyRate', inputs.occupancyRate, 0, 1);
  if ('ltv' in inputs) requireRange('ltv', inputs.ltv, 0, 1);

  for (const field of [
    'commissionRate', 'transferFeeRate', 'landCommissionRate', 'landTransferFeeRate',
    'exitTransferFeeRate', 'serviceIncomeRate', 'maintenanceRate', 'insuranceRate',
    'variableOpexRate', 'managementFeeRate', 'insuranceRateOnReplacementCost',
  ]) {
    if (field in inputs) requireRange(field, inputs[field], 0, 1);
  }

  for (const field of STRICTLY_POSITIVE_DIVISOR_FIELDS) {
    if (field in inputs && inputs[field] <= 0) {
      throw new ValidationError(field, inputs[field], 'STRICTLY_POSITIVE_REQUIRED',
        `قيمة حقل "${field}" (${inputs[field]}) يجب أن تكون أكبر من صفر`,
        `Field "${field}" value ${inputs[field]} must be strictly positive (it is used as a divisor)`);
    }
  }

  if ('leaseUpMonths' in inputs && inputs.leaseUpMonths < 0) {
    throw new ValidationError('leaseUpMonths', inputs.leaseUpMonths, 'NON_NEGATIVE_REQUIRED',
      'مدة التأجير الأولي يجب ألا تكون سالبة',
      'leaseUpMonths must be non-negative');
  }

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

module.exports = {
  ValidationError,
  requireFinite,
  requireRange,
  validateEngineInputs,
  PERCENTAGE_FIELDS_0_TO_1,
  STRICTLY_POSITIVE_DIVISOR_FIELDS,
};
