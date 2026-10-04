'use strict';

const {
  getCanonicalSourceProvider,
  sourceUrlMatchesProvider,
} = require('./source-provider-registry');

const ACCESS_MODE = Object.freeze({
  PUBLIC_WEB: 'PUBLIC_WEB',
  USER_AUTHENTICATED: 'USER_AUTHENTICATED',
  DOCUMENT_OR_FILE: 'DOCUMENT_OR_FILE',
});

const ACQUISITION_METHOD = Object.freeze({
  DIRECT_HTTPS_FETCH: 'DIRECT_HTTPS_FETCH',
  OFFICIAL_FILE_DOWNLOAD: 'OFFICIAL_FILE_DOWNLOAD',
  PUBLIC_BROWSER_RENDER: 'PUBLIC_BROWSER_RENDER',
  SITEMAP_RSS_DISCOVERY: 'SITEMAP_RSS_DISCOVERY',
  USER_AUTHORIZED_BROWSER_SESSION: 'USER_AUTHORIZED_BROWSER_SESSION',
  USER_AUTHORIZED_EXPORT: 'USER_AUTHORIZED_EXPORT',
  MANUAL_ASSISTED_CAPTURE: 'MANUAL_ASSISTED_CAPTURE',
  MANUAL_UPLOAD: 'MANUAL_UPLOAD',
});

const ATTEMPT_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
});

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function methodSequence(accessMode, contentHints = []) {
  const hints = new Set(Array.isArray(contentHints) ? contentHints : []);
  if (accessMode === ACCESS_MODE.USER_AUTHENTICATED) {
    return [
      ACQUISITION_METHOD.USER_AUTHORIZED_BROWSER_SESSION,
      ACQUISITION_METHOD.USER_AUTHORIZED_EXPORT,
      ACQUISITION_METHOD.MANUAL_ASSISTED_CAPTURE,
      ACQUISITION_METHOD.MANUAL_UPLOAD,
    ];
  }
  if (accessMode === ACCESS_MODE.DOCUMENT_OR_FILE) {
    return [
      ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD,
      ACQUISITION_METHOD.MANUAL_UPLOAD,
      ACQUISITION_METHOD.MANUAL_ASSISTED_CAPTURE,
    ];
  }
  const seq = [];
  if (hints.has('DOWNLOAD') || hints.has('PDF') || hints.has('CSV') || hints.has('XLSX')) {
    seq.push(ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD);
  }
  seq.push(ACQUISITION_METHOD.DIRECT_HTTPS_FETCH);
  if (!seq.includes(ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD)) seq.push(ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD);
  seq.push(
    ACQUISITION_METHOD.PUBLIC_BROWSER_RENDER,
    ACQUISITION_METHOD.SITEMAP_RSS_DISCOVERY,
    ACQUISITION_METHOD.MANUAL_ASSISTED_CAPTURE,
    ACQUISITION_METHOD.MANUAL_UPLOAD,
  );
  return seq;
}

function createPrivateAlphaAcquisitionPlan({ sourceProvider, sourceUrl, accessMode, contentHints = [] } = {}) {
  const provider = getCanonicalSourceProvider(sourceProvider);
  const blockers = [];
  if (!provider) blockers.push('SOURCE_PROVIDER_NOT_GOVERNED');
  if (!Object.values(ACCESS_MODE).includes(accessMode)) blockers.push('ACCESS_MODE_INVALID');
  if (!isHttpsUrl(sourceUrl)) blockers.push('HTTPS_SOURCE_URL_REQUIRED');
  if (provider && isHttpsUrl(sourceUrl) && !sourceUrlMatchesProvider(provider, sourceUrl)) blockers.push('SOURCE_URL_PROVIDER_MISMATCH');

  const methods = blockers.length ? [] : methodSequence(accessMode, contentHints);
  return freezeDeep({
    capability: 'C51_PRIVATE_ALPHA_NON_API_ACQUISITION_V1',
    operatingMode: 'PRIVATE_ALPHA',
    sourceProvider: sourceProvider || null,
    sourceUrl: typeof sourceUrl === 'string' ? sourceUrl.trim() : null,
    accessMode: Object.values(ACCESS_MODE).includes(accessMode) ? accessMode : null,
    providerOrganization: provider?.organization || null,
    sourceTier: provider?.sourceTier || null,
    apiRequired: false,
    apiPreferred: false,
    fallbackEnabled: true,
    methods,
    safety: {
      credentialBypassAllowed: false,
      captchaBypassAllowed: false,
      accessControlEvasionAllowed: false,
      rateLimitEvasionAllowed: false,
      hiddenEndpointDiscoveryRequired: false,
      authenticatedSessionMustBeUserAuthorized: accessMode === ACCESS_MODE.USER_AUTHENTICATED,
    },
    evidenceCapture: {
      sourceUrl: true,
      retrievedAt: true,
      artifactHashSha256: true,
      extractedPayloadHashSha256: true,
      method: true,
      provenanceHandoff: 'C2N/C2S',
    },
    blockers,
    ready: blockers.length === 0,
  });
}

function selectNextAcquisitionAttempt(plan, outcomes = []) {
  if (!plan || plan.ready !== true || !Array.isArray(plan.methods)) {
    return freezeDeep({ status: 'BLOCKED', method: null, reason: 'PLAN_NOT_READY' });
  }
  const normalized = Array.isArray(outcomes) ? outcomes : [];
  const success = normalized.find((x) => x && x.status === ATTEMPT_STATUS.SUCCESS && plan.methods.includes(x.method));
  if (success) {
    return freezeDeep({ status: 'COMPLETE', method: success.method, reason: 'ACQUISITION_SUCCEEDED' });
  }
  const attempted = new Set(normalized.filter(Boolean).map((x) => x.method));
  const next = plan.methods.find((method) => !attempted.has(method));
  if (!next) return freezeDeep({ status: 'EXHAUSTED', method: null, reason: 'ALL_NON_API_METHODS_EXHAUSTED' });
  return freezeDeep({ status: 'NEXT', method: next, reason: 'TRY_NEXT_ALLOWED_NON_API_METHOD' });
}

function validateAcquisitionExecutionSafety(execution = {}) {
  const blockers = [];
  if (execution.credentialBypassUsed === true) blockers.push('CREDENTIAL_BYPASS_FORBIDDEN');
  if (execution.captchaBypassUsed === true) blockers.push('CAPTCHA_BYPASS_FORBIDDEN');
  if (execution.accessControlEvasionUsed === true) blockers.push('ACCESS_CONTROL_EVASION_FORBIDDEN');
  if (execution.rateLimitEvasionUsed === true) blockers.push('RATE_LIMIT_EVASION_FORBIDDEN');
  if (execution.accessMode === ACCESS_MODE.USER_AUTHENTICATED && execution.userAuthorizedSession !== true) {
    blockers.push('USER_AUTHORIZED_SESSION_REQUIRED');
  }
  return freezeDeep({ safe: blockers.length === 0, blockers });
}

module.exports = Object.freeze({
  ACCESS_MODE,
  ACQUISITION_METHOD,
  ATTEMPT_STATUS,
  createPrivateAlphaAcquisitionPlan,
  selectNextAcquisitionAttempt,
  validateAcquisitionExecutionSafety,
});
