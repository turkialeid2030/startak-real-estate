'use strict';

const {
  RENT_FREQUENCY,
  RENT_ESCALATION_TYPE,
  OPERATING_INPUT_STATUS,
  UNIT_OPERATING_STATUS,
  LEASE_LIFECYCLE_STATUS,
  deepFreeze,
} = require('./contracts');

const OPERATING_METRICS_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  NOT_CALCULABLE: 'NOT_CALCULABLE',
});

const ANNUALIZATION_FACTOR = Object.freeze({
  [RENT_FREQUENCY.MONTHLY]: 12,
  [RENT_FREQUENCY.QUARTERLY]: 4,
  [RENT_FREQUENCY.SEMI_ANNUAL]: 2,
  [RENT_FREQUENCY.ANNUAL]: 1,
});

const RENT_UNIT_BY_FREQUENCY = Object.freeze({
  [RENT_FREQUENCY.MONTHLY]: 'SAR/month',
  [RENT_FREQUENCY.QUARTERLY]: 'SAR/quarter',
  [RENT_FREQUENCY.SEMI_ANNUAL]: 'SAR/half-year',
  [RENT_FREQUENCY.ANNUAL]: 'SAR/year',
});

const ADOPTABLE_STATUSES = new Set([
  OPERATING_INPUT_STATUS.VERIFIED_FACT,
  OPERATING_INPUT_STATUS.ASSUMED,
]);

function date(value, field) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError(`${field} must be a valid date`);
  return parsed;
}

