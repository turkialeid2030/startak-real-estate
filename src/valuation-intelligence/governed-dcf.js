'use strict';

const { EVIDENCE_GRADE, INPUT_STATUS, createEvidenceRecord } = require('./contracts');
const { xnpv, xirr } = require('../engines/financial/financial-integrity');
const { CAP_RATE_GOVERNANCE_STATUS, evaluateEntryExitCapRateGovernance } = require('./cap-rate-governance');

const GOVERNED_DCF_VERSION = 'GOVERNED_DCF_V1';
const GOVERNED_DCF_STATUS = Object.freeze({ QUALIFIED: 'QUALIFIED', REVIEW_REQUIRED: 'REVIEW_REQUIRED', HOLD: 'HOLD' });

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validRate(value) { return typeof value === 'number' && Number.isFinite(value) && value > -1; }
function nonEmpty(value) { return typeof value === 'string' && value.trim() !== ''; }

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
  if (!Array.isArray(cashflows) || cashflows.length < 2) blockers.push('DATED_CASHFLOWS_REQUIRED');
  if (!validRate(discountRate) || discountRate <= 0) blockers.push('DISCOUNT_RATE_INVALID');
  if (typeof terminalNoiSar !== 'number' || !Number.isFinite(terminalNoiSar) || terminalNoiSar <= 0) blockers.push('TERMINAL_NOI_INVALID');
  if (typeof terminalSellingCostsRate !== 'number' || !Number.isFinite(terminalSellingCostsRate) || terminalSellingCostsRate < 0 || terminalSellingCostsRate >= 1) blockers.push('TERMINAL_SELLING_COST_RATE_INVALID');
  const terminal = new Date(terminalDate);
  if (!Number.isFinite(terminal.getTime())) blockers.push('TERMINAL_DATE_INVALID');

  const discountEvidence = evidence('discountRate', discountRateEvidence);
  if (discountEvidence.blocker) blockers.push(discountEvidence.blocker);
  if (discountEvidence.record && discountEvidence.record.status === INPUT_STATUS.CONFLICT) blockers.push('DISCOUNT_RATE_EVIDENCE_CONFLICT');
  if (discountEvidence.record && [INPUT_STATUS.ASSUMED, INPUT_STATUS.UNVERIFIED].includes(discountEvidence.record.status)) warnings.push('DISCOUNT_RATE_EVIDENCE_REQUIRES_REVIEW');

  const capRateGovernance = evaluateEntryExitCapRateGovernance({ entryCapRate, entryEvidence, exitCapRate, exitEvidence, requireExit: true, sameRateRationale, capCompressionRationale, maxAbsoluteSpreadBps });
  if (capRateGovernance.status === CAP_RATE_GOVERNANCE_STATUS.HOLD) blockers.push('EXIT_CAP_RATE_GOVERNANCE_REQUIRED', ...capRateGovernance.blockers);
  if (capRateGovernance.status === CAP_RATE_GOVERNANCE_STATUS.REVIEW_REQUIRED) warnings.push(...capRateGovernance.warnings);

  if (blockers.length) return deepFreeze({ version: GOVERNED_DCF_VERSION, status: GOVERNED_DCF_STATUS.HOLD, valuationIndicationSar: null, terminalValueSar: null, netTerminalValueSar: null, xirr: null, capRateGovernance, blockers, warnings });

  const terminalValueSar = terminalNoiSar / exitCapRate;
  const netTerminalValueSar = terminalValueSar * (1 - terminalSellingCostsRate);
  const dated = cashflows.map((row) => ({ amount: row.amount, date: row.date }));
  dated.push({ amount: netTerminalValueSar, date: terminal.toISOString() });

  let valuationIndicationSar;
  let returnRate;
  try {
    valuationIndicationSar = xnpv(discountRate, dated);
    returnRate = xirr(dated);
  } catch (error) {
    return deepFreeze({ version: GOVERNED_DCF_VERSION, status: GOVERNED_DCF_STATUS.HOLD, valuationIndicationSar: null, terminalValueSar: null, netTerminalValueSar: null, xirr: null, capRateGovernance, blockers: [`DCF_CALCULATION_FAILED:${error.message}`], warnings });
  }

  if (!Number.isFinite(valuationIndicationSar)) blockers.push('DCF_VALUE_NON_FINITE');
  if (returnRate === null) warnings.push('XIRR_NOT_BRACKETED');
  const status = blockers.length ? GOVERNED_DCF_STATUS.HOLD : warnings.length ? GOVERNED_DCF_STATUS.REVIEW_REQUIRED : GOVERNED_DCF_STATUS.QUALIFIED;
  return deepFreeze({
    version: GOVERNED_DCF_VERSION,
    status,
    valuationIndicationSar: blockers.length ? null : valuationIndicationSar,
    terminalNoiSar,
    terminalValueSar,
    terminalSellingCostsRate,
    netTerminalValueSar,
    discountRate,
    discountRateEvidence: discountEvidence.record,
    xirr: returnRate,
    capRateGovernance,
    blockers,
    warnings,
    semantics: 'DCF uses dated cash flows, an independently evidenced discount rate, and an independently evidenced exit capitalization rate. QUALIFIED is an engineering/evidence status, not a certified valuation or investment approval.',
  });
}

module.exports = { GOVERNED_DCF_VERSION, GOVERNED_DCF_STATUS, calculateGovernedDcf };
