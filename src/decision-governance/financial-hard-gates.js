'use strict';

const FINANCIAL_GATE_STATUS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', INCOMPLETE: 'INCOMPLETE' });

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function positive(value) { return finite(value) && value > 0; }
function nonNegative(value) { return finite(value) && value >= 0; }

function evaluateFinancialHardGates(input = {}) {
  const failures = [];
  const incomplete = [];

  const requireFinite = (key, code) => {
    if (input[key] == null) incomplete.push(`${code}_MISSING`);
    else if (!finite(input[key])) failures.push(`${code}_NON_FINITE`);
  };

  requireFinite('npv', 'NPV');
  if (finite(input.npv) && input.npv < 0) failures.push('NPV_NEGATIVE');

  if (input.leverageEnabled === true) {
    requireFinite('leveredNPV', 'LEVERED_NPV');
    if (finite(input.leveredNPV) && input.leveredNPV < 0) failures.push('LEVERED_NPV_NEGATIVE');
    requireFinite('dscr', 'DSCR');
    requireFinite('minDscrThreshold', 'DSCR_THRESHOLD');
    if (finite(input.dscr) && finite(input.minDscrThreshold) && input.dscr < input.minDscrThreshold) failures.push('DSCR_BELOW_THRESHOLD');
    if (!positive(input.loanAmount)) failures.push('LOAN_AMOUNT_INVALID');
  }

  if (input.irrReliability === 'MULTIPLE_ROOT_RISK' || input.irrReliability === 'OUT_OF_SOLVER_RANGE' || input.irrReliability === 'INVALID') {
    failures.push('IRR_UNRELIABLE');
  } else {
    requireFinite('irr', 'IRR');
  }
  requireFinite('requiredReturn', 'REQUIRED_RETURN');
  if (finite(input.irr) && finite(input.requiredReturn) && input.irr < input.requiredReturn) failures.push('IRR_BELOW_REQUIRED_RETURN');

  if (input.mirr != null && !finite(input.mirr)) failures.push('MIRR_NON_FINITE');
  if (finite(input.mirr) && finite(input.requiredReturn) && input.irrReliability !== 'RELIABLE' && input.mirr < input.requiredReturn) failures.push('MIRR_BELOW_REQUIRED_RETURN');

  requireFinite('noi', 'NOI');
  if (finite(input.noi) && input.noi <= 0) failures.push('NOI_NON_POSITIVE');

  if (!positive(input.exitCapRate)) incomplete.push('EXIT_CAP_RATE_MISSING_OR_INVALID');
  if (input.terminalValue == null) incomplete.push('TERMINAL_VALUE_MISSING');
  else if (!finite(input.terminalValue)) failures.push('TERMINAL_VALUE_NON_FINITE');
  else if (input.terminalValue < 0) failures.push('TERMINAL_VALUE_NEGATIVE');

  if (!positive(input.acquisitionBasis)) failures.push('ACQUISITION_BASIS_INVALID');
  if (!positive(input.holdingPeriod)) failures.push('HOLDING_PERIOD_INVALID');
  if (input.rentableArea != null && !nonNegative(input.rentableArea)) failures.push('RENTABLE_AREA_INVALID');
  if (input.leasedArea != null && !nonNegative(input.leasedArea)) failures.push('LEASED_AREA_INVALID');
  if (finite(input.leasedArea) && finite(input.rentableArea) && input.leasedArea > input.rentableArea) failures.push('LEASED_AREA_EXCEEDS_RENTABLE_AREA');

  for (const [key, value] of Object.entries(input.percentages || {})) {
    if (!finite(value) || value < 0 || value > 1) failures.push(`PERCENTAGE_INVALID:${key}`);
  }

  const uniqueFailures = Object.freeze([...new Set(failures)]);
  const uniqueIncomplete = Object.freeze([...new Set(incomplete)]);
  const status = uniqueFailures.length ? FINANCIAL_GATE_STATUS.FAIL : uniqueIncomplete.length ? FINANCIAL_GATE_STATUS.INCOMPLETE : FINANCIAL_GATE_STATUS.PASS;
  return Object.freeze({ status, failures: uniqueFailures, incomplete: uniqueIncomplete, failClosed: status !== FINANCIAL_GATE_STATUS.PASS });
}

module.exports = { FINANCIAL_GATE_STATUS, evaluateFinancialHardGates };