function addUtcYears(value, years) {
  const result = new Date(value.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function addUtcMonths(value, months) {
  const result = new Date(value.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function completedIntervals(startDate, asOfDate, intervalYears) {
  let count = 0;
  let next = addUtcYears(startDate, intervalYears);
  while (next.getTime() <= asOfDate.getTime()) {
    count += 1;
    if (count > 1000) throw new RangeError('rent escalation interval count exceeds safety limit');
    next = addUtcYears(next, intervalYears);
  }
  return count;
}

function annualizePeriodicRent(periodicRent, frequency) {
  if (typeof periodicRent !== 'number' || !Number.isFinite(periodicRent) || periodicRent < 0) {
    throw new TypeError('periodicRent must be a finite number >= 0');
  }
  const factor = ANNUALIZATION_FACTOR[frequency];
  if (!factor) throw new TypeError(`UNSUPPORTED_RENT_FREQUENCY: ${frequency}`);
  return periodicRent * factor;
}

function isAdoptedValue(value) {
  return Boolean(
    value
    && value.adoptedForUnderwriting === true
    && ADOPTABLE_STATUSES.has(value.verificationStatus)
    && typeof value.value === 'number'
    && Number.isFinite(value.value),
  );
}

function periodicRentAtDate(lease, asOfDate) {
  const base = lease.baseRent.value;
  const escalation = lease.escalation;
  switch (escalation.type) {
    case RENT_ESCALATION_TYPE.NONE:
      return base;
    case RENT_ESCALATION_TYPE.FIXED_PERCENT: {
      const steps = completedIntervals(date(lease.startDate, 'lease.startDate'), asOfDate, escalation.intervalYears);
      return base * ((1 + escalation.changeValue.value) ** steps);
    }
    case RENT_ESCALATION_TYPE.FIXED_AMOUNT: {
      const steps = completedIntervals(date(lease.startDate, 'lease.startDate'), asOfDate, escalation.intervalYears);
      return base + (escalation.changeValue.value * steps);
    }
    case RENT_ESCALATION_TYPE.STEP_RENT:
    case RENT_ESCALATION_TYPE.MANUAL_SCHEDULE: {
      let current = base;
      for (const entry of escalation.schedule) {
        if (date(entry.effectiveDate, 'escalation.schedule.effectiveDate').getTime() <= asOfDate.getTime()) current = entry.rent.value;
      }
      return current;
    }
    default:
      throw new TypeError(`UNSUPPORTED_RENT_ESCALATION: ${escalation.type}`);
  }
}

function addIssue(issues, code, field, refId = null) {
  if (!issues.some((item) => item.code === code && item.field === field && item.refId === refId)) {
    issues.push({ code, field, refId });
  }
}

function validateInputs(operatingCase, asOfDate) {
  const issues = [];
  if (!operatingCase.units.length) addIssue(issues, 'RENTABLE_UNIT_INVENTORY_REQUIRED', 'units');

  for (const unit of operatingCase.units) {
    if (!isAdoptedValue(unit.rentableArea) || unit.rentableArea.value < 0) {
      addIssue(issues, 'ADOPTED_RENTABLE_AREA_REQUIRED', `unit.${unit.unitId}.rentableArea`, unit.rentableArea.sourceRef);
    }
    const status = unit.operatingStatus;
    if (!status || status.adoptedForUnderwriting !== true || !ADOPTABLE_STATUSES.has(status.verificationStatus)
      || !Object.values(UNIT_OPERATING_STATUS).includes(status.value) || status.value === UNIT_OPERATING_STATUS.UNKNOWN) {
      addIssue(issues, 'ADOPTED_UNIT_STATUS_REQUIRED', `unit.${unit.unitId}.operatingStatus`, status && status.sourceRef);
    }
    const activeLeases = operatingCase.leases.filter((lease) => lease.unitId === unit.unitId && lease.lifecycleStatus === LEASE_LIFECYCLE_STATUS.ACTIVE);
    if (activeLeases.length > 1) addIssue(issues, 'MULTIPLE_ACTIVE_LEASES_ON_UNIT', `unit.${unit.unitId}`);
    if (status && status.value === UNIT_OPERATING_STATUS.OCCUPIED && activeLeases.length !== 1) {
      addIssue(issues, 'OCCUPIED_UNIT_REQUIRES_ONE_ACTIVE_LEASE', `unit.${unit.unitId}`);
    }
    if (status && [UNIT_OPERATING_STATUS.VACANT, UNIT_OPERATING_STATUS.OFFLINE].includes(status.value) && activeLeases.length > 0) {
      addIssue(issues, 'NON_OCCUPIED_UNIT_CANNOT_HAVE_ACTIVE_LEASE', `unit.${unit.unitId}`);
    }
  }

  for (const lease of operatingCase.leases.filter((item) => item.lifecycleStatus === LEASE_LIFECYCLE_STATUS.ACTIVE)) {
    if (!lease.startDate || !lease.endDate) addIssue(issues, 'ACTIVE_LEASE_DATES_REQUIRED', `lease.${lease.leaseId}`);
    if (lease.startDate && lease.endDate) {
      const start = date(lease.startDate, 'lease.startDate');
      const end = date(lease.endDate, 'lease.endDate');
      if (asOfDate.getTime() < start.getTime() || asOfDate.getTime() >= end.getTime()) {
        addIssue(issues, 'ACTIVE_LEASE_DATE_CONTRADICTION', `lease.${lease.leaseId}`);
      }
    }
    if (!lease.termsEvidenceRef || !lease.termsAdoptionDecisionRef) addIssue(issues, 'ADOPTED_LEASE_TERMS_REQUIRED', `lease.${lease.leaseId}`, lease.termsEvidenceRef);
    if (!isAdoptedValue(lease.baseRent) || lease.baseRent.value < 0) addIssue(issues, 'ADOPTED_BASE_RENT_REQUIRED', `lease.${lease.leaseId}.baseRent`, lease.baseRent.sourceRef);
    if (!ANNUALIZATION_FACTOR[lease.rentFrequency]) addIssue(issues, 'SUPPORTED_RENT_FREQUENCY_REQUIRED', `lease.${lease.leaseId}.rentFrequency`);
    const expectedRentUnit = RENT_UNIT_BY_FREQUENCY[lease.rentFrequency];
    if (expectedRentUnit && lease.baseRent.unit !== expectedRentUnit) {
      addIssue(issues, 'RENT_UNIT_FREQUENCY_MISMATCH', `lease.${lease.leaseId}.baseRent`, lease.baseRent.sourceRef);
    }
    if (lease.escalation.type === RENT_ESCALATION_TYPE.INDEXED) addIssue(issues, 'INDEX_VALUE_ADOPTION_REQUIRED', `lease.${lease.leaseId}.escalation`, lease.escalation.indexEvidenceRef);
    if ([RENT_ESCALATION_TYPE.FIXED_PERCENT, RENT_ESCALATION_TYPE.FIXED_AMOUNT].includes(lease.escalation.type)
      && !isAdoptedValue(lease.escalation.changeValue)) {
      addIssue(issues, 'ADOPTED_ESCALATION_VALUE_REQUIRED', `lease.${lease.leaseId}.escalation`, lease.escalation.changeValue && lease.escalation.changeValue.sourceRef);
    }
    if (lease.escalation.type === RENT_ESCALATION_TYPE.FIXED_AMOUNT
      && expectedRentUnit && lease.escalation.changeValue && lease.escalation.changeValue.unit !== expectedRentUnit) {
      addIssue(issues, 'FIXED_AMOUNT_ESCALATION_UNIT_MISMATCH', `lease.${lease.leaseId}.escalation`, lease.escalation.changeValue.sourceRef);
    }
    if (lease.escalation.type === RENT_ESCALATION_TYPE.FIXED_PERCENT
      && lease.escalation.changeValue && lease.escalation.changeValue.unit !== 'ratio') {
      addIssue(issues, 'FIXED_PERCENT_ESCALATION_REQUIRES_RATIO', `lease.${lease.leaseId}.escalation`, lease.escalation.changeValue.sourceRef);
    }
    if ([RENT_ESCALATION_TYPE.STEP_RENT, RENT_ESCALATION_TYPE.MANUAL_SCHEDULE].includes(lease.escalation.type)) {
      for (const entry of lease.escalation.schedule) {
        if (!isAdoptedValue(entry.rent)) addIssue(issues, 'ADOPTED_SCHEDULE_RENT_REQUIRED', `lease.${lease.leaseId}.escalation.schedule`, entry.rent.sourceRef);
        if (expectedRentUnit && entry.rent.unit !== expectedRentUnit) {
          addIssue(issues, 'SCHEDULE_RENT_UNIT_MISMATCH', `lease.${lease.leaseId}.escalation.schedule`, entry.rent.sourceRef);
        }
      }
    }
    if (lease.startDate && isAdoptedValue(lease.baseRent)
      && ![RENT_ESCALATION_TYPE.INDEXED].includes(lease.escalation.type)) {
      try {
        const currentRent = periodicRentAtDate(lease, asOfDate);
        if (!Number.isFinite(currentRent) || currentRent < 0) addIssue(issues, 'CURRENT_CONTRACT_RENT_INVALID', `lease.${lease.leaseId}`);
      } catch (error) {
        addIssue(issues, 'CURRENT_CONTRACT_RENT_NOT_CALCULABLE', `lease.${lease.leaseId}`);
      }
    }
  }
  return issues;
}

function emptyResult(operatingCase, issues) {
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status: OPERATING_METRICS_STATUS.NOT_CALCULABLE,
    issues,
    rentRoll: null,
    occupancy: null,
    leaseTiming: null,
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    investmentDecision: null,
    semantics: 'Operating metrics were not calculated because required adopted unit or lease inputs are unavailable or unsupported.',
  });
}

function buildRentRoll(operatingCase, asOfDate) {
  const rows = operatingCase.units.map((unit) => {
    const activeLeases = operatingCase.leases.filter((lease) => lease.unitId === unit.unitId && lease.lifecycleStatus === LEASE_LIFECYCLE_STATUS.ACTIVE);
    const lease = activeLeases[0] || null;
    const periodicRent = lease ? periodicRentAtDate(lease, asOfDate) : 0;
    const annualRent = lease ? annualizePeriodicRent(periodicRent, lease.rentFrequency) : 0;
    return {
      unitId: unit.unitId,
      buildingId: unit.buildingId,
      unitType: unit.unitType,
      operatingStatus: unit.operatingStatus.value,
      rentableAreaSqm: unit.rentableArea.value,
      leaseId: lease ? lease.leaseId : null,
      tenantId: lease ? lease.tenantId : null,
      leaseStartDate: lease ? lease.startDate : null,
      leaseEndDate: lease ? lease.endDate : null,
      rentFrequency: lease ? lease.rentFrequency : null,
      currentPeriodicRent: periodicRent,
      currentAnnualContractRent: annualRent,
      escalationType: lease ? lease.escalation.type : null,
      baseRentSourceRef: lease ? lease.baseRent.sourceRef : null,
    };
  });
  const totalAnnualContractRent = rows.reduce((sum, row) => sum + row.currentAnnualContractRent, 0);
  const totalRentableAreaSqm = rows.reduce((sum, row) => sum + row.rentableAreaSqm, 0);
  return {
    rows,
    totals: {
      unitCount: rows.length,
      totalRentableAreaSqm,
      totalAnnualContractRent,
      annualRentPerSqm: totalRentableAreaSqm > 0 ? totalAnnualContractRent / totalRentableAreaSqm : null,
    },
    internalReconciliation: {
      status: 'RECONCILED',
      rowAnnualRentSum: totalAnnualContractRent,
      difference: 0,
    },
    sourceTotalReconciliation: {
      status: 'NOT_AVAILABLE',
      sourceAnnualRentTotal: null,
      difference: null,
    },
  };
}

function buildOccupancy(rentRoll) {
  const rows = rentRoll.rows;
  const totalUnits = rows.length;
  const occupied = rows.filter((row) => row.operatingStatus === UNIT_OPERATING_STATUS.OCCUPIED);
  const vacant = rows.filter((row) => row.operatingStatus === UNIT_OPERATING_STATUS.VACANT);
  const offline = rows.filter((row) => row.operatingStatus === UNIT_OPERATING_STATUS.OFFLINE);
  const contracted = rows.filter((row) => row.leaseId !== null);
  const totalArea = rentRoll.totals.totalRentableAreaSqm;
  const occupiedArea = occupied.reduce((sum, row) => sum + row.rentableAreaSqm, 0);
  const contractedArea = contracted.reduce((sum, row) => sum + row.rentableAreaSqm, 0);
  return {
    inventory: {
      totalUnits,
      occupiedUnits: occupied.length,
      vacantUnits: vacant.length,
      offlineUnits: offline.length,
      totalRentableAreaSqm: totalArea,
      occupiedAreaSqm: occupiedArea,
      contractedAreaSqm: contractedArea,
    },
    physicalOccupancyByUnits: totalUnits > 0 ? occupied.length / totalUnits : null,
    physicalOccupancyByArea: totalArea > 0 ? occupiedArea / totalArea : null,
    contractedOccupancyByArea: totalArea > 0 ? contractedArea / totalArea : null,
    economicOccupancy: null,
    economicOccupancyStatus: 'NOT_CALCULABLE_WITHOUT_COLLECTION_AND_POTENTIAL_RENT',
    denominatorPolicy: 'Physical occupancy includes offline units in total inventory so deferred maintenance or downtime is not hidden from the acquisition view.',
  };
}

function remainingYears(asOfDate, endDate) {
  return Math.max(0, (endDate.getTime() - asOfDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function buildLeaseTiming(rentRoll, asOfDate, leaseCliffThreshold) {
  const active = rentRoll.rows.filter((row) => row.leaseId !== null && row.leaseEndDate);
  const totalRent = active.reduce((sum, row) => sum + row.currentAnnualContractRent, 0);
  const totalArea = active.reduce((sum, row) => sum + row.rentableAreaSqm, 0);
  const enriched = active.map((row) => ({ ...row, remainingTermYears: remainingYears(asOfDate, date(row.leaseEndDate, 'leaseEndDate')) }));
  const waleYears = totalRent > 0
    ? enriched.reduce((sum, row) => sum + (row.currentAnnualContractRent * row.remainingTermYears), 0) / totalRent
    : null;
  const waltYears = totalArea > 0
    ? enriched.reduce((sum, row) => sum + (row.rentableAreaSqm * row.remainingTermYears), 0) / totalArea
    : null;

  const expiryByYear = {};
  for (const row of enriched) {
    const year = String(date(row.leaseEndDate, 'leaseEndDate').getUTCFullYear());
    if (!expiryByYear[year]) expiryByYear[year] = { year: Number(year), leaseCount: 0, annualRentExpiring: 0, areaExpiringSqm: 0 };
    expiryByYear[year].leaseCount += 1;
    expiryByYear[year].annualRentExpiring += row.currentAnnualContractRent;
    expiryByYear[year].areaExpiringSqm += row.rentableAreaSqm;
  }
  const buckets = Object.values(expiryByYear).sort((a, b) => a.year - b.year).map((bucket) => ({
    ...bucket,
    rentExposureRatio: totalRent > 0 ? bucket.annualRentExpiring / totalRent : null,
    areaExposureRatio: totalArea > 0 ? bucket.areaExpiringSqm / totalArea : null,
  }));

  const exposureWithinMonths = (months) => {
    const boundary = addUtcMonths(asOfDate, months).getTime();
    const rowsWithin = enriched.filter((row) => date(row.leaseEndDate, 'leaseEndDate').getTime() <= boundary);
    const rent = rowsWithin.reduce((sum, row) => sum + row.currentAnnualContractRent, 0);
    const area = rowsWithin.reduce((sum, row) => sum + row.rentableAreaSqm, 0);
    return {
      months,
      leaseCount: rowsWithin.length,
      annualRentExpiring: rent,
      rentExposureRatio: totalRent > 0 ? rent / totalRent : null,
      areaExpiringSqm: area,
      areaExposureRatio: totalArea > 0 ? area / totalArea : null,
    };
  };

  return {
    activeLeaseCount: enriched.length,
    totalActiveAnnualRent: totalRent,
    totalContractedAreaSqm: totalArea,
    waleYears,
    waltYears,
    expiryExposure: [12, 24, 36].map(exposureWithinMonths),
    expiryByYear: buckets,
    leaseCliffThreshold,
    leaseCliffs: buckets.filter((bucket) => bucket.rentExposureRatio !== null && bucket.rentExposureRatio >= leaseCliffThreshold),
    weightingPolicy: {
      wale: 'Current annual contract rent weighted remaining lease term.',
      walt: 'Contracted rentable area weighted remaining lease term.',
    },
  };
}

function calculateOperatingMetrics(operatingCase, { leaseCliffThreshold = 0.25 } = {}) {
  if (!operatingCase || operatingCase.contractType !== 'RESIDENTIAL_INCOME_OPERATING_CASE_V1') {
    throw new TypeError('operatingCase must be created by createResidentialIncomeOperatingCase');
  }
  if (typeof leaseCliffThreshold !== 'number' || !Number.isFinite(leaseCliffThreshold) || leaseCliffThreshold <= 0 || leaseCliffThreshold > 1) {
    throw new RangeError('leaseCliffThreshold must be > 0 and <= 1');
  }
  const asOfDate = date(operatingCase.asOfDate, 'operatingCase.asOfDate');
  const issues = validateInputs(operatingCase, asOfDate);
  if (issues.length) return emptyResult(operatingCase, issues);

  const rentRoll = buildRentRoll(operatingCase, asOfDate);
  const occupancy = buildOccupancy(rentRoll);
  const leaseTiming = buildLeaseTiming(rentRoll, asOfDate, leaseCliffThreshold);
  return deepFreeze({
    schemaVersion: 1,
    caseId: operatingCase.caseId,
    asOfDate: operatingCase.asOfDate,
    status: OPERATING_METRICS_STATUS.CALCULATED,
    issues: [],
    rentRoll,
    occupancy,
    leaseTiming,
    financialCalculationExecuted: false,
    stabilizedNoiCalculated: false,
    investmentDecision: null,
    semantics: 'Deterministic unit/lease operating metrics only. Contract rent is not collected rent, physical occupancy is not economic occupancy, and these outputs do not calculate stabilized NOI, value, returns, or an investment decision.',
  });
}

module.exports = {
  OPERATING_METRICS_STATUS,
  ANNUALIZATION_FACTOR,
  RENT_UNIT_BY_FREQUENCY,
  annualizePeriodicRent,
  calculateOperatingMetrics,
};
