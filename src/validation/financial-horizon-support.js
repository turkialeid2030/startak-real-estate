'use strict';

// #397 — fail closed only where the current valuation timeline is demonstrably
// unable to represent the accepted input without losing economics.
//
// Existing Building holdPeriod is an annual terminal-value horizon. Fractional
// values can skip the terminal-sale branch entirely and are therefore rejected.
// Land operatingPeriod is represented only through annual operating cash-flow
// buckets and is rejected when fractional until a dated/fractional operating
// timeline is implemented.
//
// Land constructionPeriod is intentionally NOT rejected here. Wave-B
// construction financing explicitly supports fractional years by normalizing
// them to exact calendar months (for example 2.5 years -> 30 months), and the
// canonical architecture suite relies on that behavior. Its mixed monthly-debt
// / annual-project timing basis is governed separately as a methodology
// transparency item rather than being silently disabled by this validator.
//
// Fractional loanTenor also remains supported because the production debt
// engine normalizes tenor years to calendar months.
const { ValidationError } = require('./numeric-safety');
const { STUDY_TYPE } = require('../contracts/study-type');

const ANNUAL_HORIZON_FIELDS = Object.freeze({
  [STUDY_TYPE.EXISTING_BUILDING]: Object.freeze(['holdPeriod']),
  [STUDY_TYPE.LAND_DEVELOPMENT]: Object.freeze(['operatingPeriod']),
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
