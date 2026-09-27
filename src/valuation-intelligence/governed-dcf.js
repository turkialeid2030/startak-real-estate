'use strict';

const { EVIDENCE_GRADE, INPUT_STATUS, createEvidenceRecord } = require('./contracts');
const { xnpv, solveDatedXirr, normalizeCashflows } = require('./dated-returns');
const { CAP_RATE_GOVERNANCE_STATUS, evaluateEntryExitCapRateGovernance } = require('./cap-rate-governance');

const GOVERNED_DCF_VERSION = 'GOVERNED_DCF_V2';
const GOVERNED_DCF_STATUS = Object.freeze({ QUALIFIED: 'QUALIFIED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', HOLD: 'HOLD' });

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validRate(value) { return typeof value === 'number' && Number.isFinite(value) && value > -1; }
function nonEmpty(value) { return typeof value === 'string' && value.trim() !== ''; }

function strictDateOnly(value) {
  if (typeof value !== 'string' || !/^(\d{4})-(\d{2})-(\d{2})$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return value;
}

function evidence(field, descriptor) {
  if (!descriptor || typeof descriptor !== 'object') return { record: null, blocker: `${field.toUpperCase()}_EVIDENCE_REQUIRED` };
  if (!Object.values(EVIDENCE_GRADE).includes(descriptor.grade)) return { record: null, blocker: `${field.toUpperCase()}_EVIDENCE_GRADE_INVALID` };
  const status = descriptor.status || INPUT_STATUS.OBSERVED;
  if (!Object.values(INPUT_STATUS).includes(status)) return { record: null, blocker: `${field.toUpperCase()}_EVIDENCE_STATUS_INVALID` };
  if (!nonEmpty(descriptor.sourceType) || !nonEmpty(descriptor.sourceRef)) return { record: null, blocker: `${field.toUpperCase()}_PROVENANCE_REQUIRED` };
  try {
    return { record: createEvidenceRecord({ field, grade: descriptor.grade, status, sourceType: descriptor.sourceType, sourceRef: descriptor.sourceRef, observedAt: descriptor.observedAt || null, note: descriptor.note || null }), blocker: null };
  } catch (error) { return { record: null, blocker: `${field.toUpperCase()}_EVIDENCE_INVALID:${error.message}` }; }
}

function calculateGovernedDcf({
  cashflows,
  discountRate,
  discountRateEvidence,
  terminalNoiSar,
  entryCapRate,
  entryEvidence,
  exitCapRate,
  exitEvidence,
  terminalDate,
  terminalSellingCostsRate = 0,
  sameRateRationale = null,
  capCompressionRationale = null,
  maxAbsoluteSpreadBps = null,
} = {}) {
  const blockers = [];
  const warnings = [];
  let normalizedOperatingCashflows = null;
  if (!Array.isArray(cashflows) || cashflows.length < 2) {
    blockers.push('DATED_CASHFLOWS_REQUIRED');
  } else {
    normalizedOperatingCashflows = normalizeCashflows(cashflows.map((row) => ({ amount: row && row.amount, date: row && row.date })));
    if (!normalizedOperatingCashflows) blockers.push('DATED_CASHFLOWS_INVALID');
  }
  if (!validRate(discountRate) || discountRate <= 0) blockers.push('DISCOUNT_RATE_INVALID');
  if (typeof terminalNoiSar !== 'number' || !Number.isFinite(terminalNoiSar) || terminalNoiSar <= 0) blockers.push('TERMINAL_NOI_INVALID');
  if (typeof terminalSellingCostsRate !== 'number' || !Number.isFinite(terminalSellingCostsRate) || terminalSellingCostsRate < 0 || terminalSellingCostsRate >= 1) blockers.push('TERMINAL_SELLING_COST_RATE_INVALID');
  const canonicalTerminalDate = strictDateOnly(terminalDate);
  if (!canonicalTerminalDate) blockers.push('TERMINAL_DATE_INVALID');
  if (canonicalTerminalDate && normalizedOperatingCashflows && normalizedOperatingCashflows.length) {
    const lastCashflowDate = normalizedOperatingCashflows[normalizedOperatingCashflows.length - 1].date;
    if (canonicalTerminalDate < lastCashflowDate) blockers.push('TERMINAL_DATE_PRECEDES_CASHFLOW_HORIZON');
  }

  const discountEvidence = evidence('discountRate', discountRateEvidence);
  if (discountEvidence.blocker) blockers.push(discountEvidence.blocker);
  if (discountEvidence.record && discountEvidence.record.status === INPUT_STATUS.CONFLICT) blockers.push('DISCOUNT_RATE_EVIDENCE_CONFLICT');
  if (discountEvidence.record && [INPUT_STATUS.ASSUMED, INPUT_STATUS.UNVERIFIED].includes(discountEvidence.record.status)) warnings.push('DISCOUNT_RATE_EVIDENCE_REQUIRES_REVIEW');

  const capRateGovernance = evaluateEntryExitCapRateGovernance({ entryCapRate, entryEvidence, exitCapRate, exitEvidence, requireExit: true, sameRateRationale, capCompressionRationale, maxAbsoluteSpreadBps });
  if (capRateGovernance.status === CAP_RATE_GOVERNANCE_STATUS.HOLD) blockers.push('EXIT_CAP_RATE_GOVERNANCE_REQUIRED', ...capRateGovernance.blockers);
  if (capRateGovernance.status === CAP_RATE_GOVERNANCE_STATUS.REVIEW_REQUIRED) warnings.push(...capRateGovernance.warnings);

  if (blockers.length) return deepFreeze({ version: GOVERNED_DCF_VERSION, status: GOVERNED_DCF_STATUS.HOLD, valuationIndicationSar: null, terminalValueSar: null, netTerminalValueSar: null, xirr: null, datedReturnDiagnostics: null, capRateGovernance, blockers, warnings });

  const terminalValueSar = terminalNoiSar / exitCapRate;
  const netTerminalValueSar = terminalValueSar * (1 - terminalSellingCostsRate);
  const dated = normalizedOperatingCashflows.map((row) => ({ amount: row.amount, date: row.date }));
  dated.push({ amount: netTerminalValueSar, date: canonicalTerminalDate });

  const valuationIndicationSar = xnpv(discountRate, dated);
  if (!Number.isFinite(valuationIndicationSar)) blockers.push('DCF_VALUE_NON_FINITE');

  const datedReturnDiagnostics = solveDatedXirr({ cashflows: dated });
  const returnRate = datedReturnDiagnostics.status === 'QUALIFIED' ? datedReturnDiagnostics.xirr : null;
  if (datedReturnDiagnostics.status !== 'QUALIFIED') {
    for (const blocker of datedReturnDiagnostics.blockers || []) warnings.push(`XIRR_${blocker}`);
  }

  const status = blockers.length ? GOVERNED_DCF_STATUS.HOLD : warnings.length ? GOVERNED_DCF_STATUS.REVIEW_REQUIRED : GOVERNED_DCF_STATUS.QUALIFIED;
  return deepFreeze({
    version: GOVERNED_DCF_VERSION,
    status,
    valuationIndicationSar: blockers.length ? null : valuationIndicationSar,
    terminalNoiSar,
    terminalValueSar,
    terminalSellingCostsRate,
    netTerminalValueSar,
    terminalDate: canonicalTerminalDate,
    discountRate,
    discountRateEvidence: discountEvidence.record,
    xirr: returnRate,
    datedReturnDiagnostics,
    dayCount: 'ACT/365.2425',
    capRateGovernance,
    blockers,
    warnings,
    semantics: 'DCF uses strict date-only cash flows, ACT/365.2425 dated discounting, an independently evidenced discount rate, and an independently evidenced exit capitalization rate. XIRR is diagnostic and does not block a valid DCF when a unique IRR is unavailable. QUALIFIED is an engineering/evidence status, not a certified valuation or investment approval.',
  });
}

module.exports = { GOVERNED_DCF_VERSION, GOVERNED_DCF_STATUS, calculateGovernedDcf };
