'use strict';

const FORECAST_ENGINE_FAMILY = Object.freeze({
  HOSPITALITY: 'HOSPITALITY',
  LEISURE: 'LEISURE',
});

function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a finite non-negative number`);
  }
  return value;
}

function ratio(value, field) {
  finiteNonNegative(value, field);
  if (value > 1) throw new TypeError(`${field} must be between 0 and 1`);
  return value;
}

function valueOrZero(values, key) {
  const value = values[key];
  return value === undefined ? 0 : finiteNonNegative(value, key);
}

function calculateHospitalityOperatingForecast(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new TypeError('values must be an object');
  const availableRoomNights = finiteNonNegative(values.AVAILABLE_ROOM_NIGHTS, 'AVAILABLE_ROOM_NIGHTS');
  const occupancyRate = ratio(values.OCCUPANCY_RATE, 'OCCUPANCY_RATE');
  const adrSar = finiteNonNegative(values.ADR_SAR, 'ADR_SAR');
  const departmentalExpensesSar = finiteNonNegative(values.DEPARTMENTAL_EXPENSES_SAR, 'DEPARTMENTAL_EXPENSES_SAR');
  const undistributedExpensesSar = finiteNonNegative(values.UNDISTRIBUTED_EXPENSES_SAR, 'UNDISTRIBUTED_EXPENSES_SAR');
  const ffEReserveSar = finiteNonNegative(values.FF_E_RESERVE_SAR, 'FF_E_RESERVE_SAR');
  const foodBeverageRevenueSar = valueOrZero(values, 'FOOD_BEVERAGE_REVENUE_SAR');
  const otherRevenueSar = valueOrZero(values, 'OTHER_REVENUE_SAR');
  const managementFeesSar = valueOrZero(values, 'MANAGEMENT_FEES_SAR');
  const franchiseFeesSar = valueOrZero(values, 'FRANCHISE_FEES_SAR');

  const occupiedRoomNights = availableRoomNights * occupancyRate;
  const roomsRevenueSar = occupiedRoomNights * adrSar;
  const totalOperatingRevenueSar = roomsRevenueSar + foodBeverageRevenueSar + otherRevenueSar;
  const grossOperatingProfitBeforeOperatorFeesSar = totalOperatingRevenueSar - departmentalExpensesSar - undistributedExpensesSar;
  const operatorFeesSar = managementFeesSar + franchiseFeesSar;
  const operatingSurplusBeforeReserveSar = grossOperatingProfitBeforeOperatorFeesSar - operatorFeesSar;
  const operatingSurplusAfterReserveSar = operatingSurplusBeforeReserveSar - ffEReserveSar;
  const revparSar = availableRoomNights > 0 ? roomsRevenueSar / availableRoomNights : null;
  const totalRevenuePerAvailableRoomNightSar = availableRoomNights > 0 ? totalOperatingRevenueSar / availableRoomNights : null;

  return Object.freeze({
    family: FORECAST_ENGINE_FAMILY.HOSPITALITY,
    availableRoomNights,
    occupiedRoomNights,
    occupancyRate,
    adrSar,
    revparSar,
    roomsRevenueSar,
    foodBeverageRevenueSar,
    otherRevenueSar,
    totalOperatingRevenueSar,
    departmentalExpensesSar,
    undistributedExpensesSar,
    grossOperatingProfitBeforeOperatorFeesSar,
    managementFeesSar,
    franchiseFeesSar,
    operatorFeesSar,
    ffEReserveSar,
    operatingSurplusBeforeReserveSar,
    operatingSurplusAfterReserveSar,
    totalRevenuePerAvailableRoomNightSar,
    metricConvention: 'STARTAK_SPECIALIZED_OPERATING_FORECAST_V1',
  });
}

function calculateLeisureOperatingForecast(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new TypeError('values must be an object');
  const operatingDays = finiteNonNegative(values.OPERATING_DAYS, 'OPERATING_DAYS');
  const attendance = finiteNonNegative(values.ATTENDANCE, 'ATTENDANCE');
  const admissionsRevenuePerVisitorSar = finiteNonNegative(values.ADMISSIONS_REVENUE_PER_VISITOR_SAR, 'ADMISSIONS_REVENUE_PER_VISITOR_SAR');
  const ancillarySpendPerVisitorSar = finiteNonNegative(values.ANCILLARY_SPEND_PER_VISITOR_SAR, 'ANCILLARY_SPEND_PER_VISITOR_SAR');
  const directOperatingExpensesSar = finiteNonNegative(values.DIRECT_OPERATING_EXPENSES_SAR, 'DIRECT_OPERATING_EXPENSES_SAR');
  const undistributedExpensesSar = finiteNonNegative(values.UNDISTRIBUTED_EXPENSES_SAR, 'UNDISTRIBUTED_EXPENSES_SAR');
  const managementFeesSar = valueOrZero(values, 'MANAGEMENT_FEES_SAR');
  const capitalReserveSar = finiteNonNegative(values.CAPITAL_RESERVE_SAR, 'CAPITAL_RESERVE_SAR');

  const admissionsRevenueSar = attendance * admissionsRevenuePerVisitorSar;
  const ancillaryRevenueSar = attendance * ancillarySpendPerVisitorSar;
  const totalOperatingRevenueSar = admissionsRevenueSar + ancillaryRevenueSar;
  const operatingSurplusBeforeManagementAndReserveSar = totalOperatingRevenueSar - directOperatingExpensesSar - undistributedExpensesSar;
  const operatingSurplusBeforeReserveSar = operatingSurplusBeforeManagementAndReserveSar - managementFeesSar;
  const operatingSurplusAfterReserveSar = operatingSurplusBeforeReserveSar - capitalReserveSar;
  const attendancePerOperatingDay = operatingDays > 0 ? attendance / operatingDays : null;
  const totalRevenuePerVisitorSar = attendance > 0 ? totalOperatingRevenueSar / attendance : null;
  const postReserveOperatingSurplusPerVisitorSar = attendance > 0 ? operatingSurplusAfterReserveSar / attendance : null;

  return Object.freeze({
    family: FORECAST_ENGINE_FAMILY.LEISURE,
    operatingDays,
    attendance,
    attendancePerOperatingDay,
    admissionsRevenuePerVisitorSar,
    ancillarySpendPerVisitorSar,
    admissionsRevenueSar,
    ancillaryRevenueSar,
    totalOperatingRevenueSar,
    directOperatingExpensesSar,
    undistributedExpensesSar,
    operatingSurplusBeforeManagementAndReserveSar,
    managementFeesSar,
    capitalReserveSar,
    operatingSurplusBeforeReserveSar,
    operatingSurplusAfterReserveSar,
    totalRevenuePerVisitorSar,
    postReserveOperatingSurplusPerVisitorSar,
    metricConvention: 'STARTAK_SPECIALIZED_OPERATING_FORECAST_V1',
  });
}

function calculateSpecializedOperatingForecast(family, values) {
  if (family === FORECAST_ENGINE_FAMILY.HOSPITALITY) return calculateHospitalityOperatingForecast(values);
  if (family === FORECAST_ENGINE_FAMILY.LEISURE) return calculateLeisureOperatingForecast(values);
  throw new TypeError(`unsupported specialized forecast family: ${family}`);
}

module.exports = {
  FORECAST_ENGINE_FAMILY,
  calculateHospitalityOperatingForecast,
  calculateLeisureOperatingForecast,
  calculateSpecializedOperatingForecast,
};
