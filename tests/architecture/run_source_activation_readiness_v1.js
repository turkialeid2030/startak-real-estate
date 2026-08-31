'use strict';
const assert = require('assert');
const registry = require('../../src/registries/source-registry.json');
const { SOURCE_STATUS, assessSourceActivation, assessRegistryActivation } = require('../../src/source-intelligence/activation-readiness');
let checks = 0;
function check(fn) { fn(); checks++; }

const current = assessRegistryActivation(registry);
check(() => assert.strictEqual(current.total, registry.length));
check(() => assert.strictEqual(current.liveReady, 0));
check(() => assert.strictEqual(current.manualReferenceOnly, registry.length));
check(() => assert.strictEqual(current.results.every((r) => r.canClaimLive === false), true));
check(() => assert.strictEqual(current.results.every((r) => r.status === SOURCE_STATUS.MANUAL_REFERENCE_ONLY), true));

const connectedNoLicense = assessSourceActivation({
  source_id: 'SYN-1', connector_status: 'CONNECTED', live_access: true,
  license_status: 'NOT_ASSESSED', last_verified: '2026-09-01', fallback: 'NONE',
});
check(() => assert.strictEqual(connectedNoLicense.status, SOURCE_STATUS.HOLD_LICENSE));
check(() => assert.strictEqual(connectedNoLicense.canClaimLive, false));

const connectedNoVerification = assessSourceActivation({
  source_id: 'SYN-2', connector_status: 'CONNECTED', live_access: true,
  license_status: 'PERMITTED', last_verified: null, fallback: 'NONE',
});
check(() => assert.strictEqual(connectedNoVerification.status, SOURCE_STATUS.HOLD_VERIFICATION));

const live = assessSourceActivation({
  source_id: 'SYN-3', connector_status: 'CONNECTED', live_access: true,
  license_status: 'PERMITTED', last_verified: '2026-09-01', fallback: 'NONE',
});
check(() => assert.strictEqual(live.status, SOURCE_STATUS.LIVE_READY));
check(() => assert.strictEqual(live.canClaimLive, true));

const disconnected = assessSourceActivation({
  source_id: 'SYN-4', connector_status: 'NOT_CONNECTED', live_access: false,
  license_status: 'PERMITTED', last_verified: '2026-09-01', fallback: 'NONE',
});
check(() => assert.strictEqual(disconnected.status, SOURCE_STATUS.HOLD_CONNECTION));

console.log(`SOURCE_ACTIVATION_READINESS_V1: PASS (${checks} checks)`);
