'use strict';
// Shared deterministic arithmetic; no evidence or appraisal authority.
function calculateMetrics(totals) {
  const totalOperatingRevenueSar = totals.roomsRevenueSar + totals.foodBeverageRevenueSar + totals.otherOperatingRevenueSar;
  const grossOperatingProfitBeforeOperatorFeesSar = totalOperatingRevenueSar
    - totals.departmentalExpensesSar
    - totals.undistributedOperatingExpensesSar;
  const operatingSurplusBeforeFfeAndFixedChargesSar = grossOperatingProfitBeforeOperatorFeesSar - totals.managementAndFranchiseFeesSar;
  const operatingSurplusAfterFfeReserveSar = operatingSurplusBeforeFfeAndFixedChargesSar - totals.ffeReserveSar;
  return {
    ...totals,
    totalOperatingRevenueSar,
    occupancyRate: totals.availableRoomNights > 0 ? totals.occupiedRoomNights / totals.availableRoomNights : null,
    averageDailyRateSar: totals.occupiedRoomNights > 0 ? totals.roomsRevenueSar / totals.occupiedRoomNights : null,
    revParSar: totals.availableRoomNights > 0 ? totals.roomsRevenueSar / totals.availableRoomNights : null,
    totalRevenuePerAvailableRoomNightSar: totals.availableRoomNights > 0 ? totalOperatingRevenueSar / totals.availableRoomNights : null,
    grossOperatingProfitBeforeOperatorFeesSar,
    grossOperatingProfitMarginBeforeOperatorFees: totalOperatingRevenueSar !== 0 ? grossOperatingProfitBeforeOperatorFeesSar / totalOperatingRevenueSar : null,
    grossOperatingProfitPerAvailableRoomNightSar: totals.availableRoomNights > 0 ? grossOperatingProfitBeforeOperatorFeesSar / totals.availableRoomNights : null,
    operatingSurplusBeforeFfeAndFixedChargesSar,
    operatingSurplusAfterFfeReserveSar,
    operatingSurplusAfterFfePerAvailableRoomNightSar: totals.availableRoomNights > 0 ? operatingSurplusAfterFfeReserveSar / totals.availableRoomNights : null,
  };
}

function sourceReconciliation(record) {
  const source = record.sourceReported;
  if (!source || typeof source !== 'object' || Array.isArray(source)
    || source.currency !== 'SAR'
    || source.surplusBasis !== 'AFTER_FFE_BEFORE_FIXED_CHARGES'
    || !Number.isSafeInteger(source.adrDecimals) || source.adrDecimals < 0 || source.adrDecimals > 2)
    return {status:'HOLD', reasons:['SOURCE_CURRENCY_OR_BASIS_UNQUALIFIED']};
  const safe = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER / 100;
  const nonnegative = n => safe(n) && n >= 0;
  if (!nonnegative(source.roomsRevenueSar) || !nonnegative(source.totalOperatingRevenueSar)
    || !safe(source.operatingSurplusAfterFfeReserveSar)
    || (record.occupiedRoomNights === 0 ? source.averageDailyRateSar !== null : !nonnegative(source.averageDailyRateSar)))
    return {status:'HOLD', reasons:['SOURCE_REPORTED_VALUES_INCOMPLETE_OR_INVALID']};
  const calculated = calculateMetrics(record);
  const reasons = [];
  const near = (a,b,tolerance) => safe(a) && safe(b) && Math.abs(a-b) <= tolerance;
  if (!near(source.roomsRevenueSar, calculated.roomsRevenueSar, 0.005)) reasons.push('SOURCE_ROOMS_REVENUE_MISMATCH');
  if (record.occupiedRoomNights > 0 && !near(source.averageDailyRateSar, calculated.averageDailyRateSar, 0.5 * 10 ** (-source.adrDecimals) + 1e-10))
    reasons.push('SOURCE_ADR_REVENUE_MISMATCH');
  if (!near(source.totalOperatingRevenueSar, calculated.totalOperatingRevenueSar, 0.015)) reasons.push('SOURCE_TOTAL_REVENUE_MISMATCH');
  if (!near(source.operatingSurplusAfterFfeReserveSar, calculated.operatingSurplusAfterFfeReserveSar, 0.025)) reasons.push('SOURCE_OPERATING_SURPLUS_MISMATCH');
  return {status:reasons.length?'HOLD':'ARITHMETICALLY_CONSISTENT', reasons};
}

module.exports={calculateMetrics,sourceReconciliation};
