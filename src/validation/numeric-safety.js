// src/validation/numeric-safety.js -- single canonical numeric-validation
// layer. Uses Number.isFinite() (NOT isNaN()) because isNaN(Infinity)===false.
const { STUDY_TYPE } = require('../contracts/study-type');

class ValidationError extends Error {
  constructor(field, value, rule, messageAr, messageEn) {
    super(messageEn);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.rule = rule;
    this.code = rule;
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

function requireFiniteIntermediate(field, value) {
  if (!Number.isFinite(value)) {
    throw new ValidationError(field, value, 'NON_FINITE_INTERMEDIATE',
      `القيمة الوسيطة المحسوبة "${field}" غير صالحة؛ تم إيقاف الحساب لمنع انتشار قيمة غير محدودة أو ليست رقماً`,
      `Calculated intermediate "${field}" is not finite; calculation was stopped to prevent propagation of an invalid numeric value`);
  }
  return value;
}

function requireFiniteArray(field, values) {
  if (!Array.isArray(values)) {
    throw new ValidationError(field, values, 'NON_FINITE_INTERMEDIATE',
      `القيمة الوسيطة المحسوبة "${field}" يجب أن تكون مصفوفة أرقام صالحة`,
      `Calculated intermediate "${field}" must be an array of finite numbers`);
  }
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) {
      throw new ValidationError(`${field}[${index}]`, values[index], 'NON_FINITE_INTERMEDIATE',
        `القيمة الوسيطة المحسوبة "${field}[${index}]" غير صالحة؛ تم إيقاف الحساب لمنع انتشار قيمة غير محدودة أو ليست رقماً`,
        `Calculated intermediate "${field}[${index}]" is not finite; calculation was stopped to prevent propagation of an invalid numeric value`);
    }
  }
  return values;
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
  'vatRate', 'marketCapRate', 'exitCapRate', 'variableOpexRate',
  'managementFeeRate', 'insuranceRateOnReplacementCost',
  'commissionRate', 'transferFeeRate', 'landCommissionRate', 'landTransferFeeRate',
  'exitTransferFeeRate', 'serviceIncomeRate', 'maintenanceRate', 'insuranceRate',
  'equityRiskSpread', 'buildableRatio', 'servicesRatioPerFloor', 'efficiencyRatio',
  'opexRate',
];

const GROWTH_RATE_FIELDS = ['rentGrowthRate', 'opexGrowthRate', 'replacementCostGrowthRate'];
const GROWTH_RATE_MIN = -0.5;
const GROWTH_RATE_MAX = 0.5;
const NON_NEGATIVE_FIELDS = [
  'fixedOpexPerSqm', 'replacementReservePerSqm', 'inspectionCost', 'valuationCost',
  'engineeringCost', 'landValuationCost',
];
const VALID_LEASE_STATUS = ['مؤجر', '3 أشهر', '6 أشهر', '9 أشهر', 'سنة'];

// Economically load-bearing divisors must never silently fall back to zero.
// exitCapRate remains conditional for the legacy Building contract in Wave 1;
// the approved versioned exit-cap resolver is a separate Wave 2 task.
const STRICTLY_POSITIVE_DIVISOR_FIELDS = [
  'maxPaybackThreshold',
  'buildingPrice',
  'marketCapRate',
  'exitCapRate',
];

const REQUIRED_ENGINE_FIELDS = Object.freeze({
  [STUDY_TYPE.EXISTING_BUILDING]: Object.freeze([
    'landLength', 'landWidth', 'basementCount', 'basementAreaEach', 'parkingAreaPerSpot',
    'floorCount', 'floorAreaEach', 'buildingPrice', 'commissionRate', 'transferFeeRate',
    'inspectionCost', 'valuationCost', 'rentPerSqm', 'occupancyRate', 'leaseStatus',
    'vatRate', 'serviceIncomeRate', 'basementConstructionCostPerSqm',
    'floorConstructionCostPerSqm', 'currentLandPricePerSqm', 'buildingUsefulLife',
    'marketCapRate', 'discountRate', 'holdPeriod', 'minYieldThreshold',
    'maxPaybackThreshold', 'leverageEnabled', 'ltv', 'loanRate', 'loanTenor',
    'equityRiskSpread',
  ]),
  [STUDY_TYPE.LAND_DEVELOPMENT]: Object.freeze([
    'landLength', 'landWidth', 'landPricePerSqm', 'buildableRatio', 'officeFloorCount',
    'servicesRatioPerFloor', 'basementFloorCount', 'constructionCostPerSqm',
    'landCommissionRate', 'landTransferFeeRate', 'engineeringCost', 'landValuationCost',
    'marketRentPerSqm', 'occupancyRate', 'serviceIncomeRate', 'marketCapRate',
    'constructionPeriod', 'operatingPeriod', 'exitCapRate', 'hurdleRate',
    'exitTransferFeeRate', 'maxPaybackThreshold', 'leverageEnabled', 'ltv',
    'loanRate', 'loanTenor', 'equityRiskSpread',
  ]),
});

