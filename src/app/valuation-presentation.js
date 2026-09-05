'use strict';

const {
  VALUATION_STAGE_STATUS,
  METHOD_STATE,
} = require('../valuation-intelligence');

const STAGE_PRESENTATION_STATE = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  HOLD: 'HOLD',
  UNAVAILABLE: 'UNAVAILABLE',
});

const STAGE_STATUS_TO_PRESENTATION = Object.freeze({
  [VALUATION_STAGE_STATUS.READY_FOR_DECISION_CONTROL]: STAGE_PRESENTATION_STATE.AVAILABLE,
  [VALUATION_STAGE_STATUS.HOLD_INPUTS]: STAGE_PRESENTATION_STATE.HOLD,
  [VALUATION_STAGE_STATUS.HOLD_EVIDENCE]: STAGE_PRESENTATION_STATE.HOLD,
  [VALUATION_STAGE_STATUS.HOLD_POLICY]: STAGE_PRESENTATION_STATE.HOLD,
  [VALUATION_STAGE_STATUS.UNAVAILABLE]: STAGE_PRESENTATION_STATE.UNAVAILABLE,
});

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function statusKey(state) {
  return `valuation.presentation.state.${String(state).toLowerCase()}`;
}

function reasonKey(reasonCode) {
  return reasonCode ? `valuation.presentation.reason.${reasonCode}` : null;
}

function methodKey(method) {
  return `valuation.presentation.method.${method}`;
}

function presentMethod(method, index) {
  requireObject(method, `stage.methods[${index}]`);
  if (!Object.values(METHOD_STATE).includes(method.state)) throw new TypeError(`stage.methods[${index}].state is invalid: ${method.state}`);
  if (typeof method.method !== 'string' || method.method.trim() === '') throw new TypeError(`stage.methods[${index}].method is required`);

  return Object.freeze({
    method: method.method,
    methodKey: methodKey(method.method),
    state: method.state,
    stateKey: statusKey(method.state),
    reasonCode: method.reasonCode || null,
    reasonKey: reasonKey(method.reasonCode),
    evidenceGaps: Object.freeze(Array.isArray(method.evidenceGaps) ? [...method.evidenceGaps] : []),
    hasIndication: Boolean(method.indication),
    indicationValue: method.indication && typeof method.indication.value === 'number' ? method.indication.value : null,
    weakestEvidenceGrade: method.indication?.weakestEvidenceGrade || null,
    evidenceQualityStatus: method.evidenceQuality?.status || null,
  });
}

function createValuationPresentation(stage) {
  requireObject(stage, 'stage');
  if (!Object.prototype.hasOwnProperty.call(STAGE_STATUS_TO_PRESENTATION, stage.status)) {
    throw new TypeError(`stage.status is invalid: ${stage.status}`);
  }
  if (!Array.isArray(stage.methods)) throw new TypeError('stage.methods must be an array');

  const state = STAGE_STATUS_TO_PRESENTATION[stage.status];
  const reasonCodes = Array.isArray(stage.reasonCodes) ? [...stage.reasonCodes] : [];

  return Object.freeze({
    schemaVersion: 1,
    state,
    stateKey: statusKey(state),
    engineStatus: stage.status,
    engineStatusKey: `valuation.presentation.engineStatus.${stage.status}`,
    readyForDecisionControl: stage.readyForDecisionControl === true,
    finalValue: typeof stage.finalValue === 'number' ? stage.finalValue : null,
    reasonCodes: Object.freeze(reasonCodes),
    reasons: Object.freeze(reasonCodes.map((code) => Object.freeze({ code, key: reasonKey(code) }))),
    evidenceGaps: Object.freeze(Array.isArray(stage.evidenceGaps) ? [...stage.evidenceGaps] : []),
    methods: Object.freeze(stage.methods.map(presentMethod)),
    humanDecisionRequired: stage.humanDecisionRequired !== false,
    transactionAuthorized: stage.transactionAuthorized === true,
    semantics: 'Presentation state mirrors the deterministic valuation-stage result. It does not recalculate values, upgrade evidence, or convert a HOLD/UNAVAILABLE result into an available result.',
  });
}

module.exports = {
  STAGE_PRESENTATION_STATE,
  STAGE_STATUS_TO_PRESENTATION,
  createValuationPresentation,
};
