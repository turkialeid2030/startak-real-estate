'use strict';

const assert = require('assert');
const {
  prepareNewUiDealForSave,
  prepareUpdatedUiDealForSave,
} = require('../../src/assumptions/ui-integration-controller');
const { validateSavedDealRecord, SavedDealValidationError } = require('../../src/validation/saved-deal-schema');

const savedAt = '2026-09-16T11:15:00.000Z';
const base = {
  id: 'deal-audit-1',
  name: 'Audit integration fixture',
  mode: 'building',
  inputs: { buildingPrice: 1000000, rentPerSqm: 1000 },
  savedAt,
};

const created = prepareNewUiDealForSave(base);
assert.strictEqual(created.localAuditEvent.trailType, 'LOCAL_HISTORY');
assert.strictEqual(created.localAuditEvent.enterpriseAuditTrail, false);
assert.strictEqual(created.localAuditEvent.actionType, 'DEAL_CREATED');
assert.strictEqual(created.localAuditEvent.dealId, base.id);
assert.strictEqual(created.localAuditEvent.versionId, `${base.id}:${savedAt}`);
assert.strictEqual(created.localAuditEvent.modelVersion, created.assumptionModelVersion);
assert.deepStrictEqual([...created.localAuditEvent.changedFields].sort(), Object.keys(base.inputs).sort());
assert.doesNotThrow(() => validateSavedDealRecord(created));
assert.strictEqual(Object.prototype.hasOwnProperty.call(created.inputs, 'localAuditEvent'), false);

const updated = prepareUpdatedUiDealForSave({ ...base, savedAt: '2026-09-16T11:20:00.000Z' }, created.assumptionModelVersion);
assert.strictEqual(updated.localAuditEvent.actionType, 'VERSION_SAVED');
assert.strictEqual(updated.localAuditEvent.trailType, 'LOCAL_HISTORY');
assert.strictEqual(updated.localAuditEvent.enterpriseAuditTrail, false);
assert.strictEqual(updated.localAuditEvent.modelVersion, created.assumptionModelVersion);
assert.doesNotThrow(() => validateSavedDealRecord(updated));

const tampered = {
  ...created,
  localAuditEvent: { ...created.localAuditEvent, enterpriseAuditTrail: true },
};
assert.throws(
  () => validateSavedDealRecord(tampered),
  (error) => error instanceof SavedDealValidationError && error.reasonCode === 'INVALID_LOCAL_AUDIT_EVENT',
);

const nested = {
  ...base,
  inputs: { ...base.inputs, localAuditEvent: created.localAuditEvent },
};
assert.throws(
  () => validateSavedDealRecord(nested),
  (error) => error instanceof SavedDealValidationError && error.reasonCode === 'LOCAL_AUDIT_EVENT_IN_ECONOMIC_INPUTS',
);

console.log('UI_AUDIT_EVENT_INTEGRATION_TESTS=PASS');
