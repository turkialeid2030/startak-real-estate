'use strict';

// #397 — valuation cash-flow horizons are currently annual. Until the
// canonical valuation engines implement date-aware/fractional-period cash
// flows (XNPV/XIRR or equivalent), annual horizons must fail closed rather
// than be silently floored/rounded by loop semantics.
//
// Fractional loanTenor remains supported because the production Wave-B debt
// engine normalizes tenor years to calendar months.
const { ValidationError } = require('./numeric-safety');
const { STUDY_TYPE } = require('../contracts/study-type');

const ANNUAL_HORIZON_FIELDS = Object.freeze({
  [STUDY_TYPE.EXISTING_BUILDING]: Object.freeze(['holdPeriod']),
  [STUDY_TYPE.LAND_DEVELOPMENT]: Object.freeze(['constructionPeriod', 'operatingPeriod']),
});

function rejectUnsupportedFractionalHorizon(field, value) {
  throw new ValidationError(
    field,
    value,
    'UNSUPPORTED_FRACTIONAL_ANNUAL_HORIZON',
    `الحقل "${field}" يستخدم حالياً نموذج تدفقات نقدية سنوي؛ يجب إدخال عدد صحيح من السنوات حتى يتم دعم التدفقات المؤرخة/الفترات الجزئية بصورة صريحة`,
    `Field "${field}" currently uses an annual cash-flow model; enter a whole number of years until dated/fractional-period cash flows are explicitly supported`,
  );
}

function validateSupportedFinancialHorizons(inputs, { studyType } = {}) {
  if (!inputs || typeof inputs !== 'object') return true;
  const fields = ANNUAL_HORIZON_FIELDS[studyType] || [];
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(inputs, field)
        && Number.isFinite(inputs[field])
        && !Number.isInteger(inputs[field])) {
      rejectUnsupportedFractionalHorizon(field, inputs[field]);
    }
  }

  // The current land lease-up implementation applies a lease-up factor only
  // to the first operating year. Values beyond 12 months would otherwise be
  // clamped to zero in year 1 and silently treated as fully stabilized in year
  // 2, losing the residual lease-up period.
  if (studyType === STUDY_TYPE.LAND_DEVELOPMENT
      && Object.prototype.hasOwnProperty.call(inputs, 'leaseUpMonths')
      && Number.isFinite(inputs.leaseUpMonths)
      && inputs.leaseUpMonths > 12) {
    throw new ValidationError(
      'leaseUpMonths',
      inputs.leaseUpMonths,
      'LEASE_UP_EXCEEDS_SINGLE_YEAR_MODEL',
      'نموذج التأجير الأولي الحالي يدعم حتى 12 شهراً فقط؛ يلزم نموذج متعدد السنوات قبل قبول مدة أطول',
      'The current lease-up model supports at most 12 months; a multi-year lease-up schedule is required before accepting a longer period',
    );
  }
  return true;
}

module.exports = {
  ANNUAL_HORIZON_FIELDS,
  validateSupportedFinancialHorizons,
};
