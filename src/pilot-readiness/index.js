'use strict';

const PILOT_STATUS = Object.freeze({
  READY_FOR_CONTROLLED_PILOT: 'READY_FOR_CONTROLLED_PILOT',
  HOLD_SECURITY: 'HOLD_SECURITY',
  HOLD_DATA_SOURCES: 'HOLD_DATA_SOURCES',
  HOLD_VERTICAL_SLICE: 'HOLD_VERTICAL_SLICE',
  HOLD_MONITORING: 'HOLD_MONITORING',
  HOLD_GOVERNANCE: 'HOLD_GOVERNANCE',
});

function evaluateControlledPilotReadiness({
  productionSecurityVerified = false,
  requiredLiveSourcesReady = false,
  verticalSliceVerified = false,
  monitoringVerified = false,
  humanGovernanceVerified = false,
} = {}) {
  const gates = Object.freeze({
    productionSecurityVerified: Boolean(productionSecurityVerified),
    requiredLiveSourcesReady: Boolean(requiredLiveSourcesReady),
    verticalSliceVerified: Boolean(verticalSliceVerified),
    monitoringVerified: Boolean(monitoringVerified),
    humanGovernanceVerified: Boolean(humanGovernanceVerified),
  });

  let status = PILOT_STATUS.READY_FOR_CONTROLLED_PILOT;
  if (!gates.productionSecurityVerified) status = PILOT_STATUS.HOLD_SECURITY;
  else if (!gates.requiredLiveSourcesReady) status = PILOT_STATUS.HOLD_DATA_SOURCES;
  else if (!gates.verticalSliceVerified) status = PILOT_STATUS.HOLD_VERTICAL_SLICE;
  else if (!gates.monitoringVerified) status = PILOT_STATUS.HOLD_MONITORING;
  else if (!gates.humanGovernanceVerified) status = PILOT_STATUS.HOLD_GOVERNANCE;

  const blockers = Object.freeze(Object.entries(gates).filter(([, value]) => !value).map(([key]) => key));
  return Object.freeze({
    schemaVersion: 1,
    status,
    ready: status === PILOT_STATUS.READY_FOR_CONTROLLED_PILOT,
    gates,
    blockers,
    semantics: 'Controlled-pilot readiness is granted only when every required runtime gate is independently verified. Repository code or local tests alone do not satisfy external production gates.',
  });
}

module.exports = { PILOT_STATUS, evaluateControlledPilotReadiness };
