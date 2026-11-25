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

module.exports={calculateMetrics};
