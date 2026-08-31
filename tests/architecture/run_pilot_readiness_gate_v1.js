'use strict';
const assert = require('assert');
const { PILOT_STATUS, evaluateControlledPilotReadiness } = require('../../src/pilot-readiness');
let checks = 0;
function check(fn) { fn(); checks++; }

const currentLike = evaluateControlledPilotReadiness({
  productionSecurityVerified: false,
  requiredLiveSourcesReady: false,
  verticalSliceVerified: false,
  monitoringVerified: false,
  humanGovernanceVerified: true,
});
check(() => assert.strictEqual(currentLike.ready, false));
check(() => assert.strictEqual(currentLike.status, PILOT_STATUS.HOLD_SECURITY));
check(() => assert.ok(currentLike.blockers.includes('productionSecurityVerified')));
check(() => assert.ok(currentLike.blockers.includes('requiredLiveSourcesReady')));
check(() => assert.ok(currentLike.blockers.includes('verticalSliceVerified')));

const securityOnly = evaluateControlledPilotReadiness({
  productionSecurityVerified: true,
  requiredLiveSourcesReady: false,
  verticalSliceVerified: true,
  monitoringVerified: true,
  humanGovernanceVerified: true,
});
check(() => assert.strictEqual(securityOnly.status, PILOT_STATUS.HOLD_DATA_SOURCES));

const verticalHold = evaluateControlledPilotReadiness({
  productionSecurityVerified: true,
  requiredLiveSourcesReady: true,
  verticalSliceVerified: false,
  monitoringVerified: true,
  humanGovernanceVerified: true,
});
check(() => assert.strictEqual(verticalHold.status, PILOT_STATUS.HOLD_VERTICAL_SLICE));

const monitoringHold = evaluateControlledPilotReadiness({
  productionSecurityVerified: true,
  requiredLiveSourcesReady: true,
  verticalSliceVerified: true,
  monitoringVerified: false,
  humanGovernanceVerified: true,
});
check(() => assert.strictEqual(monitoringHold.status, PILOT_STATUS.HOLD_MONITORING));

const governanceHold = evaluateControlledPilotReadiness({
  productionSecurityVerified: true,
  requiredLiveSourcesReady: true,
  verticalSliceVerified: true,
  monitoringVerified: true,
  humanGovernanceVerified: false,
});
check(() => assert.strictEqual(governanceHold.status, PILOT_STATUS.HOLD_GOVERNANCE));

const ready = evaluateControlledPilotReadiness({
  productionSecurityVerified: true,
  requiredLiveSourcesReady: true,
  verticalSliceVerified: true,
  monitoringVerified: true,
  humanGovernanceVerified: true,
});
check(() => assert.strictEqual(ready.status, PILOT_STATUS.READY_FOR_CONTROLLED_PILOT));
check(() => assert.strictEqual(ready.ready, true));
check(() => assert.deepStrictEqual(ready.blockers, []));
check(() => assert.ok(Object.isFrozen(ready)));
check(() => assert.ok(Object.isFrozen(ready.gates)));

console.log(`PILOT_READINESS_GATE_V1: PASS (${checks} checks)`);