function hasProvidedField(inputs, field) {
  return Object.prototype.hasOwnProperty.call(inputs, field)
    && inputs[field] !== undefined
    && inputs[field] !== null;
}

function missingRequiredField(field) {
  throw new ValidationError(field, undefined, 'MISSING_REQUIRED_FIELD',
    `الحقل المطلوب "${field}" مفقود؛ لا يمكن إجراء الحساب المالي دون قيمة صريحة`,
    `Required field "${field}" is missing; the financial calculation cannot proceed without an explicit value`);
}

function inferStudyType(inputs) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) return null;
  const buildingMarkers = ['buildingPrice', 'floorCount', 'basementCount', 'holdPeriod'];
  const landMarkers = ['landPricePerSqm', 'officeFloorCount', 'constructionPeriod', 'operatingPeriod'];
  const buildingHits = buildingMarkers.filter((field) => field in inputs).length;
  const landHits = landMarkers.filter((field) => field in inputs).length;
  if (buildingHits >= 2 && buildingHits > landHits) return STUDY_TYPE.EXISTING_BUILDING;
  if (landHits >= 2 && landHits > buildingHits) return STUDY_TYPE.LAND_DEVELOPMENT;
  return null;
}

function validateRequiredFields(inputs, studyType) {
  const required = REQUIRED_ENGINE_FIELDS[studyType];
  if (!required) return true;

  for (const field of required) {
    if (!hasProvidedField(inputs, field)) missingRequiredField(field);
  }

  if (studyType === STUDY_TYPE.EXISTING_BUILDING) {
    const hasPositiveOverride = Number.isFinite(inputs.netLeasableOverride) && inputs.netLeasableOverride > 0;
    if (!hasPositiveOverride && !hasProvidedField(inputs, 'efficiencyRatio')) missingRequiredField('efficiencyRatio');
    if (!hasProvidedField(inputs, 'variableOpexRate') && !hasProvidedField(inputs, 'maintenanceRate')) missingRequiredField('maintenanceRate');
    if (!hasProvidedField(inputs, 'insuranceRateOnReplacementCost') && !hasProvidedField(inputs, 'insuranceRate')) missingRequiredField('insuranceRate');
  }

  if (studyType === STUDY_TYPE.LAND_DEVELOPMENT) {
    if (!hasProvidedField(inputs, 'variableOpexRate') && !hasProvidedField(inputs, 'opexRate')) missingRequiredField('opexRate');
  }

  if (inputs.leverageEnabled === true && !hasProvidedField(inputs, 'minDscrThreshold')) {
    missingRequiredField('minDscrThreshold');
  }
  return true;
}

function validateEngineInputs(inputs, options = {}) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new ValidationError('inputs', inputs, 'MISSING_REQUIRED_FIELD',
      'مدخلات المحرك مطلوبة ويجب أن تكون كائناً صالحاً',
      'Engine inputs are required and must be a valid object');
  }

  const studyType = options.studyType || inferStudyType(inputs);
  validateRequiredFields(inputs, studyType);

  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value !== 'number') continue;
    requireFinite(key, value);
  }

  for (const field of PERCENTAGE_FIELDS_0_TO_1) {
    if (field in inputs) requireRange(field, inputs[field], 0, 1);
  }

  for (const field of GROWTH_RATE_FIELDS) {
    if (field in inputs) requireRange(field, inputs[field], GROWTH_RATE_MIN, GROWTH_RATE_MAX);
  }

  for (const field of NON_NEGATIVE_FIELDS) {
    if (field in inputs && inputs[field] < 0) {
      throw new ValidationError(field, inputs[field], 'NON_NEGATIVE_REQUIRED',
        `قيمة حقل "${field}" (${inputs[field]}) يجب ألا تكون سالبة`,
        `Field "${field}" value ${inputs[field]} must not be negative`);
    }
  }

  if ('leaseStatus' in inputs && inputs.leaseStatus !== undefined && inputs.leaseStatus !== null
      && !VALID_LEASE_STATUS.includes(inputs.leaseStatus)) {
    throw new ValidationError('leaseStatus', inputs.leaseStatus, 'UNKNOWN_CONTROLLED_VALUE',
      'قيمة حالة الإيجار غير معروفة؛ لا يجوز افتراض عدم وجود شاغر ضمنياً',
      'Unknown leaseStatus value; a zero-vacancy assumption must never be inferred silently');
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
    requireFiniteIntermediate('totalProjectCost', totalProjectCost);
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
  requireFiniteIntermediate,
  requireFiniteArray,
  requireRange,
  validateEngineInputs,
  validateRequiredFields,
  hasProvidedField,
  inferStudyType,
  REQUIRED_ENGINE_FIELDS,
  PERCENTAGE_FIELDS_0_TO_1,
  GROWTH_RATE_FIELDS,
  NON_NEGATIVE_FIELDS,
  VALID_LEASE_STATUS,
  STRICTLY_POSITIVE_DIVISOR_FIELDS,
};
