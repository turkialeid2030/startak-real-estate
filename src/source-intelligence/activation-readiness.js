'use strict';

const SOURCE_STATUS = Object.freeze({
  LIVE_READY: 'LIVE_READY',
  HOLD_CONNECTION: 'HOLD_CONNECTION',
  HOLD_LICENSE: 'HOLD_LICENSE',
  HOLD_VERIFICATION: 'HOLD_VERIFICATION',
  MANUAL_REFERENCE_ONLY: 'MANUAL_REFERENCE_ONLY',
});

function assessSourceActivation(source) {
  if (!source || typeof source !== 'object') throw new TypeError('source is required');
  const sourceId = String(source.source_id || source.sourceId || '').trim();
  if (!sourceId) throw new TypeError('source_id is required');

  const connectorStatus = String(source.connector_status || source.connectorStatus || 'UNKNOWN');
  const licenseStatus = String(source.license_status || source.licenseStatus || 'NOT_ASSESSED');
  const liveAccess = Boolean(source.live_access ?? source.liveAccess);
  const lastVerified = source.last_verified || source.lastVerified || null;
  const fallback = String(source.fallback || 'NONE');

  if (fallback === 'MANUAL_REFERENCE_ONLY' && !liveAccess) {
    return Object.freeze({ sourceId, status: SOURCE_STATUS.MANUAL_REFERENCE_ONLY, canClaimLive: false, reason: 'REGISTRY_MARKED_MANUAL_REFERENCE_ONLY' });
  }
  if (connectorStatus !== 'CONNECTED' || !liveAccess) {
    return Object.freeze({ sourceId, status: SOURCE_STATUS.HOLD_CONNECTION, canClaimLive: false, reason: 'LIVE_CONNECTOR_NOT_VERIFIED' });
  }
  if (!['APPROVED', 'LICENSED', 'PERMITTED', 'NOT_REQUIRED'].includes(licenseStatus)) {
    return Object.freeze({ sourceId, status: SOURCE_STATUS.HOLD_LICENSE, canClaimLive: false, reason: 'AUTOMATED_USE_PERMISSION_NOT_VERIFIED' });
  }
  if (!lastVerified) {
    return Object.freeze({ sourceId, status: SOURCE_STATUS.HOLD_VERIFICATION, canClaimLive: false, reason: 'LAST_VERIFIED_MISSING' });
  }
  return Object.freeze({ sourceId, status: SOURCE_STATUS.LIVE_READY, canClaimLive: true, reason: 'CONNECTION_PERMISSION_AND_VERIFICATION_PRESENT', lastVerified: String(lastVerified) });
}

function assessRegistryActivation(registry) {
  if (!Array.isArray(registry) || registry.length === 0) throw new TypeError('registry must be non-empty');
  const results = registry.map(assessSourceActivation);
  return Object.freeze({
    total: results.length,
    liveReady: results.filter((r) => r.status === SOURCE_STATUS.LIVE_READY).length,
    manualReferenceOnly: results.filter((r) => r.status === SOURCE_STATUS.MANUAL_REFERENCE_ONLY).length,
    holds: results.filter((r) => !r.canClaimLive && r.status !== SOURCE_STATUS.MANUAL_REFERENCE_ONLY).length,
    results: Object.freeze(results),
  });
}

module.exports = { SOURCE_STATUS, assessSourceActivation, assessRegistryActivation };
